const fs = require('fs');
const os = require('os');
const path = require('path');
const minimist = require('minimist');
const { startServer } = require('./server');

function resolveFolder(inputFolder) {
  if (!inputFolder) return process.cwd();
  if (path.isAbsolute(inputFolder)) return inputFolder;
  return path.resolve(process.cwd(), inputFolder);
}

function getConfigDir() {
  const dir = path.join(os.homedir(), '.local-organizer');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // best effort
  }
  return dir;
}

function getPidFilePath() {
  // Single fixed port server; use a single pidfile
  return path.join(getConfigDir(), 'server.pid');
}

function readPidFromFile() {
  const pidFile = getPidFilePath();
  try {
    const content = fs.readFileSync(pidFile, 'utf8').trim();
    const pid = Number(content);
    if (!Number.isFinite(pid)) return null;
    return pid;
  } catch (_err) {
    return null;
  }
}

function writePidFile(pid) {
  const pidFile = getPidFilePath();
  try {
    fs.writeFileSync(pidFile, String(pid), { encoding: 'utf8' });
  } catch (err) {
    console.warn('Warning: could not write pid file:', err.message);
  }
}

function removePidFile() {
  const pidFile = getPidFilePath();
  try {
    fs.unlinkSync(pidFile);
  } catch (_err) {
    // ignore
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_err) {
    return false;
  }
}

async function stopServer({ force = false, timeoutMs = 5000 } = {}) {
  const pid = readPidFromFile();
  if (!pid) {
    console.log('No running server found.');
    return 0;
  }
  if (!isProcessRunning(pid)) {
    removePidFile();
    console.log('Stale pid file removed. No running server.');
    return 0;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    console.error('Failed to send SIGTERM:', err.message);
    return 1;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 150));
    if (!isProcessRunning(pid)) {
      removePidFile();
      console.log('Server stopped.');
      return 0;
    }
  }

  if (force) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (err) {
      console.error('Failed to send SIGKILL:', err.message);
      return 1;
    }
    // Give a brief moment
    await new Promise((r) => setTimeout(r, 200));
    removePidFile();
    console.log('Server force-killed.');
    return 0;
  }

  console.error('Server did not stop within timeout. Use --force to SIGKILL.');
  return 1;
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const subcmd = argv._ && argv._[0];

  if (subcmd === 'stop') {
    const code = await stopServer({ force: Boolean(argv.force) || Boolean(argv.f) });
    process.exitCode = code;
    return;
  }

  const folderArg = argv.folder || argv.f;
  const dataFolder = resolveFolder(folderArg);
  const port = 6749; // fixed per requirement

  const existingPid = readPidFromFile();
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(`Server already running (pid ${existingPid}).`);
    console.log('If this is unexpected, run: npx local-organizer stop');
    return;
  }

  const server = startServer({ dataFolder, port });

  // Record PID and setup cleanup
  writePidFile(process.pid);
  const cleanup = () => removePidFile();
  process.on('exit', cleanup);
  process.once('SIGINT', () => { cleanup(); process.exit(); });
  process.once('SIGTERM', () => { cleanup(); process.exit(); });

  // Keep process alive if started programmatically
  if (!server.listening) {
    console.error('Server failed to start.');
    process.exitCode = 1;
  }
}

main();


