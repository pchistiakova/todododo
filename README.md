# todododo

A minimalist desktop app for to-dos and notes. Simple enough for quick captures, organized enough for real work.

## Features

- **Projects** — organize tasks, notes, and links into separate projects
- **Tasks** — due dates, recurring schedules, rich-text details, inline editing
- **Notes** — rich-text notes with formatting, checklists, and drag-and-drop reordering
- **Links** — save useful links with labels per project
- **Color-coded projects** — 24 colors from the Sanzo Wada palette
- **Drag-and-drop** — reorder projects, tasks, notes, and links
- **Archive** — completed tasks move to an archive with restore/delete options
- **Quick add** — add tasks from the Main Board with optional project and due date
- **Quick capture** — system-wide floating input (Cmd+Shift+T or tray icon) to add tasks without switching to the app
- **Search** — Cmd+F to search across all projects, tasks, notes, and links
- **Right-click menus** — context menus on tasks, projects, notes, and links with relevant actions
- **macOS menu bar** — native File, Edit, View, and Window menus
- **AI integration** — connect to Cursor, Claude, ChatGPT, and other AI tools via MCP

## Installation

Requires [Node.js](https://nodejs.org/) 18+ and npm. macOS only for now.

### From source

```bash
git clone <repo-url>
cd taskboard
npm install
npm run build
npm run install-app
```

This builds the app and installs it to `/Applications/todododo.app`.

### Development mode

```bash
cd taskboard
npm install
npm run dev
```

This starts the Vite dev server and Electron together with hot reload. Dev mode uses a separate data file so it won't affect your production data.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd+N | New task (in current project) |
| Cmd+Shift+N | New project |
| Cmd+F | Search |
| Cmd+Shift+T | Quick capture (system-wide) |
| Escape | Close search / back to Main Board |
| Double-click | Inline edit (project names, task titles, links) |

## MCP integration (AI tools)

todododo includes an MCP (Model Context Protocol) server that lets AI tools interact with your tasks and projects. You can say things like "add a task to my Canva Clicks project" in any MCP-compatible AI tool and it will appear in the app.

### Setup

**1. Build the MCP server:**

```bash
cd taskboard
npm run build:mcp
```

This compiles the server to `dist-mcp/index.js`.

**2. Register the server in your AI tool:**

Add the following to your tool's MCP configuration, replacing the path with the actual location on your machine.

**Cursor** — edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "todododo": {
      "command": "node",
      "args": ["/path/to/taskboard/dist-mcp/index.js"]
    }
  }
}
```

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "todododo": {
      "command": "node",
      "args": ["/path/to/taskboard/dist-mcp/index.js"]
    }
  }
}
```

**VS Code / Copilot** — add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "todododo": {
      "command": "node",
      "args": ["/path/to/taskboard/dist-mcp/index.js"]
    }
  }
}
```

**3. Restart the AI tool** to pick up the new server.

### Available tools

| Tool | Description |
|---|---|
| `list_projects` | List all projects with task counts |
| `list_tasks` | List tasks in a project (active, completed, or all) |
| `add_task` | Add a task to a project (creates the project if needed) |
| `complete_task` | Mark a task as completed (finds by title or ID) |
| `add_project` | Create a new project |
| `add_note` | Add a note to a project |
| `add_link` | Add a link to a project |

### Example prompts

- "List my todododo projects"
- "Add a task to Canva Clicks: review the new banner"
- "What tasks are due this week in Operations?"
- "Mark 'send report' as done in General"
- "Create a new project called Q2 Planning"
- "Add a note to Operations: sync with design team on Friday"

Changes made via MCP appear in the app automatically — no restart needed.

## Data storage

All data is stored locally on your machine:

| File | Location |
|---|---|
| Production data | `~/Library/Application Support/todododo/todododo-data.json` |
| Dev data | `~/Library/Application Support/todododo/todododo-dev-data.json` |
| Window state | `~/Library/Application Support/todododo/todododo-window-state.json` |

Data persists across app updates. Dev and production use separate files so development won't affect your real data.

## Tech stack

Electron, React, TypeScript, Tailwind CSS, Tiptap (rich text), @dnd-kit (drag-and-drop), @modelcontextprotocol/sdk (MCP).
