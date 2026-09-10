const { contextBridge, ipcRenderer, webUtils } = require('electron');
const invoke = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('folio', {
  ready: () => invoke('ready'),
  pick: () => invoke('pick'),
  open: file => invoke('open', file),
  closeDocument: () => invoke('close-document'),
  copy: text => invoke('copy', text),
  pathForFile: file => webUtils.getPathForFile(file),
  link: href => invoke('link', href),
  clearRecent: () => invoke('clear-recent'),
  exportPDF: () => invoke('export-pdf'),
  on: (channel, callback) => {
    if (!['document', 'recent', 'notice', 'anchor', 'action'].includes(channel)) return;
    ipcRenderer.on(channel, (_event, value) => callback(value));
  }
});
