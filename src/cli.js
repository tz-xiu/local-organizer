const fs = require('fs');
const os = require('os');
const path = require('path');
const minimist = require('minimist');
const { startServer } = require('./server');
const { STATUS_TO_FILE } = require('./data');

function resolveFolder(inputFolder) {
  if (!inputFolder) return process.cwd();
  if (path.isAbsolute(inputFolder)) return inputFolder;
  return path.resolve(process.cwd(), inputFolder);
}

function validatePort(port) {
  const portNum = Number(port);
  if (!Number.isInteger(portNum)) {
    return { valid: false, error: 'Port must be a valid integer' };
  }
  if (portNum < 1024 || portNum > 65535) {
    return { valid: false, error: 'Port must be between 1024 and 65535' };
  }
  return { valid: true };
}

function getConfigPath() {
  return path.join(process.cwd(), 'local-organizer.config.json');
}

function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading config file:', err.message);
    return null;
  }
}

function initProject() {
  const cwd = process.cwd();
  const configPath = getConfigPath();
  
  // If config exists, keep a backup and continue to overwrite
  if (fs.existsSync(configPath)) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${configPath}.bak.${timestamp}`;
      fs.copyFileSync(configPath, backupPath);
      console.log('Existing config detected. Backed up previous config to:', backupPath);
      console.log('Overwriting config file...');
    } catch (err) {
      console.warn('Warning: Failed to back up existing config:', err.message);
      console.log('Proceeding to overwrite config file...');
    }
  }

  const tasksFolder = path.join(cwd, 'local-task');
  const docsFolder = path.join(cwd, 'local-docs');

  // Create local-task folder and files
  console.log('Creating local-task folder...');
  fs.mkdirSync(tasksFolder, { recursive: true });
  
  const taskFiles = Object.values(STATUS_TO_FILE);
  taskFiles.forEach((filename) => {
    const filePath = path.join(tasksFolder, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf8');
      console.log(`  Created: ${filename}`);
    }
  });

  // Create local-docs folder and copy template files
  console.log('Creating local-docs folder...');
  fs.mkdirSync(docsFolder, { recursive: true });

  // Copy template files to local-docs (do not overwrite existing files)
  const templatesDir = path.join(__dirname, '..', 'templates');
  const templateFiles = ['definitions.md', 'generate.md'];
  
  templateFiles.forEach((filename) => {
    const templatePath = path.join(templatesDir, filename);
    const targetPath = path.join(docsFolder, filename);
    
    if (fs.existsSync(templatePath)) {
      try {
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(templatePath, targetPath);
          console.log(`  Copied: ${filename}`);
        } else {
          console.log(`  Exists, skipped: ${filename}`);
        }
      } catch (err) {
        console.warn(`  Warning: Could not copy ${filename}:`, err.message);
      }
    }
  });

  // Create config file
  const config = {
    tasksFolder: './local-task',
    docsFolder: './local-docs',
    port: 6749
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('\nWrote config file:', configPath);
  console.log('\nInitialization complete!');
  console.log('\nTo start the dashboard, run:');
  console.log('  npx local-organizer start');
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

  if (subcmd === 'init') {
    initProject();
    return;
  }

  if (subcmd === 'stop') {
    const code = await stopServer({ force: Boolean(argv.force) || Boolean(argv.f) });
    process.exitCode = code;
    return;
  }

  // For start command (or default), require config file
  const config = loadConfig();
  if (!config) {
    console.error('Error: No config file found.');
    console.error('Please run "npx local-organizer init" first to initialize your project.');
    process.exitCode = 1;
    return;
  }

  // Resolve paths from config (relative to cwd)
  const cwd = process.cwd();
  const tasksFolder = path.resolve(cwd, config.tasksFolder);
  const docsFolder = path.resolve(cwd, config.docsFolder);
  
  // Read and validate port from config
  const port = config.port !== undefined ? config.port : 6749;
  const portValidation = validatePort(port);
  if (!portValidation.valid) {
    console.error(`Error: Invalid port configuration. ${portValidation.error}`);
    console.error(`Please update the port in your config file (${getConfigPath()}).`);
    process.exitCode = 1;
    return;
  }

  const existingPid = readPidFromFile();
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(`Server already running (pid ${existingPid}).`);
    console.log('If this is unexpected, run: npx local-organizer stop');
    return;
  }

  const server = startServer({ tasksFolder, docsFolder, port });

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


