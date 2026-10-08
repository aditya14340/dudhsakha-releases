const { contextBridge, ipcRenderer } = require('electron');

// Strict whitelist of IPC channels the renderer is allowed to INVOKE
const ALLOWED_INVOKE_CHANNELS = [
  'get-machine-id',
  'print-receipt',
  'print-pdf',
  'print-html',
  'open-pdf',
  'fat-machine-command',
  'fat-machine-2-command',
  'weight-machine-command',
  'restart-app-for-update',
  'open-external',
  'check-tts-voices',
  'save-device-settings',
  'load-device-settings',
  'rates:read-hashmap',
  'rates:full-rebuild',
];


// Strict whitelist of IPC channels the renderer is allowed to LISTEN on
const ALLOWED_RECEIVE_CHANNELS = [
  'fat-machine-data',
  'fat-machine-status',
  'fat-machine-ports',
  'fat-machine-connection',
  'fat-machine-2-data',
  'fat-machine-2-status',
  'fat-machine-2-ports',
  'fat-machine-2-connection',
  'weight-machine-data',
  'weight-machine-status',
  'weight-machine-ports',
  'weight-machine-connection',
  'weight-machine-zero-result',  // Auto Zero result from weight_bridge.py
  'update-available',
  'update-downloaded',
  'tts-voices-installed',  // fired when Indian voice packs finish installing
  'rates:cache-updated',   // fired by main process after rates:full-rebuild completes
];

contextBridge.exposeInMainWorld('electron', {
    versions: process.versions,

    getMachineId: () => ipcRenderer.invoke('get-machine-id'),

    printReceipt: (data, language, settings) =>
        ipcRenderer.invoke('print-receipt', data, language, settings),

    // Whitelisted invoke — only permitted channels can be called
    invoke: (channel, data) => {
        if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
        console.warn(`[Preload] Blocked invoke on unlisted channel: "${channel}"`);
        return Promise.reject(new Error(`Channel "${channel}" is not allowed.`));
    },

    // Whitelisted receive — only permitted channels can be subscribed to
    receive: (channel, func) => {
        if (!ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
            console.warn(`[Preload] Blocked receive on unlisted channel: "${channel}"`);
            return () => {};
        }
        const subscription = (_event, ...args) => func(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    }
});
