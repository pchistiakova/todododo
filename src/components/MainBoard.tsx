import { useState, useEffect, useRef } from 'react'
import { AppData, getColorStyles, DEFAULT_COLOR, resolveColor } from '../types'
import { addProject, addTask, updateTask, renameProject, reorderProjects, restoreProject, deleteProject, archiveProject, completeTask, deleteTask, moveTask, getNextDueDate, getOrCreateGeneralProject } from '../store'
import { Project } from '../types'
import ContextMenu, { MenuItem } from './ContextMenu'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  data: AppData
  onOpenProject: (id: string, taskId?: string) => void
  triggerNewTask?: number
  searchBar?: React.ReactNode
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDueDateColor(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'text-red-500'
  if (diffDays === 0) return 'text-orange-500'
  if (diffDays === 1) return 'text-amber-500'
  return 'text-gray-600'
}

function SortableProjectRow({
  project,
  onOpenProject,
}: {
  project: AppData['projects'][number]
  onOpenProject: (id: string, taskId?: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  })
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const clickTimer = useRef<number | null>(null)
  const editStarted = useRef(0)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const openCount = project.tasks.filter((t) => !t.completed).length

  function saveRename() {
    if (Date.now() - editStarted.current < 200) return
    const trimmed = editName.trim()
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed)
    }
    setEditing(false)
  }

  const projectCtxItems: MenuItem[] = [
    { label: 'Open', onClick: () => onOpenProject(project.id) },
    { label: 'Rename', onClick: () => { editStarted.current = Date.now(); setEditName(project.name); setEditing(true) } },
    'separator',
    { label: 'Archive', onClick: () => archiveProject(project.id) },
    { label: 'Delete', onClick: () => deleteProject(project.id), danger: true },
  ]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center [backface-visibility:hidden]"
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
    >
      <button
        className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 p-1 touch-none"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      {editing ? (
        <div className="flex-1 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: resolveColor(project.color) }} />
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename()
                if (e.key === 'Escape') { setEditName(project.name); setEditing(false) }
              }}
              className="font-medium text-gray-700 bg-transparent border-b border-accent outline-none flex-1 min-w-0"
            />
          </div>
          <span className="text-xs text-gray-400 tabular-nums flex-shrink-0 ml-2">{openCount} tasks</span>
        </div>
      ) : (
        <div
          onClick={(e) => {
            if (e.detail >= 2) {
              if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null }
              return
            }
            clickTimer.current = window.setTimeout(() => {
              clickTimer.current = null
              onOpenProject(project.id)
            }, 200)
          }}
          onDoubleClick={() => {
            if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null }
            editStarted.current = Date.now()
            setEditName(project.name)
            setEditing(true)
          }}
          className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg transition-colors duration-150 text-left group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: resolveColor(project.color) }} />
            <span className="font-medium text-[13px] text-gray-700 group-hover:text-gray-900 truncate">
              {project.name}
            </span>
          </div>
          <span className="text-xs text-gray-400 tabular-nums flex-shrink-0 ml-2">{openCount} tasks</span>
        </div>
      )}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={projectCtxItems} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}

