# Contributing

## 1. Introduction

Thank you for your interest in contributing to this project.

This repository maintains a lightweight Chrome extension for validating `ads.txt` and `app-ads.txt` lines, with a strong bias toward deterministic parsing, operator-friendly UX, and low-maintenance implementation choices. Contributions are welcome across bug fixes, documentation, manual test improvements, UI refinements, and carefully scoped feature work.

To help maintain review velocity and release confidence, please keep changes focused, well-explained, and easy to validate. A high-quality contribution typically includes a clear problem statement, minimal surface area, updated documentation when behavior changes, and reproducible proof that the change works as intended.

## 2. I Have a Question

Please do not use the issue tracker for general usage questions, troubleshooting requests without a confirmed bug, or open-ended design discussions.

The issue tracker is reserved for:

- Reproducible defects.
- Concrete feature requests.
- Clearly scoped maintenance work.

If you have a question about how to use the extension, how to interpret validation output, or whether a workflow is supported, please use one of the following instead:

- `GitHub Discussions`, if enabled for this repository.
- `Stack Overflow`, ideally with clear tags and a minimal reproducible example.
- Your team or community support channels for AdOps, browser extension, or repository-specific discussions.

When asking for help in any community forum, include enough context for others to assist effectively:

- The extension version.
- Whether you are validating `ads.txt` or `app-ads.txt`.
- Sanitized sample target domains.
- Sanitized sample reference lines.
- What you expected to happen.
- What happened instead.

## 3. Reporting Bugs

A good bug report should be actionable, reproducible, and narrow enough that a maintainer can confirm the issue without reverse-engineering the scenario.

Before opening a bug report:

1. Search existing open issues and recently closed issues to avoid creating duplicates.
2. Confirm the issue still occurs on the latest code from the default development branch.
3. Re-test the scenario at least once to rule out transient network failures, target-side rate limiting, or temporary endpoint issues.
4. Verify that the behavior is not explained by malformed input, unsupported formatting, or expected `ads.txt` / `app-ads.txt` semantics.

Your bug report should include all of the following.

### Search Duplicates

Check whether the bug has already been reported before opening a new issue. If you find an existing report that matches your case, add your reproduction details there instead of opening a parallel issue.

### Environment

Include the full runtime context used to reproduce the bug:

- Operating system and version.
- Browser and version.
- Extension version.
- Repository revision, if testing from source.
- Any relevant language or framework versions if your workflow embeds or automates the extension in a larger toolchain.

### Steps to Reproduce

Provide an exact, step-by-step algorithm that another contributor can follow without making assumptions. The report should answer:

1. What initial state is required?
2. What inputs were pasted into each field?
3. Which settings were selected?
4. What action was triggered?
5. When does the failure appear?

Whenever possible, include sanitized but real examples of:

- Target domains.
- Reference lines.
- Exported CSV rows.
- Relevant console output from the popup or service worker.

### Expected vs. Actual Behavior

State both outcomes clearly:

- `Expected behavior`: what you believed the extension should do and why.
- `Actual behavior`: what the extension did instead, including error text, result states, incorrect classifications, or broken UI behavior.

### Recommended Bug Report Quality Bar

High-quality bug reports usually also contain:

- Screenshots or short recordings for UI defects.
- Notes on whether the issue is consistent or intermittent.
- A minimal reproducible dataset.
- A statement about impact severity, such as blocked workflow, incorrect result classification, or cosmetic regression.

Bug reports that cannot be reproduced or that omit required context may be closed until additional information is provided.

## 4. Suggesting Enhancements

Enhancement proposals are welcome, but they should be justified by a real user problem rather than a general preference.

A strong enhancement request should explain:

- What problem exists today.
- Why the current behavior is insufficient.
- What change you are proposing.
- Why the change belongs in this repository instead of external tooling.
- What operational, UX, or maintenance tradeoffs the change introduces.

### Justification

Describe the concrete pain point the feature solves. For example:

- A workflow currently requires repeated manual cleanup.
- An important validation outcome cannot be surfaced reliably.
- Operators cannot distinguish between two materially different failure modes.
- A repetitive browser action could be automated safely.

