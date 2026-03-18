import { useState, useRef, useEffect, useCallback } from 'react'
import { AppData, Project } from '../types'

function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

export interface SearchResult {
  type: 'project' | 'task' | 'note' | 'link'
  projectId: string
  projectName: string
  itemId?: string
  title: string
  snippet?: string
}

function searchData(data: AppData, query: string): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []

  for (const project of data.projects) {
    if (project.archived) continue

    if (project.name.toLowerCase().includes(q)) {
      results.push({
        type: 'project',
        projectId: project.id,
        projectName: project.name,
        title: project.name,
      })
    }

    for (const task of project.tasks) {
      const titleMatch = task.title.toLowerCase().includes(q)
      const detailsText = task.details ? stripHtml(task.details) : ''
      const detailsMatch = detailsText.toLowerCase().includes(q)
      if (titleMatch || detailsMatch) {
        results.push({
          type: 'task',
          projectId: project.id,
          projectName: project.name,
          itemId: task.id,
          title: task.title,
          snippet: detailsMatch && !titleMatch ? getSnippet(detailsText, q) : undefined,
        })
      }
    }

    for (const note of (project.noteItems || [])) {
      const titleMatch = note.title.toLowerCase().includes(q)
      const contentText = note.content ? stripHtml(note.content) : ''
      const contentMatch = contentText.toLowerCase().includes(q)
      if (titleMatch || contentMatch) {
        results.push({
          type: 'note',
          projectId: project.id,
          projectName: project.name,
          itemId: note.id,
          title: note.title || 'Untitled note',
          snippet: contentMatch ? getSnippet(contentText, q) : undefined,
        })
      }
    }

    for (const link of project.links) {
      const titleMatch = link.title.toLowerCase().includes(q)
      const urlMatch = link.url.toLowerCase().includes(q)
      if (titleMatch || urlMatch) {
        results.push({
          type: 'link',
          projectId: project.id,
          projectName: project.name,
          itemId: link.id,
          title: link.title || link.url,
          snippet: urlMatch && !titleMatch ? link.url : undefined,
        })
      }
    }
  }

  return results
}

function getSnippet(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query)
  if (idx === -1) return text.slice(0, 80)
  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + query.length + 50)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  return snippet
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const typeIcons: Record<string, JSX.Element> = {
  project: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
  task: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  note: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  link: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
}

interface SearchBarProps {
  data: AppData
  onNavigate: (projectId: string, highlightId?: string, highlightType?: string) => void
  onShowFullResults: (query: string, results: SearchResult[]) => void
  onOpenFullSearch?: () => void
  expanded: boolean
  onExpandedChange: (v: boolean) => void
  focusTrigger?: number
  onFocusConsumed?: () => void
}

