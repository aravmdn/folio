import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'folio-smoke-'));
const output = path.join(root, 'output/playwright');
await fs.mkdir(output, { recursive: true });
const file = path.join(temp, 'Reading test.md');
const sibling = path.join(temp, 'Next page.md');
const fixture = `---
title: Reading test
---
# Reading test

A paragraph with **bold text**, *emphasis*, and alpha.

## First section

Alpha appears again. [Next page](Next%20page.md#destination).

| Name | Value |
| --- | --- |
| One | Two |

- [x] Finished
- [ ] Unfinished

\`\`\`js
const answer = 42;
\`\`\`

![A local pixel](pixel.png)
![Remote picture](https://example.com/never-request-this.png)

<script>window.folioInjected = true</script>
<img src="bad.png" onerror="window.folioInjected = true">
<a href="javascript:window.folioInjected=true">Unsafe link</a>
<input autofocus onfocus="window.folioInjected=true">

## First section

Final paragraph.
`;
await fs.writeFile(file, fixture);
await fs.writeFile(sibling, '# Next page\n\n## Destination\n\nYou arrived.');
await fs.writeFile(
  path.join(temp, 'pixel.png'),
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=',
    'base64',
  ),
);
await fs.writeFile(path.join(temp, 'invalid.txt'), 'not markdown');
let app;
let page;
const env = { ...process.env, FOLIO_TEST_DATA: path.join(temp, 'settings') };
delete env.ELECTRON_RUN_AS_NODE;
const errors = [],
  network = [];
try {
  app = await electron.launch({ args: [root], env });
  page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  await page.setViewportSize({ width: 1320, height: 940 });
  await page.locator('#document h1').waitFor();
  assert.match(await page.locator('#document h1').innerText(), /little room/);
  await page.screenshot({ path: path.join(output, 'folio-light.png') });
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator('#larger').click();
  assert.equal(await page.locator('#font-size').innerText(), '18');
  await page.screenshot({ path: path.join(output, 'folio-dark.png') });
  await page.locator('#theme-toggle').click();
  await app.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, file);
  await page.locator('#open-file').click();
  await page.waitForFunction(
    () => document.querySelector('#document h1')?.textContent === 'Reading test',
  );
  assert.equal(await page.locator('#document table tbody tr').count(), 1);
  assert.equal(await page.locator('#document input[type=checkbox]:disabled').count(), 2);
  assert.equal(await page.locator('#document input:checked').count(), 1);
  assert.equal(await page.locator('#document strong').innerText(), 'bold text');
  assert.equal(
    await page
      .locator(
        '#document script, #document [onerror], #document [autofocus], #document a[href^="javascript:"]',
      )
      .count(),
    0,
  );
  assert.equal(await page.evaluate(() => window.folioInjected), undefined);
  assert.equal(await page.locator('#document h2#first-section-1').count(), 1);
  await page.waitForFunction(
    () => document.querySelector('img[alt="A local pixel"]')?.naturalWidth === 1,
  );
  assert.match(await page.locator('#document').innerText(), /Remote image kept offline/);
  await page.locator('#search-toggle').click();
  await page.locator('#search-input').fill('alpha');
  assert.equal(await page.locator('#search-count').innerText(), '1 of 2');
  await page.locator('#search-next').click();
  assert.equal(await page.locator('#search-count').innerText(), '2 of 2');
  await page.locator('#search-input').fill('missing phrase');
  assert.equal(await page.locator('#search-count').innerText(), 'No matches');
  await page.locator('#search-close').click();
  await page.locator('#source-tab').click();
  assert.equal(await page.locator('#source').textContent(), fixture);
  await page.locator('#reading-tab').click();
  await page.locator('.copy-code').click();
  await page.locator('.copy-code').filter({ hasText: 'Copied' }).waitFor();
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'const answer = 42;\n');
  await page.locator('#document a', { hasText: 'Next page' }).click();
  await page.waitForFunction(
    () => document.querySelector('#document h1')?.textContent === 'Next page',
  );
  await page.locator('[data-recent]', { hasText: 'Reading test.md' }).click();
  await page.waitForFunction(
    () => document.querySelector('#document h1')?.textContent === 'Reading test',
  );
  await fs.writeFile(path.join(temp, 'atomic.md'), fixture + '\nLive update succeeded.\n');
  await fs.rename(path.join(temp, 'atomic.md'), file);
  await page.getByText('Live update succeeded.', { exact: true }).waitFor({ timeout: 7000 });
  await page.locator('#toggle-sidebar').click();
  assert.equal(await page.locator('.sidebar').isVisible(), false);
  await page.locator('#toggle-sidebar').click();
  await app.evaluate(
    ({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
    },
    path.join(temp, 'invalid.txt'),
  );
  await page.locator('#open-file').click();
  await page.locator('#toast').filter({ hasText: 'Choose a Markdown file' }).waitFor();
  assert.equal(await page.locator('#document h1').innerText(), 'Reading test');
  const pdfPath = path.join(output, 'reading-test.pdf');
  await app.evaluate(({ dialog }, selected) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: selected });
  }, pdfPath);
  await page.locator('#export-pdf').click();
  await page.locator('#toast').filter({ hasText: 'PDF exported.' }).waitFor();
  assert.equal((await fs.readFile(pdfPath)).subarray(0, 5).toString(), '%PDF-');
  // A native file object from Chromium's file input preserves its on-disk path on drop.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'drop-test-input';
    input.hidden = true;
    document.body.append(input);
  });
  await page.locator('#drop-test-input').setInputFiles(sibling);
  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(document.querySelector('#drop-test-input').files[0]);
    document.dispatchEvent(
      new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }),
    );
  });
  await page.waitForFunction(
    () => document.querySelector('#document h1')?.textContent === 'Next page',
  );
  await page.locator('[data-welcome]').click();
  await page.waitForFunction(() =>
    document.querySelector('#document h1')?.textContent.includes('little room'),
  );
  await fs.writeFile(sibling, '# Should not replace welcome');
  await page.waitForTimeout(1200);
  assert.match(await page.locator('#document h1').innerText(), /little room/);
  assert.deepEqual(network, [], 'The app should never fetch remote resources');
  assert.deepEqual(errors, [], 'Renderer should have no uncaught errors');
  await app.close();
  app = null;
  app = await electron.launch({ args: [root, file], env });
  page = await app.firstWindow();
  await page.waitForFunction(
    () => document.querySelector('#document h1')?.textContent === 'Reading test',
  );
  assert.equal(await page.locator('#font-size').innerText(), '18');
  assert.equal(await page.locator('[data-recent]').count(), 2);
  await page.locator('#clear-recent').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-recent]').length === 0);
  console.log(
    'PASS: native open, drag/drop, CLI open, Markdown rendering, outline IDs, search, source, code copy, themes, type sizing, local images, offline operation, relative links, live reload, home, recent files, settings persistence, invalid files, sanitized HTML, and PDF export.',
  );
  console.log(`Artifacts: ${output}`);
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
  await fs.writeFile(path.join(output, 'failure.txt'), [error.stack, ...errors].join('\n'));
  throw error;
} finally {
  if (app) await app.close();
  await fs.rm(temp, { recursive: true, force: true });
}
