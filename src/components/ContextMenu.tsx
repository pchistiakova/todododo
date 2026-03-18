import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type MenuItem =
  | { label: string; onClick: () => void; danger?: boolean }
  | { label: string; submenu: MenuItem[] }
  | 'separator'

const MENU_CLASS =
  'fixed z-[9999] min-w-[140px] max-w-[200px] py-1 bg-white/95 backdrop-blur-lg rounded-lg shadow-lg border border-gray-200/80 select-none'

function SubMenuItem({
  item,
  onClose,
}: {
  item: { label: string; submenu: MenuItem[] }
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  function handleEnter() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setOpen(true), 80)
  }

  function handleLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setOpen(false), 150)
  }

  useLayoutEffect(() => {
    if (!open || !subRef.current || !rowRef.current) return
    const sub = subRef.current
    const row = rowRef.current.getBoundingClientRect()
    const subRect = sub.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = row.right + 2
    if (left + subRect.width > vw - 8) left = row.left - subRect.width - 2
    if (left < 8) left = 8

    let top = row.top
    if (top + subRect.height > vh - 8) top = vh - subRect.height - 8
    if (top < 8) top = 8

    sub.style.left = `${left}px`
    sub.style.top = `${top}px`
    sub.style.opacity = '1'
  }, [open])

  return (
    <div
      ref={rowRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100 transition-colors cursor-default ${open ? 'bg-gray-100' : ''}`}>
        <span className="truncate">{item.label}</span>
        <svg className="w-3 h-3 text-gray-400 ml-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
      {open &&
        createPortal(
          <div
            ref={subRef}
            data-ctx-menu
            style={{ left: -9999, top: -9999, opacity: 0 }}
            className={MENU_CLASS}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <MenuItems items={item.submenu} onClose={onClose} />
          </div>,
          document.body
        )}
    </div>
  )
}

function MenuItems({
  items,
  onClose,
}: {
  items: MenuItem[]
  onClose: () => void
}) {
  return (
    <>
      {items.map((item, i) => {
        if (item === 'separator') {
          return <div key={`sep-${i}`} className="my-1 border-t border-gray-100" />
        }
        if ('submenu' in item) {
          return <SubMenuItem key={`sub-${item.label}-${i}`} item={item} onClose={onClose} />
        }
        return (
          <button
            key={`${item.label}-${i}`}
            onClick={() => { item.onClick(); onClose() }}
            className={`w-full text-left px-3 py-1.5 text-[13px] truncate transition-colors ${
              item.danger
                ? 'text-red-500 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </>
  )
}

export default function ContextMenu({ x, y, items, onClose }: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x
    let top = y

    if (left + rect.width > vw - 8) left = vw - rect.width - 8
    if (top + rect.height > vh - 8) top = vh - rect.height - 8
    if (left < 8) left = 8
    if (top < 8) top = 8

    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.opacity = '1'
  }, [x, y])

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      const allMenus = document.querySelectorAll('[data-ctx-menu]')
      for (const menu of allMenus) {
        if (menu.contains(e.target as Node)) return
      }
      onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', handleDown, true)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleDown, true)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={menuRef}
      data-ctx-menu
      style={{ left: x, top: y, opacity: 0 }}
      className={MENU_CLASS}
    >
      <MenuItems items={items} onClose={onClose} />
    </div>,
    document.body
  )
}
