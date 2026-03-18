import { app, BrowserWindow, ipcMain, shell, screen, Menu, MenuItem, Tray, globalShortcut, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = app.getPath('userData')
const IS_DEV = !!process.env.VITE_DEV_SERVER_URL
const DATA_FILE = path.join(DATA_DIR, IS_DEV ? 'todododo-dev-data.json' : 'todododo-data.json')
const WINDOW_STATE_FILE = path.join(DATA_DIR, IS_DEV ? 'todododo-dev-window-state.json' : 'todododo-window-state.json')
const PREFS_FILE = path.join(DATA_DIR, IS_DEV ? 'todododo-dev-prefs.json' : 'todododo-prefs.json')

const LEGACY_PATHS = [
  path.join(DATA_DIR, 'taskboard-data.json'),
  path.join(app.getPath('appData'), 'taskboard', 'taskboard-data.json'),
]

function getDefaultData() {
  return {
    projects: [
      {
        id: 'project-1',
        name: 'Getting Started',
        tasks: [
          {
            id: 'task-1',
            title: 'Welcome to todododo!',
            details: 'This is your first task. Click to expand details, or check the circle to complete it.',
            completed: false,
            position: 0,
          },
          {
            id: 'task-2',
            title: 'Try adding a new task',
            details: 'Use the input at the bottom of the to-do list to add tasks.',
            completed: false,
            position: 1,
          },
        ],
        archivedTasks: [],
        noteItems: [],
        links: [],
      },
    ],
  }
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(raw)
    }
    for (const legacyPath of LEGACY_PATHS) {
      if (fs.existsSync(legacyPath)) {
        const raw = fs.readFileSync(legacyPath, 'utf-8')
        const data = JSON.parse(raw)
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
        fs.writeFileSync(DATA_FILE, raw, 'utf-8')
        return data
      }
    }
  } catch {
    // fall through to default
  }
  return getDefaultData()
}

function saveData(data: unknown) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null

function loadWindowState(): { x?: number; y?: number; width: number; height: number } {
  try {
    if (fs.existsSync(WINDOW_STATE_FILE)) {
      const raw = fs.readFileSync(WINDOW_STATE_FILE, 'utf-8')
      const state = JSON.parse(raw)
      if (state.width && state.height) {
        if (state.x !== undefined && state.y !== undefined) {
          const visible = screen.getAllDisplays().some((d) => {
            const { x, y, width, height } = d.bounds
            return state.x >= x - 100 && state.x < x + width && state.y >= y - 100 && state.y < y + height
          })
          if (visible) return state
        }
        return { width: state.width, height: state.height }
      }
    }
  } catch { /* use defaults */ }
  return { width: 1100, height: 750 }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const bounds = mainWindow.getBounds()
  fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(bounds), 'utf-8')
}

function loadPrefs(): { showTrayIcon: boolean } {
  try {
    if (fs.existsSync(PREFS_FILE)) {
      return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8'))
    }
  } catch { /* use defaults */ }
  return { showTrayIcon: true }
}

function savePrefs(prefs: { showTrayIcon: boolean }) {
  fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs), 'utf-8')
}

function debounceSaveWindowState() {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
  saveBoundsTimer = setTimeout(saveWindowState, 500)
}

function createWindow() {
  const windowState = loadWindowState()

  mainWindow = new BrowserWindow({
    title: 'todododo',
    ...windowState,
    minWidth: 400,
    minHeight: 300,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#fafafa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })

  mainWindow.on('resize', debounceSaveWindowState)
  mainWindow.on('move', debounceSaveWindowState)

  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()

    for (const suggestion of params.dictionarySuggestions) {
      menu.append(new MenuItem({
        label: suggestion,
        click: () => mainWindow?.webContents.replaceMisspelling(suggestion),
      }))
    }

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }))
      }
      menu.append(new MenuItem({
        label: 'Add to Dictionary',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      }))
    }

    if (menu.items.length > 0) {
      menu.popup()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function quickAddTask(title: string) {
  const data = loadData()
  let general = (data.projects || []).find(
    (p: { name: string; archived?: boolean }) => p.name === 'General' && !p.archived
  )
  if (!general) {
    general = {
      id: generateId(),
      name: 'General',
      tasks: [],
      archivedTasks: [],
      noteItems: [],
      links: [],
    }
    data.projects = [general, ...(data.projects || [])]
  }
  const maxPos = (general.tasks || []).reduce(
    (max: number, t: { position?: number }) => Math.max(max, t.position ?? 0),
    -1
  )
  general.tasks.push({
    id: generateId(),
    title,
    completed: false,
    position: maxPos + 1,
  })
  lastSaveTime = Date.now()
  saveData(data)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('data-changed', data)
  }
  buildAppMenu()
}

