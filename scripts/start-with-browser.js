import { spawn } from 'child_process';

const serverCommand = 'node';
const serverArgs = ['src/server.js'];
const appUrl = 'http://localhost:3000/home';
let browserOpened = false;

function openBrowser(url) {
  const platform = process.platform;
  let opener;
  let args;

  if (platform === 'win32') {
    opener = 'cmd';
    args = ['/c', 'start', '', url];
  } else if (platform === 'darwin') {
    opener = 'open';
    args = [url];
  } else {
    opener = 'xdg-open';
    args = [url];
  }

  try {
    spawn(opener, args, { detached: true, stdio: 'ignore' }).unref();
    console.log(`Opening browser at ${url}`);
  } catch (error) {
    console.error('Unable to launch browser automatically:', error.message);
  }
}

const server = spawn(serverCommand, serverArgs, { stdio: ['inherit', 'pipe', 'pipe'] });

server.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (!browserOpened && text.includes('Server listening on http://localhost:3000')) {
    browserOpened = true;
    openBrowser(appUrl);
  }
});

server.stderr.on('data', (chunk) => {
  process.stderr.write(chunk.toString());
});

server.on('close', (code) => {
  process.exit(code);
});

function cleanup() {
  if (!server.killed) {
    server.kill();
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
