import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pkmn', {
  onState: (cb) => ipcRenderer.on('state', (_e, payload) => cb(payload)),
  moveWindowBy: (dx, dy) => ipcRenderer.send('pkmn:move-window', { dx, dy }),
  setDetail: (open) => ipcRenderer.send('pkmn:set-detail', !!open),
  playSkill: (effect) => ipcRenderer.send('pkmn:play-skill', String(effect)),
  hatch: () => ipcRenderer.send('pkmn:hatch'),
  evolve: () => ipcRenderer.send('pkmn:evolve'),
  onWildState: (cb) => ipcRenderer.on('wild-state', (_e, payload) => cb(payload)),
  acceptEncounter: (id) => ipcRenderer.send('pkmn:accept-encounter', String(id)),
  onBattleState: (cb) => ipcRenderer.on('battle-state', (_e, payload) => cb(payload)),
  selectBattleMove: (payload) => ipcRenderer.send('pkmn:battle-move', payload),
  leaveBattle: (id) => ipcRenderer.send('pkmn:leave-battle', String(id)),
});
