import { useState, useRef, useEffect } from 'react'
import { Project, NoteItem as NoteItemType, LinkItem } from '../types'
import { addNote, updateNote, deleteNote, insertNote, reorderNotes, addLink, updateLink, deleteLink, insertLink, reorderLinks } from '../store'
import ContextMenu, { MenuItem } from './ContextMenu'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
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
  highlightId?: string
  accentColor?: string
  onHighlightDone?: () => void
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs transition-colors ${
      active ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-100">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))}>
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))}>
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))}>
        <s>S</s>
      </button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" />
        </svg>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
          <text x="1" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">1</text>
          <text x="1" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">2</text>
          <text x="1" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">3</text>
        </svg>
      </button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={btnClass(editor.isActive('taskList'))}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="6" height="6" rx="1" /><path d="M5 8l1.5 1.5L9 7" />
          <line x1="13" y1="8" x2="21" y2="8" />
          <rect x="3" y="14" width="6" height="6" rx="1" />
          <line x1="13" y1="17" x2="21" y2="17" />
        </svg>
      </button>
    </div>
  )
}

function NoteEditor({
  initialContent,
  onSave,
  onCancel,
}: {
  initialContent: string
  onSave: (html: string) => void
  onCancel: () => void
}) {
  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content: initialContent || '<p></p>',
    autofocus: true,
    editorProps: {
      attributes: {
        class: 'px-4 py-3 outline-none min-h-[80px] text-[13px] text-gray-600 leading-relaxed',
      },
    },
  })

  function handleSave() {
    if (!editor) return
    const html = editor.getHTML()
    const isEmpty = html === '<p></p>' || html === ''
    if (isEmpty) {
      onCancel()
      return
    }
    onSave(html)
  }

  return (
    <div
      className="bg-surface-50 rounded-lg border border-accent/30 shadow-sm overflow-hidden"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          handleSave()
        }
      }}
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function SavedNote({
  content,
  onEdit,
  onDelete,
}: {
  content: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="group relative rounded-lg border border-gray-200 hover:border-gray-300 transition-all cursor-pointer">
      <button
        onClick={onEdit}
        className="w-full text-left px-4 py-3"
      >
        <div
          className="text-[13px] text-gray-600 leading-relaxed prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_blockquote]:my-1"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
        title="Delete note"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

const XIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const DragHandle = (props: React.HTMLAttributes<HTMLButtonElement>) => (
  <button
    className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 p-1 touch-none"
    title="Drag to reorder"
    {...props}
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
)

function SortableNote({
  note,
  isEditing,
  onEdit,
  onDelete,
  onSave,
  onCancelEdit,
  isHighlighted,
  accentColor,
}: {
  note: NoteItemType
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
  onSave: (html: string) => void
  onCancelEdit: () => void
  isHighlighted?: boolean
  accentColor?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  })
  const highlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHighlighted && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isHighlighted])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const noteCtxItems: MenuItem[] = [
    { label: 'Edit', onClick: onEdit },
    'separator',
    { label: 'Delete', onClick: onDelete, danger: true },
  ]

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1">
      <DragHandle {...attributes} {...listeners} />
      <div
        ref={highlightRef}
        className={`flex-1 min-w-0 ${isHighlighted ? 'search-highlight' : ''}`}
        style={isHighlighted && accentColor ? { '--accent': accentColor } as React.CSSProperties : undefined}
        onContextMenu={(e) => { if (!isEditing) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) } }}
      >
        {isEditing ? (
          <NoteEditor
            initialContent={note.content}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <SavedNote
            content={note.content}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </div>
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={noteCtxItems} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}

function SortableLinkItem({
  link,
  isEditing,
  editTitle,
  editUrl,
  onEditTitleChange,
  onEditUrlChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isHighlighted,
  accentColor,
}: {
  link: Project['links'][number]
  isEditing: boolean
  editTitle: string
  editUrl: string
  onEditTitleChange: (v: string) => void
  onEditUrlChange: (v: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  isHighlighted?: boolean
  accentColor?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  })
  const clickTimer = useRef<number | null>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (isHighlighted && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isHighlighted])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const linkCtxItems: MenuItem[] = [
    { label: 'Open in browser', onClick: () => window.open(link.url, '_blank') },
    { label: 'Edit', onClick: onStartEdit },
    'separator',
    { label: 'Delete', onClick: onDelete, danger: true },
  ]

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-start gap-1">
        <DragHandle {...attributes} {...listeners} />
        <div
          className="flex-1 min-w-0 space-y-1.5 px-3 py-2 rounded-lg bg-surface-50 border border-accent/20"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) onSaveEdit()
          }}
        >
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            placeholder="Link title..."
            className="w-full text-[13px] border border-gray-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-accent transition-colors"
          />
          <input
            value={editUrl}
            onChange={(e) => onEditUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            placeholder="https://..."
            className="w-full text-[13px] border border-gray-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <DragHandle {...attributes} {...listeners} />
      <div
        ref={highlightRef}
        className={`flex-1 min-w-0 flex items-center justify-between group px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors ${isHighlighted ? 'search-highlight' : ''}`}
        style={isHighlighted && accentColor ? { '--accent': accentColor } as React.CSSProperties : undefined}
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          e.preventDefault()
          if (e.detail >= 2) {
            if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null }
            return
          }
          clickTimer.current = window.setTimeout(() => {
            clickTimer.current = null
            window.open(link.url, '_blank')
          }, 250)
        }}
        onDoubleClick={(e) => {
          e.preventDefault()
          if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null }
          onStartEdit()
        }}
      >
        <span className="text-[13px] text-accent hover:underline truncate cursor-pointer">
          {link.title}
        </span>
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
          title="Remove link"
        >
          <XIcon />
        </button>
      </div>
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={linkCtxItems} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}

