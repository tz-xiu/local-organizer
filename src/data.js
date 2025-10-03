const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');

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
        title: obj.title || '',
        parentTitle: obj.parentTitle || null,
        status: enforcedStatus || obj.status || 'backlog',
        description: typeof obj.description === 'string' ? obj.description : (obj.description ? String(obj.description) : ''),
        // preserve any extra fields, explicitly stripping legacy id/parentId
        extra: Object.fromEntries(Object.entries(obj).filter(([k]) => !['id','title','parentId','parentTitle','status','description'].includes(k))),
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
    title: task.title,
    parentTitle: task.parentTitle || null,
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
  const task = { title, parentTitle: parentId || null, status, description };
  const filename = fileForStatus(task.status);
  const filePath = path.join(folder, filename);
  const tasks = await readTasksFromFile(filePath, task.status);
  tasks.push(task);
  await writeTasksToFile(filePath, tasks);
  return task;
}

async function updateTaskByIndex(folder, status, index, updates) {
  await ensureDataFiles(folder);
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status');
  const filePath = path.join(folder, fileForStatus(status));
  const tasks = await readTasksFromFile(filePath, status);
  if (index < 0 || index >= tasks.length) return null;

  const current = tasks[index];
  const next = { ...current, ...updates };
  if (!VALID_STATUSES.includes(next.status)) throw new Error('Invalid status');

  // If status changed, move between files
  if (next.status !== status) {
    // remove from current list
    const fromList = tasks.slice(0, index).concat(tasks.slice(index + 1));
    await writeTasksToFile(filePath, fromList);

    // append to destination list
    const toPath = path.join(folder, fileForStatus(next.status));
    const toList = await readTasksFromFile(toPath, next.status);
    toList.push(next);
    await writeTasksToFile(toPath, toList);
  } else {
    // Update in place
    const list = tasks.slice();
    list[index] = next;
    await writeTasksToFile(filePath, list);
  }
  return next;
}

async function deleteTaskByIndex(folder, status, index) {
  await ensureDataFiles(folder);
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status');
  const filePath = path.join(folder, fileForStatus(status));
  const tasks = await readTasksFromFile(filePath, status);
  if (index < 0 || index >= tasks.length) return false;
  const list = tasks.slice(0, index).concat(tasks.slice(index + 1));
  await writeTasksToFile(filePath, list);
  return true;
}

async function reserializeAllTasks(folder) {
  await ensureDataFiles(folder);
  for (const [status, filename] of Object.entries(STATUS_TO_FILE)) {
    const filePath = path.join(folder, filename);
    const tasks = await readTasksFromFile(filePath, status);
    // writing back will strip legacy fields via serializeTaskToFence
    await writeTasksToFile(filePath, tasks);
  }
}

module.exports = {
  ensureDataFiles,
  listTasks,
  createTask,
  updateTaskByIndex,
  deleteTaskByIndex,
  reserializeAllTasks,
  VALID_STATUSES,
  STATUS_TO_FILE,
};


