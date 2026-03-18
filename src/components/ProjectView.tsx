import { useState, useEffect, useRef } from 'react'
import { AppData, PROJECT_COLORS, getColorStyles, DEFAULT_COLOR, resolveColor } from '../types'
import { addProject, archiveProject, deleteProject, renameProject, updateProjectColor, reorderProjects } from '../store'
import ContextMenu, { MenuItem } from './ContextMenu'
import TaskList from './TaskList'
import NotesLinks from './NotesLinks'
import Archive from './Archive'
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'

interface Props {
  data: AppData
  activeProjectId: string
  onBack: () => void
  onSwitchProject: (id: string) => void
  searchBar?: React.ReactNode
  highlightId?: string
  highlightType?: string
  onHighlightDone?: () => void
}

type SubTab = 'todos' | 'notes' | 'archive'

export default function ProjectView({ data, activeProjectId, onBack, onSwitchProject, searchBar, highlightId, highlightType, onHighlightDone }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('todos')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setShowArchiveConfirm(false)
    setShowDeleteConfirm(false)
    setShowColorPicker(false)
  }, [activeProjectId])

  useEffect(() => {
    if (highlightType === 'note' || highlightType === 'link') {
      setSubTab('notes')
    } else if (highlightType === 'task') {
      setSubTab('todos')
    }
  }, [highlightId, highlightType])

  useEffect(() => {
    if (!showColorPicker) return
    function handleClick(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showColorPicker])
  const project = data.projects.find((p) => p.id === activeProjectId)

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Project not found.</p>
      </div>
    )
  }

  const colorDef = getColorStyles(resolveColor(project.color))

  function handleArchive() {
    archiveProject(activeProjectId)
    const remaining = data.projects.filter((p) => p.id !== activeProjectId && !p.archived)
    if (remaining.length > 0) {
      onSwitchProject(remaining[0].id)
    } else {
      onBack()
    }
  }

  function handleDelete() {
    deleteProject(activeProjectId)
    const remaining = data.projects.filter((p) => p.id !== activeProjectId && !p.archived)
    if (remaining.length > 0) {
      onSwitchProject(remaining[0].id)
    } else {
      onBack()
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Back button + project actions */}
      <div className="px-6 sm:px-12 pt-1 mb-2 flex items-center justify-between whitespace-nowrap">
        <button
          onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Main Board
        </button>

        <div className="flex items-center gap-2 relative">
          {searchBar}
          {/* Color picker toggle */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorDef.dot }} />
            Color
          </button>

          {/* Archive button */}
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Archive
          </button>

          {/* Delete button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-gray-300 hover:text-red-500 transition-colors"
          >
            Delete
          </button>

          {/* Color picker dropdown */}
          {showColorPicker && (
            <div ref={colorPickerRef} className="absolute right-0 top-6 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-20 flex flex-wrap gap-2 w-[212px]">
              {PROJECT_COLORS.map((entry) => (
                <button
                  key={entry.hex}
                  onClick={() => {
                    updateProjectColor(activeProjectId, entry.hex)
                    setShowColorPicker(false)
                  }}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-125 ${
                    project.color === entry.hex ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: entry.hex }}
                  title={entry.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Archive confirmation */}
      {showArchiveConfirm && (
        <div className="mx-6 sm:mx-12 mb-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between whitespace-nowrap overflow-hidden">
          <span className="text-[13px] text-amber-700">
            Archive "{project.name}"?
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleArchive}
              className="text-xs bg-amber-500 text-white px-3 py-1 rounded-md hover:bg-amber-600 transition-colors"
            >
              Archive
            </button>
            <button
              onClick={() => setShowArchiveConfirm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mx-6 sm:mx-12 mb-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between whitespace-nowrap overflow-hidden">
          <span className="text-[13px] text-red-600">
            Permanently delete "{project.name}" and all its tasks?
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="text-xs bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project Tabs */}
      <ProjectTabs
        data={data}
        activeProjectId={activeProjectId}
        onSwitchProject={(id) => {
          onSwitchProject(id)
          setSubTab('todos')
          setShowDeleteConfirm(false)
          setShowColorPicker(false)
        }}
        onProjectCreated={(id) => {
          onSwitchProject(id)
          setSubTab('todos')
        }}
        onArchive={(id) => { archiveProject(id); onBack() }}
        onDelete={(id) => { deleteProject(id); onBack() }}
        onColorPicker={() => setShowColorPicker(!showColorPicker)}
      />

      {/* Sub Tabs: To-dos | Notes/Links | Archive */}
      <div className="border-b border-gray-100" style={{ backgroundColor: colorDef.bg }}>
        <div className="px-6 sm:px-12 flex gap-0 whitespace-nowrap">
          {(['todos', 'notes', 'archive'] as SubTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-5 py-3 text-[13px] transition-all border-b-2 ${
                subTab === tab
                  ? 'text-gray-900 font-medium'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
              style={subTab === tab ? { borderBottomColor: colorDef.border } : undefined}
            >
              {tab === 'todos' ? 'To-dos' : tab === 'notes' ? 'Notes / Links' : 'Archive'}
              {tab === 'archive' && project.archivedTasks.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-300">
                  {project.archivedTasks.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: colorDef.bg }}>
        {subTab === 'todos' ? (
          <TaskList project={project} allProjects={data.projects} onNavigate={onSwitchProject} highlightId={highlightId} onHighlightDone={onHighlightDone} accentColor={colorDef.border} />
        ) : subTab === 'notes' ? (
          <NotesLinks project={project} highlightId={highlightId} accentColor={colorDef.border} onHighlightDone={onHighlightDone} />
        ) : (
          <Archive project={project} />
        )}
      </div>
    </div>
  )
}

function SortableTab({
  project,
  isActive,
  onSwitch,
  onArchive,
  onDelete,
  onColorPicker,
}: {
  project: AppData['projects'][number]
  isActive: boolean
  onSwitch: () => void
  onArchive: () => void
  onDelete: () => void
  onColorPicker: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const localRef = useRef<HTMLElement | null>(null)
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  })

  const setNodeRef = (node: HTMLElement | null) => {
    localRef.current = node
    setSortableRef(node)
  }

  useEffect(() => {
    if (isActive && localRef.current) {
      localRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [isActive])

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  const pStyles = getColorStyles(resolveColor(project.color))

  function saveRename() {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          ...(isActive ? { backgroundColor: pStyles.tab } : {}),
        }}
        className={`px-2 py-1.5 rounded-t-xl ${isActive ? '-mb-px' : ''}`}
      >
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveRename()
            if (e.key === 'Escape') { setEditName(project.name); setEditing(false) }
          }}
          className="text-[13px] font-medium bg-transparent outline-none w-24 px-2 py-1 rounded border border-current/30"
          style={isActive ? { color: pStyles.textColor } : { color: '#374151' }}
        />
      </div>
    )
  }

  const tabCtxItems: MenuItem[] = [
    { label: 'Rename', onClick: () => { setEditName(project.name); setEditing(true) } },
    { label: 'Change color', onClick: () => { onSwitch(); onColorPicker() } },
    'separator',
    { label: 'Archive', onClick: onArchive },
    { label: 'Delete', onClick: onDelete, danger: true },
  ]

  return (
    <>
      <button
        ref={setNodeRef}
        style={{
          ...style,
          ...(isActive ? { backgroundColor: pStyles.tab, color: pStyles.textColor } : {}),
        }}
        onClick={onSwitch}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditName(project.name)
          setEditing(true)
        }}
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        className={`
          px-5 py-2.5 text-[13px] rounded-t-xl transition-colors cursor-grab active:cursor-grabbing whitespace-nowrap flex-shrink-0
          ${isActive
            ? 'font-medium shadow-sm -mb-px'
            : 'text-gray-400 hover:text-gray-600'
          }
        `}
        {...attributes}
        {...listeners}
      >
        {project.name}
      </button>
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={tabCtxItems} onClose={() => setCtxMenu(null)} />}
    </>
  )
}

