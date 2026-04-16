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
const GATEWAY_PORT = 3210;
const DASHBOARD_PORT = 3000;

// Get resource paths
function getResourcePath(relativePath: string): string {
  if (isDev) {
    return path.join(__dirname, '..', '..', relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

// Start the gateway server
async function startGateway(): Promise<void> {
  return new Promise((resolve, reject) => {
    const gatewayPath = path.join(__dirname, '..', '..', '..', 'dist', 'bin', 'cli.js');

    if (!fs.existsSync(gatewayPath)) {
      console.log('Gateway not found at:', gatewayPath);
      resolve(); // Continue without gateway
      return;
    }

    gatewayProcess = spawn('node', [gatewayPath, 'run', String(GATEWAY_PORT)], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    });

    gatewayProcess.stdout?.on('data', (data) => {
      console.log('[Gateway]', data.toString());
      if (data.toString().includes('gateway running')) {
        resolve();
      }
    });

    gatewayProcess.stderr?.on('data', (data) => {
      console.error('[Gateway Error]', data.toString());
    });

    gatewayProcess.on('error', (err) => {
      console.error('Failed to start gateway:', err);
      resolve(); // Continue anyway
    });

    // Timeout after 5 seconds
    setTimeout(resolve, 5000);
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
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0B0F14',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  // Load the dashboard
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${DASHBOARD_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    const dashboardPath = getResourcePath('dashboard/index.html');
    if (fs.existsSync(dashboardPath)) {
      mainWindow.loadFile(dashboardPath);
    } else {
      mainWindow.loadURL(`http://localhost:${DASHBOARD_PORT}`);
    }
  }

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
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'OpenTradex',
      submenu: [
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
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
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
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' },
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
            shell.openExternal('https://discord.gg/opentradex');
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
