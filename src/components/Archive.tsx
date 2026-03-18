import { useState, useEffect, useCallback } from 'react'
import { Project } from '../types'
import { restoreTask, deleteArchivedTask, deleteArchivedTasks } from '../store'

interface Props {
  project: Project
}

function formatCompletionDate(isoStr: string): string {
  const date = new Date(isoStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Completed today'
  if (diffDays === 1) return 'Completed yesterday'
  return `Completed ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function Archive({ project }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sorted = [...project.archivedTasks].sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
    return bTime - aTime
  })

  useEffect(() => {
    setSelected((prev) => {
      const validIds = new Set(project.archivedTasks.map((t) => t.id))
      const filtered = new Set([...prev].filter((id) => validIds.has(id)))
      return filtered.size !== prev.size ? filtered : prev
    })
  }, [project.archivedTasks])

  const handleDeleteSelected = useCallback(() => {
    if (selected.size === 0) return
    deleteArchivedTasks(project.id, [...selected])
    setSelected(new Set())
  }, [selected, project.id])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selected.size === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDeleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, handleDeleteSelected])

  function toggleSelect(taskId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  function selectAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map((t) => t.id)))
    }
  }

  return (
    <div className="px-6 sm:px-12 py-6 max-w-2xl">
      {sorted.length === 0 ? (
        <p className="text-[13px] text-gray-300">
          No completed tasks yet. Tasks you check off will appear here.
        </p>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={selectAll}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {selected.size === sorted.length ? 'Deselect all' : 'Select all'}
            </button>
            {selected.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {selected.size} selected
                </span>
                <button
                  onClick={handleDeleteSelected}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete selected
                </button>
              </div>
            )}
          </div>

          <div className="space-y-0.5">
            {sorted.map((task) => {
              const isSelected = selected.has(task.id)
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between px-4 py-1.5 rounded-lg transition-colors ${
                    isSelected ? 'bg-accent/5 ring-1 ring-accent/20' : 'hover:bg-white/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox for multi-select */}
                    <button
                      onClick={() => toggleSelect(task.id)}
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-accent border-accent'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>

                    <span className="text-[13px] text-gray-400 line-through truncate">
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {task.completedAt && (
                      <span className="text-xs text-gray-300 hidden sm:inline">
                        {formatCompletionDate(task.completedAt)}
                      </span>
                    )}
                    <button
                      onClick={() => restoreTask(project.id, task.id)}
                      className="text-xs text-gray-400 hover:text-accent transition-colors px-1.5 py-0.5 rounded hover:bg-accent/5"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => deleteArchivedTask(project.id, task.id)}
                      className="text-xs text-gray-300 hover:text-red-500 transition-colors px-1 py-0.5 rounded hover:bg-red-50"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {selected.size > 0 && (
            <p className="text-xs text-gray-300 mt-3">
              Press Delete or Backspace to remove selected
            </p>
          )}
        </>
      )}
    </div>
  )
}