let mainWasVisible = false
let captureClosedAt = 0

function showCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.close()
    return
  }

  if (Date.now() - captureClosedAt < 500) return

  mainWasVisible = mainWindow?.isVisible() ?? false

  const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width } = activeDisplay.workArea
  const winWidth = 340
  const winHeight = 100

  captureWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: x + Math.round((width - winWidth) / 2),
    y: y + 80,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    transparent: true,
    vibrancy: 'popover',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'capture-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  captureWindow.loadFile(path.join(__dirname, 'capture.html'))
  captureWindow.once('ready-to-show', () => captureWindow?.show())
  captureWindow.on('blur', () => {
    captureWindow?.close()
  })
  captureWindow.on('closed', () => {
    captureClosedAt = Date.now()
    captureWindow = null
    if (!mainWasVisible && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide()
    }
  })
}

function createTray() {
  const raw = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png'))
  const icon = raw.resize({ width: 22, height: 22 })
  tray = new Tray(icon)
  tray.setToolTip('todododo — Quick capture')
  tray.on('click', () => showCaptureWindow())

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quick Capture', click: () => showCaptureWindow() },
    { label: 'Open todododo', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Hide from Menu Bar', click: () => setTrayVisible(false) },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } },
  ])
  tray.on('right-click', () => tray?.popUpContextMenu(contextMenu))
}

function setTrayVisible(visible: boolean) {
  if (visible && (!tray || tray.isDestroyed())) {
    createTray()
  } else if (!visible && tray && !tray.isDestroyed()) {
    tray.destroy()
    tray = null
  }
  savePrefs({ showTrayIcon: visible })
  buildAppMenu()
}

function buildAppMenu() {
  const data = loadData()
  const projects = (data.projects || []).filter((p: { archived?: boolean }) => !p.archived)

  const projectMenuItems: Electron.MenuItemConstructorOptions[] = projects.slice(0, 15).map(
    (p: { id: string; name: string }) => ({
      label: p.name,
      click: () => mainWindow?.webContents.send('menu-navigate', p.id),
    })
  )

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Task',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu-new-task'),
        },
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => mainWindow?.webContents.send('menu-new-project'),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Main Board',
          click: () => mainWindow?.webContents.send('menu-navigate', null),
        },
        ...(projectMenuItems.length > 0
          ? [{ type: 'separator' as const }, ...projectMenuItems]
          : []),
        { type: 'separator' },
        {
          label: 'Show Menu Bar Icon',
          type: 'checkbox',
          checked: tray !== null && !tray.isDestroyed(),
          click: (mi: Electron.MenuItem) => setTrayVisible(mi.checked),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.on('before-quit', () => {
  isQuitting = true
})

let lastSaveTime = 0
let fileWatcher: fs.FSWatcher | null = null

function startFileWatcher() {
  if (fileWatcher) return
  try {
    fileWatcher = fs.watch(DATA_FILE, { persistent: false }, (eventType) => {
      if (eventType !== 'change') return
      if (Date.now() - lastSaveTime < 1000) return
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8')
        const freshData = JSON.parse(raw)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('data-changed', freshData)
        }
        buildAppMenu()
      } catch { /* ignore parse errors from partial writes */ }
    })
  } catch { /* file may not exist yet */ }
}

app.whenReady().then(() => {
  ipcMain.handle('load-data', () => loadData())
  ipcMain.handle('save-data', (_event, data) => {
    lastSaveTime = Date.now()
    saveData(data)
    buildAppMenu()
    return true
  })
  ipcMain.handle('quick-add-task', (_event, title: string) => {
    quickAddTask(title)
    return true
  })
  ipcMain.on('capture-close', () => {
    captureWindow?.close()
  })

  createWindow()
  buildAppMenu()
  startFileWatcher()
  if (loadPrefs().showTrayIcon) createTray()

  globalShortcut.register('CommandOrControl+Shift+T', () => {
    showCaptureWindow()
  })

  app.on('activate', () => {
    if (Date.now() - captureClosedAt < 500) return
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    } else {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
