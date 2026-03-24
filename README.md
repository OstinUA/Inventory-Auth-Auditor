# Ads.txt / App-ads.txt Line Valid-checker

**High-signal Chrome extension for AdOps teams to validate `ads.txt` and `app-ads.txt` lines at scale with resilient network handling and audit-ready exports.**

[![Version](https://img.shields.io/badge/version-1.3.0-1f6feb?style=for-the-badge)](manifest.json)
[![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-34a853?style=for-the-badge&logo=googlechrome&logoColor=white)](manifest.json)
[![Manifest](https://img.shields.io/badge/manifest-v3-ff9800?style=for-the-badge)](manifest.json)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/status-active%20development-8a2be2?style=for-the-badge)](#)

> [!IMPORTANT]
> This tool does **line-level semantic validation**, not just file existence checks. It verifies partner domain, publisher ID, and relationship type (`DIRECT` / `RESELLER`) against your reference set.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Technical Notes](#technical-notes)
  - [Project Structure](#project-structure)
  - [Key Design Decisions](#key-design-decisions)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Usage](#usage)
- [Configuration](#configuration)
- [License](#license)
- [Contacts and Support](#contacts-and-support)

## Features

- **Bulk domain processing** with configurable batch size (`2`, `5`, `10`, `20`) for balancing speed and reliability.
- **Dual-file mode**: supports both `ads.txt` and `app-ads.txt` validation flows.
- **Reference-aware parsing**:
  - Validates `(domain, publisher-id, account-type)` tuples.
  - Detects partial matches (for example, when ID matches but account type is wrong).
- **Resilient fetch pipeline**:
  - Attempts secure and fallback protocols when needed.
  - Retries transient failures.
  - Detects soft-404 responses (HTML/JSON/XML payloads masquerading as text endpoints).
- **Data hygiene and normalization**:
  - Strips comments and zero-width chars.
  - Normalizes casing for deterministic comparisons.
  - Identifies duplicate logical records in target files.
- **Operational visibility**:
  - Progress bar, status line, and per-status counters (`Valid`, `Partial`, `Missing`, `Error`).
  - Filter mode for showing only warnings/errors.
- **Report tooling**:
  - CSV export.
  - Clipboard copy for quick ticketing or Slack handoff.
- **Metadata extraction**: surfaces optional `OWNERDOMAIN` and `MANAGERDOMAIN` hints in the result set.

> [!TIP]
> If your domain list is huge, start with smaller batch sizes to reduce false negatives from temporary network jitter.

## Tech Stack

- **Runtime / Platform**: Chrome Extension (`Manifest V3`).
- **Frontend**: Vanilla JavaScript, HTML, CSS.
- **Background execution**: Service Worker (`background.js`) for extension window bootstrap.
- **Storage**: `chrome.storage.local` for persistent UI/session state.
- **Permissions model**:
  - `storage`
  - broad `host_permissions` (`http://*/*`, `https://*/*`) for cross-domain validation checks.

## Technical Notes

### Project Structure

```text
.
├── manifest.json      # Extension metadata, permissions, entry points
├── background.js      # Opens popup in dedicated extension window
├── popup.html         # Main UI layout
├── popup.js           # Validation engine, parsing, rendering, export logic
├── style.css          # UI styles
├── icons/
│   └── icon128.png    # Extension icon
└── LICENSE
```

### Key Design Decisions

1. **Single-screen ops UX**: inputs, run controls, progress, and report grid are colocated for fast repetitive workflows.
2. **Protocol fallback strategy**: the validator can recover when HTTPS endpoint behavior differs from HTTP endpoint behavior.
3. **Soft-404 heuristics**: prevents accidentally accepting HTML error pages as valid ads inventory declarations.
4. **Normalized comparison pipeline**: avoids false mismatches caused by casing, comments, or hidden unicode characters.
5. **Error-first filtering**: high-signal mode for triage-heavy audits and campaign onboarding checks.

> [!NOTE]
> This repository is intentionally lightweight and dependency-free. There is no Node/Python runtime requirement for normal usage.

## Getting Started

### Prerequisites

- **Google Chrome** (current stable recommended).
- Local filesystem access to load an unpacked extension.
- Optional: Git for cloning and syncing updates.

### Installation

```bash
# 1) Clone the repository
git clone https://github.com/<your-org>/Ads.txt-App-ads.txt-line-Valid-checker.git
cd Ads.txt-App-ads.txt-line-Valid-checker

# 2) Open Chrome extension manager
# Navigate to: chrome://extensions/

# 3) Enable "Developer mode"
# 4) Click "Load unpacked"
# 5) Select this repository folder
```

After loading, click the extension action icon to open the validator window.

## Testing

This project currently has no formal automated test suite, but you can run robust manual validation checks.

### Functional smoke test

```text
1. Load extension in Developer mode.
2. Set File Type to ads.txt.
3. Add 2-3 known domains with known-good reference lines.
4. Click Start Validation.
5. Verify status counters and table rows are coherent.
6. Export CSV and verify output integrity.
```

### Regression checklist

- Verify `Errors / Warnings Only` hides valid rows.
- Verify `Stop` interrupts active run.
- Verify state persistence after closing/reopening extension window.
- Verify duplicate detection annotation in details column.
- Verify owner/manager metadata extraction when available.

> [!WARNING]
> Network behavior varies across targets (redirects, bot protection, WAFs). Treat isolated `Connection Error` results as potentially transient and re-run before escalating.

## Deployment

Since this is a Chrome extension, “deployment” usually means one of two flows:

### Internal/Team deployment (fast path)

1. Keep extension unpacked in a shared repository.
2. Team members pull latest changes.
3. Reload extension in `chrome://extensions/`.

### Release packaging (distribution path)

```bash
# from repository root
zip -r release.zip manifest.json background.js popup.html popup.js style.css icons LICENSE README.md CONTRIBUTING.md
```

Then upload package through your distribution channel (for example, private enterprise policy or Chrome Web Store pipeline).

> [!CAUTION]
> Validate permissions and host access scope before publishing externally.

## Usage

### Minimal workflow

```text
# Target Websites (left textarea)
example.com
news-site.tld
appvendor.tld

# Reference Lines (right textarea)
google.com, pub-1234567890, DIRECT
appnexus.com, 98765, RESELLER
```

### Operator runbook

```text
1) Pick file mode: ads.txt or app-ads.txt
2) Choose view mode: all results or errors-only
3) Tune batch size for your network conditions
4) Start validation and monitor progress/stats
5) Export CSV or copy output into incident/task tracker
```

## Configuration

This extension does not use a `.env` file.

Runtime configuration is done in the UI and persisted via `chrome.storage.local`:

- `fileType`: target file type (`ads.txt` or `app-ads.txt`).
- `viewMode`: result filtering mode (`all` or `errors`).
- `batchSize`: concurrency level for domain processing.
- `targets`: multiline domain input.
- `refs`: multiline reference tuples.

> [!NOTE]
> Persisted values are local to each browser profile.

## License

Distributed under the `GPL-3.0` License. See [`LICENSE`](LICENSE) for the full legal text.

## Contacts and Support

## ❤️ Support the Project

If you find this tool useful, consider leaving a ⭐ on GitHub or supporting the author directly:

[![Patreon](https://img.shields.io/badge/Patreon-OstinFCT-f96854?style=flat-square&logo=patreon)](https://www.patreon.com/OstinFCT)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-fctostin-29abe0?style=flat-square&logo=ko-fi)](https://ko-fi.com/fctostin)
[![Boosty](https://img.shields.io/badge/Boosty-Support-f15f2c?style=flat-square)](https://boosty.to/ostinfct)
[![YouTube](https://img.shields.io/badge/YouTube-FCT--Ostin-red?style=flat-square&logo=youtube)](https://www.youtube.com/@FCT-Ostin)
[![Telegram](https://img.shields.io/badge/Telegram-FCTostin-2ca5e0?style=flat-square&logo=telegram)](https://t.me/FCTostin)

For project maintenance topics, use repository Issues/PRs. For questions on usage patterns and audit workflows, prefer Discussions if enabled.
