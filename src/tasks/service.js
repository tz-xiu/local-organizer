const path = require('path');
const {
  ensureDataFiles,
  VALID_STATUSES,
  STATUS_TO_FILE,
  fileForStatus,
  readTasksFromFile,
  writeTasksToFile,
} = require('./markdownRepository');

async function listTasks(tasksFolder) {
  await ensureDataFiles(tasksFolder);
  const all = [];
  for (const [status, filename] of Object.entries(STATUS_TO_FILE)) {
    const filePath = path.join(tasksFolder, filename);
    const tasks = await readTasksFromFile(filePath, status);
    all.push(...tasks);
  }
  return all;
}

async function createTask(tasksFolder, { title, parentId = null, status = 'backlog', description = '' }) {
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status');
  await ensureDataFiles(tasksFolder);
  const task = { title, parentTitle: parentId || null, status, description };
  const filename = fileForStatus(task.status);
  const filePath = path.join(tasksFolder, filename);
  const tasks = await readTasksFromFile(filePath, task.status);
  tasks.push(task);
  await writeTasksToFile(filePath, tasks);
  return task;
}

async function updateTaskByIndex(tasksFolder, status, index, updates) {
  await ensureDataFiles(tasksFolder);
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status');
  const filePath = path.join(tasksFolder, fileForStatus(status));
  const tasks = await readTasksFromFile(filePath, status);
  if (index < 0 || index >= tasks.length) return null;

  const current = tasks[index];
  const next = { ...current, ...updates };
  if (!VALID_STATUSES.includes(next.status)) throw new Error('Invalid status');

  if (next.status !== status) {
    const fromList = tasks.slice(0, index).concat(tasks.slice(index + 1));
    await writeTasksToFile(filePath, fromList);

    const toPath = path.join(tasksFolder, fileForStatus(next.status));
    const toList = await readTasksFromFile(toPath, next.status);
    toList.push(next);
    await writeTasksToFile(toPath, toList);
  } else {
    const list = tasks.slice();
    list[index] = next;
    await writeTasksToFile(filePath, list);
  }
  return next;
}

async function deleteTaskByIndex(tasksFolder, status, index) {
  await ensureDataFiles(tasksFolder);
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status');
  const filePath = path.join(tasksFolder, fileForStatus(status));
  const tasks = await readTasksFromFile(filePath, status);
  if (index < 0 || index >= tasks.length) return false;
  const list = tasks.slice(0, index).concat(tasks.slice(index + 1));
  await writeTasksToFile(filePath, list);
  return true;
}

async function reserializeAllTasks(tasksFolder) {
  await ensureDataFiles(tasksFolder);
  for (const [status, filename] of Object.entries(STATUS_TO_FILE)) {
    const filePath = path.join(tasksFolder, filename);
    const tasks = await readTasksFromFile(filePath, status);
    await writeTasksToFile(filePath, tasks);
  }
}

module.exports = {
  listTasks,
  createTask,
  updateTaskByIndex,
  deleteTaskByIndex,
  reserializeAllTasks,
};


