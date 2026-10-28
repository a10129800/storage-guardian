import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { IPC_CHANNELS } from './ipc/channels.ts';
import { DiskService } from './ipc/diskService.ts';
import { ScannerService } from './ipc/scannerService.ts';
import { DuplicateService } from './ipc/duplicateService.ts';
import { CleanService } from './ipc/cleanService.ts';
import { DevCleanerService } from './ipc/devCleanerService.ts';
import { HistoryService } from './ipc/historyService.ts';
import { SettingsService } from './ipc/settingsService.ts';
import { resolveWindowsPath, validateSafePath, validateScanPath } from '../src/utils/security.ts';
import os from 'os';
import { createSandboxFiles } from './ipc/sandboxService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDiagLogPath(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      const userDir = app.getPath('userData');
      if (userDir) {
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }
        return path.join(userDir, 'diagnostic.log');
      }
    }
  } catch {}

  const appData = process.env.APPDATA || (os.homedir() ? path.join(os.homedir(), 'AppData', 'Roaming') : '');
  if (appData) {
    const dir = path.join(appData, 'StorageGuardian');
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, 'diagnostic.log');
    } catch {}
  }

  return path.resolve(__dirname, '../diagnostic.log');
}

function logDiag(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);
  try {
    fs.appendFileSync(getDiagLogPath(), logLine + '\n', 'utf8');
  } catch {}
}

let mainWindow: BrowserWindow | null = null;

const diskService = new DiskService();
const scannerService = new ScannerService();
const duplicateService = new DuplicateService();
const cleanService = new CleanService();
const devCleanerService = new DevCleanerService();
const historyService = new HistoryService();
const settingsService = new SettingsService();

