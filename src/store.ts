import { AppData, Project, Task, LinkItem, NoteItem, PROJECT_COLORS } from './types'
import { v4 as uuid } from 'uuid'

declare global {
  interface Window {
    api?: {
      loadData: () => Promise<AppData>
      saveData: (data: AppData) => Promise<boolean>
      onDataChanged: (callback: (data: AppData) => void) => void
      onMenuNewTask: (callback: () => void) => void
      onMenuNewProject: (callback: () => void) => void
      onMenuNavigate: (callback: (projectId: string | null) => void) => void
    }
  }
}

let data: AppData = { projects: [] }
let listeners: Array<() => void> = []

function notify() {
  listeners.forEach((fn) => fn())
  persist()
}

const STORAGE_KEY = 'todododo-data'

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
  if (window.api) {
    window.api.saveData(data)
  }
}

export function subscribe(fn: () => void) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

export function getSnapshot(): AppData {
  return data
}

function loadFromLocalStorage(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('taskboard-data')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function pickRicher(a: AppData | null, b: AppData | null): AppData {
  if (!a) return b || getDefaultData()
  if (!b) return a
  const aCount = a.projects.filter((p) => !p.archived).reduce((n, p) => n + 1 + p.tasks.length, 0)
  const bCount = b.projects.filter((p) => !p.archived).reduce((n, p) => n + 1 + p.tasks.length, 0)
  return aCount >= bCount ? a : b
}

export async function loadInitialData(): Promise<AppData> {
  let fileData: AppData | null = null
  if (window.api) {
    try { fileData = await window.api.loadData() } catch {}
    window.api.onDataChanged?.((freshData: AppData) => {
      data = freshData
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
      listeners.forEach((fn) => fn())
    })
  }
  const localData = loadFromLocalStorage()
  data = pickRicher(fileData, localData)
  persist()
  return data
}

function getDefaultData(): AppData {
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

export function getOrCreateGeneralProject(): Project {
  const existing = data.projects.find((p) => p.name === 'General' && !p.archived)
  if (existing) return existing
  return addProject('General')
}

function pickNextColor(): string {
  const usedColors = new Set(data.projects.map((p) => p.color).filter(Boolean))
  const available = PROJECT_COLORS.find((c) => !usedColors.has(c.hex))
  return available ? available.hex : PROJECT_COLORS[data.projects.length % PROJECT_COLORS.length].hex
}

export function addProject(name: string): Project {
  const project: Project = {
    id: uuid(),
    name,
    color: pickNextColor(),
    tasks: [],
    archivedTasks: [],
    noteItems: [],
    links: [],
  }
  data = { ...data, projects: [...data.projects, project] }
  notify()
  return project
}

export function archiveProject(projectId: string) {
  data = {
    ...data,
    projects: data.projects.map((p) => (p.id === projectId ? { ...p, archived: true } : p)),
  }
  notify()
}

export function restoreProject(projectId: string) {
  data = {
    ...data,
    projects: data.projects.map((p) => (p.id === projectId ? { ...p, archived: false } : p)),
  }
  notify()
}

export function deleteProject(projectId: string) {
  data = { ...data, projects: data.projects.filter((p) => p.id !== projectId) }
  notify()
}

export function renameProject(projectId: string, name: string) {
  data = {
    ...data,
    projects: data.projects.map((p) => (p.id === projectId ? { ...p, name } : p)),
  }
  notify()
}

export function reorderProjects(projects: Project[]) {
  data = { ...data, projects }
  notify()
}

export function updateProjectColor(projectId: string, color: string) {
  data = {
    ...data,
    projects: data.projects.map((p) => (p.id === projectId ? { ...p, color } : p)),
  }
  notify()
}

function updateProject(projectId: string, updater: (p: Project) => Project) {
  data = {
    ...data,
    projects: data.projects.map((p) => (p.id === projectId ? updater(p) : p)),
  }
  notify()
}

export function addTask(projectId: string, title: string): Task {
  const project = data.projects.find((p) => p.id === projectId)
  const maxPos = project?.tasks.reduce((max, t) => Math.max(max, t.position), -1) ?? -1
  const task: Task = {
    id: uuid(),
    title,
    completed: false,
    position: maxPos + 1,
  }
  updateProject(projectId, (p) => ({ ...p, tasks: [...p.tasks, task] }))
  return task
}

export function updateTask(projectId: string, taskId: string, updates: Partial<Task>) {
  updateProject(projectId, (p) => ({
    ...p,
    tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
  }))
}

export function getNextDueDate(currentDue: string | undefined, rule: string): string {
  const base = currentDue ? new Date(currentDue) : new Date()
  const today = new Date()
  const start = base > today ? base : today

  if (rule === 'daily') {
    start.setDate(start.getDate() + 1)
  } else if (rule === 'biweekly') {
    start.setDate(start.getDate() + 14)
  } else if (rule === 'monthly') {
    start.setMonth(start.getMonth() + 1)
  } else if (rule.startsWith('weekly:')) {
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    }
    const targetDay = dayMap[rule.split(':')[1]] ?? 1
    const current = start.getDay()
    let daysUntil = targetDay - current
    if (daysUntil <= 0) daysUntil += 7
    start.setDate(start.getDate() + daysUntil)
  }

  return start.toISOString().split('T')[0]
}

export function completeTask(projectId: string, taskId: string) {
  const project = data.projects.find((p) => p.id === projectId)
  const task = project?.tasks.find((t) => t.id === taskId)
  if (!task) return

  const archived: Task = {
    ...task,
    completed: true,
    completedAt: new Date().toISOString(),
    isRecurring: undefined,
    recurrenceRule: undefined,
  }

  if (task.isRecurring && task.recurrenceRule) {
    const nextDue = getNextDueDate(task.dueDate, task.recurrenceRule)
    const nextTask: Task = {
      ...task,
      id: uuid(),
      dueDate: nextDue,
      position: task.position,
    }
    updateProject(projectId, (p) => ({
      ...p,
      tasks: [...p.tasks.filter((t) => t.id !== taskId), nextTask],
      archivedTasks: [...p.archivedTasks, archived],
    }))
  } else {
    updateProject(projectId, (p) => ({
      ...p,
      tasks: p.tasks.filter((t) => t.id !== taskId),
      archivedTasks: [...p.archivedTasks, archived],
    }))
  }
}

export function deleteTask(projectId: string, taskId: string) {
  updateProject(projectId, (p) => ({
    ...p,
    tasks: p.tasks.filter((t) => t.id !== taskId),
  }))
}

export function insertTask(projectId: string, task: Task) {
  updateProject(projectId, (p) => {
    const tasks = [...p.tasks, task]
    tasks.sort((a, b) => a.position - b.position)
    return { ...p, tasks }
  })
}

export function moveTask(fromProjectId: string, taskId: string, toProjectId: string) {
  const fromProject = data.projects.find((p) => p.id === fromProjectId)
  const task = fromProject?.tasks.find((t) => t.id === taskId)
  if (!task) return
  const toProject = data.projects.find((p) => p.id === toProjectId)
  const maxPos = toProject?.tasks.reduce((max, t) => Math.max(max, t.position), -1) ?? -1
  const moved = { ...task, position: maxPos + 1 }
  data = {
    ...data,
    projects: data.projects.map((p) => {
      if (p.id === fromProjectId) return { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }
      if (p.id === toProjectId) return { ...p, tasks: [...p.tasks, moved] }
      return p
    }),
  }
  notify()
}

export function reorderTasks(projectId: string, tasks: Task[]) {
  const reordered = tasks.map((t, i) => ({ ...t, position: i }))
  updateProject(projectId, (p) => ({ ...p, tasks: reordered }))
}


export function addLink(projectId: string, title: string, url: string): LinkItem {
  const link: LinkItem = { id: uuid(), title, url }
  updateProject(projectId, (p) => ({ ...p, links: [...p.links, link] }))
  return link
}

export function updateLink(projectId: string, linkId: string, updates: Partial<LinkItem>) {
  updateProject(projectId, (p) => ({
    ...p,
    links: p.links.map((l) => (l.id === linkId ? { ...l, ...updates } : l)),
  }))
}

export function deleteLink(projectId: string, linkId: string) {
  updateProject(projectId, (p) => ({
    ...p,
    links: p.links.filter((l) => l.id !== linkId),
  }))
}

export function restoreTask(projectId: string, taskId: string) {
  const project = data.projects.find((p) => p.id === projectId)
  const task = project?.archivedTasks.find((t) => t.id === taskId)
  if (!task) return

  const maxPos = project?.tasks.reduce((max, t) => Math.max(max, t.position), -1) ?? -1
  const restored: Task = {
    ...task,
    completed: false,
    completedAt: undefined,
    position: maxPos + 1,
  }

  updateProject(projectId, (p) => ({
    ...p,
    archivedTasks: p.archivedTasks.filter((t) => t.id !== taskId),
    tasks: [...p.tasks, restored],
  }))
}

export function deleteArchivedTask(projectId: string, taskId: string) {
  updateProject(projectId, (p) => ({
    ...p,
    archivedTasks: p.archivedTasks.filter((t) => t.id !== taskId),
  }))
}

export function deleteArchivedTasks(projectId: string, taskIds: string[]) {
  const idSet = new Set(taskIds)
  updateProject(projectId, (p) => ({
    ...p,
    archivedTasks: p.archivedTasks.filter((t) => !idSet.has(t.id)),
  }))
}

export function addNote(projectId: string, title: string, content: string): NoteItem {
  const note: NoteItem = {
    id: uuid(),
    title,
    content,
    createdAt: new Date().toISOString(),
  }
  updateProject(projectId, (p) => ({
    ...p,
    noteItems: [...(p.noteItems || []), note],
  }))
  return note
}

export function updateNote(projectId: string, noteId: string, updates: Partial<NoteItem>) {
  updateProject(projectId, (p) => ({
    ...p,
    noteItems: (p.noteItems || []).map((n) => (n.id === noteId ? { ...n, ...updates } : n)),
  }))
}

export function deleteNote(projectId: string, noteId: string) {
  updateProject(projectId, (p) => ({
    ...p,
    noteItems: (p.noteItems || []).filter((n) => n.id !== noteId),
  }))
}

export function insertNote(projectId: string, note: NoteItem) {
  updateProject(projectId, (p) => ({ ...p, noteItems: [...(p.noteItems || []), note] }))
}

export function insertLink(projectId: string, link: LinkItem) {
  updateProject(projectId, (p) => ({ ...p, links: [...p.links, link] }))
}

export function reorderNotes(projectId: string, notes: NoteItem[]) {
  updateProject(projectId, (p) => ({ ...p, noteItems: notes }))
}

export function reorderLinks(projectId: string, links: LinkItem[]) {
  updateProject(projectId, (p) => ({ ...p, links }))
}
