const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data: unknown) => ipcRenderer.invoke('save-data', data),
  onDataChanged: (callback: (data: unknown) => void) => {
    ipcRenderer.on('data-changed', (_event: unknown, data: unknown) => callback(data))
  },
  onMenuNewTask: (callback: () => void) => {
    ipcRenderer.on('menu-new-task', () => callback())
  },
  onMenuNewProject: (callback: () => void) => {
    ipcRenderer.on('menu-new-project', () => callback())
  },
  onMenuNavigate: (callback: (projectId: string | null) => void) => {
    ipcRenderer.on('menu-navigate', (_event: unknown, projectId: string | null) => callback(projectId))
  },
})
