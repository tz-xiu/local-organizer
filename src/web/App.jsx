import React, { useEffect, useMemo, useState } from 'react'

const STATUSES = ['backlog', 'in-progress', 'complete', 'archived']

function Group({ title, tasks, onEdit, onDelete }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3>{title}</h3>
        <span className={`chip ${title.toLowerCase()}`}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className="muted">No tasks</div>
      ) : (
        <ul className="task-list">
          {tasks.map((t) => (
            <li key={t.id} className="task-item">
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onEdit(t)} className="button-secondary">Edit</button>
                <button onClick={() => onDelete(t)} className="button-danger">Delete</button>
              </div>
              <div className="task-title">{t.title}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function App() {
  const [tasks, setTasks] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)

  async function load() {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(data.tasks || [])
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const map = { backlog: [], 'in-progress': [], complete: [], archived: [] }
    for (const t of tasks) map[t.status]?.push(t)
    return map
  }, [tasks])

  async function createTask(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = form.get('title')?.toString().trim()
    const status = form.get('status')?.toString()
    const parentId = form.get('parentId')?.toString() || null
    const description = form.get('description')?.toString()
    if (!title) return
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, status, description, parentId }) })
    setShowNew(false)
    await load()
  }

  async function updateTask(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = form.get('title')?.toString().trim()
    const status = form.get('status')?.toString()
    const parentId = form.get('parentId')?.toString() || null
    const description = form.get('description')?.toString()
    await fetch(`/api/tasks/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, status, description, parentId }) })
    setEditing(null)
    await load()
  }

  async function deleteTask(task) {
    if (!task?.id) return
    // Try DELETE first; if not supported, fall back to POST /delete endpoint
    let ok = false
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      ok = res.ok
    } catch (_) {}
    if (!ok) {
      await fetch(`/api/tasks/${task.id}/delete`, { method: 'POST' })
    }
    await load()
  }

  function requestDelete(task) {
    setConfirmingDelete(task)
  }

  return (
    <div className="container">
      <div className="header">
        <h2 className="title">Local Organizer</h2>
        <div className="header-controls">
          <button onClick={() => setShowNew(true)}>New</button>
          <button className="button-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="grid">
        <Group title="Backlog" tasks={grouped['backlog']} onEdit={setEditing} onDelete={requestDelete} />
        <Group title="In Progress" tasks={grouped['in-progress']} onEdit={setEditing} onDelete={requestDelete} />
        <Group title="Complete" tasks={grouped['complete']} onEdit={setEditing} onDelete={requestDelete} />
        <Group title="Archived" tasks={grouped['archived']} onEdit={setEditing} onDelete={requestDelete} />
      </div>

      {showNew && (
        <div className="modal-backdrop">
          <form onSubmit={createTask} className="modal">
            <h3>New Task</h3>
            <div className="form-field">
              <label>Title:</label>
              <input name="title" placeholder="Title" required />
            </div>
            <div className="form-field">
              <label>Parent ID:</label>
              <input name="parentId" placeholder="Parent ID (optional)" />
            </div>
            <div className="form-field">
              <label>Status:</label>
              <select name="status" defaultValue="backlog">
                {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="form-field">
              <label>Description:</label>
              <textarea name="description" placeholder="Description" rows={6} />
            </div>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop">
          <form onSubmit={updateTask} className="modal">
            <h3>Edit Task</h3>
            <div className="form-field">
              <label>Title:</label>
              <input name="title" defaultValue={editing.title} required />
            </div>
            <div className="form-field">
              <label>Parent ID:</label>
              <input name="parentId" defaultValue={editing.parentId || ''} placeholder="Parent ID (optional)" />
            </div>
            <div className="form-field">
              <label>Status:</label>
              <select name="status" defaultValue={editing.status}>
                {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="form-field">
              <label>Description:</label>
              <textarea name="description" defaultValue={editing.description} rows={6} />
            </div>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      )}

      {confirmingDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Delete Task</h3>
            <div className="form-field">
              <div>Are you sure you want to delete:</div>
              <div className="task-title" style={{ marginTop: 8 }}>{confirmingDelete.title}</div>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>This action cannot be undone.</div>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setConfirmingDelete(null)}>Cancel</button>
              <button type="button" className="button-danger" onClick={async () => { await deleteTask(confirmingDelete); setConfirmingDelete(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


