import { useState, useCallback, useEffect, useRef } from 'react'
import { Project, Task } from '../types'
import { addTask, updateTask, completeTask, deleteTask, insertTask, reorderTasks, getNextDueDate, moveTask } from '../store'
import ContextMenu, { MenuItem } from './ContextMenu'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapTaskList from '@tiptap/extension-task-list'
import TiptapTaskItem from '@tiptap/extension-task-item'
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
  project: Project
  allProjects: Project[]
  onNavigate?: (projectId: string) => void
  highlightId?: string
  onHighlightDone?: () => void
  accentColor?: string
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
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'text-red-500'
  if (diff === 0) return 'text-orange-500'
  if (diff <= 1) return 'text-amber-500'
  return 'text-gray-600'
}

function isDueSoon(dateStr?: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 7
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function SortableTaskItem({ task, projectId, allProjects, onDelete, onMove, isHighlighted, accentColor }: { task: Task; projectId: string; allProjects: Project[]; onDelete: (task: Task) => void; onMove: (name: string, id: string) => void; isHighlighted?: boolean; accentColor?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const itemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHighlighted && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isHighlighted])

  return (
    <div ref={setNodeRef} style={style}>
      <div
        ref={itemRef}
        className={isHighlighted ? 'search-highlight' : ''}
        style={isHighlighted && accentColor ? { '--accent': accentColor } as React.CSSProperties : undefined}
      >
        <TaskItem
          task={task}
          projectId={projectId}
          allProjects={allProjects}
          dragHandleProps={{ ...attributes, ...listeners }}
          onDelete={onDelete}
          onMove={onMove}
        />
      </div>
    </div>
  )
}

