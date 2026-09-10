import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import nodeMachineId from 'node-machine-id';
const { machineIdSync } = nodeMachineId;
const _require = createRequire(import.meta.url);

// Auto-updater is imported lazily inside app.whenReady() — NOT here at the top level.
// Reason: electron-updater calls app.getPath('userData') during import, which throws
// if the app is not yet ready. A top-level await would silently swallow that error
// and leave autoUpdater as null forever.
let autoUpdater = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// ─── AUTO-INSTALL INDIAN TTS VOICES ─────────────────────────────────────────
// Silently installs Marathi (mr-IN) and Hindi (hi-IN) Windows speech packs
// on first launch using PowerShell. Runs in background — never blocks startup.
// Records attempt in userData so it only runs once per machine.
function installIndianVoices() {
  if (process.platform !== 'win32') return; // Windows only

  const userData = app.getPath('userData');
  const flagFile = path.join(userData, '.indian_voices_installed');

  // Skip if already attempted
  if (fs.existsSync(flagFile)) return;

  // Mark as attempted immediately so we never retry on every launch
  try { fs.writeFileSync(flagFile, new Date().toISOString()); } catch (e) { /* ignore */ }

  // PowerShell command: install mr-IN and hi-IN speech capabilities silently.
  // Add-WindowsCapability downloads from Windows Update (needs internet once).
  // After installation they work 100% offline with zero latency.
  const ps = [
    'Add-WindowsCapability -Online -Name "Language.Speech~~~mr-IN~0.0.1.0" -ErrorAction SilentlyContinue;',
    'Add-WindowsCapability -Online -Name "Language.Speech~~~hi-IN~0.0.1.0" -ErrorAction SilentlyContinue;',
    // Also ensure the text-to-speech package for both languages is present
    'Add-WindowsCapability -Online -Name "Language.TextToSpeech~~~mr-IN~0.0.1.0" -ErrorAction SilentlyContinue;',
    'Add-WindowsCapability -Online -Name "Language.TextToSpeech~~~hi-IN~0.0.1.0" -ErrorAction SilentlyContinue;',
  ].join(' ');

  console.log('[TTS] Installing Indian language voice packs in background...');

  exec(
    `powershell.exe -NonInteractive -WindowStyle Hidden -Command "${ps}"`,
    { windowsHide: true },
    (err, stdout, stderr) => {
      if (err) {
        // Non-fatal: may fail if no internet or no admin rights.
        // SpeechSynthesis will still use whatever is already installed.
        console.warn('[TTS] Voice install failed (non-fatal):', err.message);
        // Remove flag so we retry next launch
        try { fs.unlinkSync(flagFile); } catch (e) { /* ignore */ }
      } else {
        console.log('[TTS] Indian voice packs install completed.');
        // Notify renderer so it can reload its voice list
        sendToRenderer('tts-voices-installed', true);
      }
    }
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      zoomFactor: 1.15
    },
  });

  // M5: Set Content Security Policy (production only — Vite dev needs inline scripts)
  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://supabase-proxy.dudhsakha-api.workers.dev; img-src 'self' data: blob:; font-src 'self' data:;"
          ]
        }
      });
    });
  }

  mainWindow.webContents.setZoomFactor(1.15);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    // DISABLE ZOOM: Prevent Ctrl+, Ctrl-, Ctrl+0
    if (input.control || input.meta) {
      if (input.key === '=' || input.key === '+' || input.key === '-' || input.key === '_' || input.key === '0') {
        event.preventDefault();
      }
    }
  });

  const loadApp = () => {

    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log('Main window is destroyed, skipping loadApp');
      return;
    }

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
      mainWindow.loadURL('http://localhost:5173').catch((e) => {
        console.log('Failed to load URL, retrying in 1s...', e);
        setTimeout(() => {

          if (mainWindow && !mainWindow.isDestroyed()) {
            loadApp();
          }
        }, 1000);
      });
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  };

  loadApp();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('Failed to load:', errorCode, errorDescription);
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (isDev) {
      setTimeout(() => {

        if (mainWindow && !mainWindow.isDestroyed()) {
          loadApp();
        }
      }, 1000);
    }
  });

  // Allow blank popups (about:blank) used by print fallback; deny real URL navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow about:blank popups (used as print fallback when electron.invoke fails)
    if (!url || url === 'about:blank') return { action: 'allow' };
    // Block all other popup navigation
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  // --- AUTO UPDATER: Use createRequire (NOT dynamic import) so asar paths resolve correctly ---
  // Dynamic import() in ES modules does NOT work with Electron's asar filesystem.
  // createRequire() goes through the native require() pipeline which has full asar support.
  if (app.isPackaged) {
    try {
      autoUpdater = _require('electron-updater').autoUpdater;
      console.log('[Updater] electron-updater loaded successfully via require');
    } catch (e) {
      console.warn('[Updater] electron-updater failed to load:', e.message);
    }
  }

  // Kill any Python bridge processes left over from a previous session (crash/force-close)
  // BEFORE creating the window so COM ports are guaranteed to be free on connect.
  await killOrphanedBridges();

  createWindow();

  // Install Indian (Marathi/Hindi) TTS voices silently on first launch
  // Runs in background — does NOT block startup or UI in any way
  installIndianVoices();

  // --- AUTO UPDATER: Check for updates after window is ready ---
  if (autoUpdater) {
    try {
      autoUpdater.autoDownload = true;        // Download silently in background
      autoUpdater.autoInstallOnAppQuit = true; // Install when user quits naturally

      // Setup logging to a file in userData directory (app is ready, so this is safe!)
      const logPath = path.join(app.getPath('userData'), 'updater.log');
      autoUpdater.logger = {
        info: (msg) => {
          try { fs.appendFileSync(logPath, `[INFO] [${new Date().toISOString()}] ${msg}\n`); } catch (e) {}
        },
        warn: (msg) => {
          try { fs.appendFileSync(logPath, `[WARN] [${new Date().toISOString()}] ${msg}\n`); } catch (e) {}
        },
        error: (msg) => {
          try { fs.appendFileSync(logPath, `[ERROR] [${new Date().toISOString()}] ${msg}\n`); } catch (e) {}
        }
      };
      autoUpdater.logger.info('Updater initialized and configured');
    } catch (err) {
      console.warn('[Updater] Failed to configure logger:', err.message);
    }

    // Wait 10 seconds after app loads before checking — ensures window is fully ready
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates().catch(err => {
          console.warn('[Updater] Check failed (no internet?):', err.message);
        });
      } catch (err) {
        console.warn('[Updater] Could not initiate update check:', err.message);
      }
    }, 10000);

    // Notify renderer when a new update is found
    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] New version available:', info.version);
      sendToRenderer('update-available', info.version);
    });

    // Log when already on latest version
    autoUpdater.on('update-not-available', (info) => {
      console.log('[Updater] Already on latest version:', info.version);
    });

    // Notify renderer when update has been fully downloaded
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Updater] Update downloaded:', info.version);
      sendToRenderer('update-downloaded', info.version);
    });

    // Log update errors but don't crash
    autoUpdater.on('error', (err) => {
      console.warn('[Updater] Update error (non-fatal):', err.message);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- HARDWARE BINDING ---
ipcMain.handle('get-machine-id', async () => {
  try {
    const id = machineIdSync(true); // original machine ID
    return { success: true, machineId: id };
  } catch (error) {
    console.error("Failed to generate machine ID:", error);
    return { success: false, error: error.message };
  }
});



// --- AUTO UPDATER: Restart the app to install downloaded update ---
ipcMain.handle('restart-app-for-update', () => {
  if (autoUpdater) {
    // isSilent=false shows Windows progress, isForceRunAfter=true auto-relaunches the app
    autoUpdater.quitAndInstall(false, true);
  }
});

// --- OPEN EXTERNAL LINK safely in user's browser ---
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('[Shell] Failed to open URL:', err.message);
    return { success: false, error: err.message };
  }
});


