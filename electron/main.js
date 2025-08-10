const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { Gemini } = require('./services/gemini');
const { Memory } = require('./services/memory');

let mainWindow;
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 380,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    hasShadow: false,
    vibrancy: 'under-window',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !!isDev,
    }
  });

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true);

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Keep agent alive like a tray app? For now, quit on all platforms.
  app.quit();
});

// Services
const memoryPath = path.join(app.getPath('userData'), 'blob-memory.json');
const memory = new Memory(memoryPath);
const gemini = new Gemini(process.env.GEMINI_API_KEY);

// IPC Handlers
ipcMain.handle('blob:llm', async (_evt, payload) => {
  const { prompt, mood, nickname, insideJokes } = payload || {};
  try {
    const text = await gemini.generate({ prompt, mood, nickname, insideJokes });
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('blob:memory:get', async (_evt, key) => {
  try { return { ok: true, value: memory.get(key) }; }
  catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('blob:memory:set', async (_evt, { key, value }) => {
  try { memory.set(key, value); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('blob:goodbye', async () => {
  try {
    const nickname = memory.get('nickname') || 'friend';
    const text = await gemini.generate({
      prompt: 'Dramatic but sweet goodbye line for when the app is closing.',
      mood: 'dramatic',
      nickname,
      insideJokes: memory.get('insideJokes') || []
    });
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('blob:quit', async () => {
  app.quit();
  return { ok: true };
});
