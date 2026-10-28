import {
  AppSettings,
  CleanupCandidateItem,
  CleanupExecutionPlan,
  CleanupHistoryRecord,
  CleanupResult,
  DevProjectCandidate,
  DirectoryTreeNode,
  DriveInfo,
  DuplicateGroup,
  FileItem,
  ScanProgress,
  StorageGuardianAPI,
} from '../types/index.ts';

// Browser dev fallback mocks if not running inside Electron
const mockDrives: DriveInfo[] = [
  {
    id: 'drive-c',
    mountPoint: 'C:',
    label: '系統磁碟 (Windows)',
    fileSystem: 'NTFS',
    totalBytes: 512 * 1024 * 1024 * 1024,
    usedBytes: 420 * 1024 * 1024 * 1024,
    freeBytes: 92 * 1024 * 1024 * 1024,
    usagePercent: 82.0,
    isSystem: true,
    isReady: true,
    warning: false,
  },
  {
    id: 'drive-d',
    mountPoint: 'D:',
    label: '資料與專案磁碟',
    fileSystem: 'NTFS',
    totalBytes: 1024 * 1024 * 1024 * 1024,
    usedBytes: 890 * 1024 * 1024 * 1024,
    freeBytes: 134 * 1024 * 1024 * 1024,
    usagePercent: 86.9,
    isSystem: false,
    isReady: true,
    warning: true,
  },
];

const mockTreeNode: DirectoryTreeNode = {
  path: 'C:\\Users\\Developer\\Projects',
  name: 'Projects',
  size: 42 * 1024 * 1024 * 1024,
  fileCount: 38240,
  dirCount: 2410,
  children: [
    {
      path: 'C:\\Users\\Developer\\Projects\\frontend-app',
      name: 'frontend-app',
      size: 21 * 1024 * 1024 * 1024,
      fileCount: 22100,
      dirCount: 1100,
      categoryBreakdown: {
        code: 1 * 1024 * 1024 * 1024,
        archive: 8 * 1024 * 1024 * 1024,
        document: 200 * 1024 * 1024,
        image: 500 * 1024 * 1024,
        video: 0,
        audio: 0,
        installer: 0,
        model3d: 0,
        ai_data: 0,
        other: 11.3 * 1024 * 1024 * 1024,
      },
      largestFiles: [],
    },
    {
      path: 'C:\\Users\\Developer\\Projects\\ai-pipeline',
      name: 'ai-pipeline',
      size: 15 * 1024 * 1024 * 1024,
      fileCount: 420,
      dirCount: 45,
      categoryBreakdown: {
        ai_data: 14 * 1024 * 1024 * 1024,
        code: 800 * 1024 * 1024,
        document: 200 * 1024 * 1024,
        image: 0,
        video: 0,
        audio: 0,
        archive: 0,
        installer: 0,
        model3d: 0,
        other: 0,
      },
      largestFiles: [],
    },
  ],
  categoryBreakdown: {
    document: 400 * 1024 * 1024,
    image: 500 * 1024 * 1024,
    video: 0,
    audio: 0,
    archive: 8 * 1024 * 1024 * 1024,
    installer: 0,
    model3d: 0,
    code: 1.8 * 1024 * 1024 * 1024,
    ai_data: 14 * 1024 * 1024 * 1024,
    other: 17.3 * 1024 * 1024 * 1024,
  },
  largestFiles: [
    {
      path: 'C:\\Users\\Developer\\Projects\\ai-pipeline\\model.safetensors',
      name: 'model.safetensors',
      size: 7.8 * 1024 * 1024 * 1024,
      extension: 'safetensors',
      category: 'ai_data',
      modifiedAt: new Date().toISOString(),
      isDirectory: false,
    },
    {
      path: 'C:\\Users\\Developer\\Projects\\frontend-app\\bundle.tar.gz',
      name: 'bundle.tar.gz',
      size: 4.2 * 1024 * 1024 * 1024,
      extension: 'gz',
      category: 'archive',
      modifiedAt: new Date().toISOString(),
      isDirectory: false,
    },
  ],
};

