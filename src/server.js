const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDataFiles, listTasks, createTask, updateTaskById, deleteTaskById } = require('./data');

function startServer({ dataFolder, port }) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Ensure data files exist at startup
  ensureDataFiles(dataFolder).catch((err) => {
    console.error('Failed to ensure data files:', err);
  });

  // API routes
  app.get('/api/tasks', async (req, res) => {
    try {
      const status = req.query.status;
      const tasks = await listTasks(dataFolder);
      const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
      res.json({ tasks: filtered });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { title, parentId = null, status = 'backlog', description = '' } = req.body || {};
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'title is required' });
      }
      const task = await createTask(dataFolder, { title, parentId, status, description });
      res.status(201).json({ task });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  app.put('/api/tasks/:id', async (req, res) => {
    try {
      const taskId = req.params.id;
      const updates = req.body || {};
      const updated = await updateTaskById(dataFolder, taskId, updates);
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      res.json({ task: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Some environments/proxies can mis-handle HTTP DELETE requests.
  // Keep the DELETE route (below) but also provide a POST fallback for reliability.
  app.post('/api/tasks/:id/delete', async (req, res) => {
    try {
      const taskId = req.params.id;
      const deleted = await deleteTaskById(dataFolder, taskId);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const taskId = req.params.id;
      const deleted = await deleteTaskById(dataFolder, taskId);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  app.post('/api/refresh', async (_req, res) => {
    // Stateless read; nothing cached. Endpoint exists for UI "Refresh" button.
    res.json({ ok: true });
  });

  // Serve static frontend built by Vite (dist directory)
  const publicDir = path.join(__dirname, '..', 'dist');
  app.use(express.static(publicDir));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    return res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.listen(port, () => {
    console.log(`Local Organizer listening on http://localhost:${port}`);
    console.log(`Data folder: ${path.resolve(dataFolder)}`);
  });
}

module.exports = { startServer };


