"""Create GitHub issues and optional PR comments from model analysis.

This script runs in GitHub Actions for push and pull_request events.
It collects a diff, sends it to the configured model, and creates an issue
from the structured response. For pull requests, it also posts a short
summary comment back to the PR.
"""

import os
import json
import re
import time
import requests
from github import Github, Auth

# Shared environment configuration.
gh_token = os.environ.get("GITHUB_TOKEN")
model_token = os.environ.get("GH_MODELS_TOKEN")
repo_name = os.environ.get("REPOSITORY")
event_name = os.environ.get("EVENT_NAME")
allowed_users = [u.strip().lower() for u in os.environ.get("ALLOWED_USER", "").split(",")]

MODEL_NAME = "Llama-3.3-70B-Instruct"
ENDPOINT = "https://models.inference.ai.azure.com/chat/completions"

# Reuse a single authenticated GitHub client.
auth = Auth.Token(gh_token)
gh = Github(auth=auth)
repo = gh.get_repo(repo_name)

# Event-derived mutable state.
diff_text = ""
event_context = ""
author_login = ""
trigger_labels = []
dedup_key = ""
pr_ref = None

# Collect event-specific metadata and diff content.
if event_name == "push":
    commit_sha = os.environ.get("COMMIT_SHA")
    commit = repo.get_commit(commit_sha)

    # Skip merge commits here to avoid duplicate analysis with PR runs.
    if len(commit.parents) > 1:
        exit(0)
    if not commit.author:
        exit(0)

    author_login = commit.author.login.strip().lower()
    if author_login not in allowed_users:
        exit(0)

    # Treat merge commits that reference a PR as already analyzed in PR flow.
    pr_match = re.search(r'\(#(\d+)\)', commit.commit.message)
    if pr_match:
        dedup_key = f"PR #{pr_match.group(1)}"
    else:
        dedup_key = f"commit:{commit_sha[:7]}"

    event_context = f"Commit Message: {commit.commit.message}"
    # Labels are extracted from commit message brackets, e.g. [security].
    trigger_labels = [m.lower() for m in re.findall(r'\[(.*?)\]', commit.commit.message)]

    # Cap diff size to keep model input bounded.
    for file in commit.files:
        diff_text += f"File: {file.filename}\nPatch:\n{file.patch}\n\n"
        if len(diff_text) > 10000:
            diff_text += "\n[Diff truncated...]"
            break

elif event_name == "pull_request":
    pr_number = int(os.environ.get("PR_NUMBER"))
    pr = repo.get_pull(pr_number)
    author_login = pr.user.login.strip().lower()
    if author_login not in allowed_users:
        exit(0)

    # Keep a PR reference for posting a summary comment later.
    pr_ref = pr
    dedup_key = f"PR #{pr_number}"
    event_context = f"PR Title: {pr.title}\nPR Body: {pr.body}"
    trigger_labels = [label.name.lower() for label in pr.labels]

    # Cap diff size to keep model input bounded.
    for file in pr.get_files():
        diff_text += f"File: {file.filename}\nPatch:\n{file.patch}\n\n"
        if len(diff_text) > 80000:
            diff_text += "\n[Diff truncated...]"
            break
else:
    # Ignore unsupported event types without failing the workflow.
    exit(0)

# Skip tiny diffs that are unlikely to produce useful analysis.
if len(diff_text.strip()) < 50:
    print("Diff too small to analyze. Skipping.")
    exit(0)

# Avoid creating duplicate issues for the same event key.
for issue in repo.get_issues(state="all"):
    if dedup_key in (issue.body or ""):
        print(f"Issue for {dedup_key} already exists (#{issue.number}), skipping.")
        exit(0)


def was_already_closed(title_keyword: str) -> bool:
    """Return True when a similar closed issue title already exists."""
    for issue in repo.get_issues(state="closed"):
        if title_keyword.lower() in (issue.title or "").lower():
            print(f"Similar closed issue found: #{issue.number} — skipping.")
            return True
    return False


def build_permalink(filename: str, line: int = 1) -> str:
    """Build a GitHub permalink for a file path and line number."""
    sha = os.environ.get("COMMIT_SHA") or ""
    # Fall back to PR head SHA when running from a pull_request event.
    if not sha and pr_ref:
        sha = pr_ref.head.sha
    return f"https://github.com/{repo_name}/blob/{sha}/{filename}#L{line}"


# Schema constraints included in every model prompt.
base_instructions = """
Return only a raw JSON object with no markdown formatting. The JSON must have these exact keys:

"issue_title": string — include severity prefix like [CRITICAL], [HIGH], [MEDIUM], or [LOW] at the start,
"severity": string — one of: critical, high, medium, low,
"issue_body": string — must include these sections:
  ## Problem
  (clear description with exact file paths and line numbers if known)

  ## Code Reference
  (the exact problematic code snippet)

  ## Suggested Fix
  (concrete code or steps to fix)

  ## Permalink
  (placeholder: PUT_PERMALINK_HERE — will be replaced automatically)

"labels": list of strings — standard GitHub labels plus the severity level,
"affected_file": string — the most relevant filename from the diff (or "" if unknown),
"affected_line": integer — approximate line number of the issue (or 1 if unknown),
"summary": string — 2-3 sentence plain-English summary for the PR comment

The issue_title, issue_body and summary MUST be written entirely in English.
"""

