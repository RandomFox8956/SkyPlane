// Electron main process — wraps the Sky Plane web game in a desktop window.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Live update: whenever a game file next to this one changes on disk (for example after `npm run dev`
// copies the latest code in), refresh the open window. This is what lets the built exe pick up new
// versions without a five-minute rebuild — just relaunch or let it reload in place.
function watchForReload() {
  try {
    let timer = null;
    fs.watch(__dirname, { recursive: false }, (_ev, file) => {
      if (!file || !/\.(js|html|css)$/i.test(file)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const w of BrowserWindow.getAllWindows()) w.webContents.reloadIgnoringCache();
      }, 150);
    });
  } catch { /* watching is best-effort; ignore if the platform can't */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#102e30',
    autoHideMenuBar: true,
    title: 'Sky Plane',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  watchForReload();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