export default function NotesLinks({ project, highlightId, accentColor, onHighlightDone }: Props) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [showAddLink, setShowAddLink] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editLinkTitle, setEditLinkTitle] = useState('')
  const [editLinkUrl, setEditLinkUrl] = useState('')

  type PendingItem = { type: 'note'; item: NoteItemType } | { type: 'link'; item: LinkItem }
  const [pendingDeletes, setPendingDeletes] = useState<{ items: PendingItem[]; timeoutId: number } | null>(null)
  const pendingRef = useRef(pendingDeletes)
  pendingRef.current = pendingDeletes

  useEffect(() => {
    return () => { if (pendingRef.current) clearTimeout(pendingRef.current.timeoutId) }
  }, [])

  function handleDeleteNoteWithUndo(note: NoteItemType) {
    deleteNote(project.id, note.id)
    setPendingDeletes((prev) => {
      if (prev) clearTimeout(prev.timeoutId)
      const items = prev ? [...prev.items, { type: 'note' as const, item: note }] : [{ type: 'note' as const, item: note }]
      const timeoutId = window.setTimeout(() => setPendingDeletes(null), 4000)
      return { items, timeoutId }
    })
  }

  function handleDeleteLinkWithUndo(link: LinkItem) {
    deleteLink(project.id, link.id)
    setPendingDeletes((prev) => {
      if (prev) clearTimeout(prev.timeoutId)
      const items = prev ? [...prev.items, { type: 'link' as const, item: link }] : [{ type: 'link' as const, item: link }]
      const timeoutId = window.setTimeout(() => setPendingDeletes(null), 4000)
      return { items, timeoutId }
    })
  }

  function handleUndoDeletes() {
    if (!pendingDeletes) return
    clearTimeout(pendingDeletes.timeoutId)
    for (const entry of pendingDeletes.items) {
      if (entry.type === 'note') insertNote(project.id, entry.item)
      else insertLink(project.id, entry.item)
    }
    setPendingDeletes(null)
  }

  const noteItems = project.noteItems || []

  const noteSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )
  const linkSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleCreateNote(html: string) {
    addNote(project.id, '', html)
    setCreatingNew(false)
  }

  function handleUpdateNote(noteId: string, html: string) {
    updateNote(project.id, noteId, { content: html })
    setEditingNoteId(null)
  }

  function handleNoteDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = noteItems.findIndex((n) => n.id === active.id)
    const newIndex = noteItems.findIndex((n) => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...noteItems]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderNotes(project.id, reordered)
  }

  function handleAddLink() {
    const title = newLinkTitle.trim()
    const url = newLinkUrl.trim()
    if (!title || !url) return
    addLink(project.id, title, url)
    setNewLinkTitle('')
    setNewLinkUrl('')
    setShowAddLink(false)
  }

  function saveLinkEdit() {
    if (!editingLinkId) return
    const title = editLinkTitle.trim()
    const url = editLinkUrl.trim()
    if (title && url) {
      updateLink(project.id, editingLinkId, { title, url })
    }
    setEditingLinkId(null)
  }

  function handleLinkDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = project.links.findIndex((l) => l.id === active.id)
    const newIndex = project.links.findIndex((l) => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...project.links]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderLinks(project.id, reordered)
  }

  return (
    <div className="px-6 sm:px-12 py-6 max-w-2xl">
      {/* Notes */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">Notes</h3>
          {!creatingNew && (
            <button
              onClick={() => { setCreatingNew(true); setEditingNoteId(null) }}
              className="text-xs text-accent hover:text-accent-dark transition-colors"
            >
              + New note
            </button>
          )}
        </div>

        {/* New note editor */}
        {creatingNew && (
          <div className="mb-4">
            <NoteEditor
              initialContent=""
              onSave={handleCreateNote}
              onCancel={() => setCreatingNew(false)}
            />
          </div>
        )}

        {/* Empty state */}
        {noteItems.length === 0 && !creatingNew && (
          <button
            onClick={() => setCreatingNew(true)}
            className="w-full text-[13px] text-gray-300 hover:text-gray-400 bg-surface-50 hover:bg-gray-100/50 border border-dashed border-gray-200 rounded-lg px-4 py-6 transition-colors"
          >
            Click to add your first note...
          </button>
        )}

        {/* Saved notes */}
        <DndContext sensors={noteSensors} collisionDetection={closestCenter} onDragEnd={handleNoteDragEnd}>
          <SortableContext items={noteItems.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {noteItems.map((note) => (
                <SortableNote
                  key={note.id}
                  note={note}
                  isEditing={editingNoteId === note.id}
                  onEdit={() => { setEditingNoteId(note.id); setCreatingNew(false) }}
                  onDelete={() => handleDeleteNoteWithUndo(note)}
                  onSave={(html) => handleUpdateNote(note.id, html)}
                  onCancelEdit={() => setEditingNoteId(null)}
                  isHighlighted={note.id === highlightId}
                  accentColor={accentColor}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* Links */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Useful Links
          </h3>
          <button
            onClick={() => setShowAddLink(true)}
            className="text-xs text-accent hover:text-accent-dark transition-colors"
          >
            + Add link
          </button>
        </div>

        {project.links.length === 0 && !showAddLink && (
          <p className="text-[13px] text-gray-300">No links yet.</p>
        )}

        <DndContext sensors={linkSensors} collisionDetection={closestCenter} onDragEnd={handleLinkDragEnd}>
          <SortableContext items={project.links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {project.links.map((link) => (
                <SortableLinkItem
                  key={link.id}
                  link={link}
                  isEditing={editingLinkId === link.id}
                  editTitle={editLinkTitle}
                  editUrl={editLinkUrl}
                  onEditTitleChange={setEditLinkTitle}
                  onEditUrlChange={setEditLinkUrl}
                  onStartEdit={() => {
                    setEditLinkTitle(link.title)
                    setEditLinkUrl(link.url)
                    setEditingLinkId(link.id)
                  }}
                  onSaveEdit={saveLinkEdit}
                  onCancelEdit={() => setEditingLinkId(null)}
                  onDelete={() => handleDeleteLinkWithUndo(link)}
                  isHighlighted={link.id === highlightId}
                  accentColor={accentColor}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {showAddLink && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddLink()
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (newLinkTitle.trim() && newLinkUrl.trim()) {
                  handleAddLink()
                } else {
                  setShowAddLink(false)
                  setNewLinkTitle('')
                  setNewLinkUrl('')
                }
              }
            }}
            className="mt-3 space-y-2"
          >
            <input
              autoFocus
              value={newLinkTitle}
              onChange={(e) => setNewLinkTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddLink() }
                if (e.key === 'Escape') { setShowAddLink(false); setNewLinkTitle(''); setNewLinkUrl('') }
              }}
              placeholder="Link title..."
              className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
            />
            <input
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddLink() }
                if (e.key === 'Escape') { setShowAddLink(false); setNewLinkTitle(''); setNewLinkUrl('') }
              }}
              placeholder="https://..."
              className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
            />
          </form>
        )}
      </section>

      {pendingDeletes && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-[13px] px-5 py-3 rounded-lg shadow-lg animate-slide-up">
          <span className="truncate max-w-[200px]">
            {pendingDeletes.items.length === 1
              ? `${pendingDeletes.items[0].type === 'note' ? 'Note' : 'Link'} deleted`
              : `${pendingDeletes.items.length} items deleted`}
          </span>
          <button
            onClick={handleUndoDeletes}
            className="text-accent font-medium hover:underline shrink-0"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