function TaskItem({
  task,
  projectId,
  allProjects,
  dragHandleProps,
  onDelete,
  onMove,
}: {
  task: Task
  projectId: string
  allProjects: Project[]
  dragHandleProps?: Record<string, unknown>
  onDelete: (task: Task) => void
  onMove: (name: string, id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [inlineEditing, setInlineEditing] = useState(false)
  const [inlineTitle, setInlineTitle] = useState(task.title)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const taskItemRef = useRef<HTMLDivElement>(null)

  const hasContent = !!(task.details || task.link || (task.isRecurring && task.recurrenceRule))

  useEffect(() => {
    if (!expanded || editing || hasContent) return
    function handleClickOutside(e: MouseEvent) {
      if (taskItemRef.current && !taskItemRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded, editing, hasContent])
  const [title, setTitle] = useState(task.title)
  const [details, setDetails] = useState(task.details || '')
  const [link, setLink] = useState(task.link || '')
  const [linkLabel, setLinkLabel] = useState(task.linkLabel || '')
  const [dueDate, setDueDate] = useState(task.dueDate || '')

  const effectiveDueDate = task.isRecurring && task.recurrenceRule
    ? (task.dueDate || getNextDueDate(undefined, task.recurrenceRule))
    : task.dueDate

  const dueSoon = isDueSoon(effectiveDueDate)

  function handleSave() {
    updateTask(projectId, task.id, {
      title,
      details: details || undefined,
      link: link || undefined,
      linkLabel: linkLabel || undefined,
      dueDate: dueDate || undefined,
    })
    setEditing(false)
  }

  function handleMoveToProject(toProjectId: string) {
    const target = allProjects.find((p) => p.id === toProjectId)
    if (!target) return
    updateTask(projectId, task.id, {
      title, details: details || undefined, link: link || undefined,
      linkLabel: linkLabel || undefined, dueDate: dueDate || undefined,
    })
    moveTask(projectId, task.id, toProjectId)
    onMove(target.name, target.id)
  }

  function saveInlineTitle() {
    const trimmed = inlineTitle.trim()
    if (trimmed && trimmed !== task.title) {
      updateTask(projectId, task.id, { title: trimmed })
      setTitle(trimmed)
    }
    setInlineEditing(false)
  }

  const dueDateColor = effectiveDueDate ? getDueDateColor(effectiveDueDate) : ''

  const otherProjects = allProjects.filter((p) => p.id !== projectId && !p.archived)

  const contextMenuItems: MenuItem[] = [
    { label: 'Edit', onClick: () => { setExpanded(true); setEditing(true) } },
    { label: task.completed ? 'Mark incomplete' : 'Complete', onClick: () => completeTask(projectId, task.id) },
    { label: 'Change due date', onClick: () => setShowDatePicker(true) },
    ...(otherProjects.length > 0 ? [
      { label: 'Move to', submenu: otherProjects.map((p) => ({
        label: p.name,
        onClick: () => handleMoveToProject(p.id),
      })) },
    ] : []),
    'separator' as const,
    { label: 'Delete', onClick: () => onDelete(task), danger: true },
  ]

  return (
    <div ref={taskItemRef} className="group border-b border-gray-50 last:border-0">
      <div
        className="flex items-start gap-2 px-4 py-1.5"
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
      >
        {/* Drag handle */}
        <button
          className="mt-1 text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          title="Drag to reorder"
          {...dragHandleProps}
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

        {/* Completion circle */}
        <button
          onClick={() => completeTask(projectId, task.id)}
          className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-accent hover:bg-accent/10 transition-all shrink-0 flex items-center justify-center"
          title="Complete task"
        >
          <svg
            className="w-3 h-3 text-transparent group-hover:text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="w-full flex items-center justify-between">
            {inlineEditing ? (
              <div className="flex-1 min-w-0">
                <input
                  autoFocus
                  value={inlineTitle}
                  onChange={(e) => setInlineTitle(e.target.value)}
                  onBlur={saveInlineTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineTitle()
                    if (e.key === 'Escape') { setInlineTitle(task.title); setInlineEditing(false) }
                  }}
                  className="w-full text-[13px] text-gray-700 bg-white border border-accent/40 rounded px-1.5 py-0.5 outline-none focus:border-accent"
                />
              </div>
            ) : (
              <div
                onClick={() => {
                  if (window.getSelection()?.toString()) return
                  setExpanded(!expanded)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setInlineTitle(task.title)
                  setInlineEditing(true)
                }}
                className="flex-1 text-left flex items-center min-w-0 cursor-pointer select-text"
              >
                <span className="text-[13px] text-gray-700 flex-1 min-w-0">{task.title}</span>
                {task.isRecurring && (
                  <svg className="w-3.5 h-3.5 text-gray-300 shrink-0 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
                    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                  </svg>
                )}
                <svg
                  className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ml-1 ${expanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0 ml-3">
              {effectiveDueDate && (
                showDatePicker ? (
                  <input
                    autoFocus
                    type="date"
                    value={dueDate || effectiveDueDate}
                    onChange={(e) => {
                      const val = e.target.value
                      setDueDate(val)
                      updateTask(projectId, task.id, { dueDate: val || undefined })
                      setShowDatePicker(false)
                    }}
                    onBlur={() => setShowDatePicker(false)}
                    className="text-xs border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-accent transition-colors"
                  />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDatePicker(true)
                    }}
                    className={`text-xs ${dueDateColor} hover:underline cursor-pointer`}
                  >
                    {formatDueDate(effectiveDueDate)}
                  </button>
                )
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(task)
                }}
                className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded hover:bg-red-50"
                title="Delete task"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {expanded && !editing && (
            <div
              className="mt-2 space-y-1.5 cursor-pointer"
              onDoubleClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) return
                setEditing(true)
              }}
            >
              {task.details && (
                <div
                  className="text-xs text-gray-400 leading-relaxed select-text [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_ul:not([data-type=taskList])]:pl-4 [&_ol]:pl-4 [&_ul:not([data-type=taskList])]:list-disc [&_ol]:list-decimal"
                  dangerouslySetInnerHTML={{ __html: task.details }}
                />
              )}
              {task.link && (
                <a
                  href={task.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  {task.linkLabel || extractDomain(task.link)}
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </a>
              )}
              {task.isRecurring && task.recurrenceRule && (
                <span className="text-xs text-gray-300">
                  Repeats: {formatRecurrence(task.recurrenceRule)}
                </span>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {expanded && editing && (
            <EditForm
              title={title}
              setTitle={setTitle}
              details={details}
              setDetails={setDetails}
              link={link}
              setLink={setLink}
              linkLabel={linkLabel}
              setLinkLabel={setLinkLabel}
              dueDate={dueDate}
              setDueDate={setDueDate}
              isRecurring={task.isRecurring}
              recurrenceRule={task.recurrenceRule}
              projectId={projectId}
              taskId={task.id}
              allProjects={allProjects}
              onMoveToProject={handleMoveToProject}
              onSave={() => setEditing(false)}
              onCancel={() => {
                setEditing(false)
                setTitle(task.title)
                setDetails(task.details || '')
                setLink(task.link || '')
                setLinkLabel(task.linkLabel || '')
                setDueDate(task.dueDate || '')
              }}
            />
          )}
        </div>
      </div>
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}

function MiniEditor({
  initialContent,
  onChange,
}: {
  initialContent: string
  onChange: (html: string) => void
}) {
  const handleUpdate = useCallback(
    ({ editor }: { editor: { getHTML: () => string } }) => {
      onChange(editor.getHTML())
    },
    [onChange]
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapTaskList,
      TiptapTaskItem.configure({ nested: true }),
    ],
    content: initialContent || '<p></p>',
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: 'px-3 py-1.5 outline-none min-h-[48px] text-xs text-gray-600 leading-relaxed',
      },
    },
  })

  if (!editor) return null

  const btnClass = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-xs transition-colors ${
      active ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden focus-within:border-accent transition-colors bg-white">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 bg-gray-50/50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))}>
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))}>
          <em>I</em>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))}>
          <s>S</s>
        </button>
        <div className="w-px h-3 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))}>
          &bull; List
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))}>
          1. List
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={btnClass(editor.isActive('taskList'))}>
          &#9745; Check
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function EditForm({
  title, setTitle,
  details, setDetails,
  link, setLink,
  linkLabel, setLinkLabel,
  dueDate, setDueDate,
  isRecurring,
  recurrenceRule,
  projectId,
  taskId,
  allProjects,
  onMoveToProject,
  onSave,
  onCancel,
}: {
  title: string; setTitle: (v: string) => void
  details: string; setDetails: (v: string) => void
  link: string; setLink: (v: string) => void
  linkLabel: string; setLinkLabel: (v: string) => void
  dueDate: string; setDueDate: (v: string) => void
  isRecurring?: boolean
  recurrenceRule?: string
  projectId: string
  taskId: string
  allProjects: Project[]
  onMoveToProject: (toProjectId: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const [recurring, setRecurring] = useState(isRecurring || false)
  const [rule, setRule] = useState(recurrenceRule || 'weekly:monday')
  const [moved, setMoved] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const otherProjects = allProjects.filter((p) => p.id !== projectId && !p.archived)

  function handleSave() {
    if (moved) return
    updateTask(projectId, taskId, {
      title,
      details: details || undefined,
      link: link || undefined,
      linkLabel: linkLabel || undefined,
      dueDate: dueDate || undefined,
      isRecurring: recurring || undefined,
      recurrenceRule: recurring ? rule : undefined,
    })
    onSave()
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        handleSaveRef.current()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div
      ref={formRef}
      className="mt-3 space-y-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
        placeholder="Task title"
      />
      <MiniEditor initialContent={details} onChange={setDetails} />
      <div className="flex gap-2">
        <input
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          className="w-1/3 text-xs border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
          placeholder="Label (optional)"
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="w-2/3 text-xs border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
          placeholder="https://..."
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="rounded border-gray-300 text-accent focus:ring-accent"
          />
          Recurring
        </label>
        <div className="flex-1" />
        {otherProjects.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setMoved(true)
                onMoveToProject(e.target.value)
              }
            }}
            className="text-xs border border-gray-200 rounded-md pl-2.5 pr-6 py-1.5 bg-white outline-none focus:border-accent transition-colors text-gray-400 max-w-[140px] truncate appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
          >
            <option value="">Move to...</option>
            {otherProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={handleSave}
          className="text-xs bg-accent text-white px-3 py-1 rounded-md hover:bg-accent-dark transition-colors"
        >
          Save
        </button>
      </div>
      {recurring && (
        <select
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          className="text-xs border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
        >
          <option value="daily">Every day</option>
          <option value="weekly:monday">Every Monday</option>
          <option value="weekly:tuesday">Every Tuesday</option>
          <option value="weekly:wednesday">Every Wednesday</option>
          <option value="weekly:thursday">Every Thursday</option>
          <option value="weekly:friday">Every Friday</option>
          <option value="weekly:saturday">Every Saturday</option>
          <option value="weekly:sunday">Every Sunday</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Every month</option>
        </select>
      )}
    </div>
  )
}

function formatRecurrence(rule: string): string {
  if (rule === 'daily') return 'Every day'
  if (rule === 'biweekly') return 'Every 2 weeks'
  if (rule === 'monthly') return 'Every month'
  if (rule.startsWith('weekly:')) {
    const day = rule.split(':')[1]
    return `Every ${day.charAt(0).toUpperCase() + day.slice(1)}`
  }
  return rule
}

function splitAndSort(tasks: Task[]): { mainTasks: Task[]; recurringTasks: Task[] } {
  const recurring: Task[] = []
  const dueSoon: Task[] = []
  const rest: Task[] = []

  for (const task of tasks) {
    if (task.isRecurring) {
      recurring.push(task)
    } else if (isDueSoon(task.dueDate)) {
      dueSoon.push(task)
    } else {
      rest.push(task)
    }
  }

  dueSoon.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
  rest.sort((a, b) => a.position - b.position)
  recurring.sort((a, b) => a.position - b.position)

  return { mainTasks: [...dueSoon, ...rest], recurringTasks: recurring }
}

export default function TaskList({ project, allProjects, onNavigate, highlightId, onHighlightDone, accentColor }: Props) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [movedToast, setMovedToast] = useState<{ name: string; id: string } | null>(null)
  const [pendingDeletes, setPendingDeletes] = useState<{ tasks: Task[]; timeoutId: number } | null>(null)
  const pendingRef = useRef(pendingDeletes)
  pendingRef.current = pendingDeletes

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timeoutId)
    }
  }, [])

  useEffect(() => {
    if (!movedToast) return
    const id = window.setTimeout(() => setMovedToast(null), 4000)
    return () => clearTimeout(id)
  }, [movedToast])

  function handleDeleteWithUndo(task: Task) {
    deleteTask(project.id, task.id)
    setPendingDeletes((prev) => {
      if (prev) clearTimeout(prev.timeoutId)
      const tasks = prev ? [...prev.tasks, task] : [task]
      const timeoutId = window.setTimeout(() => setPendingDeletes(null), 4000)
      return { tasks, timeoutId }
    })
  }

  function handleUndo() {
    if (!pendingDeletes) return
    clearTimeout(pendingDeletes.timeoutId)
    for (const task of pendingDeletes.tasks) {
      insertTask(project.id, task)
    }
    setPendingDeletes(null)
  }

  const { mainTasks, recurringTasks } = splitAndSort(project.tasks)
  const allForDnd = [...mainTasks, ...recurringTasks]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = allForDnd.findIndex((t) => t.id === active.id)
    const newIndex = allForDnd.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...allForDnd]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderTasks(project.id, reordered)
  }

  function handleAdd() {
    const title = newTaskTitle.trim()
    if (!title) return
    addTask(project.id, title)
    setNewTaskTitle('')
  }

  const noTasks = mainTasks.length === 0 && recurringTasks.length === 0

  return (
    <div className="px-6 sm:px-12 py-4 max-w-2xl">
      {noTasks && (
        <p className="text-[13px] text-gray-300 mb-4">No tasks yet. Add one below.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={allForDnd.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {/* Main tasks */}
          {mainTasks.length > 0 && (
            <div>
              {mainTasks.map((task) => (
                <SortableTaskItem key={task.id} task={task} projectId={project.id} allProjects={allProjects} onDelete={handleDeleteWithUndo} onMove={(name, id) => setMovedToast({ name, id })} isHighlighted={task.id === highlightId} accentColor={accentColor} />
              ))}
            </div>
          )}

          {/* Add task input — aligned with task circles */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAdd()
            }}
            className="flex items-center gap-2 px-4 mb-2"
          >
            {/* Spacer matching drag handle width + gap */}
            <div className="w-4 shrink-0" />
            <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-200 shrink-0" />
            <input
              data-task-input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={() => { if (newTaskTitle.trim()) handleAdd() }}
              placeholder="Add a task..."
              className="flex-1 text-[13px] bg-transparent outline-none text-gray-500 placeholder-gray-300 py-2"
            />
          </form>

          {/* Divider + Recurring tasks */}
          {recurringTasks.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-300 uppercase tracking-wider">Recurring</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div>
                {recurringTasks.map((task) => (
                  <SortableTaskItem key={task.id} task={task} projectId={project.id} allProjects={allProjects} onDelete={handleDeleteWithUndo} onMove={(name, id) => setMovedToast({ name, id })} isHighlighted={task.id === highlightId} accentColor={accentColor} />
                ))}
              </div>
            </>
          )}
        </SortableContext>
      </DndContext>

      {pendingDeletes && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-[13px] px-5 py-3 rounded-lg shadow-lg animate-slide-up">
          <span className="truncate max-w-[200px]">
            {pendingDeletes.tasks.length === 1 ? 'Task deleted' : `${pendingDeletes.tasks.length} tasks deleted`}
          </span>
          <button
            onClick={handleUndo}
            className="text-accent font-medium hover:underline shrink-0"
          >
            Undo
          </button>
        </div>
      )}

      {movedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gray-800 text-white text-[13px] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span>Task moved to{' '}
              <button
                onClick={() => { if (onNavigate) onNavigate(movedToast.id); setMovedToast(null) }}
                className="underline underline-offset-2 font-semibold hover:text-accent-light transition-colors"
              >
                {movedToast.name}
              </button>
            </span>
            <button
              onClick={() => setMovedToast(null)}
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