// --- OPEN PDF in system default viewer (Chrome/Acrobat/etc.) ---
ipcMain.handle('open-pdf', async (event, pdfBase64) => {
  try {
    const tmpDir = app.getPath('temp');
    const tmpFile = path.join(tmpDir, `dudhsakha_bill_${Date.now()}.pdf`);
    const buffer = Buffer.from(pdfBase64, 'base64');
    fs.writeFileSync(tmpFile, buffer);
    // Opens the PDF in the system default application (Chrome, Adobe, etc.)
    await shell.openPath(tmpFile);
    return { success: true, path: tmpFile };
  } catch (err) {
    console.error('[open-pdf] Failed:', err.message);
    return { success: false, error: err.message };
  }
});

// --- PRINT HTML: Render to PDF via Chromium, then open with system PDF viewer ---
// Uses printToPDF() which is reliably Promise-based in ALL Electron versions.
// The user's default PDF viewer (e.g. Adobe, Chrome, Edge) handles print/save.
ipcMain.handle('print-html', async (event, htmlContent) => {
  let tmpHtml = null;
  let pdfWin  = null;
  try {
    const tmpDir = app.getPath('temp');
    tmpHtml = path.join(tmpDir, `dudhsakha_print_${Date.now()}.html`);
    fs.writeFileSync(tmpHtml, htmlContent, 'utf8');

    pdfWin = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await pdfWin.loadFile(tmpHtml);

    // Give webfonts time to load (Noto Sans Devanagari)
    await new Promise(r => setTimeout(r, 1200));

    // printToPDF is reliably Promise-based in ALL Electron versions
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: true,
      margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });

    const pdfPath = path.join(tmpDir, `dudhsakha_report_${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Open in the system default PDF application (Chrome, Adobe, Edge, etc.)
    await shell.openPath(pdfPath);

    // Clean up HTML temp file (keep PDF until user is done)
    try { fs.unlinkSync(tmpHtml); } catch (e) { /* ignore */ }

    return { success: true, pdfPath };
  } catch (err) {
    console.error('[print-html] Failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close();
  }
});

// --- PDF PRINT via native dialog ---
// NOTE: Electron 32+ removed the callback form of webContents.print() — use Promise API.
ipcMain.handle('print-pdf', async (event, pdfBase64) => {
  let tmpFile = null;
  let printWin = null;
  try {
    const tmpDir = app.getPath('temp');
    tmpFile = path.join(tmpDir, `dudhsakha_print_${Date.now()}.pdf`);
    const buffer = Buffer.from(pdfBase64, 'base64');
    fs.writeFileSync(tmpFile, buffer);

    printWin = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { contextIsolation: true }
    });

    await printWin.loadFile(tmpFile);

    // Electron 32+: webContents.print() returns a Promise<void>
    await printWin.webContents.print({ silent: false, printBackground: true });

    return { success: true };
  } catch (err) {
    console.error('[print-pdf] Failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) printWin.close();
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore cleanup */ } }
  }
});

// ─── BRIDGE ORPHAN CLEANUP ────────────────────────────────────────────────────────────────────
// Each time a bridge starts, its PID is written to bridge_pids.json in userData.
// On the NEXT app launch, those PIDs are killed before any new bridge starts.
// This prevents "port is busy" / "Access Denied" errors when the app was
// force-closed (crash, Task Manager kill, power cut) without running 'will-quit',
// leaving Python processes alive and holding COM2 / COM3 open.
const BRIDGE_PID_FILE = () => path.join(app.getPath('userData'), 'bridge_pids.json');

function saveBridgePids() {
  try {
    const pids = {};
    if (fatMachineProcess?.pid)    pids.fat    = fatMachineProcess.pid;
    if (weightMachineProcess?.pid) pids.weight = weightMachineProcess.pid;
    fs.writeFileSync(BRIDGE_PID_FILE(), JSON.stringify(pids));
  } catch (e) { /* non-fatal — worst case is a stale PID on next launch */ }
}

/**
 * Kills orphaned Python bridge processes from a previous session.
 * Called at startup BEFORE the window is created so COM ports are free.
 * Resolves once the OS has had time to fully release the ports (500 ms).
 */
function killOrphanedBridges() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') { resolve(); return; }
    try {
      const pidFile = BRIDGE_PID_FILE();
      if (!fs.existsSync(pidFile)) { resolve(); return; }
      const pids = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
      fs.unlinkSync(pidFile); // Delete immediately — stale PIDs must not persist
      const toKill = [pids.fat, pids.weight, pids.tts].filter(Boolean);
      if (toKill.length === 0) { resolve(); return; }
      console.log('[Bridge] Killing orphaned bridge PIDs from previous session:', toKill);
      let done = 0;
      toKill.forEach(pid => {
        exec(`taskkill /PID ${pid} /F`, { windowsHide: true }, () => {
          if (++done === toKill.length) {
            // Wait 500 ms so Windows fully releases the COM ports before we reconnect
            setTimeout(resolve, 500);
          }
        });
      });
    } catch (e) {
      console.warn('[Bridge] Orphan cleanup failed (non-fatal):', e.message);
      resolve();
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────────

// --- FAT MACHINE INTEGRATION ---
let fatMachineProcess = null;
let fatMachineConnected = false;  // Track connection state so Settings can query it
let fatMachinePort = null;

// Helper to send data to renderer
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// Start the Python bridge script
function startFatMachineBridge() {
  if (fatMachineProcess) return; // Already running

  const pythonScript = app.isPackaged
    ? path.join(process.resourcesPath, 'fatmachine', 'python', 'fatmachine_bridge.py')
    : path.join(__dirname, '../fatmachine/python/fatmachine_bridge.py');
  
  console.log("Starting Fat Machine Bridge:", pythonScript);

  // M6: Use system Python instead of hardcoded path
  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';

  // DEBUG LOGGING
  const logPath = path.join(app.getPath('userData'), 'main_debug.log');
  try {
    fs.writeFileSync(logPath, `Attempting spawn: ${pythonExecutable} ${pythonScript}\n`);
  } catch (err) { console.error("Log error", err); }

  try {
    console.log(`Spawning python at: ${pythonExecutable}`);
    fatMachineProcess = spawn(pythonExecutable, [pythonScript]);
    try { fs.appendFileSync(logPath, `Spawn called successfully.\n`); } catch (e) { }
    saveBridgePids(); // Record PID — next launch will kill it if we crash before will-quit
  } catch (e) {
    try { fs.appendFileSync(logPath, `Spawn Exception: ${e.message}\n`); } catch (err) { }
    console.error("Failed to spawn python process:", e);
    sendToRenderer('fat-machine-status', 'Python Launch Failed');
    return;
  }

  fatMachineProcess.on('error', (err) => {
    console.error("Fat Machine Process Error:", err);
    sendToRenderer('fat-machine-status', `Python Error: ${err.message}`);
  });

  fatMachineProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (!line.trim()) return;
      try {
        const json = JSON.parse(line.trim());
        // console.log("Bridge Output:", json); 

        if (json.type === 'data') {
          sendToRenderer('fat-machine-data', json.payload);
        } else if (json.type === 'status') {
          sendToRenderer('fat-machine-status', json.payload);
        } else if (json.type === 'ports') {
          sendToRenderer('fat-machine-ports', json.payload);
        } else if (json.type === 'connection_status') {
          // Track state so Settings can query it later
          fatMachineConnected = json.connected;
          fatMachinePort = json.connected ? (json.port || null) : null;
          sendToRenderer('fat-machine-connection', json);
          if (json.connected) {
            sendToRenderer('fat-machine-status', `Connected: ${json.port}`);
          } else {
            fatMachineConnected = false;
            sendToRenderer('fat-machine-status', json.message || 'Disconnected');
          }
        } else if (json.type === 'error') {
          console.error("Bridge Error:", json.message);
          sendToRenderer('fat-machine-status', `Error: ${json.message}`);
        }
      } catch (e) {
        console.log("Raw Bridge Output:", line);
      }
    });
  });

  fatMachineProcess.stderr.on('data', (data) => {
    console.error(`Bridge Stderr: ${data}`);
  });

  fatMachineProcess.on('close', (code) => {
    console.log(`Bridge process exited with code ${code}`);
    fatMachineProcess = null;
    sendToRenderer('fat-machine-status', `Bridge Stopped (Code ${code})`);
  });
}

// Consolidated will-quit: kill BOTH bridges and remove PID file on clean exit.
// On a crash/force-kill this handler never runs — the PID file stays on disk and
// killOrphanedBridges() will clean it up when the app is next launched.
app.on('will-quit', () => {
  if (fatMachineProcess)    { try { fatMachineProcess.kill();    } catch (e) {} fatMachineProcess    = null; }
  if (weightMachineProcess) { try { weightMachineProcess.kill(); } catch (e) {} weightMachineProcess = null; }
  try { fs.unlinkSync(BRIDGE_PID_FILE()); } catch (e) { /* already gone or never created */ }
});


ipcMain.handle('fat-machine-command', async (event, command) => {
  // Handle status query without needing the bridge
  if (command.action === 'get_status') {
    return { success: true, connected: fatMachineConnected, port: fatMachinePort };
  }

  if (!fatMachineProcess) {
    startFatMachineBridge();
    // Give it a moment to start
    await new Promise(r => setTimeout(r, 500));
  }

  if (fatMachineProcess) {
    try {
      fatMachineProcess.stdin.write(JSON.stringify(command) + '\n');
      return { success: true };
    } catch (e) {
      console.error("Failed to write to bridge:", e);
      return { success: false, error: e.message };
    }
  } else {
    return { success: false, error: "Failed to start bridge" };
  }
});


// --- WEIGHT MACHINE INTEGRATION ---
let weightMachineProcess = null;
let weightMachineConnected = false;  // Track connection state so Settings can query it
let weightMachinePort = null;

function startWeightMachineBridge() {
  if (weightMachineProcess) return;

  const pythonScript = app.isPackaged
    ? path.join(process.resourcesPath, 'fatmachine', 'python', 'weight_bridge.py')
    : path.join(__dirname, '../fatmachine/python/weight_bridge.py');
    
  console.log("Starting Weight Machine Bridge:", pythonScript);

  // M6: Use system Python instead of hardcoded path
  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';

  try {
    weightMachineProcess = spawn(pythonExecutable, [pythonScript]);
    saveBridgePids(); // Record PID — next launch will kill it if we crash before will-quit
  } catch (e) {
    console.error("Failed to spawn weight bridge:", e);
    sendToRenderer('weight-machine-status', 'Python Launch Failed');
    return;
  }

  weightMachineProcess.on('error', (err) => {
    console.error("Weight Machine Process Error:", err);
    sendToRenderer('weight-machine-status', `Python Error: ${err.message}`);
  });

  weightMachineProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (!line.trim()) return;
      try {
        const json = JSON.parse(line.trim());

        if (json.type === 'data') {
          sendToRenderer('weight-machine-data', json.payload);
        } else if (json.type === 'status') {
          sendToRenderer('weight-machine-status', json.payload);
        } else if (json.type === 'ports') {
          sendToRenderer('weight-machine-ports', json.payload);
        } else if (json.type === 'connection_status') {
          // Track state so Settings can query it later
          weightMachineConnected = json.connected;
          weightMachinePort = json.connected ? (json.port || null) : null;
          sendToRenderer('weight-machine-connection', json);
          if (json.connected) {
            sendToRenderer('weight-machine-status', `Connected: ${json.port}`);
          } else {
            weightMachineConnected = false;
            sendToRenderer('weight-machine-status', json.message || 'Disconnected');
          }
        } else if (json.type === 'zero_result') {
          // Forward Auto Zero result to renderer
          sendToRenderer('weight-machine-zero-result', json);
        } else if (json.type === 'error') {
          console.error("Weight Bridge Error:", json.message);
          sendToRenderer('weight-machine-status', `Error: ${json.message}`);
        }
      } catch (e) {
        console.log("Raw Weight Bridge Output:", line);
      }
    });
  });

  weightMachineProcess.stderr.on('data', (data) => {
    console.error(`Weight Bridge Stderr: ${data}`);
  });

  weightMachineProcess.on('close', (code) => {
    console.log(`Weight bridge exited with code ${code}`);
    weightMachineProcess = null;
    sendToRenderer('weight-machine-status', `Bridge Stopped (Code ${code})`);
  });
}

// (Weight bridge cleanup is now handled in the consolidated will-quit handler above.)

ipcMain.handle('weight-machine-command', async (event, command) => {
  // Handle status query without needing the bridge
  if (command.action === 'get_status') {
    return { success: true, connected: weightMachineConnected, port: weightMachinePort };
  }

  if (!weightMachineProcess) {
    startWeightMachineBridge();
    await new Promise(r => setTimeout(r, 500));
  }

  if (weightMachineProcess) {
    try {
      weightMachineProcess.stdin.write(JSON.stringify(command) + '\n');
      return { success: true };
    } catch (e) {
      console.error("Failed to write to weight bridge:", e);
      return { success: false, error: e.message };
    }
  } else {
    return { success: false, error: "Failed to start weight bridge" };
  }
});


// ─── DEVICE SETTINGS PERSISTENCE (file-based, survives localStorage clears) ───
const getDeviceSettingsPath = () => path.join(app.getPath('userData'), 'device_settings.json');

ipcMain.handle('save-device-settings', (event, settings) => {
  try {
    fs.writeFileSync(getDeviceSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    console.error('Failed to save device settings:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('load-device-settings', () => {
  try {
    const filePath = getDeviceSettingsPath();
    if (!fs.existsSync(filePath)) return { success: true, settings: {} };
    const raw = fs.readFileSync(filePath, 'utf8');
    return { success: true, settings: JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to load device settings:', e);
    return { success: true, settings: {} };
  }
});



// ─── RATES CSV CACHE ──────────────────────────────────────────────────────────
const getRatesCachePath = (dairyId) =>
  path.join(app.getPath('userData'), `rates_cache_${dairyId}.csv`);



// Read the local CSV file — called by renderer's loadRatesFromCSV()
ipcMain.handle('rates:read-csv', (event, { dairyId }) => {
  try {
    if (!dairyId) return { success: true, data: null };
    const filePath = getRatesCachePath(dairyId);
    if (!fs.existsSync(filePath)) return { success: true, data: null };
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (e) {
    console.error('[RatesCache] Failed to read CSV:', e);
    return { success: true, data: null };
  }
});

// ─── RATES FULL REBUILD (Proxy + anon key) ────────────────────────────────────
// Runs in the Electron main process. Fetches ALL rates + farmer rate_type
// assignments for the dairy, then writes two local files:
//   rates_cache_{dairyId}.csv          — fat/snf → rate lookup table
//   farmer_rate_types_{dairyId}.json   — { farmerId: rateType, ... }
// Uses the same proxy URL + anon key as the renderer — no extra secrets.

const SUPABASE_PROXY_URL = 'https://supabase-proxy.dudhsakha-api.workers.dev';
const SUPABASE_ANON_KEY  = 'sb_publishable_tikgibRJsN8rYZ3xpXzPLA_bixoyaAC';

async function supabaseFetchAll(table, dairyId, columns = '*', authToken = null) {
  const PAGE_SIZE = 1000;
  const allRows   = [];
  let from = 0;
  while (true) {
    const url = `${SUPABASE_PROXY_URL}/rest/v1/${table}` +
      `?select=${encodeURIComponent(columns)}` +
      `&dairy_id=eq.${encodeURIComponent(dairyId)}` +
      `&limit=${PAGE_SIZE}&offset=${from}`;
    const headers = {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': authToken ? `Bearer ${authToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'count=none',
    };
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase fetch failed [${res.status}]: ${errText}`);
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

function csvQ(val) {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

function buildRatesCSV(rows) {
  const header = 'milk_type,fat,snf,rate,effective_date,rate_type,dairy_id';
  const lines  = [header];
  for (const r of rows) {
    const fat  = parseFloat(r.fat  ?? 0);
    const snf  = parseFloat(r.snf  ?? 0);
    const rate = parseFloat(r.rate ?? 0);
    if (isNaN(fat) || isNaN(snf) || isNaN(rate) || rate <= 0) continue;
    lines.push([
      csvQ(r.milk_type      || ''),
      fat.toFixed(1),
      snf.toFixed(1),
      rate.toFixed(2),
      csvQ(r.effective_date || ''),
      csvQ(r.rate_type      || 'sangh'),
      csvQ(String(r.dairy_id ?? '')),
    ].join(','));
  }
  return lines.join('\n');
}

const getFarmerRateTypesPath = (dairyId) =>
  path.join(app.getPath('userData'), `farmer_rate_types_${dairyId}.json`);

ipcMain.handle('rates:full-rebuild', async (event, { dairyId, authToken }) => {
  try {
    if (!dairyId) return { success: false, error: 'dairyId required' };
    console.log(`[RatesCache] Full rebuild started for dairy ${dairyId}...`);

    const [rates, farmers] = await Promise.all([
      supabaseFetchAll('rates',   dairyId, 'milk_type,fat,snf,rate,effective_date,rate_type,dairy_id', authToken),
      supabaseFetchAll('farmers', dairyId, 'id,rate_type,dairy_id', authToken),
    ]);

    // Write rates CSV
    fs.writeFileSync(getRatesCachePath(dairyId), buildRatesCSV(rates), 'utf8');

    // Write farmer→rate_type map
    const farmerMap = {};
    for (const f of farmers) farmerMap[String(f.id)] = f.rate_type || 'sangh';
    fs.writeFileSync(getFarmerRateTypesPath(dairyId), JSON.stringify(farmerMap, null, 2), 'utf8');

    const milkTypes = [...new Set(rates.map(r => r.milk_type))].join(', ');
    const charts    = [...new Set(rates.map(r => r.rate_type || 'sangh'))].join(', ');
    console.log(`[RatesCache] ✅ Done: ${rates.length} rates | Milk: ${milkTypes} | Charts: ${charts} | Farmers: ${farmers.length}`);

    // Notify ALL renderer windows so Collection.jsx can reload stale state
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('rates:cache-updated', { dairyId });
      }
    });

    return { success: true, ratesCount: rates.length, farmerCount: farmers.length };
  } catch (e) {
    console.error('[RatesCache] Full rebuild failed:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('rates:get-all-farmer-rate-types', (event, { dairyId }) => {
  try {
    const filePath = getFarmerRateTypesPath(dairyId);
    if (!fs.existsSync(filePath)) return { success: true, map: {} };
    return { success: true, map: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (e) {
    return { success: true, map: {} };
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// Guard flag: prevents two print jobs running at the same time.
// Reset automatically by safety timeout in case dialog was closed unexpectedly.
let isPrinting = false;

ipcMain.handle('print-receipt', (event, data, language = 'en', printSettings = null) => {
  console.log('PRINT REQUEST RECEIVED:', data.farmerName, 'Language:', language);

  return new Promise((resolve, reject) => {

    const translations = {
      en: {
        title: 'MILK RECEIPT',
        farmer: 'Farmer:',
        type: 'Type:',
        fat: 'Fat:',
        snf: 'SNF:',
        qty: 'Qty:',
        rate: 'Rate:',
        amount: 'Amount:',
        total: 'TOTAL:',
        water: 'Water:',
        thankYou: '*** THANK YOU ***',
        poweredBy: 'Powered by Dudhsakha',
        milkTypeBuffalo: 'Buffalo',
        milkTypeCow: 'Cow',
        shiftMorning: 'Morning',
        shiftEvening: 'Evening',
        method: 'Method:',
        received: 'Received:',
        remaining: 'Remaining:',
        cash: 'Cash',
        udhari: 'Udhari',
        partial: 'Partial'
      },
      mr: {
        title: 'दूध पावती',
        farmer: 'शेतकरी:',
        type: 'प्रकार:',
        fat: 'फॅट:',
        snf: 'एसएनएफ:',
        qty: 'प्रमाण:',
        rate: 'दर:',
        amount: 'रक्कम:',
        total: 'एकूण:',
        water: 'पाणी:',
        thankYou: '*** धन्यवाद ***',
        poweredBy: 'Powered by Dudhsakha',
        milkTypeBuffalo: 'म्हैस',
        milkTypeCow: 'गाय',
        shiftMorning: 'सकाळ',
        shiftEvening: 'संध्याकाळ',
        method: 'पद्धत:',
        received: 'मिळाले:',
        remaining: 'बाकी:',
        cash: 'रोख',
        udhari: 'उधारी',
        partial: 'अंशतः'
      },
      hi: {
        title: 'दूध रसीद',
        farmer: 'किसान:',
        type: 'प्रकार:',
        fat: 'फैट:',
        snf: 'एसएनएफ:',
        qty: 'मात्रा:',
        rate: 'दर:',
        amount: 'रकम:',
        total: 'कुल:',
        water: 'पानी:',
        thankYou: '*** धन्यवाद ***',
        poweredBy: 'Powered by Dudhsakha',
        milkTypeBuffalo: 'भैंस',
        milkTypeCow: 'गाय',
        shiftMorning: 'सुबह',
        shiftEvening: 'शाम',
        method: 'विधि:',
        received: 'प्राप्त:',
        remaining: 'शेष:',
        cash: 'नकद',
        udhari: 'उधारी',
        partial: 'आंशिक'
      }
    };

    const t = translations[language] || translations.en;

    // Apply custom labels if provided in settings
    let customQtyLabel = t.qty;
    let customFatLabel = t.fat;
    let customSnfLabel = t.snf;

    if (printSettings) {
      // Labels
      if (printSettings.qtyLabel && printSettings.qtyLabel[language] && printSettings.qtyLabel[language].trim() !== '') {
        customQtyLabel = printSettings.qtyLabel[language] + ':';
      }
      if (printSettings.fatLabel && printSettings.fatLabel[language] && printSettings.fatLabel[language].trim() !== '') {
        customFatLabel = printSettings.fatLabel[language] + ':';
      }
      if (printSettings.snfLabel && printSettings.snfLabel[language] && printSettings.snfLabel[language].trim() !== '') {
        customSnfLabel = printSettings.snfLabel[language] + ':';
      }
    }

    const milkTypeMap = {
      Buffalo: t.milkTypeBuffalo,
      Cow: t.milkTypeCow
    };

    const shiftMap = {
      Morning: t.shiftMorning,
      Evening: t.shiftEvening
    };

    const displayMilkType = milkTypeMap[data.milk_type] || (data.milk_type || '');
    const displayShift = data.isMilkSale
      ? (data.shift || '')
      : (shiftMap[data.shift] || (data.shift || ''));

    if (isPrinting) {
      console.warn('[Print] Print requested while another job is in progress — will retry after 2s');
      // Auto-reset after 2 seconds so the next save attempt isn't permanently blocked
      setTimeout(() => { isPrinting = false; }, 2000);
      return resolve({ success: false, message: 'Printer busy' });
    }
    isPrinting = true;

    // Safety timeout: if print dialog is dismissed, cancelled, or crashes without
    // calling the callback, isPrinting would stay true forever and block all future
    // prints. This resets it after 8 seconds as a failsafe (reduced from 15s).
    const printSafetyTimeout = setTimeout(() => {
      if (isPrinting) {
        isPrinting = false;
        console.warn('[Print] Safety timeout fired — isPrinting reset to false');
      }
    }, 8000);

    // ── PAPER SIZE ────────────────────────────────────────────────────────────
    // Map the user's chosen paper size to a BrowserWindow pixel width and a
    // font-scale factor so that receipts fill the correct print width.
    //
    //  58mm (2")  = 384px  @ 203 DPI  ← legacy default
    //  76mm (3")  = 512px  @ 203 DPI
    //  80mm (3.15")= 576px @ 203 DPI  ← most popular modern printers
    //  A4          = 794px @ 96  DPI  ← plain paper
    const PAPER_SIZES = {
      '58mm': { width: 384,  scale: 1.00 },
      '76mm': { width: 512,  scale: 1.25 },
      '80mm': { width: 576,  scale: 1.35 },
      'A4':   { width: 794,  scale: 1.70 },
    };
    const chosenSize  = (printSettings && printSettings.paperSize) || '58mm';
    const paperConfig = PAPER_SIZES[chosenSize] || PAPER_SIZES['58mm'];
    const paperWidth  = paperConfig.width;
    const fontScale   = paperConfig.scale;
    console.log(`[Print] Paper size: ${chosenSize}  →  ${paperWidth}px  scale:${fontScale}`);
    // ─────────────────────────────────────────────────────────────────────────

    const workerWindow = new BrowserWindow({
      show: false,
      width: paperWidth, // Dynamic: set from paper size setting
      height: 5000,      // Large viewport height to prevent clipping on long receipts
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const escapeHtml = (unsafe) => {
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // CSS scaled proportionally from the base 58mm (384px/scale=1.0) design.
    // All font sizes and spacing multiply by fontScale so the layout fills the
    // chosen paper width naturally without any other layout changes.
    const s = fontScale; // shorthand
    const sharedStyles = `
        @page {
            margin: 0;
        }
        body {
            margin: 0;
            padding: ${Math.round(2*s)}px ${Math.round(12*s)}px ${Math.round(2*s)}px ${Math.round(2*s)}px;
            font-family: 'Arial', sans-serif;
            font-weight: bold;
            width: 100%;
            box-sizing: border-box;
            background-color: #fff;
            color: #000;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .title  { font-size: ${Math.round(16*s)}px; text-align: center; margin: 0; line-height: 1.2; width: 100%; }
        .meta   { font-size: ${Math.round(11*s)}px; text-align: center; margin-top: ${Math.round(1*s)}px; margin-bottom: ${Math.round(3*s)}px; width: 100%; }
        .row {
            display: flex;
            justify-content: space-between;
            width: 100%;
            font-size: ${Math.round(12*s)}px;
            margin-bottom: ${Math.round(1*s)}px;
            line-height: 1.2;
        }
        .text-right {
            text-align: right;
            max-width: 55%;
            word-wrap: break-word;
        }
        .full-line {
            width: 100%;
            font-size: ${Math.round(12*s)}px;
            margin-bottom: ${Math.round(1*s)}px;
            line-height: 1.2;
            text-align: left;
            word-wrap: break-word;
        }
        .thick-divider {
            width: 100%;
            border-bottom: ${Math.round(2*s)}px solid black;
            margin-bottom: ${Math.round(5*s)}px;
            margin-top: ${Math.round(2*s)}px;
        }
        .thin-divider {
            width: 100%;
            border-bottom: 1px solid black;
            margin-bottom: ${Math.round(5*s)}px;
            margin-top: ${Math.round(2*s)}px;
        }
        .footer {
            font-size: ${Math.round(9*s)}px;
            text-align: center;
            margin-top: ${Math.round(3*s)}px;
            line-height: 1.2;
            width: 100%;
        }
        .credit {
            font-size: ${Math.round(7*s)}px;
            text-align: center;
            margin-top: ${Math.round(2*s)}px;
            width: 100%;
        }
    `;

    const toLocaleNum = (numStr) => {
      if (language !== 'mr' || numStr === undefined || numStr === null) return numStr;
      const marathiDigits = {
        '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', 
        '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
      };
      return String(numStr).replace(/[0-9]/g, match => marathiDigits[match]);
    };

    let htmlContent;

    // Helper functions for conditionally rendering rows based on settings
    const renderRow = (label, value, isVisible = true) => {
      if (!isVisible && printSettings) return ''; // Hide if settings exist and say false
      return `
            <div class="row">
                <span>${escapeHtml(label)}</span>
                <span class="text-right">${value}</span>
            </div>
        `;
    };

    if (data.isLocalSaleBill) {
      const getCycleLabel = (cycle) => {
        if (cycle === '10_days') return language === 'mr' ? '१० दिवस' : language === 'hi' ? '१० दिन' : '10 Days';
        if (cycle === '30_days') return language === 'mr' ? '३० दिवस' : language === 'hi' ? '३० दिन' : '30 Days';
        return language === 'mr' ? 'त्वरित रोख' : language === 'hi' ? 'तुरंत नकद' : 'Immediate Cash';
      };

      const billRowsHtml = (data.rows || []).map(r => `
        <div style="display: flex; justify-content: space-between; font-size: 10px; border-bottom: 0.2px solid #eee; width: 100%; padding: 2px 0;">
            <span style="flex: 1.5; text-align: left;">${escapeHtml(formatDate(r.sale_date).slice(0, 5))} (${escapeHtml(r.milk_type === 'Buffalo' ? (language === 'mr' ? 'म्हैस' : language === 'hi' ? 'भैंस' : 'Buf') : (language === 'mr' ? 'गाय' : language === 'hi' ? 'गाय' : 'Cow'))})</span>
            <span style="flex: 1; text-align: right;">${escapeHtml(toLocaleNum(parseFloat(r.quantity || 0).toFixed(3)))}L</span>
            <span style="flex: 1.2; text-align: right;">₹${escapeHtml(toLocaleNum(Math.round(r.amount || 0)))}</span>
            <span style="flex: 1.2; text-align: right;">₹${escapeHtml(toLocaleNum(Math.round(r.received_amount !== undefined && r.received_amount !== null ? r.received_amount : r.amount)))}</span>
        </div>
      `).join('');

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${sharedStyles}</style>
        </head>
        <body>
            <div class="title">${escapeHtml(data.dairyName || (language === 'mr' ? 'स्थानिक ग्राहक बिल' : language === 'hi' ? 'स्थानीय ग्राहक बिल' : 'CUSTOMER BILL'))}</div>
            <div class="meta">${escapeHtml(toLocaleNum(formatDate(data.startDate)))} - ${escapeHtml(toLocaleNum(formatDate(data.endDate)))}</div>
            
            <div class="thick-divider"></div>

            <div class="row">
                <span>${escapeHtml(language === 'mr' ? 'ग्राहक:' : language === 'hi' ? 'ग्राहक:' : 'Customer:')}</span>
                <span class="text-right" style="font-weight: bold;">${escapeHtml(data.customerName)}</span>
            </div>
            <div class="row">
                <span>${escapeHtml(language === 'mr' ? 'सायकल:' : language === 'hi' ? 'चक्र:' : 'Cycle:')}</span>
                <span class="text-right">${escapeHtml(getCycleLabel(data.billingCycle))}</span>
            </div>

            <div class="thick-divider"></div>
            
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; border-bottom: 1px solid black; width: 100%; padding-bottom: 2px;">
                <span style="flex: 1.5; text-align: left;">${escapeHtml(language === 'mr' ? 'दिनांक' : language === 'hi' ? 'दिनांक' : 'Date')}</span>
                <span style="flex: 1; text-align: right;">${escapeHtml(language === 'mr' ? 'लिटर' : language === 'hi' ? 'लीटर' : 'Qty')}</span>
                <span style="flex: 1.2; text-align: right;">${escapeHtml(language === 'mr' ? 'रक्कम' : language === 'hi' ? 'रकम' : 'Amt')}</span>
                <span style="flex: 1.2; text-align: right;">${escapeHtml(language === 'mr' ? 'जमा' : language === 'hi' ? 'जमा' : 'Paid')}</span>
            </div>

            ${billRowsHtml}

            <div class="thick-divider"></div>

            <div class="row">
                <span>${escapeHtml(language === 'mr' ? 'एकूण लिटर:' : language === 'hi' ? 'कुल लीटर:' : 'Total Qty:')}</span>
                <span class="text-right">${escapeHtml(toLocaleNum(parseFloat(data.totalQty || 0).toFixed(3)))} L</span>
            </div>
            <div class="row">
                <span>${escapeHtml(language === 'mr' ? 'एकूण रक्कम:' : language === 'hi' ? 'कुल राशि:' : 'Total Amount:')}</span>
                <span class="text-right">₹${escapeHtml(toLocaleNum(parseFloat(data.totalAmount || 0).toFixed(2)))}</span>
            </div>
            <div class="row">
                <span>${escapeHtml(language === 'mr' ? 'एकूण जमा:' : language === 'hi' ? 'कुल जमा:' : 'Total Received:')}</span>
                <span class="text-right">₹${escapeHtml(toLocaleNum(parseFloat(data.receivedAmount || 0).toFixed(2)))}</span>
            </div>
            <div class="row" style="font-size: 14px; font-weight: bold; border-top: 1px dashed black; padding-top: 2px;">
                <span>${escapeHtml(language === 'mr' ? 'उर्वरित बाकी:' : language === 'hi' ? 'शेष बाकी:' : 'Total Balance:')}</span>
                <span class="text-right">₹${escapeHtml(toLocaleNum(parseFloat(data.remainingAmount || 0).toFixed(2)))}</span>
            </div>

            <div class="thick-divider"></div>

            <div class="footer">
                ${escapeHtml(toLocaleNum(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))}
                <div style="margin-top: 4px;">*** ${escapeHtml(language === 'mr' ? 'धन्यवाद' : language === 'hi' ? 'धन्यवाद' : 'THANK YOU')} ***</div>
            </div>
        </body>
        </html>
      `;
    } else if (data.isMilkSale) {
      // MILK SALE RECEIPT
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${sharedStyles}</style>
        </head>
        <body>
            <div class="title">${escapeHtml(data.dairyName || data.receiptTitle || (language === 'mr' ? 'दूध विक्री' : language === 'hi' ? 'दूध बिक्री' : 'MILK SALE'))}</div>
            <div class="meta">${escapeHtml(toLocaleNum(formatDate(data.sale_date)))} ${!printSettings || printSettings.showShift ? `| ${escapeHtml(displayShift)}` : ''}</div>
            
            <div class="thick-divider"></div>

            <div class="row">
                <span>${escapeHtml(t.farmer)}</span>
                <span class="text-right">${data.farmerCode ? escapeHtml(toLocaleNum(String(data.farmerCode))) : ''}</span>
            </div>
            <div class="full-line">
                ${escapeHtml(data.farmerName || '')}
            </div>
            
            <div class="row">
                <span>${escapeHtml(t.type)}</span>
                <span class="text-right">${escapeHtml(displayMilkType)}</span>
            </div>

            <div class="thin-divider"></div>

            ${renderRow(customQtyLabel, `${escapeHtml(toLocaleNum(data.quantity))} L`)}
            ${renderRow(t.rate, `₹${toLocaleNum(parseFloat(data.rate).toFixed(2))}`, !printSettings || printSettings.showRate)}

            <div class="thick-divider"></div>

            ${renderRow(t.total, `₹${toLocaleNum(parseFloat(data.amount).toFixed(2))}`, !printSettings || printSettings.showAmount)}

            ${data.payment_method ? `
            <div class="thin-divider"></div>
            <div class="row" style="font-size: 11px;">
                <span>${escapeHtml(t.method || 'Method:')}</span>
                <span class="text-right">${escapeHtml(data.payment_method === 'Cash' ? t.cash : data.payment_method === 'Udhari' ? t.udhari : t.partial)}</span>
            </div>
            <div class="row" style="font-size: 11px;">
                <span>${escapeHtml(t.received || 'Received:')}</span>
                <span class="text-right">₹${toLocaleNum(parseFloat(data.received_amount !== undefined && data.received_amount !== null ? data.received_amount : data.amount).toFixed(2))}</span>
            </div>
            <div class="row" style="font-size: 11px;">
                <span>${escapeHtml(t.remaining || 'Remaining:')}</span>
                <span class="text-right">₹${toLocaleNum(parseFloat(data.remaining_amount || 0).toFixed(2))}</span>
            </div>
            ` : ''}

            <div class="thick-divider"></div>

            <div class="footer">
                ${escapeHtml(toLocaleNum(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))}
            </div>
            <div class="credit"></div>
        </body>
        </html>
      `;
    } else {
      // FARMER COLLECTION RECEIPT
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${sharedStyles}</style>
        </head>
        <body>
            <div class="title">${escapeHtml(data.dairyName || t.title)}</div>
            <div class="meta">${escapeHtml(toLocaleNum(formatDate(data.date)))} ${!printSettings || printSettings.showShift ? `| ${escapeHtml(displayShift)}` : ''}</div>
            
            <div class="thick-divider"></div>

            <div class="row">
                <span>${escapeHtml(t.farmer)}</span>
                <span class="text-right">${data.farmerCode ? escapeHtml(toLocaleNum(String(data.farmerCode))) : ''}</span>
            </div>
            <div class="full-line">
                ${escapeHtml(data.farmerName || '')}
            </div>

            <div class="row">
                <span>${escapeHtml(t.type)}</span>
                <span class="text-right">${escapeHtml(displayMilkType)}</span>
            </div>

            <div class="thin-divider"></div>

            ${renderRow(customFatLabel, toLocaleNum(parseFloat(data.fat).toFixed(1)), !printSettings || printSettings.showFat)}
            ${renderRow(customSnfLabel, toLocaleNum(parseFloat(data.snf).toFixed(1)), !printSettings || printSettings.showSnf)}
            ${renderRow(customQtyLabel, `${toLocaleNum(parseFloat(data.quantity).toFixed(3))} L`)}
            ${renderRow(t.water, `${toLocaleNum(parseFloat(data.addedWater ?? 0).toFixed(1))}%`, printSettings && printSettings.showWater && data.addedWater != null)}
            ${renderRow(t.rate, `₹${toLocaleNum(parseFloat(data.rate).toFixed(2))}`, !printSettings || printSettings.showRate)}

            <div class="thick-divider"></div>

            ${renderRow(t.total, `₹${toLocaleNum(parseFloat(data.amount).toFixed(2))}`, !printSettings || printSettings.showAmount)}

            <div class="thick-divider"></div>

            <div class="footer">
                ${escapeHtml(toLocaleNum(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))}
            </div>
            <div class="credit"></div>
        </body>
        </html>
      `;
    }

    workerWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    workerWindow.webContents.on('did-finish-load', () => {

      workerWindow.webContents.print({ silent: false, printBackground: true, deviceName: '' }, (success, errorType) => {
        clearTimeout(printSafetyTimeout); // ✅ Cancel safety timeout — print resolved normally
        if (!success) {
          console.error("Print failed:", errorType);
          isPrinting = false;
          reject(new Error(errorType));
        } else {
          console.log("Print initiated successfully.");
          isPrinting = false;
          resolve({ success: true });
        }

        setTimeout(() => {
          workerWindow.close();
        }, 500);
      });
    });

    workerWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      clearTimeout(printSafetyTimeout); // ✅ Cancel safety timeout — load failed
      isPrinting = false;
      reject(new Error('Failed to load receipt content: ' + errorDescription));
      workerWindow.close();
    });
  });
});
// --- CHECK WHICH TTS VOICES ARE INSTALLED ---
// Renderer calls this to get a list of installed Windows speech voices,
// then refreshes window.speechSynthesis so newly installed voices are picked up.
ipcMain.handle('check-tts-voices', async () => {
  if (process.platform !== 'win32') return { voices: [], installed: false };
  return new Promise((resolve) => {
    const ps = [
      '$voices = New-Object System.Collections.Generic.List[string];',
      '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
      'foreach ($v in $synth.GetInstalledVoices()) {',
      '  $voices.Add($v.VoiceInfo.Name + "|" + $v.VoiceInfo.Culture);',
      '}',
      '$synth.Dispose();',
      'Write-Output ($voices -join ",");',
    ].join(' ');
    exec(
      `powershell.exe -NonInteractive -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Speech; ${ps}"`,
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        if (err) { resolve({ voices: [], installed: false }); return; }
        const voiceList = (stdout || '').trim();
        const hasMarathi = voiceList.toLowerCase().includes('mr-in') || voiceList.toLowerCase().includes('marathi');
        const hasHindi = voiceList.toLowerCase().includes('hi-in') || voiceList.toLowerCase().includes('hindi');
        resolve({ voices: voiceList.split(',').filter(Boolean), installed: hasMarathi || hasHindi });
      }
    );
  });
});

