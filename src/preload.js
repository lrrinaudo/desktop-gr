const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
	invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
	send: (channel, ...args) => ipcRenderer.send(channel, ...args),
});
