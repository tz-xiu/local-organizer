# Local Organizer

A simple local dashboard to manage tasks stored in markdown files. Ships as an npm CLI that runs a web UI on localhost:6749.

## Install

```bash
npm install local-organizer
```

## Usage

```bash
# Start dashboard and point to your folder containing task markdown files
npx local-organizer --folder ./path/to/tasks
 
# Stop the running server gracefully (SIGTERM), or force kill on timeout
npx local-organizer stop
npx local-organizer stop --force
```

- The server listens on `http://localhost:6749`.
- The UI provides list view, status filter, New/Edit modals, and a Refresh button.

## Data Source

Provide these files in the folder you pass via `--folder`:
- `backlog.md`
- `in-progress-tasks.md`
- `completed-tasks.md`
- `archive-tasks.md`

Tasks are stored as YAML inside fenced code blocks labeled `task`.

Example (`backlog.md`):

```task
id: "t-001"
title: "Implement login"
parentId: null
status: "backlog"   # backlog | in-progress | complete | archived
description: |
  Build initial login flow with email/password.
```

- Status determines which file the task lives in. Updating status moves the block across files.
- New tasks get a generated `id`.

## API (optional)

- `GET  /api/tasks?status=<optional>` → `{ tasks: Task[] }`
- `POST /api/tasks` body: `{ title, parentId?, status?, description? }`
- `PUT  /api/tasks/:id` body: partial Task fields
- `POST /api/refresh` (no-op but triggers UI reload)

Task shape:
```json
{
  "id": "t_abc12345",
  "title": "...",
  "parentId": null,
  "status": "backlog",
  "description": "..."
}
```

## Development

- Dev server (API + static): `node src/cli.js --folder demo`
- Frontend dev via Vite: `vite` (proxies `/api` to `:6749`)
- Build frontend: `npm run build:web` (outputs to `dist/`)

## License

MIT