const mockApi: StorageGuardianAPI = {
      getDrives: async () => mockDrives,
      selectFolder: async () => {
        console.warn('[DIAG-B-MOCK] 注意：正處於 mock selectFolder()！window.storageGuardian 不存在，無法彈出 Windows 檔案選擇視窗。');
        return 'C:\\Users\\Developer\\Projects';
      },
      startFolderScan: async () => mockTreeNode,
      cancelFolderScan: async () => {},
      onScanProgress: (cb) => {
        const timer = setTimeout(() => {
          cb({
            phase: 'completed',
            currentPath: 'C:\\Users\\Developer\\Projects',
            scannedFiles: 38240,
            scannedDirs: 2410,
            totalBytes: 42 * 1024 * 1024 * 1024,
            errors: [],
          });
        }, 1000);
        return () => clearTimeout(timer);
      },
      getScanResult: async () => mockTreeNode,
      findLargeFiles: async () => mockTreeNode.largestFiles,
      openPathInExplorer: async () => true,
      openFileItem: async () => true,
      findDuplicates: async () => [
        {
          id: 'dup-demo-1',
          size: 1.2 * 1024 * 1024 * 1024,
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          theoreticalReclaimableBytes: 1.2 * 1024 * 1024 * 1024,
          files: [
            {
              path: 'C:\\Downloads\\installer_v2_backup.iso',
              name: 'installer_v2_backup.iso',
              modifiedAt: '2026-08-10T10:00:00.000Z',
              selectedForDeletion: false,
            },
            {
              path: 'D:\\Archive\\installer_v2.iso',
              name: 'installer_v2.iso',
              modifiedAt: '2026-08-01T10:00:00.000Z',
              selectedForDeletion: false,
            },
          ],
        },
      ],
      cancelDuplicateScan: async () => {},
      onDuplicateProgress: () => () => {},
      scanSafeCleanCandidates: async () => [
        {
          id: 'user_temp',
          category: 'user_temp',
          categoryName: '使用者暫存檔案 (User Temp)',
          path: 'C:\\Users\\Developer\\AppData\\Local\\Temp',
          fileCount: 4210,
          estimatedBytes: 3.4 * 1024 * 1024 * 1024,
          riskLevel: 'safe',
          description: '軟體執行時產生的臨時檔案，安全度高，釋放後不影響軟體設定。',
          recommendedAction: '建議定期清理釋放空間。',
          selected: true,
        },
        {
          id: 'crash_dumps',
          category: 'windows_temp',
          categoryName: '程式當機報告與記憶體傾印 (Crash Dumps)',
          path: 'C:\\Users\\Developer\\AppData\\Local\\CrashDumps',
          fileCount: 18,
          estimatedBytes: 850 * 1024 * 1024,
          riskLevel: 'safe',
          description: '應用程式發生錯誤時產生的傾印日誌 (.dmp)。',
          recommendedAction: '可安全清理，不會影響軟體正常運作。',
          selected: true,
        },
      ],
      executeCleanup: async (plan: CleanupExecutionPlan) => ({
        id: `mock-clean-${Date.now()}`,
        timestamp: new Date().toISOString(),
        operationType: 'safe_cleanup',
        totalProcessed: plan.items.length,
        successCount: plan.items.length,
        failCount: 0,
        skippedCount: 0,
        actualFreedBytes: plan.totalEstimatedBytes,
        details: plan.items.map((i) => ({
          path: i.path,
          size: i.estimatedBytes,
          status: 'success',
          movedToRecycleBin: plan.method === 'recycle_bin',
        })),
      }),
      cancelCleanup: async () => true,
      onCleanupProgress: () => () => {},
      scanDevProjects: async () => [
        {
          id: 'dev-1',
          projectRoot: 'C:\\Users\\Developer\\Projects\\frontend-app',
          projectName: 'frontend-app',
          targetDir: 'C:\\Users\\Developer\\Projects\\frontend-app\\node_modules',
          targetType: 'node_modules',
          size: 1.8 * 1024 * 1024 * 1024,
          fileCount: 34200,
          lastModified: new Date().toISOString(),
          isDangerous: false,
          selected: true,
        },
        {
          id: 'dev-2',
          projectRoot: 'C:\\Users\\Developer\\Projects\\frontend-app',
          projectName: 'frontend-app',
          targetDir: 'C:\\Users\\Developer\\Projects\\frontend-app\\.next',
          targetType: '.next',
          size: 650 * 1024 * 1024,
          fileCount: 2800,
          lastModified: new Date().toISOString(),
          isDangerous: false,
          selected: true,
        },
      ],
      cleanDevCandidates: async (items: DevProjectCandidate[]) => ({
        id: `mock-dev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        operationType: 'dev_cleanup',
        totalProcessed: items.length,
        successCount: items.length,
        failCount: 0,
        skippedCount: 0,
        actualFreedBytes: items.reduce((s, i) => s + i.size, 0),
        details: items.map((i) => ({
          path: i.targetDir,
          size: i.size,
          status: 'success',
          movedToRecycleBin: true,
        })),
      }),
      getHistory: async () => [
        {
          id: 'hist-1',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          operationType: 'safe_cleanup',
          itemCount: 4210,
          originalBytes: 3.4 * 1024 * 1024 * 1024,
          freedBytes: 3.4 * 1024 * 1024 * 1024,
          successCount: 4210,
          failCount: 0,
          method: '資源回收筒',
          details: [],
        },
      ],
      clearHistory: async () => true,
      exportHistoryCsv: async () => '歷史紀錄CSV預覽資料',
      getSettings: async () => ({
        language: 'zh-TW',
        theme: 'light',
        excludePaths: ['C:\\Windows', 'C:\\Program Files'],
        largeFileThresholdBytes: 524288000,
        enableSha256InScan: true,
        maxConcurrency: 4,
        lowDiskThresholdPercent: 85,
        defaultCleanMethod: 'recycle_bin',
        historyRetentionDays: 90,
        version: '1.0.0',
      }),
      saveSettings: async (s) => (s as any),
      getSandboxPath: async () => 'C:\\Users\\Developer\\AppData\\Local\\Temp\\StorageGuardian-Sandbox',
      setupSandbox: async () => 'C:\\Users\\Developer\\AppData\\Local\\Temp\\StorageGuardian-Sandbox',
    };
/**
 * Checks if the real Electron storageGuardian API is injected into window.
 */
export function isElectronBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).storageGuardian;
}

/**
 * Dynamically resolves active API provider.
 * If running inside Electron with preload script injected, always delegates to window.storageGuardian.
 * Otherwise, falls back to mockApi for web browser preview.
 */
function getActiveApi(): StorageGuardianAPI {
  if (typeof window !== 'undefined' && (window as any).storageGuardian) {
    return (window as any).storageGuardian;
  }
  return mockApi;
}

export const api: StorageGuardianAPI = new Proxy({} as StorageGuardianAPI, {
  get(_target, prop: string | symbol) {
    const active = getActiveApi();
    const isReal = typeof window !== 'undefined' && !!(window as any).storageGuardian;
    const val = (active as any)[prop];
    if (typeof val === 'function') {
      return (...args: any[]) => {
        console.log(`[DIAG-B] 前端呼叫 api.${String(prop)}() (模式: ${isReal ? '真實 Electron IPC' : '前端 Mock 假資料'})`, args);
        return val.apply(active, args);
      };
    }
    return val;
  },
});