function UpcomingTaskRow({
  task,
  allProjects,
  onOpenProject,
}: {
  task: { id: string; title: string; dueDate: string; projectName: string; projectId: string }
  allProjects: Project[]
  onOpenProject: (id: string, taskId?: string) => void
}) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const clickTimer = useRef<number | null>(null)
  const editStarted = useRef(0)

  function saveTitle() {
    if (Date.now() - editStarted.current < 200) return
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== task.title) {
      updateTask(task.projectId, task.id, { title: trimmed })
    }
    setEditing(false)
  }

  const otherProjects = allProjects.filter((p) => p.id !== task.projectId && !p.archived)

  const taskCtxItems: MenuItem[] = [
    { label: 'Open in project', onClick: () => onOpenProject(task.projectId, task.id) },
    { label: 'Complete', onClick: () => completeTask(task.projectId, task.id) },
    { label: 'Change due date', onClick: () => setShowDatePicker(true) },
    ...(otherProjects.length > 0 ? [
      { label: 'Move to', submenu: otherProjects.map((p) => ({
        label: p.name,
        onClick: () => moveTask(task.projectId, task.id, p.id),
      })) },
    ] : []),
    'separator' as const,
    { label: 'Delete', onClick: () => deleteTask(task.projectId, task.id), danger: true },
  ]

  return (
    <div
      className="w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors duration-150 text-left group"
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
    >
      <button
        onClick={() => completeTask(task.projectId, task.id)}
        className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-accent hover:bg-accent/10 transition-all shrink-0 flex items-center justify-center mr-2.5"
        title="Complete task"
      >
        <svg className="w-2.5 h-2.5 text-transparent group-hover:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </button>
      {editing ? (
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') { setEditTitle(task.title); setEditing(false) }
            }}
            className="text-[13px] text-gray-700 bg-transparent border-b border-accent outline-none flex-1 min-w-0"
          />
          <span className="text-xs text-gray-300 flex-shrink-0">/ {task.projectName}</span>
        </div>
      ) : (
        <div
          onClick={(e) => {
            if (e.detail >= 2) {
              if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null }
              return
            }
            clickTimer.current = window.setTimeout(() => {
              clickTimer.current = null
              onOpenProject(task.projectId, task.id)
            }, 200)
          }}
          onDoubleClick={() => {
            if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null }
            editStarted.current = Date.now()
            setEditTitle(task.title)
            setEditing(true)
          }}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        >
          <span className="text-[13px] text-gray-700 truncate">{task.title}</span>
          <span className="text-xs text-gray-300 flex-shrink-0">/ {task.projectName}</span>
        </div>
      )}
      <span className="flex-shrink-0 ml-2">
        {showDatePicker ? (
          <input
            autoFocus
            type="date"
            value={task.dueDate}
            onChange={(e) => {
              if (e.target.value) {
                updateTask(task.projectId, task.id, { dueDate: e.target.value })
              }
              setShowDatePicker(false)
            }}
            onBlur={() => setShowDatePicker(false)}
            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-accent transition-colors"
          />
        ) : (
          <button
            onClick={() => setShowDatePicker(true)}
            className={`text-[13px] ${getDueDateColor(task.dueDate)} hover:underline cursor-pointer`}
          >
            {formatDueDate(task.dueDate)}
          </button>
        )}
      </span>
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={taskCtxItems} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}

