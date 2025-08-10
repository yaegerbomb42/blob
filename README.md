# Blob Desktop Agent

Playful desktop blob companion with moods, memory, and Gemini-powered quips.

Requirements
- Node 18+
- A Google AI Studio API key. The app includes a hardcoded fallback (for dev/testing), but you can override with the GEMINI_API_KEY environment variable.

Install & Run
1. Install deps
```
npm install
```
2. Optional: Set your API key (overrides the fallback)
```
export GEMINI_API_KEY=YOUR_KEY
```
3a. Start the Electron desktop agent
```
npm start
```

3b. Or run as a local web server (for Plash/overlay use)
```
npm run serve
```
Then open http://localhost:3264

Quick setup helper (auto-start + Plash):
```
npm run setup
```
This prints Plash instructions and, on Linux, can generate a systemd --user service to auto-start on login.

Notes
- The app uses the Gemini REST API via the v1beta generateContent endpoint with the `X-goog-api-key` header (model: gemini-2.0-flash).
- Memory persists to a small JSON file in your Electron userData folder (nickname, inside jokes, flags).
 - In server mode, memory is stored under your user data directory (XDG_DATA_HOME on Linux) as `blob-memory.json`.
 - For auto-start on login, use your OS startup settings or a process manager (e.g., systemd user service or pm2) to run `npm run serve`.

Improvements for Plash and advanced desktop integration
- Cursor-aware overlays: In a web overlay (Plash), we already react to mouse move/hover. For deeper cursor or window/icon awareness, prefer Electron with a transparent, always-on-top window, global shortcuts, and potential screen capture permissions.
- Window snapping/edge docking: Add logic to snap the blob window to screen edges and follow the mouse between monitors (Electron only).
- Microphone/voice reactions: Add optional wake words and speech-to-text to let the blob respond out loud (Electron with microphone permissions).
- System presence: Integrate tray icon with quick toggles (mute quips, sleep mode), and minimize-to-tray behavior.
- Rich memory: Expand memory schema to track streaks (ignored hours), nicknames, and inside jokes frequency; schedule callbacks to change mood over days.
- Theming: Auto-adapt blob palette to OS theme (Electron nativeTheme) or desktop wallpaper colors (read wallpaper average color via OS APIs).
- Performance: Use OffscreenCanvas and requestAnimationFrame for smoother physics-based bobbing and trick animations.