import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { createIcons, BookOpen, FileText, FolderOpen, PanelLeftClose, PanelLeftOpen, Search, Sun, Moon, ChevronRight, ChevronUp, ChevronDown, X, ArrowUpRight, Code2, AlignLeft, Download, Copy, Check, Plus, Minus, Leaf, Clock, Trash2 } from 'lucide';
import { welcome } from './welcome';
import './style.css';

const iconSet = { BookOpen, FileText, FolderOpen, PanelLeftClose, PanelLeftOpen, Search, Sun, Moon, ChevronRight, ChevronUp, ChevronDown, X, ArrowUpRight, Code2, AlignLeft, Download, Copy, Check, Plus, Minus, Leaf, Clock, Trash2 };
const icons = () => createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.65 } });
const icon = name => `<i data-lucide="${name}"></i>`;
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Remove image sources before sanitized markup is attached to a live document.
DOMPurify.addHook('beforeSanitizeAttributes', node => {
  if (node.tagName === 'IMG') { node.setAttribute('data-folio-src', node.getAttribute('src') || ''); node.removeAttribute('src'); }
  if (node.tagName === 'INPUT') node.removeAttribute('src');
});
let preferences;
try { preferences = JSON.parse(localStorage.getItem('folio-preferences')) || {}; } catch { preferences = {}; }
let doc = { name: 'Welcome to Folio', content: welcome, path: null };
let recents = [], source = false, matches = [], matchIndex = -1, headingObserver;
let fontSize = Math.max(14, Math.min(24, Number(preferences.fontSize) || 17));
let theme = preferences.theme === 'dark' ? 'dark' : 'light';
let sidebarHidden = false;
const savePreferences = () => localStorage.setItem('folio-preferences', JSON.stringify({ fontSize, theme }));

$('#app').innerHTML = `
  <aside class="sidebar" aria-label="Document navigation">
    <a class="brand" href="#" aria-label="Folio home"><span class="brand-mark">${icon('book-open')}</span><span>folio<span class="brand-dot">.</span></span></a>
    <div class="sidebar-intro">A quiet place to read.</div>
    <button class="open-button" id="open-file">${icon('plus')}<span>Open file</span><kbd>⌘ / Ctrl O</kbd></button>
    <div class="section-label recent-label"><span>YOUR LIBRARY</span><button class="icon-button tiny" id="clear-recent" title="Clear recent files" aria-label="Clear recent files">${icon('trash-2')}</button></div>
    <nav id="recent-files" aria-label="Recent documents"></nav>
    <div class="sidebar-divider"></div>
    <div class="section-label outline-label">ON THIS PAGE</div>
    <nav id="outline" aria-label="Table of contents"></nav>
    <div class="sidebar-bottom"><span class="local-dot"></span> Local files. Just for you.<span class="version">v1.0</span></div>
  </aside>
  <main class="main">
    <header class="toolbar">
      <div class="document-location"><button class="icon-button" id="toggle-sidebar" title="Toggle sidebar (Ctrl/⌘ B)" aria-label="Toggle sidebar" aria-expanded="true">${icon('panel-left-close')}</button><span class="toolbar-divider"></span><span class="breadcrumb">Library</span>${icon('chevron-right')}<span id="filename">Welcome to Folio</span></div>
      <div class="toolbar-actions"><button class="icon-button" id="search-toggle" title="Find in document (Ctrl/⌘ F)" aria-label="Find in document">${icon('search')}</button><button class="icon-button" id="theme-toggle" title="Switch to dark theme" aria-label="Switch to dark theme">${icon('moon')}</button><span class="toolbar-divider"></span><button class="export-button" id="export-pdf">${icon('download')}<span>Export PDF</span></button></div>
    </header>
    <div class="reading-toolbar"><div class="view-tabs" role="group" aria-label="Document view"><button id="reading-tab" class="selected" aria-pressed="true">${icon('book-open')}Reading</button><button id="source-tab" aria-pressed="false">${icon('code-2')}Source</button></div><div class="type-controls"><span class="type-label">Text size</span><button class="icon-button tiny" id="smaller" aria-label="Decrease text size">${icon('minus')}</button><span id="font-size">17</span><button class="icon-button tiny" id="larger" aria-label="Increase text size">${icon('plus')}</button></div></div>
    <div class="search-bar" hidden><label for="search-input">${icon('search')}</label><input id="search-input" placeholder="Find in this document…" autocomplete="off" /><span id="search-count" aria-live="polite"></span><button class="icon-button tiny" id="search-prev" aria-label="Previous match">${icon('chevron-up')}</button><button class="icon-button tiny" id="search-next" aria-label="Next match">${icon('chevron-down')}</button><button class="icon-button tiny" id="search-close" aria-label="Close search">${icon('x')}</button></div>
    <div class="scroll-area" id="scroll-area">
      <div class="page-wrap"><div class="document-eyebrow"><span id="document-kind">THE FOLIO FIELD GUIDE</span><span class="eyebrow-line"></span><span id="reading-time"></span></div><article id="document" class="prose" aria-label="Rendered Markdown"></article><pre id="source" class="source-view" hidden></pre><div class="end-mark">${icon('leaf')}<span>Room to read. Space to think.</span></div></div>
    </div>
    <footer class="statusbar"><span class="status-left"><span class="local-dot"></span><span id="file-status">Welcome to your reading space</span></span><span class="status-right"><span id="word-count"></span><span class="status-divider">·</span><span>Markdown</span><span class="status-divider">·</span><span id="progress">0%</span></span></footer>
  </main>
  <div id="drop-overlay" hidden><div class="drop-card">${icon('folder-open')}<h2>A fresh page awaits.</h2><p>Drop a Markdown file to start reading.</p></div></div>
  <div id="toast" role="status" hidden></div>
  <input type="file" id="browser-file" accept=".md,.markdown,.mdown,.mkd,.mdx" hidden />
`;

