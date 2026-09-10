# Security policy

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** form:

https://github.com/aravmdn/folio/security/advisories/new

Provide the affected commit, operating system, a minimal reproduction, expected and observed behavior, and any suggested mitigation. Use synthetic Markdown and images instead of private documents. Do not publish exploit details in a public issue before the maintainer has had an opportunity to investigate.

If the private form is unavailable, open a public issue requesting a private reporting channel **without including vulnerability details**. This is a volunteer project; no response or fix deadline is guaranteed.

## Supported code

Security fixes target the current `main` branch. There are no maintained older release branches, packaged releases, or automatic updates. Pull current source, reinstall locked dependencies, and rebuild to obtain fixes. Only Linux is currently tested.

## Boundaries

- Markdown and embedded HTML are untrusted input. Marked parses the document and DOMPurify sanitizes the resulting HTML before display.
- The Electron renderer has Node integration disabled, context isolation enabled, and sandboxing enabled. The preload exposes specific operations instead of a general IPC or filesystem interface.
- IPC handlers check the sending web contents and frame URL. They read requested Markdown files, watch the active path, and handle recent-file state, explicitly requested PDF exports, and clipboard text.
- `folio://app/` serves built application assets. `folio-asset://local/` serves selected image formats inside the active document's directory, with real-path checks to reject escapes through symlinks.
- Renderer navigation, new windows, and permission requests are blocked. A content policy restricts resource loading. Remote Markdown images are replaced before their sources are attached to the page.
- Clicking HTTP(S) or mail links delegates them to the operating system. Relative Markdown links can open another local Markdown path; the document-directory restriction applies to **images**, not to Markdown navigation.

Folio is not a hardened document-isolation environment or a general-purpose HTML viewer. It has not undergone an independent security audit. Regression tests cover selected sanitization cases and remote image behavior, not every possible hostile input.

## Local data

Recent file names and absolute paths, preferences, and Chromium runtime data live in Electron's user-data directory. These settings are not encrypted by Folio. The current document is held in memory; Folio does not intentionally save its body as part of recent-file history. Exported PDFs are ordinary files at the location selected by the user.

See the [README](README.md#privacy-and-local-storage) for clearing history and settings.
