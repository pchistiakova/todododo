#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  "Library",
  "Application Support",
  "todododo"
)
const DATA_FILE = path.join(DATA_DIR, "todododo-data.json")

interface Task {
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

interface NoteItem {
  id: string
  title: string
  content: string
  createdAt: string
}

interface LinkItem {
  id: string
  title: string
  url: string
}

interface Project {
  id: string
  name: string
  color?: string
  archived?: boolean
  tasks: Task[]
  archivedTasks: Task[]
  noteItems: NoteItem[]
  links: LinkItem[]
}

interface AppData {
  projects: Project[]
}

function readData(): AppData {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return { projects: [] }
  }
}

function writeData(data: AppData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8")
}

function findProject(data: AppData, nameOrId: string): Project | undefined {
  const lower = nameOrId.toLowerCase()
  return (
    data.projects.find((p) => p.id === nameOrId) ||
    data.projects.find((p) => p.name.toLowerCase() === lower) ||
    data.projects.find((p) => p.name.toLowerCase().includes(lower))
  )
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] }
}

const server = new McpServer({
  name: "todododo",
  version: "1.0.0",
})

// --- list_projects ---
server.tool(
  "list_projects",
  "List all projects in todododo. Returns project names, IDs, task counts, and whether they are archived.",
  {},
  async () => {
    const data = readData()
    const lines = data.projects.map((p) => {
      const active = p.tasks.filter((t) => !t.completed).length
      const archived = p.archived ? " [archived]" : ""
      return `- ${p.name} (id: ${p.id}, ${active} active tasks)${archived}`
    })
    if (lines.length === 0) return textResult("No projects found.")
    return textResult(lines.join("\n"))
  }
)

// --- list_tasks ---
server.tool(
  "list_tasks",
  "List tasks in a specific project. Can filter by status (active, completed, all).",
  {
    project: z.string().describe("Project name or ID"),
    status: z
      .enum(["active", "completed", "all"])
      .optional()
      .default("active")
      .describe("Filter: active (default), completed, or all"),
  },
  async ({ project: nameOrId, status }) => {
    const data = readData()
    const proj = findProject(data, nameOrId)
    if (!proj) return textResult(`Project "${nameOrId}" not found.`)

    let tasks: Task[] = []
    if (status === "active" || status === "all") tasks.push(...proj.tasks.filter((t) => !t.completed))
    if (status === "completed" || status === "all") tasks.push(...proj.archivedTasks)

    if (tasks.length === 0) return textResult(`No ${status} tasks in "${proj.name}".`)

    const lines = tasks.map((t) => {
      const due = t.dueDate ? ` (due: ${t.dueDate})` : ""
      const done = t.completed ? " [completed]" : ""
      const recurring = t.isRecurring ? " [recurring]" : ""
      return `- ${t.title}${due}${recurring}${done} (id: ${t.id})`
    })
    return textResult(`Tasks in "${proj.name}":\n${lines.join("\n")}`)
  }
)

// --- add_task ---
server.tool(
  "add_task",
  "Add a new task to a project in todododo. If the project doesn't exist, it will be created.",
  {
    project: z.string().describe("Project name or ID"),
    title: z.string().describe("Task title"),
    details: z.string().optional().describe("Task details or description"),
    due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
  },
  async ({ project: nameOrId, title, details, due_date }) => {
    const data = readData()
    let proj = findProject(data, nameOrId)

    if (!proj) {
      proj = {
        id: randomUUID(),
        name: nameOrId,
        tasks: [],
        archivedTasks: [],
        noteItems: [],
        links: [],
      }
      data.projects.push(proj)
    }

    const maxPos = proj.tasks.reduce((max, t) => Math.max(max, t.position), -1)
    const task: Task = {
      id: randomUUID(),
      title,
      details,
      dueDate: due_date,
      completed: false,
      position: maxPos + 1,
    }
    proj.tasks.push(task)
    writeData(data)
    return textResult(`Task "${title}" added to "${proj.name}".${due_date ? ` Due: ${due_date}.` : ""}`)
  }
)

// --- complete_task ---
server.tool(
  "complete_task",
  "Mark a task as completed. Search by task title (partial match) or ID within a project.",
  {
    project: z.string().describe("Project name or ID"),
    task: z.string().describe("Task title (partial match) or task ID"),
  },
  async ({ project: nameOrId, task: taskQuery }) => {
    const data = readData()
    const proj = findProject(data, nameOrId)
    if (!proj) return textResult(`Project "${nameOrId}" not found.`)

    const lower = taskQuery.toLowerCase()
    const taskObj =
      proj.tasks.find((t) => t.id === taskQuery) ||
      proj.tasks.find((t) => t.title.toLowerCase() === lower) ||
      proj.tasks.find((t) => t.title.toLowerCase().includes(lower))

    if (!taskObj) return textResult(`Task "${taskQuery}" not found in "${proj.name}".`)

    proj.tasks = proj.tasks.filter((t) => t.id !== taskObj.id)
    proj.archivedTasks.push({
      ...taskObj,
      completed: true,
      completedAt: new Date().toISOString(),
    })
    writeData(data)
    return textResult(`Task "${taskObj.title}" marked as completed in "${proj.name}".`)
  }
)

// --- add_project ---
server.tool(
  "add_project",
  "Create a new project in todododo.",
  {
    name: z.string().describe("Project name"),
  },
  async ({ name }) => {
    const data = readData()
    const existing = data.projects.find((p) => p.name.toLowerCase() === name.toLowerCase() && !p.archived)
    if (existing) return textResult(`Project "${name}" already exists.`)

    const proj: Project = {
      id: randomUUID(),
      name,
      tasks: [],
      archivedTasks: [],
      noteItems: [],
      links: [],
    }
    data.projects.push(proj)
    writeData(data)
    return textResult(`Project "${name}" created.`)
  }
)

// --- add_note ---
server.tool(
  "add_note",
  "Add a note to a project in todododo.",
  {
    project: z.string().describe("Project name or ID"),
    content: z.string().describe("Note content (supports HTML/markdown)"),
    title: z.string().optional().default("").describe("Optional note title"),
  },
  async ({ project: nameOrId, content, title }) => {
    const data = readData()
    const proj = findProject(data, nameOrId)
    if (!proj) return textResult(`Project "${nameOrId}" not found.`)

    const note: NoteItem = {
      id: randomUUID(),
      title: title || "",
      content,
      createdAt: new Date().toISOString(),
    }
    if (!proj.noteItems) proj.noteItems = []
    proj.noteItems.push(note)
    writeData(data)
    return textResult(`Note added to "${proj.name}".`)
  }
)

// --- add_link ---
server.tool(
  "add_link",
  "Add a useful link to a project in todododo.",
  {
    project: z.string().describe("Project name or ID"),
    url: z.string().describe("The URL"),
    title: z.string().optional().describe("Link title/label"),
  },
  async ({ project: nameOrId, url, title }) => {
    const data = readData()
    const proj = findProject(data, nameOrId)
    if (!proj) return textResult(`Project "${nameOrId}" not found.`)

    const link: LinkItem = {
      id: randomUUID(),
      title: title || url,
      url,
    }
    proj.links.push(link)
    writeData(data)
    return textResult(`Link "${link.title}" added to "${proj.name}".`)
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("MCP server error:", err)
  process.exit(1)
})