let toastTimer;
function notice(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 5000); }
async function action(fn) { try { return await fn(); } catch (error) { notice(error.message); } }
function applyPreferences() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--reading-size', `${fontSize}px`);
  $('#font-size').textContent = fontSize;
  $('#smaller').disabled = fontSize <= 14;
  $('#larger').disabled = fontSize >= 24;
  $('#theme-toggle').innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
  $('#theme-toggle').title = $('#theme-toggle').ariaLabel = `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`;
  icons(); savePreferences();
}

function renderRecents() {
  $('#recent-files').innerHTML = `<button class="recent-item ${!doc.path ? 'active' : ''}" data-welcome>${icon('book-open')}<span>Welcome to Folio<small>Your reading space</small></span>${!doc.path ? '<span class="active-dot"></span>' : ''}</button>` + recents.map((r, index) => `<button class="recent-item ${r.path === doc.path ? 'active' : ''}" data-recent="${index}" title="${escapeHTML(r.path)}">${icon('file-text')}<span>${escapeHTML(r.name)}<small>${escapeHTML(r.path.split('/').slice(-2, -1).join('') || 'Local file')}</small></span>${r.path === doc.path ? '<span class="active-dot"></span>' : ''}</button>`).join('');
  $('#clear-recent').hidden = !recents.length;
  icons();
}