# Choose a prompt persona from trigger labels; default to documentation summary.
if any(l in trigger_labels for l in ["sec", "security", "audit"]):
    prompt = f"Act as a Strict Security Auditor. Perform a deep security audit (OWASP Top 10). Find real vulnerabilities with exact file/line references.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["review", "refactor", "code-review"]):
    prompt = f"Act as a Strict Code Reviewer. Analyze code quality (SOLID/DRY). Point to exact lines that violate principles.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["qa", "test", "testing"]):
    prompt = f"Act as a QA Engineer. Identify edge cases and missing test coverage. Reference exact functions/lines.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["perf", "performance", "optimize"]):
    prompt = f"Act as a Performance Expert. Analyze bottlenecks and O(n) complexity issues with exact line references.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["pm", "release", "product"]):
    prompt = f"Act as a Product Manager. Generate user-facing Release Notes with clear impact descriptions.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["deps", "dependencies"]):
    prompt = f"Act as a Security & Dependency Auditor. Analyze all new or changed dependencies: check for known vulnerabilities (CVEs), license compatibility (MIT/Apache/GPL), package size impact, and whether each dep is actively maintained. Reference exact file and line where dep is added.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["arch", "architecture"]):
    prompt = f"Act as a Software Architect. Review the code changes for architectural issues: violation of separation of concerns, tight coupling, wrong layer dependencies, anti-patterns (God object, spaghetti logic, magic numbers). Reference exact files and lines.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
else:
    prompt = f"""Analyze the following code changes and create a documentation issue summarizing what was changed and why.
IMPORTANT: Do NOT invent security issues, bugs, or problems that do not exist in the diff.
If the changes are trivial (e.g. adding imports, minor refactoring), set severity to LOW and describe only what actually changed.
Context: {event_context}
Changes: {diff_text}
{base_instructions}"""


def call_model(prompt: str, retries: int = 3, delay: int = 5) -> dict:
    """Call the model endpoint and parse the JSON response."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {model_token}"
    }
    payload = {
        "messages": [
            {"role": "system", "content": "You are a professional software auditor. Always return valid JSON only. No markdown, no explanation, just the JSON object."},
            {"role": "user", "content": prompt}
        ],
        "model": MODEL_NAME,
        # Keep output deterministic so retries are less likely to drift.
        "temperature": 0.1
    }

    for attempt in range(retries):
        try:
            resp = requests.post(ENDPOINT, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            raw = data['choices'][0]['message']['content'].strip()
            # Some model versions still wrap JSON in markdown fences.
            raw = re.sub(r'^```json\s*|```$', '', raw, flags=re.MULTILINE).strip()
            return json.loads(raw)
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay)

    print("All attempts failed. Exiting gracefully.")
    exit(0)


# Generate issue content and publish results to GitHub.
result = call_model(prompt)

# Use a prefix match to tolerate minor title wording changes.
title_keyword = result.get("issue_title", "")[:40]
if was_already_closed(title_keyword):
    exit(0)

affected_file = result.get("affected_file", "")
affected_line = result.get("affected_line", 1)

# Replace placeholder permalink with a concrete file link when available.
if affected_file:
    permalink = build_permalink(affected_file, affected_line)
    issue_body = result["issue_body"].replace("PUT_PERMALINK_HERE", permalink)
else:
    issue_body = result["issue_body"].replace("PUT_PERMALINK_HERE", "_No specific file identified_")

# Include source context for traceability.
footer = f"\n\n---\n*Generated from {dedup_key}*"

# Normalize severity into a standard label set.
severity = result.get("severity", "medium").lower()
severity_label_map = {
    "critical": "severity: critical",
    "high":     "severity: high",
    "medium":   "severity: medium",
    "low":      "severity: low",
}
extra_labels = [severity_label_map.get(severity, "severity: medium")]
# Merge suggested labels with the required severity label.
all_labels = list(set(result.get("labels", []) + extra_labels))

issue = repo.create_issue(
    title=result["issue_title"],
    body=issue_body + footer,
    labels=all_labels
)
print(f"Created issue #{issue.number}: {issue.title}")

# Add a short PR comment so reviewers can see the summary inline.
if pr_ref:
    summary = result.get("summary", "")
    if summary:
        pr_comment = (
            f"### AI Analysis Summary\n\n"
            f"{summary}\n\n"
            f"**Severity:** `{severity.upper()}`\n\n"
            f"Full details: #{issue.number}"
        )
        pr_ref.create_issue_comment(pr_comment)
        print(f"Posted summary comment to PR #{pr_ref.number}")
