const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

async function ensureDocsFolder(folder) {
  await fsp.mkdir(folder, { recursive: true });
}

async function listDocs(folder) {
  await ensureDocsFolder(folder);
  try {
    const files = await fsp.readdir(folder);
    const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'));
    return mdFiles.map((filename) => ({
      filename,
      path: path.join(folder, filename),
    }));
  } catch (err) {
    console.error('Error listing docs:', err);
    return [];
  }
}

async function readDoc(folder, filename) {
  const filePath = path.join(folder, filename);
  try {
    const content = await fsp.readFile(filePath, 'utf8');
    return { filename, content };
  } catch (err) {
    console.error('Error reading doc:', err);
    return null;
  }
}

module.exports = {
  ensureDocsFolder,
  listDocs,
  readDoc,
};

