# Ads.txt / App-ads.txt line Validator-checker (Chrome Extension)

A specialized Chrome Extension for AdOps professionals to validate specific `ads.txt` and `app-ads.txt` lines across multiple domains simultaneously. 

Unlike simple "existence checkers," this tool parses the content of the files and verifies if specific Reference Lines (Publisher IDs and Account Types) are present and correct on the target domains.

![Version](https://img.shields.io/badge/version-1.0-blue)
![Platform](https://img.shields.io/badge/platform-Chrome-green)

## Features

* **Bulk Validation:** Scan lists of domains against a set of expected rules.
* **Dual Mode:** Supports both `ads.txt` (Web) and `app-ads.txt` (Mobile Apps).
* **Deep Content Parsing:** * Verifies **Domain**, **Publisher ID**, and **Account Type** (DIRECT/RESELLER).
    * Detects mismatched types (e.g., finding RESELLER when expecting DIRECT).
* **Smart Network Handling:**
    * Bypasses CORS restrictions using browser native fetch.
    * Automatically handles "Soft 404s" (HTML pages returned instead of text files).
    * Retries connections on timeout.
* **Reporting:**
    * Color-coded status (Valid, Partial Match, Error, Missing).
    * Filter view to show only errors/warnings.
    * **CSV Export** for detailed reporting.

## Installation

Since this is a private internal tool, it must be installed in Developer Mode:

1.  Download all extension files (`manifest.json`, `background.js`, `popup.html`, `popup.js`, `icon.png`) into a single folder named `AdsTxtValidator`.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (toggle switch in the top right corner).
4.  Click **Load unpacked** (button in the top left).
5.  Select the `AdsTxtValidator` folder.
6.  The extension should now appear in your browser toolbar.

## How to Use

1.  Click the extension icon to open the main window.
2.  **Configure Settings:**
    * **File Type:** Select `ads.txt` or `app-ads.txt`.
    * **Filter:** Choose "Show All Results" or "Errors / Warnings Only".
3.  **Enter Target Websites (Left Panel):**
    * Paste the list of domains you want to scan.
    * Format: One domain per line.
4.  **Enter Reference Lines (Right Panel):**
    * Paste the lines you expect to find on those websites.
    * Format: `Domain, Publisher ID, Account Type`.
5.  Click **Start Validation**.
6.  Once the scan is complete, click **Download CSV** to save the report.

## Input Format Examples

### Target Websites
```text
nytimes.com
cnn.com
washingtonpost.com