export default function SearchBar({ data, onNavigate, onShowFullResults, onOpenFullSearch, expanded, onExpandedChange, focusTrigger, onFocusConsumed }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isNarrow = () => window.innerWidth < 500

  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      onFocusConsumed?.()
      if (isNarrow() && onOpenFullSearch) {
        onOpenFullSearch()
      } else {
        onExpandedChange(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
  }, [focusTrigger, onOpenFullSearch, onFocusConsumed, onExpandedChange])

  useEffect(() => {
    setResults(searchData(data, query))
  }, [query, data])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onExpandedChange(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onExpandedChange])

  const handleResultClick = useCallback((result: SearchResult) => {
    onNavigate(result.projectId, result.itemId, result.type)
    onExpandedChange(false)
    setQuery('')
  }, [onNavigate, onExpandedChange])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() && results.length > 0) {
      onShowFullResults(query, results)
      onExpandedChange(false)
      setQuery('')
    }
  }, [query, results, onShowFullResults, onExpandedChange])

  const dropdownResults = results.slice(0, 8)

  return (
    <div ref={containerRef} className="relative flex items-center">
      {expanded ? (
        <form onSubmit={handleSubmit} className="flex items-center">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.nativeEvent.stopPropagation()
                onExpandedChange(false)
                setQuery('')
              }
            }}
            placeholder="Search..."
            className="text-xs bg-white ring-1 ring-gray-200 rounded px-2 py-1 w-32 outline-none focus:ring-gray-300 shadow-sm placeholder-gray-400 text-gray-700"
          />
        </form>
      ) : (
        <button
          onClick={() => {
            if (isNarrow() && onOpenFullSearch) {
              onOpenFullSearch()
            } else {
              onExpandedChange(true)
              setTimeout(() => inputRef.current?.focus(), 50)
            }
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          title="Search (Cmd+F)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      )}

      {expanded && query.trim() && dropdownResults.length > 0 && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="max-h-80 overflow-y-auto py-1">
            {dropdownResults.map((r, i) => (
              <button
                key={`${r.type}-${r.projectId}-${r.itemId || i}`}
                onClick={() => handleResultClick(r)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start gap-2.5 transition-colors"
              >
                <span className="text-gray-400 mt-0.5 shrink-0">{typeIcons[r.type]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-gray-700 truncate">
                    <HighlightMatch text={r.title} query={query} />
                  </div>
                  {r.snippet && (
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      <HighlightMatch text={r.snippet} query={query} />
                    </div>
                  )}
                  {r.type !== 'project' && (
                    <div className="text-xs text-gray-300 mt-0.5">{r.projectName}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
          {results.length > 8 && (
            <button
              onClick={() => {
                onShowFullResults(query, results)
                onExpandedChange(false)
                setQuery('')
              }}
              className="w-full text-center text-xs text-accent py-2 border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              See all {results.length} results
            </button>
          )}
          {results.length <= 8 && (
            <div className="text-center text-xs text-gray-300 py-1.5 border-t border-gray-100">
              {results.length} result{results.length !== 1 ? 's' : ''} — Enter for full view
            </div>
          )}
        </div>
      )}

      {expanded && query.trim() && results.length === 0 && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 px-4 py-3">
          <p className="text-[13px] text-gray-400 text-center">No results for "{query}"</p>
        </div>
      )}
    </div>
  )
}

interface SearchResultsPageProps {
  query: string
  results: SearchResult[]
  data: AppData
  onNavigate: (projectId: string, highlightId?: string, highlightType?: string) => void
  onBack: () => void
  liveSearch?: boolean
}

export function SearchResultsPage({ query: initialQuery, results: initialResults, data, onNavigate, onBack, liveSearch }: SearchResultsPageProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [liveResults, setLiveResults] = useState<SearchResult[]>(initialResults)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (liveSearch) {
      setLiveResults(searchData(data, searchQuery))
    }
  }, [searchQuery, data, liveSearch])

  useEffect(() => {
    if (!liveSearch) {
      setSearchQuery(initialQuery)
      setLiveResults(initialResults)
    }
  }, [initialQuery, initialResults, liveSearch])

  useEffect(() => {
    if (liveSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [liveSearch])

  const displayQuery = liveSearch ? searchQuery : initialQuery
  const displayResults = liveSearch ? liveResults : initialResults

  const grouped = new Map<string, SearchResult[]>()
  for (const r of displayResults) {
    const existing = grouped.get(r.projectId) || []
    existing.push(r)
    grouped.set(r.projectId, existing)
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 sm:px-12" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-4 pt-1">
          <button
            onClick={onBack}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          {liveSearch ? (
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.nativeEvent.stopPropagation()
                  onBack()
                }
              }}
              placeholder="Search..."
              className="flex-1 text-[13px] bg-white ring-1 ring-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-gray-300 placeholder-gray-400 text-gray-700"
            />
          ) : (
            <>
              <h1 className="text-sm font-semibold text-gray-900">
                Search results for "{displayQuery}"
              </h1>
              <span className="text-xs text-gray-400">{displayResults.length} result{displayResults.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {liveSearch && displayQuery.trim() === '' && (
          <p className="text-[13px] text-gray-400 mt-8 text-center">Type to search across all projects, tasks, notes, and links.</p>
        )}

        {displayQuery.trim() !== '' && displayResults.length === 0 && (
          <p className="text-[13px] text-gray-400 mt-8 text-center">No results for "{displayQuery}"</p>
        )}

        {Array.from(grouped.entries()).map(([projectId, items]) => {
          const project = data.projects.find((p) => p.id === projectId)
          return (
            <div key={projectId} className="mb-6">
              <button
                onClick={() => onNavigate(projectId)}
                className="text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors mb-2 flex items-center gap-1.5"
              >
                {typeIcons.project}
                {project?.name || 'Unknown project'}
              </button>
              <div className="space-y-0.5">
                {items.map((r, i) => (
                  <button
                    key={`${r.type}-${r.itemId || i}`}
                    onClick={() => onNavigate(r.projectId, r.itemId, r.type)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-start gap-2.5 transition-colors"
                  >
                    <span className="text-gray-400 mt-0.5 shrink-0">{typeIcons[r.type]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-gray-700">
                        <HighlightMatch text={r.title} query={displayQuery} />
                      </div>
                      {r.snippet && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          <HighlightMatch text={r.snippet} query={displayQuery} />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 shrink-0 mt-0.5">{r.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
