const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');
const { nanoid } = require('nanoid');

const STATUS_TO_FILE = {
  backlog: 'backlog.md',
  'in-progress': 'in-progress-tasks.md',
  complete: 'completed-tasks.md',
  archived: 'archive-tasks.md',
};

const VALID_STATUSES = Object.keys(STATUS_TO_FILE);

function fileForStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  return STATUS_TO_FILE[status];
}

async function ensureDataFiles(folder) {
  await fsp.mkdir(folder, { recursive: true });
  const promises = Object.values(STATUS_TO_FILE).map(async (filename) => {
    const filePath = path.join(folder, filename);
    if (!fs.existsSync(filePath)) {
      await fsp.writeFile(filePath, '', 'utf8');
    }
  });
  await Promise.all(promises);
}

function parseTasksFromMarkdown(markdown, enforcedStatus) {
  const tasks = [];
  const fenceRegex = /```task\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = fenceRegex.exec(markdown)) !== null) {
    const yamlText = match[1];
    try {
      const obj = yaml.load(yamlText) || {};
      const task = {
        id: obj.id || null,
        title: obj.title || '',
        parentId: obj.parentId || null,
        status: enforcedStatus || obj.status || 'backlog',
        description: typeof obj.description === 'string' ? obj.description : (obj.description ? String(obj.description) : ''),
        // preserve any extra fields
        extra: Object.fromEntries(Object.entries(obj).filter(([k]) => !['id','title','parentId','status','description'].includes(k))),
      };
      tasks.push(task);
    } catch (e) {
      // skip malformed block
    }
  }
  return tasks;
}

function serializeTaskToFence(task) {
  const obj = {
    id: task.id,
    title: task.title,
    parentId: task.parentId || null,
    status: task.status,
    description: task.description || '',
    ...(task.extra || {}),
  };
  const yamlText = yaml.dump(obj, { lineWidth: 80, noRefs: true });
  return '```task\n' + yamlText + '```\n';
}

async function readTasksFromFile(filePath, enforcedStatus) {
  const text = fs.existsSync(filePath) ? await fsp.readFile(filePath, 'utf8') : '';
  return parseTasksFromMarkdown(text, enforcedStatus);
}

async function writeTasksToFile(filePath, tasks) {
  const content = tasks.map(serializeTaskToFence).join('\n');
  await fsp.writeFile(filePath, content, 'utf8');
}

async function listTasks(folder) {
  await ensureDataFiles(folder);
  const all = [];
  for (const [status, filename] of Object.entries(STATUS_TO_FILE)) {
    const filePath = path.join(folder, filename);
    const tasks = await readTasksFromFile(filePath, status);
    all.push(...tasks);
  }
  return all;
}

async function createTask(folder, { title, parentId = null, status = 'backlog', description = '' }) {
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status');
  await ensureDataFiles(folder);
  const id = 't_' + nanoid(8);
  const task = { id, title, parentId, status, description };
  const filename = fileForStatus(task.status);
  const filePath = path.join(folder, filename);
  const tasks = await readTasksFromFile(filePath, task.status);
  tasks.push(task);
  await writeTasksToFile(filePath, tasks);
  return task;
}

async function updateTaskById(folder, taskId, updates) {
  await ensureDataFiles(folder);
  const all = [];
  const perFile = {};
  for (const [status, filename] of Object.entries(STATUS_TO_FILE)) {
    const filePath = path.join(folder, filename);
    const tasks = await readTasksFromFile(filePath, status);
    perFile[status] = { filePath, tasks };
    all.push(...tasks);
  }
  const current = all.find((t) => t.id === taskId);
  if (!current) return null;

  const next = { ...current, ...updates };
  if (!VALID_STATUSES.includes(next.status)) throw new Error('Invalid status');

  // If status changed, move between files
  if (next.status !== current.status) {
    const from = perFile[current.status].tasks.filter((t) => t.id !== taskId);
    const to = perFile[next.status].tasks.concat([next]);
    await writeTasksToFile(perFile[current.status].filePath, from);
    await writeTasksToFile(perFile[next.status].filePath, to);
  } else {
    // Update in place
    const list = perFile[current.status].tasks.map((t) => (t.id === taskId ? next : t));
    await writeTasksToFile(perFile[current.status].filePath, list);
  }
  return next;
}

async function deleteTaskById(folder, taskId) {
  await ensureDataFiles(folder);
  const perFile = {};
  let foundStatus = null;
  for (const [status, filename] of Object.entries(STATUS_TO_FILE)) {
    const filePath = path.join(folder, filename);
    const tasks = await readTasksFromFile(filePath, status);
    perFile[status] = { filePath, tasks };
    if (tasks.some((t) => t.id === taskId)) {
      foundStatus = status;
    }
  }
  if (!foundStatus) return false;
  const list = perFile[foundStatus].tasks.filter((t) => t.id !== taskId);
  await writeTasksToFile(perFile[foundStatus].filePath, list);
  return true;
}

module.exports = {
  ensureDataFiles,
  listTasks,
  createTask,
  updateTaskById,
  deleteTaskById,
  VALID_STATUSES,
};