function renderDocument(next) {
  const previousScroll = $('#scroll-area').scrollTop;
  doc = next;
  matches = []; matchIndex = -1;
  document.title = `${doc.name} — Folio`;
  $('#filename').textContent = doc.name;
  $('#filename').title = doc.path || 'Welcome to Folio';
  $('#document-kind').textContent = doc.path ? 'YOUR LOCAL DOCUMENT' : 'THE FOLIO FIELD GUIDE';
  $('#file-status').textContent = doc.path ? (doc.refreshed ? 'Updated from disk · Watching for changes' : 'Saved on your device · Watching for changes') : 'Welcome to your reading space';
  if (!window.folio && doc.path) $('#file-status').textContent = 'Opened locally in your browser';
  let content = doc.content.replace(/^\uFEFF/, '');
  let frontmatter = '';
  const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (front) { frontmatter = `<details class="frontmatter"><summary>Document metadata</summary><pre>${escapeHTML(front[1])}</pre></details>`; content = content.slice(front[0].length); }
  const rendered = document.createElement('div');
  rendered.innerHTML = DOMPurify.sanitize(marked.parse(content, { gfm: true }), { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'video', 'audio', 'source', 'iframe', 'object', 'embed', 'link', 'meta'], FORBID_ATTR: ['style', 'srcset', 'id', 'name', 'autofocus'] });
  rendered.querySelectorAll('input').forEach(input => { if (input.type !== 'checkbox') input.remove(); else { input.disabled = true; input.parentElement.classList.add('task-item'); } });
  $('#document').innerHTML = frontmatter;
  $('#document').append(...rendered.childNodes);
  const wordCount = ($('#document').textContent.match(/\S+/g) || []).length;
  $('#word-count').textContent = `${wordCount.toLocaleString()} words`;
  $('#reading-time').textContent = `${Math.max(1, Math.ceil(wordCount / 220))} min read`;
  $('#source').textContent = doc.content;
  const usedIds = new Map();
  const headings = [...$('#document').querySelectorAll('h1,h2,h3,h4,h5,h6')];
  headings.forEach(heading => {
    const slug = heading.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';
    const count = usedIds.get(slug) || 0;
    usedIds.set(slug, count + 1);
    heading.id = count ? `${slug}-${count}` : slug;
  });
  $('#outline').innerHTML = headings.filter(h => h.tagName !== 'H1' || headings.length === 1).map(h => `<a href="#${encodeURIComponent(h.id)}" class="outline-link level-${h.tagName.slice(1)}">${escapeHTML(h.textContent)}</a>`).join('') || '<p class="outline-empty">Headings will appear here.</p>';
  $('#document').querySelectorAll('pre > code').forEach(code => {
    hljs.highlightElement(code);
    const language = code.className.match(/language-([\w+-]+)/)?.[1] || 'text';
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    toolbar.innerHTML = `<span>${escapeHTML(language)}</span><button class="copy-code" aria-label="Copy code">${icon('copy')}<span>Copy</span></button>`;
    code.parentElement.prepend(toolbar);
  });
  $('#document').querySelectorAll('table').forEach(table => { const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; table.replaceWith(wrapper); wrapper.append(table); });
  $('#document').querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('data-folio-src') || '';
    img.removeAttribute('data-folio-src');
    if (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)) { img.src = src; return; }
    if (!/^[a-z][a-z\d+.-]*:|^\/\//i.test(src) && window.folio && doc.path) {
      img.src = new URL(src, 'folio-asset://local/').href;
      img.addEventListener('error', () => { const message = document.createElement('span'); message.className = 'image-placeholder'; message.textContent = `Image unavailable: ${img.alt || src}`; img.replaceWith(message); });
    } else {
      const placeholder = document.createElement('span'); placeholder.className = 'image-placeholder';
      placeholder.textContent = `${img.alt || 'Image'} · ${/^https?:/i.test(src) ? 'Remote image kept offline' : 'Image unavailable'}`;
      img.replaceWith(placeholder);
    }
  });
  headingObserver?.disconnect();
  headingObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const links = [...$('#outline').querySelectorAll('a')];
      links.forEach(link => { const active = decodeURIComponent(link.hash.slice(1)) === entry.target.id; link.classList.toggle('current', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    }
  }, { root: $('#scroll-area'), rootMargin: '-5% 0px -72% 0px' });
  headings.forEach(h => headingObserver.observe(h));
  renderRecents(); icons();
  $('#scroll-area').scrollTop = doc.refreshed ? previousScroll : 0;
  if (! $('.search-bar').hidden) search();
  updateProgress();
}

function switchView(toSource) {
  source = toSource;
  $('#document').hidden = source; $('#source').hidden = !source;
  $('#reading-tab').classList.toggle('selected', !source); $('#source-tab').classList.toggle('selected', source);
  $('#reading-tab').setAttribute('aria-pressed', String(!source)); $('#source-tab').setAttribute('aria-pressed', String(source));
  if (!$('.search-bar').hidden) search();
  updateProgress();
}
function goToAnchor(anchor) {
  switchView(false);
  const target = [...$('#document').querySelectorAll('[id]')].find(el => el.id === anchor);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function toggleSidebar() { sidebarHidden = !sidebarHidden; $('#app').classList.toggle('sidebar-hidden', sidebarHidden); $('#toggle-sidebar').setAttribute('aria-expanded', String(!sidebarHidden)); $('#toggle-sidebar').innerHTML = icon(sidebarHidden ? 'panel-left-open' : 'panel-left-close'); icons(); }
function toggleSearch(show = true) { $('.search-bar').hidden = !show; if (show) { $('#search-input').focus(); $('#search-input').select(); search(); } else { clearMatches(); $('#search-toggle').focus(); } }
function clearMatches() { document.querySelectorAll('mark.search-match').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent))); $('#document').normalize(); $('#source').normalize(); matches = []; matchIndex = -1; }
function search() {
  clearMatches();
  const term = $('#search-input').value.toLocaleLowerCase();
  if (!term) { $('#search-count').textContent = ''; return; }
  const root = source ? $('#source') : $('#document');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement.closest('.code-toolbar') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.textContent, lower = text.toLocaleLowerCase();
    let start = 0, index = lower.indexOf(term);
    if (index < 0) continue;
    const fragment = document.createDocumentFragment();
    while (index >= 0) {
      fragment.append(text.slice(start, index));
      const mark = document.createElement('mark'); mark.className = 'search-match'; mark.textContent = text.slice(index, index + term.length); fragment.append(mark); matches.push(mark);
      start = index + term.length; index = lower.indexOf(term, start);
    }
    fragment.append(text.slice(start)); node.replaceWith(fragment);
  }
  jumpMatch(1);
}
function jumpMatch(direction) { if (!matches.length) { $('#search-count').textContent = 'No matches'; return; } matches[matchIndex]?.classList.remove('current-match'); matchIndex = (matchIndex + direction + matches.length) % matches.length; matches[matchIndex].classList.add('current-match'); matches[matchIndex].scrollIntoView({ block: 'center' }); $('#search-count').textContent = `${matchIndex + 1} of ${matches.length}`; }
function updateProgress() { const el = $('#scroll-area'); $('#progress').textContent = `${el.scrollHeight <= el.clientHeight ? 100 : Math.round(el.scrollTop / (el.scrollHeight - el.clientHeight) * 100)}%`; }
async function openBrowserFile(file) { if (!file || !/\.(md|markdown|mdown|mkd|mdx)$/i.test(file.name)) throw new Error('Choose a Markdown file.'); if (file.size > 10 * 1024 * 1024) throw new Error('This file is too large. The limit is 10 MB.'); renderDocument({ name: file.name, path: file.name, content: await file.text() }); }
const openFile = () => action(() => window.folio ? window.folio.pick() : $('#browser-file').click());
const showWelcome = () => action(async () => { await window.folio?.closeDocument(); switchView(false); renderDocument({ name: 'Welcome to Folio', content: welcome, path: null }); });
const exportPDF = () => action(async () => { switchView(false); toggleSearch(false); if (window.folio) await window.folio.exportPDF(); else window.print(); });

