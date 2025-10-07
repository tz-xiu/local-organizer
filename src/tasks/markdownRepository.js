const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');
const { STATUS_TO_FILE, VALID_STATUSES, fileForStatus } = require('../constants/status');

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
    } catch (_e) {
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

module.exports = {
  ensureDataFiles,
  VALID_STATUSES,
  STATUS_TO_FILE,
  fileForStatus,
  parseTasksFromMarkdown,
  serializeTaskToFence,
  readTasksFromFile,
  writeTasksToFile,
};


