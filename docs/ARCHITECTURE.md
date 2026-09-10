# Architecture

Folio is an Electron app with a Vite-built, plain JavaScript renderer. It has no application server or remote backend. UI assets are bundled locally, including the parser, sanitizer, highlighter, and icons.

## Code map

| Path                          | Responsibility                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `electron/main.cjs`           | Window, menus, dialogs, file reading/watching, recent paths, protocols, IPC, links, and PDF export |
| `electron/preload.cjs`        | The isolated `window.folio` bridge                                                                 |
| `src/main.js`                 | Renderer state, Markdown transformation, outline, search, and controls                             |
| `src/style.css`               | Themes, responsive layout, typography, syntax colors, and printing                                 |
| `src/welcome.js`              | The built-in sample Markdown document                                                              |
| `public/icon.svg`             | Application artwork                                                                                |
| `scripts/install-local.mjs`   | Linux launcher and desktop-entry installation                                                      |
| `scripts/uninstall-local.mjs` | Removal of installer-owned integration                                                             |
| `scripts/smoke.mjs`           | Electron functional checks using Playwright                                                        |
| `.github/workflows/ci.yml`    | Formatting, build, desktop checks, and diagnostic artifacts                                        |

## Document flow

1. A dialog, dropped file, recent entry, command-line path, or clicked Markdown link supplies a path to the main process.
2. The main process checks the extension, resolves the path, verifies a regular file no larger than 10 MiB, and reads UTF-8 text.
3. It sets the active image root, replaces the watcher, updates recents, and sends the document to the renderer. An opening counter prevents an older completed read from replacing a newer request.
4. The renderer extracts front matter, parses Markdown with Marked, and sanitizes HTML with DOMPurify. Image sources stay inert until evaluated for local or embedded use.
5. It generates heading IDs, highlights code, adds copy controls, wraps tables, resolves allowed images, and builds the outline. App-chrome text is assigned as text or escaped before insertion.
6. A 700 ms file-stat watcher detects edits and atomic replacements, then rereads the active document. On a failed reread, the last rendered version stays visible with a notice. Returning to the welcome page stops watching.

## Native bridge

The preload exposes methods for initialization, choosing/opening/closing a document, resolving a dropped file's path, copying text, clearing recents, opening links, and exporting PDF. Event subscriptions are restricted to a fixed set. There is no exposed `ipcRenderer` or generic command runner.

Main-process handlers validate the sender before dispatch. Expected operational errors return through the bridge and appear as a toast. OS permissions still govern file access.

## Asset serving

`folio://app/` loads `dist/` assets, with paths restricted to that directory. The renderer's content policy permits local scripts and styles while forbidding frames and objects.

`folio-asset://local/` maps images to the active document's directory. Requests must use that host, resolve beneath the root after symlink resolution, and have an allowed extension. Parent-directory images are unavailable. Relative Markdown links use a separate operation and may navigate outside the current directory.

HTTP(S) images become placeholders. Clicked HTTP(S) and mail links are handed to the system handler. Document HTML cannot navigate the Electron window or open another window directly.

## State and persistence

The current document, view mode, search matches, and outline state live in renderer memory. Local storage persists theme and font size. The main process writes up to 15 name/path pairs to `recent.json` in Electron's user-data directory. It does not persist document bodies or restore the last document automatically.

`FOLIO_TEST_DATA` overrides the user-data path for the smoke suite and bypasses the single-instance lock so tests do not reuse a user's app. It is a testing hook, not a supported user-facing configuration feature.

## PDF and browser preview

PDF export chooses a destination in the main process and calls Electron's `printToPDF`. Print CSS hides app chrome and uses an A4 light layout. The renderer switches out of source mode and closes search first.

Without the preload bridge, the frontend becomes a browser preview. It reads selected `File` objects in memory and delegates export to browser printing. Native watching, recent path access, relative local assets, and native file navigation are unavailable.

## Verification and future changes

The smoke suite tests the bridge and renderer together with stubbed dialog selections and temporary files. Screenshots are diagnostics, not visual baselines. No packaged build, signed installer, non-Linux validation, or plugin system is implemented.

Keep parsing and presentation in the renderer, OS operations in the main process, and bridge methods specific to their purpose. Markdown or HTML changes must preserve sanitization and offline resource behavior. Read [SECURITY.md](../SECURITY.md) before changing these boundaries.
