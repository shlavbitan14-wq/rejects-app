const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1350,
    height: 900,
    minWidth: 360,
    minHeight: 480,
    title: "מערכת בקרת איכות בנייה",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));

  // Security: block external navigation and new windows (local app only)
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- Projects database (stored in userData) ----
function dbPath() {
  return path.join(app.getPath('userData'), 'projects.json');
}
function tplStorePath() {
  return path.join(app.getPath('userData'), 'templates.json');
}

// ---- Custom templates store ----
ipcMain.handle('tpl-store-read', () => {
  try {
    const p = tplStorePath();
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    return null;
  } catch (e) { return null; }
});
ipcMain.handle('tpl-store-write', (event, jsonString) => {
  try {
    JSON.parse(jsonString);
    fs.writeFileSync(tplStorePath(), jsonString, 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('db-read', () => {
  try {
    const p = dbPath();
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    return null;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('db-write', (event, jsonString) => {
  try {
    // Validate JSON before writing
    JSON.parse(jsonString);
    fs.writeFileSync(dbPath(), jsonString, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---- Export PDF ----
ipcMain.handle('export-pdf', async (event, arg) => {
  // arg may be a string (legacy) or { defaultName, docNum }
  const opts = (typeof arg === 'string') ? { defaultName: arg } : (arg || {});
  const defaultName = opts.defaultName || 'report';
  const docNum = opts.docNum || '';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'שמירת PDF',
    defaultPath: defaultName + '.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false };
  try {
    const footerTemplate =
      '<div style="font-size:8px;width:100%;padding:0 16mm;display:flex;' +
      'justify-content:space-between;color:#6b7280;direction:rtl;font-family:Arial,sans-serif;">' +
      '<span>' + (docNum ? ('מסמך מס׳ ' + escapeHtml(docNum)) : '') + '</span>' +
      '<span>עמוד <span class="pageNumber"></span> מתוך <span class="totalPages"></span></span>' +
      '</div>';
    const data = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate,
      margins: { marginType: 'custom', top: 0.7, bottom: 0.6, left: 0.6, right: 0.6 }
    });
    fs.writeFileSync(filePath, data);
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Save report to file ----
ipcMain.handle('save-report-file', async (event, { defaultName, jsonString }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'שמירת דוח',
    defaultPath: (defaultName || 'report') + '.qcreport',
    filters: [{ name: 'דוח QC', extensions: ['qcreport'] }]
  });
  if (canceled || !filePath) return { ok: false };
  try {
    JSON.parse(jsonString); // validate
    fs.writeFileSync(filePath, jsonString, 'utf8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---- Load report from file ----
ipcMain.handle('load-report-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'פתיחת דוח',
    properties: ['openFile'],
    filters: [{ name: 'דוח QC', extensions: ['qcreport', 'json'] }]
  });
  if (canceled || !filePaths || !filePaths[0]) return { ok: false };
  try {
    const content = fs.readFileSync(filePaths[0], 'utf8');
    JSON.parse(content); // validate JSON
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---- Save template ----
ipcMain.handle('save-template', async (event, jsonString) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'שמירת תבנית',
    defaultPath: 'template.qctpl',
    filters: [{ name: 'תבנית QC', extensions: ['qctpl'] }]
  });
  if (canceled || !filePath) return { ok: false };
  try {
    JSON.parse(jsonString); // validate
    fs.writeFileSync(filePath, jsonString, 'utf8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---- Load template ----
ipcMain.handle('load-template', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'טעינת תבנית',
    properties: ['openFile'],
    filters: [{ name: 'תבנית QC', extensions: ['qctpl', 'json'] }]
  });
  if (canceled || !filePaths || !filePaths[0]) return { ok: false };
  try {
    const content = fs.readFileSync(filePaths[0], 'utf8');
    JSON.parse(content); // validate
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