Avoid feature requests framed only as personal preference without a clear maintenance or user benefit.

### Use Cases

Provide real-world usage examples. Helpful use cases typically answer:

- Who will use the feature?
- In what workflow?
- With what input volume or operating constraints?
- What decision becomes easier, faster, or more reliable after the change?

If you are proposing an architectural change, also describe:

- Why the current architecture is insufficient.
- Expected impact on complexity, performance, permissions, or security.
- Migration considerations for existing users or maintainers.

## 5. Local Development / Setup

This repository is intentionally lightweight and does not currently rely on a package manager, compiled build pipeline, or environment-specific application server. Development primarily consists of editing the extension source and loading it unpacked in Chrome.

### Fork and Clone

1. Fork the repository to your own GitHub account.
2. Clone your fork locally.
3. Add the upstream remote so you can sync changes later.

```bash
git clone https://github.com/<your-username>/Ads.txt-App-ads.txt-line-Valid-checker.git
cd Ads.txt-App-ads.txt-line-Valid-checker
git remote add upstream https://github.com/<upstream-owner>/Ads.txt-App-ads.txt-line-Valid-checker.git
```

### Dependencies

There are no mandatory runtime dependencies to install for normal development at this time.

If you choose to use optional local quality tools, install them manually in your own environment, for example:

```bash
npm install
pip install -r requirements.txt
```

Use those commands only if you add and document the corresponding toolchain as part of your contribution. Do not assume Node.js or Python tooling exists unless your branch explicitly introduces it and the maintainers have agreed to it.

### Environment Variables

This project does not currently use required environment variables for local development.

If a future contribution introduces environment-driven behavior, it must also include:

1. A checked-in `.env.example` file.
2. Documentation for each variable.
3. Safe defaults where possible.
4. Clear setup instructions such as:

```bash
cp .env.example .env
```

Do not commit secrets, tokens, credentials, or organization-specific internal endpoints.

### Running Locally

Load the extension as an unpacked Chrome extension:

```text
1. Open chrome://extensions/
2. Enable Developer mode
3. Click Load unpacked
4. Select the repository root directory
5. Reload the extension after each code change
```

Recommended local validation workflow:

1. Open the extension UI.
2. Test both `ads.txt` and `app-ads.txt` modes when applicable.
3. Exercise success, mismatch, missing, and network-failure scenarios.
4. Verify persistence in `chrome.storage.local` after reopening the extension.
5. Confirm export and clipboard behaviors still work.

## 6. Pull Request Process

Pull requests should be small, focused, and easy to review. If a change mixes unrelated concerns such as refactoring, feature work, and documentation cleanup, it is likely to slow review and increase merge risk.

### Branching Strategy

Create all work on a dedicated topic branch. Use the following naming conventions:

- `feature/<short-description>` for new capabilities.
- `bugfix/<issue-number-or-short-description>` for defect fixes.
- `docs/<short-description>` for documentation-only changes.
- `chore/<short-description>` for maintenance work.
- `refactor/<short-description>` for behavior-preserving structural cleanup.

Examples:

- `feature/export-summary-metadata`
- `bugfix/142-soft-404-detection`
- `docs/contributing-guide`

### Commit Messages

This repository uses the Conventional Commits specification. Structure commit messages as:

```text
<type>: <concise summary>
```

Common commit types include:

- `feat: add ownerdomain parsing fallback`
- `fix: prevent invalid domain rows from masking fetch errors`
- `docs: expand contribution workflow`
- `refactor: isolate result rendering helpers`
- `test: add regression coverage notes`
- `chore: align manifest metadata`

Please keep commit messages imperative, concise, and behavior-oriented.

### Upstream Synchronization

Before opening or updating a pull request:

1. Fetch the latest changes from `upstream`.
2. Rebase or merge the current default branch into your branch.
3. Resolve conflicts locally.
4. Re-run your validation workflow.

Typical commands:

```bash
git fetch upstream
git checkout main
git pull --ff-only upstream main
git checkout <your-branch>
git rebase main
```

### PR Description

Your pull request body should include:

