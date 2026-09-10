import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'linux') {
  throw new Error('Desktop integration is currently supported only on Linux.');
}

const applications = path.join(os.homedir(), '.local/share/applications');
const entries = [
  path.join(os.homedir(), '.local/bin/folio'),
  path.join(applications, 'folio.desktop'),
];
const removable = [];
for (const filename of entries) {
  let content;
  try {
    content = await readFile(filename, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  if (!content.includes('Folio local Markdown reader')) {
    throw new Error(`Refusing to remove an unrelated file: ${filename}`);
  }
  removable.push(filename);
}
for (const filename of removable) await unlink(filename);
spawnSync('update-desktop-database', [applications], { stdio: 'ignore' });
console.log(
  'Removed Folio desktop integration. Your documents, settings, and source checkout remain in place.',
);
