import React, { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'

const STATUSES = ['backlog', 'in-progress', 'complete', 'archived']

function Group({ title, tasks, onEdit, onDelete }) {
  const label = title === 'in-progress' ? 'In Progress' : (title.charAt(0).toUpperCase() + title.slice(1))
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3>{label}</h3>
        <span className={`chip ${title}`}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className="muted">No tasks</div>
      ) : (
        <ul className="task-list">
          {tasks.map((t, idx) => (
            <li key={`${t.title}:${idx}`} className="task-item">
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onEdit({ ...t, _index: idx, _status: title.toLowerCase() })} className="button-secondary">Edit</button>
                <button onClick={() => onDelete({ ...t, _index: idx, _status: title.toLowerCase() })} className="button-danger">Delete</button>
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
  const [activeTab, setActiveTab] = useState('tasks')
  const [tasks, setTasks] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [theme, setTheme] = useState(() => {
    // Load theme from localStorage or default to 'dark'
    return localStorage.getItem('theme') || 'dark'
  })
  
  // Documents state
  const [docs, setDocs] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [docContent, setDocContent] = useState('')

  async function load() {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks((data.tasks || []).map(t => ({ ...t })))
  }

  useEffect(() => { load() }, [])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light')
  }

  async function loadDocs() {
    const res = await fetch('/api/docs')
    const data = await res.json()
    setDocs(data.docs || [])
  }

  async function loadDocContent(filename) {
    const res = await fetch(`/api/docs/${filename}`)
    const data = await res.json()
    setDocContent(data.content || '')
    setSelectedDoc(filename)
  }

  useEffect(() => {
    if (activeTab === 'documents') {
      loadDocs()
    }
  }, [activeTab])

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
    const parentTitle = form.get('parentTitle')?.toString() || null
    const description = form.get('description')?.toString()
    if (!title) return
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, status, description, parentTitle }) })
    setShowNew(false)
    await load()
  }

  async function updateTask(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = form.get('title')?.toString().trim()
    const status = form.get('status')?.toString()
    const parentTitle = form.get('parentTitle')?.toString() || null
    const description = form.get('description')?.toString()
    await fetch(`/api/tasks/${editing._status}/${editing._index}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, status, description, parentTitle }) })
    setEditing(null)
    await load()
  }

  async function deleteTask(task) {
    if (typeof task?._index !== 'number' || !task?._status) return
    // Try DELETE first; if not supported, fall back to POST /delete endpoint
    let ok = false
    try {
      const res = await fetch(`/api/tasks/${task._status}/${task._index}`, { method: 'DELETE' })
      ok = res.ok
    } catch (_) {}
    if (!ok) {
      await fetch(`/api/tasks/${task._status}/${task._index}/delete`, { method: 'POST' })
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
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button 
          className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Documents
        </button>
      </div>

      <div className="tab-actions">
        {activeTab === 'tasks' && (
          <>
            <button onClick={() => setShowNew(true)}>New Task</button>
            <button className="button-secondary" onClick={load}>Refresh</button>
          </>
        )}
        {activeTab === 'documents' && (
          <button className="button-secondary" onClick={loadDocs}>Refresh</button>
        )}
      </div>

      {activeTab === 'tasks' && (
        <div className="grid">
          <Group title="backlog" tasks={grouped['backlog']} onEdit={setEditing} onDelete={requestDelete} />
          <Group title="in-progress" tasks={grouped['in-progress']} onEdit={setEditing} onDelete={requestDelete} />
          <Group title="complete" tasks={grouped['complete']} onEdit={setEditing} onDelete={requestDelete} />
          <Group title="archived" tasks={grouped['archived']} onEdit={setEditing} onDelete={requestDelete} />
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="docs-container">
          <div className="docs-sidebar">
            <h3>Documents</h3>
            {docs.length === 0 ? (
              <div className="muted">No documents found</div>
            ) : (
              <ul className="docs-list">
                {docs.map((doc) => (
                  <li 
                    key={doc.filename} 
                    className={`doc-item ${selectedDoc === doc.filename ? 'active' : ''}`}
                    onClick={() => loadDocContent(doc.filename)}
                  >
                    {doc.filename}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="docs-content">
            {selectedDoc ? (
              <>
                <h3>{selectedDoc}</h3>
                <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked(docContent) }} />
              </>
            ) : (
              <div className="muted">Select a document to view</div>
            )}
          </div>
        </div>
      )}

      {showNew && (
        <div className="modal-backdrop">
          <form onSubmit={createTask} className="modal">
            <h3>New Task</h3>
            <div className="form-field">
              <label>Title:</label>
              <input name="title" placeholder="Title" required />
            </div>
            <div className="form-field">
              <label>Parent Title:</label>
              <input name="parentTitle" placeholder="Parent Title (optional)" />
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
              <label>Parent Title:</label>
              <input name="parentTitle" defaultValue={editing.parentTitle || ''} placeholder="Parent Title (optional)" />
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


