import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pkmn', {
  onState: (cb) => ipcRenderer.on('state', (_e, payload) => cb(payload)),
  moveWindowBy: (dx, dy) => ipcRenderer.send('pkmn:move-window', { dx, dy }),
});
