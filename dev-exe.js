// One-command dev loop for the Sky Plane desktop build.
//
//   npm run dev          Build the unpacked exe once (if needed), launch it, then keep the exe's game
//                        files in sync with your source as you edit. The running window reloads itself,
//                        so you never wait for the 5-minute portable build again.
//   npm run sync         Copy the latest source into the already-built exe once and exit.
//   npm run pack         Just (re)build the fast unpacked exe (electron-builder --dir).
//
// The slow `npm run dist` is still there for when you want the single shippable SkyPlane.exe.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = __dirname;
// The game files that get bundled into the app (must match package.json "build.files").
const FILES = ['index.html', 'style.css', 'core.js', 'worlds.js', 'cockpit.js', 'world.js', 'app.js', 'main.js'];
const UNPACKED = path.join(ROOT, 'dist', 'win-unpacked');
const APP_DIR = path.join(UNPACKED, 'resources', 'app');
const syncOnce = process.argv.includes('--sync-once');

function log(msg) { console.log('[dev-exe] ' + msg); }

// Copy one source file into the packaged app, if it exists and actually changed.
function copyFile(name) {
  const src = path.join(ROOT, name), dst = path.join(APP_DIR, name);
  if (!fs.existsSync(src)) return false;
  try {
    if (fs.existsSync(dst) && fs.readFileSync(src).equals(fs.readFileSync(dst))) return false;
    fs.copyFileSync(src, dst);
    return true;
  } catch (e) { log('could not copy ' + name + ': ' + e.message); return false; }
}

function syncAll() {
  let n = 0;
  for (const f of FILES) if (copyFile(f)) n++;
  log(n ? `synced ${n} file${n > 1 ? 's' : ''} into the exe` : 'exe already up to date');
}

// Build the unpacked app (fast: no installer, no compression, files left as plain copies).
function pack() {
  log('building the unpacked exe (one-time, ~1 min)…');
  const r = spawnSync('npx', ['electron-builder', '--dir'], { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) { log('build failed — see the output above.'); process.exit(r.status || 1); }
}

function findExe() {
  if (!fs.existsSync(UNPACKED)) return null;
  const exe = fs.readdirSync(UNPACKED).find(f => f.toLowerCase().endsWith('.exe'));
  return exe ? path.join(UNPACKED, exe) : null;
}

// --- sync-once mode -------------------------------------------------------
if (syncOnce) {
  if (!fs.existsSync(APP_DIR)) { log('no unpacked exe yet — run `npm run pack` (or `npm run dev`) first.'); process.exit(1); }
  syncAll();
  process.exit(0);
}

// --- full dev loop --------------------------------------------------------
if (!fs.existsSync(APP_DIR)) pack();
syncAll();

const exe = findExe();
if (exe) {
  log('launching ' + path.basename(exe));
  spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
} else {
  log('built, but could not find the exe to launch. Open dist/win-unpacked yourself.');
}

// Watch the source files and push changes into the running exe, which reloads itself.
log('watching for changes — edit any game file and the window refreshes. Ctrl+C to stop.');
let timer = null, pending = new Set();
fs.watch(ROOT, { recursive: false }, (_ev, file) => {
  if (!file || !FILES.includes(file)) return;
  pending.add(file);
  clearTimeout(timer);
  timer = setTimeout(() => {
    let n = 0;
    for (const f of pending) if (copyFile(f)) n++;
    if (n) log(`updated ${[...pending].join(', ')} → exe reloading`);
    pending.clear();
  }, 150);
});
