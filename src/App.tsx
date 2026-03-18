import { useEffect, useState, useSyncExternalStore, useRef, useCallback } from 'react'
import { View } from './types'
import { loadInitialData, subscribe, getSnapshot, addProject } from './store'
import MainBoard from './components/MainBoard'
import ProjectView from './components/ProjectView'
import SearchBar, { SearchResultsPage, SearchResult } from './components/SearchBar'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ kind: 'main-board' })
  const [animClass, setAnimClass] = useState('')
  const appData = useSyncExternalStore(subscribe, getSnapshot)
  const contentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    loadInitialData().then(() => setLoading(false))
  }, [])

  const navigate = useCallback((next: View) => {
    setAnimClass('view-exit')
    requestAnimationFrame(() => {
      setTimeout(() => {
        setView(next)
        setAnimClass('view-enter')
        setTimeout(() => setAnimClass(''), 200)
      }, 120)
    })
  }, [])

  const [triggerNewTask, setTriggerNewTask] = useState(0)
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchExpandedRef = useRef(false)
  searchExpandedRef.current = searchExpanded
  const [searchView, setSearchView] = useState<{ query: string; results: SearchResult[]; liveSearch?: boolean } | null>(null)
  const searchViewRef = useRef(searchView)
  searchViewRef.current = searchView
  const previousView = useRef<View>({ kind: 'main-board' })
  const [highlightId, setHighlightId] = useState<string | undefined>()
  const [highlightType, setHighlightType] = useState<string | undefined>()
  const lastEscapeRef = useRef(0)

  const handleNewTask = useCallback(() => {
    if (viewRef.current.kind === 'project') {
      const input = document.querySelector<HTMLInputElement>('[data-task-input]')
      input?.focus()
    } else {
      setTriggerNewTask((n) => n + 1)
    }
  }, [])

  const handleNewProject = useCallback(() => {
    const project = addProject('New Project')
    setView({ kind: 'project', projectId: project.id })
  }, [])

  const handleFocusConsumed = useCallback(() => setSearchFocusTrigger(0), [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (e.key === 'Escape') {
        const now = Date.now()
        if (e.repeat || now - lastEscapeRef.current < 300) return
        lastEscapeRef.current = now

        if (searchExpandedRef.current) {
          setSearchExpanded(false)
          return
        }
        if (searchViewRef.current) {
          setSearchView(null)
          return
        }
        if (isInput) {
          (target as HTMLElement).blur()
          return
        }
        if (viewRef.current.kind === 'project') {
          navigate({ kind: 'main-board' })
          return
        }
      }

      if (meta && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNewProject()
        return
      }

      if (meta && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNewTask()
        return
      }

      if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchFocusTrigger((n) => n + 1)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, handleNewTask, handleNewProject])

  useEffect(() => {
    if (!window.api) return

    window.api.onMenuNewTask(() => handleNewTask())
    window.api.onMenuNewProject(() => handleNewProject())
    window.api.onMenuNavigate((projectId: string | null) => {
      if (projectId) {
        navigate({ kind: 'project', projectId })
      } else {
        navigate({ kind: 'main-board' })
      }
    })
  }, [navigate, handleNewTask, handleNewProject])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    )
  }

  const searchBarElement = (
    <SearchBar
      data={appData}
      onNavigate={(projectId, itemId, itemType) => {
        setSearchView(null)
        setSearchExpanded(false)
        setHighlightId(itemId)
        setHighlightType(itemType)
        navigate({ kind: 'project', projectId })
      }}
      onShowFullResults={(query, results) => {
        previousView.current = view
        setSearchView({ query, results })
        setSearchExpanded(false)
      }}
      onOpenFullSearch={() => {
        previousView.current = view
        setSearchView({ query: '', results: [], liveSearch: true })
        setSearchExpanded(false)
      }}
      expanded={searchExpanded}
      onExpandedChange={setSearchExpanded}
      focusTrigger={searchFocusTrigger}
      onFocusConsumed={handleFocusConsumed}
    />
  )

  return (
    <div className="h-screen flex flex-col">
      <div className="drag-bar shrink-0" />

      <div ref={contentRef} className="flex-1 flex flex-col overflow-hidden">
        {searchView && (
          <SearchResultsPage
            query={searchView.query}
            results={searchView.results}
            data={appData}
            onNavigate={(projectId, itemId, itemType) => {
              setSearchView(null)
              setHighlightId(itemId)
              setHighlightType(itemType)
              navigate({ kind: 'project', projectId })
            }}
            onBack={() => setSearchView(null)}
            liveSearch={searchView.liveSearch}
          />
        )}
        <div
          className={`flex-1 flex flex-col overflow-hidden ${animClass}`}
          style={{ display: searchView ? 'none' : undefined }}
        >
          {view.kind === 'main-board' ? (
            <MainBoard
              data={appData}
              onOpenProject={(id, taskId) => {
                if (taskId) {
                  setHighlightId(taskId)
                  setHighlightType('task')
                }
                navigate({ kind: 'project', projectId: id })
              }}
              triggerNewTask={triggerNewTask}
              searchBar={searchBarElement}
            />
          ) : (
            <ProjectView
              data={appData}
              activeProjectId={view.projectId}
              onBack={() => navigate({ kind: 'main-board' })}
              onSwitchProject={(id) => setView({ kind: 'project', projectId: id })}
              searchBar={searchBarElement}
              highlightId={highlightId}
              highlightType={highlightType}
              onHighlightDone={() => { setHighlightId(undefined); setHighlightType(undefined) }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
