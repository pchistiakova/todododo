export interface Task {
  id: string
  title: string
  details?: string
  link?: string
  linkLabel?: string
  dueDate?: string
  isRecurring?: boolean
  recurrenceRule?: string
  completed: boolean
  completedAt?: string
  position: number
}

export interface LinkItem {
  id: string
  title: string
  url: string
}

export type ProjectColor = string

export interface ColorEntry {
  name: string
  hex: string
}

export const PROJECT_COLORS: ColorEntry[] = [
  { name: 'Cameo Pink',            hex: '#e6adcf' },
  { name: 'Old Rose',              hex: '#d94d99' },
  { name: 'Coral Red',             hex: '#ff7399' },
  { name: 'Pompeian Red',          hex: '#a90636' },
  { name: 'Burnt Orange',          hex: '#de4500' },
  { name: "Hay's Russet",          hex: '#681916' },
  { name: 'Salvia Blue',           hex: '#96bfe6' },
  { name: 'Cream Yellow',          hex: '#ffb852' },
  { name: 'Sage Green',            hex: '#76844e' },
  { name: 'Cossack Green',         hex: '#66ab56' },
  { name: 'Light Porcelain Green', hex: '#23c17c' },
  { name: 'Mineral Gray',          hex: '#9fc2b2' },
  { name: 'Olympic Blue',          hex: '#4f8fe6' },
  { name: 'Dark Navy',             hex: '#202d85' },
  { name: 'Deep Brunswick Green',  hex: '#0f261f' },
  { name: 'Grayish Lavender',      hex: '#b8b8ff' },
  { name: 'Royal Indigo',          hex: '#4d52de' },
  { name: 'Veronia Purple',        hex: '#7e3075' },
  { name: 'Fawn',                  hex: '#d1b0b3' },
  { name: 'Apricot Orange',        hex: '#ff7340' },
  { name: 'Pyrite Yellow',         hex: '#c4bf33' },
  { name: 'Antwarp Blue',          hex: '#008aa1' },
  { name: 'Dusky Madder Violet',   hex: '#2d0060' },
  { name: 'Neutral Gray',          hex: '#8b9daa' },
]

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function getTextColorForBg(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return L > 0.18 ? '#1a1a1a' : '#ffffff'
}

export function getColorStyles(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  const bgR = Math.round(r + (255 - r) * 0.92)
  const bgG = Math.round(g + (255 - g) * 0.92)
  const bgB = Math.round(b + (255 - b) * 0.92)
  const textColor = getTextColorForBg(hex)
  return {
    hex,
    bg: `rgb(${bgR}, ${bgG}, ${bgB})`,
    dot: hex,
    border: hex,
    tab: hex,
    textColor,
  }
}

export const DEFAULT_COLOR = '#8b9daa'

const VALID_HEXES = new Set(PROJECT_COLORS.map((c) => c.hex.toLowerCase()))

export function resolveColor(hex: string | undefined): string {
  if (!hex) return DEFAULT_COLOR
  if (VALID_HEXES.has(hex.toLowerCase())) return hex
  const [r1, g1, b1] = hexToRgb(hex)
  let best = PROJECT_COLORS[0].hex
  let bestDist = Infinity
  for (const c of PROJECT_COLORS) {
    const [r2, g2, b2] = hexToRgb(c.hex)
    const dist = (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
    if (dist < bestDist) { bestDist = dist; best = c.hex }
  }
  return best
}

export interface NoteItem {
  id: string
  title: string
  content: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  color?: ProjectColor
  archived?: boolean
  tasks: Task[]
  archivedTasks: Task[]
  noteItems: NoteItem[]
  links: LinkItem[]
}

export interface AppData {
  projects: Project[]
}

export type View = { kind: 'main-board' } | { kind: 'project'; projectId: string }
