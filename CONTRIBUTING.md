# Contributing to Folio

Useful contributions include reproducible bug reports, clearer documentation, fixes, test coverage, keyboard and accessibility improvements, and verified platform-support work.

## Before you start

- Read the [README](README.md) for supported behavior and limitations.
- Search existing [issues](https://github.com/aravmdn/folio/issues) and pull requests to avoid duplicate work.
- For a substantial feature or new dependency, open an issue describing the user problem and a small proposed solution first.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md), not public bug reports.

## Set up a checkout

Fork the repository on GitHub, clone your fork, and create a branch:

```sh
git clone https://github.com/YOUR-USERNAME/folio.git
cd folio
git switch -c fix/describe-the-change
npm ci
npm start
```

Use Node.js 24 or newer; `.nvmrc` selects 24. Desktop development and automated checks currently target Linux. A graphical session is required unless you run under Xvfb. See the README for headless setup.

`npm run dev` is useful for renderer layout changes, but it is a browser preview with fewer capabilities. Verify changes involving native APIs in Electron with `npm start`. There is no desktop hot reload; restart the app after code changes.

## Keep changes reviewable

- Keep a pull request focused on one problem or closely related set of changes.
- Use small, descriptive commits, such as `fix: preserve search when a document refreshes`.
- Run `npm run format` to follow the Prettier configuration. Avoid unrelated refactors.
- Add or adjust tests when behavior changes. Prefer observable behavior over assertions that duplicate implementation details.
- Update documentation when supported behavior, setup steps, storage, or security boundaries change.
- Commit `package-lock.json` with dependency changes. Explain new dependencies.
- Keep generated `dist/`, `node_modules/`, and test output out of Git. Documentation screenshots belong in `docs/images/` and must contain no personal data.

## Validate your change

```sh
npm run format:check
npm test
```

The test suite uses temporary settings and Markdown files, but its clipboard check writes a small test snippet to your clipboard. Close test windows only after the suite finishes.

For UI work, inspect both themes, keyboard focus, a long document, source view, and the minimum desktop width of 760 px. For file-loading changes, try a missing file, a file with spaces in its name, a local image, and a live edit. Run the checks relevant to the change.

CI runs formatting and desktop checks on Ubuntu 22.04 with Node.js 24. Screenshots, the PDF fixture, and failure diagnostics are short-lived workflow artifacts, not visual baselines.

## Open a pull request

Push your branch to your fork and open a PR against `main`. Explain:

1. The user-visible problem and resulting behavior.
2. How you tested it, including your operating system and checks you could not run.
3. Screenshots for visible changes and any remaining limitations.

Maintainers may request changes or suggest reducing scope. There is no guaranteed review timeline. Contributions are accepted under the [MIT License](LICENSE); there is no separate contributor license agreement.

## Maintainer checklist

Before merging, confirm the behavior is covered, CI passes, documentation matches the implementation, and no personal data or generated output was added. Review changes to Electron, sanitization, IPC, custom protocols, or external links with particular care.

The repository currently distributes source only. Before a future release, update `CHANGELOG.md`, align package and lockfile versions, validate a clean installation, and document exactly which platforms and artifacts were tested. A `dist/` frontend bundle alone is not a standalone desktop release.