$('#open-file').onclick = openFile;
$('.brand').onclick = event => { event.preventDefault(); showWelcome(); };
$('#browser-file').onchange = event => { action(() => openBrowserFile(event.target.files[0])); event.target.value = ''; };
$('#recent-files').onclick = event => { const recent = event.target.closest('[data-recent]'); if (recent) action(() => window.folio.open(recents[Number(recent.dataset.recent)].path)); if (event.target.closest('[data-welcome]')) showWelcome(); };
$('#clear-recent').onclick = () => action(() => window.folio?.clearRecent());
$('#theme-toggle').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; applyPreferences(); };
$('#smaller').onclick = () => { fontSize = Math.max(14, fontSize - 1); applyPreferences(); };
$('#larger').onclick = () => { fontSize = Math.min(24, fontSize + 1); applyPreferences(); };
$('#toggle-sidebar').onclick = toggleSidebar;
$('#reading-tab').onclick = () => switchView(false);
$('#source-tab').onclick = () => switchView(true);
$('#export-pdf').onclick = exportPDF;
$('#search-toggle').onclick = () => toggleSearch($('.search-bar').hidden);
$('#search-close').onclick = () => toggleSearch(false);
$('#search-input').oninput = search;
$('#search-input').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); jumpMatch(event.shiftKey ? -1 : 1); } };
$('#search-next').onclick = () => jumpMatch(1);
$('#search-prev').onclick = () => jumpMatch(-1);
$('#outline').onclick = event => { const link = event.target.closest('a'); if (link) { event.preventDefault(); goToAnchor(decodeURIComponent(link.hash.slice(1))); } };
$('#document').onclick = event => {
  const copy = event.target.closest('.copy-code');
  if (copy) action(async () => { const text = copy.closest('pre').querySelector('code').textContent; if (window.folio) await window.folio.copy(text); else await navigator.clipboard.writeText(text); copy.innerHTML = `${icon('check')}<span>Copied</span>`; icons(); setTimeout(() => { copy.innerHTML = `${icon('copy')}<span>Copy</span>`; icons(); }, 1800); });
  const link = event.target.closest('a');
  if (link) { event.preventDefault(); const href = link.getAttribute('href') || ''; if (href.startsWith('#')) action(() => goToAnchor(decodeURIComponent(href.slice(1)))); else if (window.folio) action(() => window.folio.link(href)); else if (/^https?:/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer'); }
};
$('#scroll-area').addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { toggleSearch(false); $('#drop-overlay').hidden = true; }
  if ((event.ctrlKey || event.metaKey) && !window.folio) { const handler = { o: openFile, f: () => toggleSearch(), b: toggleSidebar, p: exportPDF }[event.key.toLowerCase()]; if (handler) { event.preventDefault(); handler(); } }
});
let dragDepth = 0;
document.addEventListener('dragenter', event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; } });
document.addEventListener('dragover', event => { event.preventDefault(); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop-overlay').hidden = true; } });
document.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true;
  const file = event.dataTransfer.files[0];
  if (file) action(() => window.folio ? window.folio.open(window.folio.pathForFile(file)) : openBrowserFile(file));
});
if (window.folio) {
  window.folio.on('document', renderDocument);
  window.folio.on('recent', value => { recents = value; renderRecents(); });
  window.folio.on('notice', notice);
  window.folio.on('anchor', goToAnchor);
  window.folio.on('action', name => ({ find: () => toggleSearch(), sidebar: toggleSidebar, export: exportPDF })[name]?.());
  action(async () => { recents = (await window.folio.ready()).recent; renderRecents(); });
}
applyPreferences(); renderDocument(doc);