function ProjectTabs({
  data,
  activeProjectId,
  onSwitchProject,
  onProjectCreated,
  onArchive,
  onDelete,
  onColorPicker,
}: {
  data: AppData
  activeProjectId: string
  onSwitchProject: (id: string) => void
  onProjectCreated: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onColorPicker: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeProjects = data.projects.filter((p) => !p.archived)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = activeProjects.findIndex((p) => p.id === active.id)
    const newIndex = activeProjects.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...activeProjects]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    const archivedProjects = data.projects.filter((p) => p.archived)
    reorderProjects([...reordered, ...archivedProjects])
  }

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    const project = addProject(name)
    setNewName('')
    setAdding(false)
    onProjectCreated(project.id)
  }

  return (
    <div className="px-6 sm:px-12 flex items-end gap-0.5 border-b border-gray-200 overflow-x-auto scrollbar-hide">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={activeProjects.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          {activeProjects.map((p) => (
            <SortableTab
              key={p.id}
              project={p}
              isActive={p.id === activeProjectId}
              onSwitch={() => onSwitchProject(p.id)}
              onArchive={() => onArchive(p.id)}
              onDelete={() => onDelete(p.id)}
              onColorPicker={onColorPicker}
            />
          ))}
        </SortableContext>
      </DndContext>

      {adding ? (
        <form
          onSubmit={(e) => { e.preventDefault(); handleAdd() }}
          className="flex items-center mb-1 ml-2 flex-shrink-0"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => { newName.trim() ? handleAdd() : setAdding(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setNewName(''); setAdding(false) } }}
            placeholder="Project name..."
            className="text-[13px] bg-transparent border-b border-gray-300 focus:border-gray-500 outline-none px-1 py-1.5 w-28 transition-colors"
          />
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-2.5 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none mb-0.5 flex-shrink-0"
          title="New project"
        >
          +
        </button>
      )}
    </div>
  )
}
