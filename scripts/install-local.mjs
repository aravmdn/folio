import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'linux') {
  throw new Error('Desktop integration is currently supported only on Linux. Use npm start to run from source.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const electron = require('electron');
const bin = path.join(os.homedir(), '.local/bin');
const applications = path.join(os.homedir(), '.local/share/applications');
await mkdir(bin, { recursive: true });
await mkdir(applications, { recursive: true });
const launcher = path.join(bin, 'folio');
const desktop = path.join(applications, 'folio.desktop');
const shellQuote = text => "'" + text.replaceAll("'", "'\\''") + "'";
const desktopQuote = text => '"' + text.replace(/[\\"`$]/g, '\\$&') + '"';
for (const filename of [launcher, desktop]) {
  let existing;
  try { existing = await readFile(filename, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing && !existing.includes('Folio local Markdown reader')) throw new Error(`An unrelated file already exists at ${filename}.`);
}
await writeFile(launcher, `#!/bin/sh\n# Folio local Markdown reader\nunset ELECTRON_RUN_AS_NODE\nexec ${shellQuote(electron)} ${shellQuote(root)} "$@"\n`, { mode: 0o755 });
await writeFile(desktop, `[Desktop Entry]\n# Folio local Markdown reader\nType=Application\nName=Folio\nGenericName=Markdown Reader\nComment=A quiet place to read Markdown\nExec=${desktopQuote(launcher)} %f\nIcon=${root}/public/icon.svg\nTerminal=false\nCategories=Office;Viewer;\nMimeType=text/markdown;text/x-markdown;\nStartupWMClass=folio-reader\nKeywords=markdown;md;reader;notes;\n`);
spawnSync('update-desktop-database', [applications], { stdio: 'ignore' });
console.log(`Installed Folio. Open it from your app menu or run ${launcher} [file.md].`);
