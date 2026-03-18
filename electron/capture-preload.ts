const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('captureApi', {
  addTask: (title: string) => ipcRenderer.invoke('quick-add-task', title),
  close: () => ipcRenderer.send('capture-close'),
})
