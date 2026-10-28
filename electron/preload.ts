import type {
  AppSettings,
  CleanupCandidateItem,
  CleanupExecutionPlan,
  CleanupHistoryRecord,
  CleanupProgress,
  CleanupResult,
  DevProjectCandidate,
  DirectoryTreeNode,
  DriveInfo,
  DuplicateGroup,
  FileItem,
  ScanProgress,
  StorageGuardianAPI,
} from '../src/types/index.ts';

// @ts-ignore
const { contextBridge, ipcRenderer } = require('electron');

const IPC_CHANNELS = {
  GET_DRIVES: 'storage:get-drives',
  SELECT_FOLDER: 'storage:select-folder',
  START_FOLDER_SCAN: 'storage:start-folder-scan',
  CANCEL_FOLDER_SCAN: 'storage:cancel-folder-scan',
  SCAN_PROGRESS: 'storage:scan-progress',
  GET_SCAN_RESULT: 'storage:get-scan-result',
  FIND_LARGE_FILES: 'storage:find-large-files',
  OPEN_EXPLORER: 'storage:open-explorer',
  OPEN_FILE: 'storage:open-file',
  FIND_DUPLICATES: 'storage:find-duplicates',
  CANCEL_DUPLICATES: 'storage:cancel-duplicates',
  DUPLICATE_PROGRESS: 'storage:duplicate-progress',
  SCAN_SAFE_CLEAN: 'storage:scan-safe-clean',
  EXECUTE_CLEANUP: 'storage:execute-cleanup',
  CANCEL_CLEANUP: 'storage:cancel-cleanup',
  CLEANUP_PROGRESS: 'storage:cleanup-progress',
  SCAN_DEV_PROJECTS: 'storage:scan-dev-projects',
  CLEAN_DEV_CANDIDATES: 'storage:clean-dev-candidates',
  GET_HISTORY: 'storage:get-history',
  CLEAR_HISTORY: 'storage:clear-history',
  EXPORT_HISTORY_CSV: 'storage:export-history-csv',
  GET_SETTINGS: 'storage:get-settings',
  SAVE_SETTINGS: 'storage:save-settings',
  GET_SANDBOX_PATH: 'storage:get-sandbox-path',
  SETUP_SANDBOX: 'storage:setup-sandbox',
} as const;

console.log('[PRELOAD-INIT] Storage Guardian Preload script initializing...');

const api: StorageGuardianAPI = {
  getDrives: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DRIVES),
  selectFolder: () => {
    console.log('[DIAG-C] Preload selectFolder() invoked. Sending IPC:', IPC_CHANNELS.SELECT_FOLDER);
    return ipcRenderer.invoke(IPC_CHANNELS.SELECT_FOLDER);
  },
  
  startFolderScan: (targetPath: string, options?: { maxDepth?: number }) => {
    console.log('[DIAG-C] Preload startFolderScan() invoked with path:', targetPath);
    return ipcRenderer.invoke(IPC_CHANNELS.START_FOLDER_SCAN, targetPath, options);
  },
  
  cancelFolderScan: () => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_FOLDER_SCAN),
  
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const handler = (_event: any, progress: ScanProgress) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.SCAN_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SCAN_PROGRESS, handler);
    };
  },

  getScanResult: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SCAN_RESULT),

  findLargeFiles: (targetPath: string, minSizeBytes: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.FIND_LARGE_FILES, targetPath, minSizeBytes),

  openPathInExplorer: (targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXPLORER, targetPath),

  openFileItem: (targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE, targetPath),

  findDuplicates: (targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FIND_DUPLICATES, targetPath),

  cancelDuplicateScan: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_DUPLICATES),

  onDuplicateProgress: (callback: (progress: ScanProgress) => void) => {
    const handler = (_event: any, progress: ScanProgress) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.DUPLICATE_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.DUPLICATE_PROGRESS, handler);
    };
  },

  scanSafeCleanCandidates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_SAFE_CLEAN),

  executeCleanup: (plan: CleanupExecutionPlan) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_CLEANUP, plan),

  cancelCleanup: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_CLEANUP),

  onCleanupProgress: (callback: (progress: CleanupProgress) => void) => {
    const handler = (_event: any, progress: CleanupProgress) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.CLEANUP_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CLEANUP_PROGRESS, handler);
    };
  },

  scanDevProjects: (targetRoot: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_DEV_PROJECTS, targetRoot),

  cleanDevCandidates: (items: DevProjectCandidate[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAN_DEV_CANDIDATES, items),

  getHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),

  clearHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY),

  exportHistoryCsv: () =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_HISTORY_CSV),

  getSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  saveSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  getSandboxPath: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SANDBOX_PATH),

  setupSandbox: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SETUP_SANDBOX),
};

contextBridge.exposeInMainWorld('storageGuardian', {
  ...api,
  __diag: {
    isRealElectron: true,
    preloadLoadedAt: new Date().toISOString(),
  },
});
console.log('[PRELOAD-SUCCESS] window.storageGuardian exposed to main world successfully!');
