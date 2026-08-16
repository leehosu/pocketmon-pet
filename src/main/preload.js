import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pkmn', {
  onState: (cb) => ipcRenderer.on('state', (_e, payload) => cb(payload)),
});