export default function MainBoard({ data, onOpenProject, triggerNewTask, searchBar }: Props) {
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [showArchivedProjects, setShowArchivedProjects] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskProject, setNewTaskProject] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [taskCreatedToast, setTaskCreatedToast] = useState<{ name: string; id: string } | null>(null)

  useEffect(() => {
    if (!taskCreatedToast) return
    const id = window.setTimeout(() => setTaskCreatedToast(null), 4000)
    return () => clearTimeout(id)
  }, [taskCreatedToast])

  useEffect(() => {
    if (triggerNewTask && triggerNewTask > 0) {
      setShowNewTask(true)
    }
  }, [triggerNewTask])

  const activeProjects = data.projects.filter((p) => !p.archived)
  const archivedProjects = data.projects.filter((p) => p.archived)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const upcomingTasks = activeProjects
    .flatMap((p) =>
      p.tasks
        .filter((t) => !t.completed && (t.dueDate || (t.isRecurring && t.recurrenceRule)))
        .map((t) => {
          const effectiveDue = t.isRecurring && t.recurrenceRule
            ? (t.dueDate || getNextDueDate(undefined, t.recurrenceRule))
            : t.dueDate!
          return { ...t, dueDate: effectiveDue, projectName: p.name, projectId: p.id }
        })
    )
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())

  function handleAddProject() {
    const name = newProjectName.trim()
    if (!name) return
    addProject(name)
    setNewProjectName('')
    setShowNewProject(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = activeProjects.findIndex((p) => p.id === active.id)
    const newIndex = activeProjects.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...activeProjects]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderProjects([...reordered, ...archivedProjects])
  }

  function handleAddTask() {
    const title = newTaskTitle.trim()
    if (!title) return
    let projectId = newTaskProject
    let projectName = ''
    if (projectId) {
      projectName = activeProjects.find((p) => p.id === projectId)?.name || ''
    } else {
      const general = getOrCreateGeneralProject()
      projectId = general.id
      projectName = general.name
    }
    const task = addTask(projectId, title)
    if (newTaskDueDate) {
      updateTask(projectId, task.id, { dueDate: newTaskDueDate })
    }
    setNewTaskTitle('')
    setNewTaskDueDate('')
    setNewTaskProject('')
    setShowNewTask(false)
    setTaskCreatedToast({ name: projectName, id: projectId })
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 sm:px-12">
      <div className="min-h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0 pt-1">
        <h1 className="text-xl font-semibold text-gray-900 whitespace-nowrap">Main Board</h1>
        {searchBar}
      </div>

      {/* Projects — capped height, inner scroll */}
      <section className="shrink-0 mb-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">Projects</h2>
          <button
            onClick={() => setShowNewProject(true)}
            className="text-xs text-accent hover:text-accent-dark transition-colors"
          >
            + New project
          </button>
        </div>

        <div className="max-h-[30vh] min-h-[80px] overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeProjects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-px">
                {activeProjects.map((project) => (
                  <SortableProjectRow
                    key={project.id}
                    project={project}
                    onOpenProject={onOpenProject}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {showNewProject && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAddProject()
              }}
              className="flex items-center gap-2 px-4 py-1.5 ml-6"
            >
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onBlur={() => {
                  if (newProjectName.trim()) { handleAddProject() } else { setShowNewProject(false) }
                }}
                placeholder="Project name..."
                className="flex-1 text-[13px] bg-transparent border-b border-gray-200 focus:border-accent outline-none py-1 transition-colors"
              />
              <button
                type="submit"
                className="text-xs text-accent hover:text-accent-dark px-2 py-1"
              >
                Add
              </button>
            </form>
          )}

          {activeProjects.length === 0 && !showNewProject && (
            <p className="text-[13px] text-gray-400 px-4 py-4">
              No projects yet. Create one to get started.
            </p>
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="shrink-0 border-t border-gray-100 my-3" />

      {/* Tasks with due dates — fills remaining, inner scroll */}
      <section className="flex-1 min-h-[120px] flex flex-col overflow-hidden pb-4">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 whitespace-nowrap">
            Tasks with due dates
          </h2>
          <button
            onClick={() => {
              setNewTaskProject('')
              setShowNewTask(true)
            }}
            className="text-xs text-accent hover:text-accent-dark transition-colors"
          >
            + New task
          </button>
        </div>

        {showNewTask && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddTask() }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (newTaskTitle.trim()) {
                  handleAddTask()
                } else {
                  setNewTaskTitle('')
                  setNewTaskDueDate('')
                  setNewTaskProject('')
                  setShowNewTask(false)
                }
              }
            }}
            className="shrink-0 flex items-center gap-2 mb-2 px-1"
          >
            <input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setNewTaskTitle(''); setNewTaskDueDate(''); setShowNewTask(false) }
              }}
              placeholder="Task title..."
              className="flex-1 min-w-0 text-[13px] bg-transparent border-b border-gray-200 focus:border-accent outline-none py-1 transition-colors"
            />
            <select
              value={newTaskProject}
              onChange={(e) => setNewTaskProject(e.target.value)}
              className="text-xs border border-gray-200 rounded pl-2.5 pr-6 py-1.5 bg-white outline-none focus:border-accent transition-colors max-w-[140px] truncate appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
            >
              <option value="">General</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              className="text-xs text-accent hover:text-accent-dark px-2 py-1 shrink-0"
            >
              Add
            </button>
          </form>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
        {upcomingTasks.length > 0 ? (
          <div className="space-y-px">
            {upcomingTasks.map((task) => (
              <UpcomingTaskRow key={task.id} task={task} allProjects={activeProjects} onOpenProject={onOpenProject} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-gray-300 px-4 py-3">
            No tasks with due dates yet.
          </p>
        )}

      {/* Project Archive */}
      {archivedProjects.length > 0 && (
        <div className="pt-4">
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={() => setShowArchivedProjects(!showArchivedProjects)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-gray-400 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showArchivedProjects ? 'rotate-90' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              Project Archive
              <span className="text-gray-200">{archivedProjects.length}</span>
            </button>

            {showArchivedProjects && (
              <div className="mt-1.5 space-y-px">
                {archivedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg group hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full opacity-40"
                        style={{ backgroundColor: resolveColor(project.color) }}
                      />
                      <span className="text-[13px] text-gray-400">{project.name}</span>
                      <span className="text-xs text-gray-300">{project.tasks.length} tasks</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => restoreProject(project.id)}
                        className="text-xs text-gray-400 hover:text-accent px-2 py-0.5 rounded transition-colors"
                      >
                        Restore
                      </button>
                      {deleteConfirmId === project.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { deleteProject(project.id); setDeleteConfirmId(null) }}
                            className="text-xs text-red-500 hover:text-red-600 px-1.5 py-0.5 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-gray-400 hover:text-gray-500 px-1.5 py-0.5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(project.id)}
                          className="text-xs text-gray-300 hover:text-red-500 px-2 py-0.5 rounded transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </section>
      </div>

      {taskCreatedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gray-800 text-white text-[13px] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span>Task created in{' '}
              <button
                onClick={() => { onOpenProject(taskCreatedToast.id); setTaskCreatedToast(null) }}
                className="underline underline-offset-2 font-semibold hover:text-accent-light transition-colors"
              >
                {taskCreatedToast.name}
              </button>
            </span>
            <button
              onClick={() => setTaskCreatedToast(null)}
              className="text-gray-400 hover:text-white ml-1"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
