# Third-party notices

Folio's own source is MIT-licensed. Its dependencies retain their respective licenses. Versions are locked in `package-lock.json`; the table describes the direct packages used by this checkout.

| Package      | Role                                | Declared license                                                   |
| ------------ | ----------------------------------- | ------------------------------------------------------------------ |
| Electron     | Desktop runtime                     | MIT; Chromium and other bundled components have additional notices |
| Marked       | Markdown parser                     | MIT                                                                |
| DOMPurify    | HTML sanitization                   | MPL-2.0 OR Apache-2.0                                              |
| highlight.js | Syntax highlighting                 | BSD-3-Clause                                                       |
| Lucide       | Interface icons                     | ISC, with MIT notices for Feather-derived icons                    |
| Vite         | Frontend build and browser preview  | MIT                                                                |
| Playwright   | Desktop automation                  | Apache-2.0                                                         |
| Prettier     | Source and documentation formatting | MIT                                                                |

The licenses for the four dependencies bundled into the renderer are preserved in [docs/licenses/](docs/licenses/). Lucide's license file includes the relevant Feather attribution. Unmodified dependencies installed by npm contain their own license files as well.

The Electron runtime includes `LICENSE` and `LICENSES.chromium.html` in its distribution directory. Anyone distributing a future packaged Folio binary must retain those runtime notices and the notices for any other included dependencies. This document is an attribution index, not a replacement for those license texts.

The Folio book artwork in `public/icon.svg` and application screenshots are part of the MIT-licensed project. System fonts are selected from the user's operating system; no font files are bundled.