- A concise summary of the change.
- The motivation or problem statement.
- Links to related issues, discussions, or prior context.
- Notes on any architectural or UX tradeoffs.
- Proof of testing, such as manual test scenarios or automated results.
- Screenshots or recordings for visible UI changes.
- Any follow-up work that is intentionally out of scope.

If the pull request changes behavior, update documentation in the same branch whenever practical.

## 7. Styleguides

Contributors are expected to preserve the repository's low-dependency, browser-native architecture.

### Code Quality and Formatting

This project does not currently ship a mandatory formatter or linter configuration. If you touch code, follow the existing style consistently:

- Use clear, readable vanilla JavaScript.
- Prefer small, purpose-driven functions.
- Keep DOM interaction and state updates straightforward.
- Avoid introducing unnecessary abstractions or framework patterns.
- Keep user-facing copy explicit and operationally useful.

### Linters and Formatters

There is no enforced repository configuration today for tools such as `ESLint`, `Prettier`, `Black`, or `Flake8`.

That means:

- Do not assume those tools are available in CI.
- Do not introduce them opportunistically in an unrelated pull request.
- If you propose adding a formatter or linter, discuss it first and document the exact commands and configuration.

### Architectural and Naming Conventions

Please follow these project conventions:

- Keep the extension dependency-free unless there is strong justification.
- Preserve `Manifest V3` compatibility.
- Prefer deterministic parsing over permissive heuristics when validation accuracy is at stake.
- Keep UI logic, fetch logic, and parsing logic easy to trace during debugging.
- Use descriptive names for functions, DOM references, and result states.
- Avoid broad refactors unless they are directly required to solve the targeted problem.

Documentation changes should also be written in clear technical English and should favor reproducible instructions over broad narrative prose.

## 8. Testing

All new code, behavior changes, and bug fixes must be accompanied by relevant testing evidence.

Because the repository does not currently provide a formal automated test suite, contributors are expected to perform and document manual validation. If you add automated tests in a future contribution, include the new test commands in both the pull request and repository documentation.

### Required Validation Expectations

At a minimum, validate the scenario your change affects and confirm there are no obvious regressions in nearby behavior.

Recommended manual coverage includes:

- A known valid match that should return `Valid`.
- A reference mismatch that should return `Partial`.
- A missing entry that should return `Not Found`.
- A network or unreachable target scenario that should return `Error`.
- CSV export verification.
- Clipboard copy verification.
- State persistence verification after reopening the extension.

### Local Test Commands

There is no project-wide automated test command at this time.

Use the following repository-level command to package the extension contents as a basic integrity check:

```bash
zip -r release.zip manifest.json background.js popup.html popup.js style.css icons LICENSE README.md CONTRIBUTING.md
```

Then run a manual test pass by loading the unpacked extension in Chrome and exercising the workflows described above.

If your pull request introduces an automated test suite, document the exact commands explicitly, for example:

```bash
npm test
npm run lint
python -m pytest
```

Only list commands that actually exist in your branch.

## 9. Code Review Process

After you open a pull request, maintainers will review the change for correctness, scope control, regression risk, and project fit.

### What Happens After Opening a PR

1. A maintainer or reviewer performs an initial triage.
2. The change is checked for scope, clarity, and reproducibility.
3. Review feedback is left inline or in summary comments.
4. The author addresses feedback with additional commits or clarifying responses.
5. Once the review criteria are satisfied, the pull request may be merged.

### Who Reviews and Approval Expectations

- Repository maintainers are responsible for final review and merge decisions.
- At least one maintainer approval is expected before merge.
- Additional review may be requested for larger UX, architectural, or behavior-sensitive changes.

### Addressing Feedback

When responding to review comments:

- Reply with the technical rationale for your change when needed.
- Make targeted follow-up commits rather than unrelated cleanup.
- Re-request review after substantial updates.
- Do not mark conversations resolved until the requested change or explanation has been provided.

A pull request may be asked to split into smaller follow-ups if it is too broad, too risky, or too difficult to validate efficiently.

Thank you again for contributing and for helping keep the project maintainable, reliable, and easy to review.
