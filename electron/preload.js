const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blobAPI', {
  askLLM: async ({ prompt, mood, nickname, insideJokes }) => {
    return await ipcRenderer.invoke('blob:llm', { prompt, mood, nickname, insideJokes });
  },
  getMemory: async (key) => {
    return await ipcRenderer.invoke('blob:memory:get', key);
  },
  setMemory: async (key, value) => {
    return await ipcRenderer.invoke('blob:memory:set', { key, value });
  },
  goodbye: async () => {
    return await ipcRenderer.invoke('blob:goodbye');
  },
  invokeQuit: async () => {
    return await ipcRenderer.invoke('blob:quit');
  }
});
