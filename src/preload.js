const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qcAPI', {
  isElectron:     true,
  dbRead:         ()      => ipcRenderer.invoke('db-read'),
  dbWrite:        (json)  => ipcRenderer.invoke('db-write', json),
  tplStoreRead:   ()      => ipcRenderer.invoke('tpl-store-read'),
  tplStoreWrite:  (json)  => ipcRenderer.invoke('tpl-store-write', json),
  exportPDF:      (args)  => ipcRenderer.invoke('export-pdf', args),
  saveReportFile: (args)  => ipcRenderer.invoke('save-report-file', args),
  loadReportFile: ()      => ipcRenderer.invoke('load-report-file'),
  saveTemplate:   (json)  => ipcRenderer.invoke('save-template', json),
  loadTemplate:   ()      => ipcRenderer.invoke('load-template'),
});
