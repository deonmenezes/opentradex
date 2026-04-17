/**
 * OpenTradex Desktop App - Electron Main Process
 */

import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let gatewayProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const GATEWAY_PORT = 3210;
const DASHBOARD_PORT = 3000;

// Start the gateway server
async function startGateway(): Promise<void> {
  return new Promise((resolve) => {
    // In dev: resolve from packages/desktop/dist → project root.
    // In packaged: expect gateway bundled at resources/app/dist/bin/cli.js.
    const candidates = [
      path.join(__dirname, '..', '..', '..', 'dist', 'bin', 'cli.js'),
      path.join(process.resourcesPath || '', 'app', 'dist', 'bin', 'cli.js'),
      path.join(process.resourcesPath || '', 'dist', 'bin', 'cli.js'),
    ];
    const gatewayPath = candidates.find((p) => p && fs.existsSync(p));

    if (!gatewayPath) {
      console.log('[Gateway] cli.js not found — dashboard will expect an externally-running gateway');
      resolve();
      return;
    }

    gatewayProcess = spawn('node', [gatewayPath, 'run', String(GATEWAY_PORT)], {
      stdio: 'pipe',
      shell: isWin,
      windowsHide: true,
      env: { ...process.env, NODE_ENV: 'production' },
    });

    gatewayProcess.stdout?.on('data', (data) => console.log('[Gateway]', data.toString().trim()));
    gatewayProcess.stderr?.on('data', (data) => console.error('[Gateway err]', data.toString().trim()));
    gatewayProcess.on('error', (err) => {
      console.error('Failed to start gateway:', err);
      resolve();
    });

    // Poll the gateway until it answers, then resolve.
    const deadline = Date.now() + 15000;
    const ping = async (): Promise<void> => {
      try {
        const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/health`, { signal: AbortSignal.timeout(500) });
        if (res.ok) return resolve();
      } catch { /* not ready */ }
      if (Date.now() > deadline) return resolve();
      setTimeout(ping, 250);
    };
    setTimeout(ping, 300);
  });
}

// Stop the gateway server
function stopGateway(): void {
  if (gatewayProcess) {
    gatewayProcess.kill();
    gatewayProcess = null;
  }
}

// Create the main window
function createWindow(): void {
  const iconFile = isWin ? 'icon.ico' : isMac ? 'icon.icns' : 'icon.png';
  const iconPath = path.join(__dirname, '..', 'assets', iconFile);

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0B0F14',
    // hiddenInset is macOS-only; Windows gets a normal title bar.
    ...(isMac ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 15, y: 15 } } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
  });

  // Load the dashboard. The gateway (port 3210) already serves the built dashboard,
  // so we point there in both dev and prod — single source of truth.
  mainWindow.loadURL(`http://127.0.0.1:${GATEWAY_PORT}`);
  if (isDev) mainWindow.webContents.openDevTools();

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createMenu(): void {
  const appMenuSubmenu: Electron.MenuItemConstructorOptions[] = [
    { role: 'about' },
    { type: 'separator' },
    {
      label: 'Preferences...',
      accelerator: 'CmdOrCtrl+,',
      click: () => {
        mainWindow?.webContents.send('open-settings');
      },
    },
    { type: 'separator' },
    ...(isMac
      ? ([
          { role: 'services' as const },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    { role: 'quit' },
  ];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'OpenTradex',
      submenu: appMenuSubmenu,
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Trading',
      submenu: [
        {
          label: 'Run Cycle',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.send('run-cycle');
          },
        },
        {
          label: 'Toggle Auto Loop',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow?.webContents.send('toggle-autoloop');
          },
        },
        { type: 'separator' },
        {
          label: 'PANIC - Emergency Stop',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: async () => {
            const result = await dialog.showMessageBox(mainWindow!, {
              type: 'warning',
              buttons: ['Cancel', 'PANIC'],
              defaultId: 0,
              title: 'Emergency Stop',
              message: 'This will flatten all positions and halt trading.',
              detail: 'Are you sure you want to proceed?',
            });
            if (result.response === 1) {
              mainWindow?.webContents.send('panic');
            }
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: isMac
        ? [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' },
          ]
        : [
            { role: 'minimize' },
            { role: 'close' },
          ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/deonmenezes/opentradex#readme');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/deonmenezes/opentradex/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'Join Discord',
          click: () => {
            shell.openExternal('https://discord.gg/tNfdVQU5');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle('get-gateway-url', () => {
  return `http://localhost:${GATEWAY_PORT}`;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// App lifecycle
app.whenReady().then(async () => {
  createMenu();
  await startGateway();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopGateway();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopGateway();
});
