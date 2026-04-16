/**
 * Preload script - exposes safe APIs to the renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('opentradex', {
  // Gateway
  getGatewayUrl: () => ipcRenderer.invoke('get-gateway-url'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Events from main process
  onRunCycle: (callback: () => void) => {
    ipcRenderer.on('run-cycle', callback);
    return () => ipcRenderer.removeListener('run-cycle', callback);
  },
  onToggleAutoloop: (callback: () => void) => {
    ipcRenderer.on('toggle-autoloop', callback);
    return () => ipcRenderer.removeListener('toggle-autoloop', callback);
  },
  onPanic: (callback: () => void) => {
    ipcRenderer.on('panic', callback);
    return () => ipcRenderer.removeListener('panic', callback);
  },
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback);
    return () => ipcRenderer.removeListener('open-settings', callback);
  },

  // Platform info
  platform: process.platform,
});

// Type declaration for window.opentradex
declare global {
  interface Window {
    opentradex: {
      getGatewayUrl: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      onRunCycle: (callback: () => void) => () => void;
      onToggleAutoloop: (callback: () => void) => () => void;
      onPanic: (callback: () => void) => () => void;
      onOpenSettings: (callback: () => void) => () => void;
      platform: NodeJS.Platform;
    };
  }
}
