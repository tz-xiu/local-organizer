const path = require('path');
const minimist = require('minimist');
const { startServer } = require('./server');

function resolveFolder(inputFolder) {
  if (!inputFolder) return process.cwd();
  if (path.isAbsolute(inputFolder)) return inputFolder;
  return path.resolve(process.cwd(), inputFolder);
}

function main() {
  const argv = minimist(process.argv.slice(2));
  const folderArg = argv.folder || argv.f;
  const dataFolder = resolveFolder(folderArg);
  const port = 6749; // fixed per requirement

  startServer({ dataFolder, port });
}

main();


