// Minimal web server to host the Blob agent UI and proxy Gemini + memory.
// Runs without Electron so you can embed it as wallpaper/overlay tools.

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { Gemini } = require('./electron/services/gemini');
const { Memory } = require('./electron/services/memory');

const PORT = process.env.PORT || 3264;

// Resolve a cross-platform data path
function getDataDir() {
  // Prefer XDG on Linux, otherwise use platform conventions
  const home = os.homedir();
  if (process.platform === 'linux') {
    const xdg = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    return path.join(xdg, 'blob-desktop-agent');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Blob Desktop Agent');
  }
  // win32 or other
  return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Blob Desktop Agent');
}

const dataDir = getDataDir();
fs.mkdirSync(dataDir, { recursive: true });
const memoryPath = path.join(dataDir, 'blob-memory.json');

const memory = new Memory(memoryPath);
const gemini = new Gemini(process.env.GEMINI_API_KEY);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve the UI from /src
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'src')));

// API routes
app.post('/api/llm', async (req, res) => {
  try {
    const { prompt, mood, nickname, insideJokes } = req.body || {};
    const text = await gemini.generate({ prompt, mood, nickname, insideJokes });
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/memory/:key', (req, res) => {
  try {
    const value = memory.get(req.params.key);
    res.json({ ok: true, value });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/memory', (req, res) => {
  try {
    const { key, value } = req.body || {};
    memory.set(key, value);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/goodbye', async (_req, res) => {
  try {
    const nickname = memory.get('nickname') || 'friend';
    const text = await gemini.generate({
      prompt: 'Dramatic but sweet goodbye line for when the app is closing.',
      mood: 'dramatic',
      nickname,
      insideJokes: memory.get('insideJokes') || [],
    });
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/quit', (_req, res) => {
  // For safety in a server context, do not exit by default.
  if (process.env.ALLOW_QUIT === '1') {
    res.json({ ok: true });
    setTimeout(() => process.exit(0), 50);
    return;
  }
  res.json({ ok: true, note: 'Quit disabled for web server.' });
});

app.listen(PORT, () => {
  console.log(`[blob] Web server listening on http://localhost:${PORT}`);
});
