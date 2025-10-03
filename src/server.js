const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDataFiles, listTasks, createTask, updateTaskByIndex, deleteTaskByIndex, reserializeAllTasks } = require('./data');
const { ensureDocsFolder, listDocs, readDoc } = require('./docs');

function startServer({ tasksFolder, docsFolder, port }) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Ensure data files exist at startup
  ensureDataFiles(tasksFolder).catch((err) => {
    console.error('Failed to ensure task files:', err);
  });

  ensureDocsFolder(docsFolder).catch((err) => {
    console.error('Failed to ensure docs folder:', err);
  });

  // API routes for tasks
  app.get('/api/tasks', async (req, res) => {
    try {
      const status = req.query.status;
      const tasks = await listTasks(tasksFolder);
      const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
      res.json({ tasks: filtered });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { title, parentTitle = null, status = 'backlog', description = '' } = req.body || {};
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'title is required' });
      }
      const task = await createTask(tasksFolder, { title, parentId: parentTitle, status, description });
      res.status(201).json({ task });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Breaking change: index-based addressing
  app.put('/api/tasks/:status/:index', async (req, res) => {
    try {
      const status = req.params.status;
      const index = Number(req.params.index);
      const updates = req.body || {};
      const updated = await updateTaskByIndex(tasksFolder, status, index, updates);
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      res.json({ task: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Some environments/proxies can mis-handle HTTP DELETE requests.
  // Keep the DELETE route (below) but also provide a POST fallback for reliability.
  app.post('/api/tasks/:status/:index/delete', async (req, res) => {
    try {
      const status = req.params.status;
      const index = Number(req.params.index);
      const deleted = await deleteTaskByIndex(tasksFolder, status, index);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  app.delete('/api/tasks/:status/:index', async (req, res) => {
    try {
      const status = req.params.status;
      const index = Number(req.params.index);
      const deleted = await deleteTaskByIndex(tasksFolder, status, index);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // API routes for documents
  app.get('/api/docs', async (req, res) => {
    try {
      const docs = await listDocs(docsFolder);
      res.json({ docs });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to list documents' });
    }
  });

  app.get('/api/docs/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const doc = await readDoc(docsFolder, filename);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      res.json(doc);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to read document' });
    }
  });

  app.post('/api/refresh', async (_req, res) => {
    try {
      await reserializeAllTasks(tasksFolder);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to refresh' });
    }
  });

  // Serve static frontend built by Vite (dist directory)
  const publicDir = path.join(__dirname, '..', 'dist');
  app.use(express.static(publicDir));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    return res.sendFile(path.join(publicDir, 'index.html'));
  });

  const server = app.listen(port, () => {
    console.log(`Local Organizer listening on http://localhost:${port}`);
    console.log(`Tasks folder: ${path.resolve(tasksFolder)}`);
    console.log(`Docs folder: ${path.resolve(docsFolder)}`);
  });

  function shutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close((err) => {
      if (err) {
        console.error('Error during server close:', err);
        process.exit(1);
      }
      process.exit(0);
    });
    // Fallback: force exit if close hangs
    setTimeout(() => {
      console.warn('Force exiting after timeout.');
      process.exit(1);
    }, 5000).unref();
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return server;
}

module.exports = { startServer };


