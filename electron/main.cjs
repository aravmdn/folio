const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, protocol, net, shell } = require('electron');
const fs = require('node:fs/promises');
const { watchFile, unwatchFile } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'folio', privileges: { standard: true, secure: true, supportFetchAPI: true } }, { scheme: 'folio-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (process.env.FOLIO_TEST_DATA) app.setPath('userData', process.env.FOLIO_TEST_DATA);
app.setName('Folio');
let win, currentPath, assetRoot, watchedPath;
let recent = [];
let opening = 0;
const isMarkdown = p => typeof p === 'string' && /\.(md|markdown|mdown|mkd|mdx)$/i.test(p);
const startupFile = process.argv.slice(1).find(p => !p.startsWith('-') && isMarkdown(p));
const dataFile = () => path.join(app.getPath('userData'), 'recent.json');
const send = (channel, value) => { if (win && !win.isDestroyed()) win.webContents.send(channel, value); };

async function readDocument(file) {
  if (!isMarkdown(file)) throw new Error('Choose a Markdown file (.md, .markdown, .mdown, .mkd, or .mdx).');
  const absolute = await fs.realpath(path.resolve(file));
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new Error('This path is not a file.');
  if (stat.size > 10 * 1024 * 1024) throw new Error('This file is too large. Folio supports files up to 10 MB.');
  return { path: absolute, name: path.basename(absolute), content: await fs.readFile(absolute, 'utf8'), modified: stat.mtime.toISOString() };
}

async function openDocument(file) {
  const sequence = ++opening;
  const doc = await readDocument(file);
  if (sequence !== opening) return;
  currentPath = doc.path;
  assetRoot = path.dirname(doc.path);
  if (watchedPath) unwatchFile(watchedPath);
  watchedPath = currentPath;
  watchFile(currentPath, { interval: 700 }, async (now, previous) => {
    if (now.mtimeMs === previous.mtimeMs && now.size === previous.size) return;
    try {
      const refreshed = await readDocument(doc.path);
      if (currentPath === doc.path) send('document', { ...refreshed, refreshed: true });
    } catch { send('notice', 'This file is unavailable. The last readable version is still displayed.'); }
  });
  recent = [{ path: doc.path, name: doc.name }, ...recent.filter(r => r.path !== doc.path)].slice(0, 15);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(dataFile(), JSON.stringify(recent)).catch(() => {});
  win.setTitle(`${doc.name} — Folio`);
  send('recent', recent);
  send('document', doc);
  return doc;
}

async function pickFile() {
  const result = await dialog.showOpenDialog(win, { title: 'Open a Markdown file', properties: ['openFile'], filters: [{ name: 'Markdown documents', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] }] });
  if (!result.canceled) await openDocument(result.filePaths[0]);
}
function safeAction(action) { return Promise.resolve().then(action).catch(error => send('notice', error.message)); }

if (!process.env.FOLIO_TEST_DATA && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, args) => {
    if (win?.isMinimized()) win.restore();
    win?.focus();
    const file = args.find(isMarkdown);
    if (file) safeAction(() => openDocument(file));
  });
  app.whenReady().then(async () => {
    try { recent = JSON.parse(await fs.readFile(dataFile(), 'utf8')).filter(r => isMarkdown(r.path)).slice(0, 15); } catch {}
    const dist = path.join(__dirname, '../dist');
    protocol.handle('folio', async request => {
      const url = new URL(request.url);
      const target = path.resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (url.host !== 'app' || !target.startsWith(dist + path.sep)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(target).href);
    });
    protocol.handle('folio-asset', async request => {
      try {
        if (!assetRoot) return new Response('No document', { status: 404 });
        const url = new URL(request.url);
        const target = await fs.realpath(path.resolve(assetRoot, '.' + decodeURIComponent(url.pathname)));
        if (url.host !== 'local' || !target.startsWith(assetRoot + path.sep) || !/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(target)) return new Response('Forbidden', { status: 403 });
        return net.fetch(pathToFileURL(target).href);
      } catch { return new Response('Image unavailable', { status: 404 }); }
    });
    win = new BrowserWindow({ width: 1320, height: 900, minWidth: 760, minHeight: 540, backgroundColor: '#f9f8f4', title: 'Folio', icon: path.join(__dirname, '../public/icon.svg'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    win.webContents.session.setPermissionCheckHandler(() => false);
    const handle = (channel, fn) => ipcMain.handle(channel, async (event, ...args) => {
      if (event.sender !== win.webContents || event.senderFrame?.url !== 'folio://app/') throw new Error('Untrusted sender');
      try { return { ok: true, value: await fn(...args) }; } catch (error) { return { ok: false, error: error.message }; }
    });
    handle('ready', () => ({ recent }));
    handle('pick', pickFile);
    handle('open', openDocument);
    handle('copy', text => {
      if (typeof text !== 'string' || text.length > 10 * 1024 * 1024) throw new Error('This text cannot be copied.');
      clipboard.writeText(text);
    });
    handle('close-document', () => {
      opening++;
      if (watchedPath) unwatchFile(watchedPath);
      watchedPath = currentPath = assetRoot = null;
      win.setTitle('Folio');
    });
    handle('clear-recent', async () => { recent = []; await fs.writeFile(dataFile(), '[]'); send('recent', recent); });
    handle('link', async href => {
      if (typeof href !== 'string') return;
      if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return shell.openExternal(href);
      if (/^[a-z][a-z\d+.-]*:/i.test(href) || !currentPath) throw new Error('This link cannot be opened in Folio.');
      const filename = decodeURIComponent(href.split('#')[0].split('?')[0]);
      if (!isMarkdown(filename)) throw new Error('Folio opens links to Markdown files.');
      await openDocument(path.resolve(path.dirname(currentPath), filename));
      if (href.includes('#')) send('anchor', decodeURIComponent(href.split('#')[1]));
    });
    handle('export-pdf', async () => {
      const result = await dialog.showSaveDialog(win, { title: 'Export as PDF', defaultPath: (currentPath ? path.basename(currentPath, path.extname(currentPath)) : 'Welcome to Folio') + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (result.canceled) return;
      const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
      await fs.writeFile(result.filePath, pdf);
      send('notice', 'PDF exported.');
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [{ label: 'Open Markdown…', accelerator: 'CmdOrCtrl+O', click: () => safeAction(pickFile) }, { label: 'Export PDF…', accelerator: 'CmdOrCtrl+P', click: () => send('action', 'export') }, { type: 'separator' }, { role: 'quit' }] },
      { label: 'Edit', submenu: [{ role: 'copy' }, { role: 'selectAll' }, { label: 'Find in document', accelerator: 'CmdOrCtrl+F', click: () => send('action', 'find') }] },
      { label: 'View', submenu: [{ label: 'Toggle sidebar', accelerator: 'CmdOrCtrl+B', click: () => send('action', 'sidebar') }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }
    ]));
    await win.loadURL('folio://app/');
    if (startupFile) safeAction(() => openDocument(startupFile));
    win.on('closed', () => { if (watchedPath) unwatchFile(watchedPath); });
  });
}
app.on('window-all-closed', () => app.quit());