function createWindow() {
  const preloadCjs = path.join(__dirname, 'preload.cjs');
  const preloadJs = path.join(__dirname, 'preload.js');
  const preloadPath = fs.existsSync(preloadCjs) ? preloadCjs : preloadJs;

  logDiag(`[MAIN] Preload 腳本選定路徑: ${preloadPath} (檔案存在: ${fs.existsSync(preloadPath)})`);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 650,
    frame: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload IPC bridge in standard vite-electron setup
    },
    title: 'Storage Guardian | 電腦容量守護者',
  });

  // Capture preload errors
  (mainWindow.webContents as any).on('preload-error', (_event: any, preloadPathErr: string, error: Error) => {
    logDiag(`[MAIN-PRELOAD-ERROR] Preload 載入嚴重錯誤！路徑: ${preloadPathErr}, 錯誤: ${error.message}\n${error.stack}`);
  });

  // Capture renderer console messages
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = level === 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
    logDiag(`[RENDERER-${levelStr}] ${message} (${path.basename(sourceId)}:${line})`);
  });

  // Verify window.storageGuardian upon page load
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const checkResult = await mainWindow?.webContents.executeJavaScript(`
        ({
          hasStorageGuardian: typeof window.storageGuardian !== 'undefined',
          keys: typeof window.storageGuardian !== 'undefined' ? Object.keys(window.storageGuardian) : [],
          diag: typeof window.storageGuardian !== 'undefined' ? window.storageGuardian.__diag : null
        })
      `);
      logDiag(`[MAIN-VERIFY] 頁面載入完成，window.storageGuardian 檢測結果: ${JSON.stringify(checkResult)}`);
    } catch (err: any) {
      logDiag(`[MAIN-VERIFY-ERROR] 執行 window.storageGuardian 檢查失敗: ${err.message}`);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercept navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    cleanService.cancel();
    devCleanerService.cancel();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  logDiag('====================================================');
  logDiag('Storage Guardian 主程序啟動 - 診斷監控開啟');
  logDiag(`Node: ${process.versions.node}, Electron: ${process.versions.electron}`);
  logDiag('====================================================');
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // Drives
  ipcMain.handle(IPC_CHANNELS.GET_DRIVES, async () => {
    const settings = await settingsService.getSettings();
    return diskService.getDrives(settings.lowDiskThresholdPercent);
  });

  // Folder Picker Dialog
  ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async (event) => {
    logDiag('[DIAG-D] 主程序收到 IPC: storage:select-folder 請求');
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow || null;
      logDiag(`[DIAG-E] 主程序準備呼叫 dialog.showOpenDialog (目標視窗: ${win && !win.isDestroyed() ? '有效' : '無/獨立'})...`);
      const options: Electron.OpenDialogOptions = {
        title: '選擇要掃描或分析的資料夾',
        properties: ['openDirectory', 'dontAddToRecent'],
      };
      const result = win && !win.isDestroyed()
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);

      logDiag(`[DIAG-F] dialog.showOpenDialog 返回: canceled=${result.canceled}, filePaths=${JSON.stringify(result.filePaths)}`);
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (err: any) {
      logDiag(`[DIAG-F-ERROR] dialog.showOpenDialog 拋出例外: ${err.message || String(err)}`);
      console.error('IPC SELECT_FOLDER failed:', err);
      throw new Error(`無法開啟資料夾選取對話方塊：${err.message || String(err)}`);
    }
  });

  // Directory Scanner
  ipcMain.handle(IPC_CHANNELS.START_FOLDER_SCAN, async (event, rawPath: string, options?: { maxDepth?: number }) => {
    logDiag(`[DIAG-D] 主程序收到 START_FOLDER_SCAN 請求, rawPath="${rawPath}"`);
    const targetPath = resolveWindowsPath(rawPath);
    logDiag(`[DIAG-E] 解析 Windows 路徑: "${targetPath}", 檔案是否存在: ${fs.existsSync(targetPath)}`);
    if (!targetPath || !fs.existsSync(targetPath)) {
      const errMsg = `指定的資料夾不存在：${rawPath || '未填寫'}${rawPath && rawPath !== targetPath ? ` (解析路徑為: ${targetPath})` : ''}。請確認路徑或點擊「🧪 隔離測試沙箱」自動建立檔案。`;
      logDiag(`[DIAG-F-ERROR] START_FOLDER_SCAN 失敗: ${errMsg}`);
      throw new Error(errMsg);
    }
    const safety = validateScanPath(targetPath);
    if (!safety.safe) {
      const errMsg = safety.reason || '目標路徑無效，無法進行掃描';
      logDiag(`[DIAG-F-ERROR] 安全防護攔截: ${errMsg}`);
      throw new Error(errMsg);
    }
    logDiag(`[DIAG-E] 開始執行 scannerService.scanDirectory("${targetPath}")...`);
    return scannerService.scanDirectory(
      targetPath,
      (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.SCAN_PROGRESS, progress);
        }
      },
      options?.maxDepth || 10
    );
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_FOLDER_SCAN, async () => {
    scannerService.cancelScan();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_SCAN_RESULT, async () => {
    return scannerService.getLastResult();
  });

  // Large Files
  ipcMain.handle(IPC_CHANNELS.FIND_LARGE_FILES, async (_event, rawPath: string, minSizeBytes: number) => {
    const targetPath = resolveWindowsPath(rawPath);
    if (!targetPath || !fs.existsSync(targetPath)) {
      throw new Error(`指定的路徑不存在：${rawPath || '未填寫'}。請確認路徑或點擊「🧪 隔離測試沙箱」。`);
    }
    const safety = validateScanPath(targetPath);
    if (!safety.safe) {
      throw new Error(safety.reason || '目標路徑無效，無法檢索大型檔案');
    }
    return scannerService.findLargeFiles(targetPath, minSizeBytes || 104857600);
  });

  // Explorer Open / Reveal
  ipcMain.handle(IPC_CHANNELS.OPEN_EXPLORER, async (_event, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) return false;
    shell.showItemInFolder(targetPath);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async (_event, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) return false;
    const res = await shell.openPath(targetPath);
    return res === '';
  });

  // Duplicate Scanner
  ipcMain.handle(IPC_CHANNELS.FIND_DUPLICATES, async (event, rawPath: string) => {
    const targetPath = resolveWindowsPath(rawPath);
    if (!targetPath || !fs.existsSync(targetPath)) {
      throw new Error(`指定的路徑不存在：${rawPath || '未填寫'}。請確認路徑或點擊「🧪 隔離測試沙箱」。`);
    }
    const safety = validateScanPath(targetPath);
    if (!safety.safe) {
      throw new Error(safety.reason || '目標路徑無效，無法搜尋重複檔案');
    }
    return duplicateService.findDuplicates(targetPath, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.DUPLICATE_PROGRESS, progress);
      }
    });
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_DUPLICATES, async () => {
    duplicateService.cancel();
    return true;
  });

  // Safe Cleanup
  ipcMain.handle(IPC_CHANNELS.SCAN_SAFE_CLEAN, async () => {
    return cleanService.scanSafeCleanCandidates();
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_CLEANUP, async () => {
    logDiag('[DIAG-D] 主程序收到 CANCEL_CLEANUP 請求，正在通知清理服務中斷後續任務...');
    cleanService.cancel();
    devCleanerService.cancel();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.EXECUTE_CLEANUP, async (event, plan) => {
    logDiag(`[DIAG-D] 主程序收到 EXECUTE_CLEANUP 請求, itemsCount=${plan?.items?.length}, method=${plan?.method}`);
    if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) {
      logDiag('[DIAG-F-ERROR] EXECUTE_CLEANUP 失敗：未提供有效的清理執行計畫');
      throw new Error('未提供有效的清理執行計畫');
    }
    const result = await cleanService.executeCleanup(plan, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.CLEANUP_PROGRESS, progress);
      }
    });
    logDiag(`[DIAG-E] EXECUTE_CLEANUP 完成：成功=${result.successCount}, 略過=${result.skippedCount}, 失敗=${result.failCount}, 實際釋放=${result.actualFreedBytes} Bytes`);
    await historyService.appendRecord(result, plan.totalEstimatedBytes);
    return result;
  });

  // Developer Cleaner
  ipcMain.handle(IPC_CHANNELS.SCAN_DEV_PROJECTS, async (_event, targetRoot: string) => {
    if (!targetRoot || !fs.existsSync(targetRoot)) {
      throw new Error('指定的專案根目錄不存在');
    }
    const safety = validateScanPath(targetRoot);
    if (!safety.safe) {
      throw new Error(safety.reason || '目標目錄無效，無法掃描專案快取');
    }
    return devCleanerService.scanDevProjects(targetRoot);
  });

  ipcMain.handle(IPC_CHANNELS.CLEAN_DEV_CANDIDATES, async (event, items) => {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('未提供待清理的專案產物');
    }
    const result = await devCleanerService.cleanCandidates(items, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.CLEANUP_PROGRESS, progress);
      }
    });
    await historyService.appendRecord(result);
    return result;
  });

  // History & Audit Log
  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
    return historyService.getHistory();
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, async () => {
    return historyService.clearHistory();
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_HISTORY_CSV, async () => {
    return historyService.exportCsv();
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return settingsService.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, updatedSettings) => {
    return settingsService.saveSettings(updatedSettings);
  });

  // Sandbox Test
  ipcMain.handle(IPC_CHANNELS.GET_SANDBOX_PATH, async () => {
    return path.join(os.tmpdir(), 'StorageGuardian-Sandbox');
  });

  ipcMain.handle(IPC_CHANNELS.SETUP_SANDBOX, async () => {
    const result = await createSandboxFiles();
    return result.sandboxDir;
  });
}
