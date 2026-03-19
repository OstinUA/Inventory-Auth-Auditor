# API Reference

## Overview

This project does **not** expose a first-party REST API from this repository. It is a Chrome extension that consumes publisher-hosted `ads.txt` and `app-ads.txt` resources in order to validate inventory authorization lines against an operator-supplied reference set.

From an HTTP integration perspective, the extension interacts with a small external resource contract:

- `GET /ads.txt`
- `GET /app-ads.txt`

These resources are requested on arbitrary target domains entered by the operator. The validator first attempts HTTPS and, if that request fails, falls back to HTTP.

### Base URL

Because the extension works against user-supplied publisher domains, there is no single fixed origin. The effective base URL pattern is:

| Environment | Base URL |
| --- | --- |
| Production | `https://{target-domain}` |
| Fallback / legacy transport | `http://{target-domain}` |
| Staging | Not defined by this repository |

Example target origins:

- `https://example.com`
- `http://example.com`

## Authentication

No authentication is required or supported by the external resources consumed by this extension.

The extension performs anonymous `GET` requests and does not attach bearer tokens, API keys, OAuth credentials, or custom authorization headers.

### Example Request Headers

```http
GET /ads.txt HTTP/1.1
Host: example.com
Cache-Control: no-store
```

## Endpoints

### GET /ads.txt

**Description:** Retrieves the publisher's `ads.txt` declaration file from the target domain root so the extension can parse and validate `(advertising-system-domain, publisher-id, relationship-type)` tuples.

#### Path Parameters & Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `target-domain` (host) | string | Yes | Publisher domain supplied by the operator. The extension normalizes the input by removing protocol, `www.`, and any path/query fragments before requesting `/{filename}`. |

This endpoint does not use path parameters beyond the fixed `/ads.txt` path and does not send query parameters.

#### Request Body

No request body.

#### Responses

##### `200 OK`

A successful response is expected to be plain-text content, typically with MIME types such as `text/plain` or `text/csv`. The extension parses the body line by line, strips comments, removes zero-width characters, and extracts optional `OWNERDOMAIN` / `MANAGERDOMAIN` metadata.

Example successful payload:

```text
google.com, pub-1234567890, DIRECT
appnexus.com, 98765, RESELLER
OWNERDOMAIN=example.com
MANAGERDOMAIN=manager.example
```

Example normalized validation result produced by the extension after processing the file:

```json
{
  "target": "example.com",
  "reference": "google.com, pub-1234567890, DIRECT",
  "status": "Valid",
  "details": "Matched",
  "owner": "Owner: example.com, Manager: manager.example",
  "isError": false
}
```

##### Common Error Responses

| Status | Meaning |
| --- | --- |
| `400 Bad Request` | Not emitted by the remote file itself, but the extension treats malformed target input as an invalid domain before requesting the resource. |
| `401 Unauthorized` | Uncommon for public `ads.txt`, but any non-OK HTTP status is treated as a fetch failure. |
| `404 Not Found` | The target domain does not expose `/ads.txt`. |
| `500 Internal Server Error` | The remote host failed while serving the file. |
| Network / timeout error | The extension times out a request after approximately 12 seconds per attempt and retries up to 3 times per transport. |
| Soft 404 | HTML, JSON, or XML payloads masquerading as a text file are rejected as `Soft 404 / Not a text file`. |

Example error-shaped validation result:

```json
{
  "target": "example.com",
  "reference": "google.com, pub-1234567890, DIRECT",
  "status": "Error",
  "details": "Soft 404 / Not a text file",
  "owner": "",
  "isError": true
}
```

### GET /app-ads.txt

**Description:** Retrieves the publisher's `app-ads.txt` declaration file from the target domain root so the extension can validate mobile or app inventory authorization lines against the operator's reference dataset.

#### Path Parameters & Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `target-domain` (host) | string | Yes | Publisher domain supplied by the operator. The extension normalizes the host before requesting `/app-ads.txt`. |

This endpoint does not use query parameters.

#### Request Body

No request body.

#### Responses

##### `200 OK`

A successful response is expected to be a plain-text `app-ads.txt` file.

Example successful payload:

```text
google.com, pub-1234567890, DIRECT
adnetwork.example, 998877, RESELLER
OWNERDOMAIN=appvendor.example
```

Example normalized validation result produced by the extension after processing the file:

```json
{
  "target": "appvendor.example",
  "reference": "adnetwork.example, 998877, RESELLER",
  "status": "Partial",
  "details": "Type Mismatch: found DIRECT, expected RESELLER",
  "owner": "Owner: appvendor.example",
  "isError": true
}
```

##### Common Error Responses

| Status | Meaning |
| --- | --- |
| `400 Bad Request` | Input host is malformed and rejected by local validation before a network call is made. |
| `401 Unauthorized` | Any non-OK response is surfaced as an HTTP fetch error. |
| `404 Not Found` | The remote host does not publish `/app-ads.txt`. |
| `500 Internal Server Error` | The remote host encountered an unexpected error. |
| Network / timeout error | Connection failures, aborts, and repeated timeouts are surfaced as validation errors. |
| Soft 404 | Non-plain-text responses are rejected even if the HTTP request itself succeeds. |

Example error-shaped validation result:

```json
{
  "target": "appvendor.example",
  "reference": "adnetwork.example, 998877, RESELLER",
  "status": "Error",
  "details": "Connection Error",
  "owner": "",
  "isError": true
}
```

## Rate Limiting & Pagination

### Rate Limiting

This repository does not define a server-side rate limiting policy because it does not host an API service.

Client-side concurrency is controlled by the extension's `Batch Size` setting, which determines how many target domains are processed in parallel during a validation run. Supported batch sizes exposed by the UI are:

- `2`
- `5`
- `10`
- `20`

The extension also applies retry logic:

- Up to `3` attempts per URL fetch.
- Approximately `12` seconds timeout per attempt.
- HTTPS is attempted first, then HTTP fallback is used when HTTPS fails.

### Pagination

Pagination is not applicable.

- `GET /ads.txt` and `GET /app-ads.txt` return complete text resources.
- The extension downloads and parses the full file in a single request.
- No cursor-based or offset-based pagination semantics are implemented by this repository.
