# Local Organizer

## Intro
A simple local web dashboard for managing AI‑generated tasks and docs.
- Simple task format that maps cleanly from AI‑generated tasks.
- Built‑in prompt templates to generate and update docs with your AI coding tool.
- Keeps all data in your repo.

## Install

```bash
npm install local-organizer
```

## How to Use

### Initialize a new project

```bash
# Initialize in current directory - creates folders and config file
npx local-organizer init
```

Behavior:
- If `local-organizer.config.json` already exists, it will be overwritten.
- A backup of the previous file will be saved as `local-organizer.config.json.bak.<timestamp>`.
- The operation is non-interactive (no prompt) and logs a message indicating the backup and overwrite.

This creates:
- `local-task/` folder with task markdown files
- 4 tasks markdown files are created in `local-task` folder.
- `local-docs/` folder for your markdown documents
- `generate.md` and `definitions.md` are created in `local-task` folder
- `local-organizer.config.json` configuration file

### Start the dashboard

```bash
# Start the dashboard (requires init first)
npx local-organizer start
 
# Stop the running server gracefully (SIGTERM), or force kill on timeout
npx local-organizer stop
npx local-organizer stop --force
```

- The server listens on `http://localhost:6749`.
- The UI provides two tabs: **Tasks** and **Documents**.
- Tasks tab: List view with status columns, New/Edit modals, and Refresh button.
- Documents tab: Browse and view all markdown files in your docs folder.

### Generate project context files (definited in `definitions.md`).
- Use `generate.md` as a prompt with your AI assistant to generate the project context files.
- AI generates/updates the specified docs in your `local-docs` folder
- View the generated docs in the Documents tab

## Configuration

The `local-organizer.config.json` file defines paths and port:

```json
{
  "tasksFolder": "./local-task",
  "docsFolder": "./local-docs",
  "port": 6749
}
```

You can customize these paths to point to existing folders. The default port is 6749.

## Data Source

### Tasks

Task files are automatically created in the `local-task` folder:
- `backlog.md`
- `in-progress-tasks.md`
- `completed-tasks.md`
- `archive-tasks.md`

Tasks are stored as YAML inside fenced code blocks labeled `task`.

Example (`backlog.md`):

```task
title: "Implement login"
parentTitle: null
status: "backlog"   # backlog | in-progress | complete | archived
description: |
  Build initial login flow with email/password.
```

- Status determines which file the task lives in. Updating status moves the block across files.
- Task identity is based on its position (index) within its status list.

### Documents

Place any markdown (`.md`) files in your `local-docs` folder. They'll appear in the Documents tab for easy viewing.

#### AI-Assisted Documentation

When you run `npx local-organizer init`, two special template files are copied to your `local-docs` folder:

**`definitions.md`** - Define the structure and content requirements for your project documentation:
- Organize docs by category (e.g., one-page, architecture, tech-stack, build-deploy, testing, code-style)
- Specify the filename for each doc (`## doc name`)
- List what content should be included (`## content`)
- Customize this file to to define what docs you need

**`generate.md`** - A ready-to-use prompt for AI assistants (like Cursor, Claude, ChatGPT):
- Contains instructions to generate or update documentation based on `definitions.md`
- AI will read your codebase and create factual documentation covering all requirements
- Ensures docs are based on actual code, not suggestions
- Customize the prompt if you need different generation behavior

## License

MIT