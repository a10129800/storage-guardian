export type FileCategory =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'installer'
  | 'model3d'
  | 'code'
  | 'ai_data'
  | 'other';

export interface DriveInfo {
  id: string;
  mountPoint: string;
  label: string;
  fileSystem: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
  isSystem: boolean;
  isReady: boolean;
  warning: boolean;
}

export interface FileItem {
  path: string;
  name: string;
  size: number;
  extension: string;
  category: FileCategory;
  modifiedAt: string;
  isDirectory: boolean;
  parentPath?: string;
}

export interface DirectoryTreeNode {
  path: string;
  name: string;
  size: number;
  fileCount: number;
  dirCount: number;
  children?: DirectoryTreeNode[];
  categoryBreakdown: Record<FileCategory, number>;
  largestFiles: FileItem[];
}

export interface ScanProgress {
  phase: 'idle' | 'indexing' | 'analyzing' | 'hashing' | 'completed' | 'cancelled' | 'error';
  currentPath: string;
  scannedFiles: number;
  scannedDirs: number;
  totalBytes: number;
  errors: { path: string; message: string }[];
  percent?: number;
}

export interface DuplicateGroup {
  id: string;
  size: number;
  hash: string;
  files: {
    path: string;
    name: string;
    modifiedAt: string;
    selectedForDeletion: boolean;
  }[];
  theoreticalReclaimableBytes: number;
}

export type CleanupRiskLevel = 'safe' | 'moderate' | 'caution';

export interface CleanupCandidateItem {
  id: string;
  category: 'user_temp' | 'windows_temp' | 'recycle_bin' | 'thumbnail_cache' | 'app_cache' | 'custom';
  categoryName: string;
  path: string;
  fileCount: number;
  estimatedBytes: number;
  riskLevel: CleanupRiskLevel;
  description: string;
  recommendedAction: string;
  selected: boolean;
  items?: { path: string; size: number }[];
}

export interface CleanupExecutionPlan {
  items: { id: string; path: string; estimatedBytes: number; toRecycleBin: boolean }[];
  totalFiles: number;
  totalEstimatedBytes: number;
  method: 'recycle_bin' | 'permanent';
}

export interface CleanupResultDetail {
  path: string;
  size: number;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  movedToRecycleBin: boolean;
}

export interface CleanupResult {
  id: string;
  timestamp: string;
  operationType: string;
  totalProcessed: number;
  successCount: number;
  failCount: number;
  skippedCount: number;
  actualFreedBytes: number;
  details: CleanupResultDetail[];
}

export interface DevProjectCandidate {
  id: string;
  projectRoot: string;
  projectName: string;
  targetDir: string;
  targetType: 'node_modules' | '.next' | 'dist' | 'build' | 'coverage' | '.turbo' | '.vite' | 'cargo_target' | 'other';
  size: number;
  fileCount: number;
  lastModified: string;
  isDangerous: boolean;
  warningMessage?: string;
  selected: boolean;
}

export interface CleanupHistoryRecord {
  id: string;
  timestamp: string;
  operationType: 'safe_cleanup' | 'large_file' | 'duplicate_cleanup' | 'dev_cleanup';
  itemCount: number;
  originalBytes: number;
  freedBytes: number;
  successCount: number;
  failCount: number;
  method: string;
  details: {
    path: string;
    size: number;
    status: string;
    reason?: string;
  }[];
}

export interface AppSettings {
  language: 'zh-TW';
  theme: 'light' | 'dark' | 'system';
  excludePaths: string[];
  largeFileThresholdBytes: number;
  enableSha256InScan: boolean;
  maxConcurrency: number;
  lowDiskThresholdPercent: number;
  defaultCleanMethod: 'recycle_bin' | 'permanent';
  historyRetentionDays: number;
  version: string;
}

export interface StorageGuardianAPI {
  getDrives: () => Promise<DriveInfo[]>;
  selectFolder: () => Promise<string | null>;
  startFolderScan: (targetPath: string, options?: { maxDepth?: number }) => Promise<DirectoryTreeNode | null>;
  cancelFolderScan: () => Promise<void>;
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
  getScanResult: () => Promise<DirectoryTreeNode | null>;
  
  findLargeFiles: (targetPath: string, minSizeBytes: number) => Promise<FileItem[]>;
  openPathInExplorer: (targetPath: string) => Promise<boolean>;
  openFileItem: (targetPath: string) => Promise<boolean>;
  
  findDuplicates: (targetPath: string) => Promise<DuplicateGroup[]>;
  cancelDuplicateScan: () => Promise<void>;
  onDuplicateProgress: (callback: (progress: ScanProgress) => void) => () => void;

  scanSafeCleanCandidates: () => Promise<CleanupCandidateItem[]>;
  executeCleanup: (plan: CleanupExecutionPlan) => Promise<CleanupResult>;
  
  scanDevProjects: (targetRoot: string) => Promise<DevProjectCandidate[]>;
  cleanDevCandidates: (items: DevProjectCandidate[]) => Promise<CleanupResult>;

  getHistory: () => Promise<CleanupHistoryRecord[]>;
  clearHistory: () => Promise<boolean>;
  exportHistoryCsv: () => Promise<string>;

  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

  getSandboxPath: () => Promise<string>;
  setupSandbox: () => Promise<string>;
}

declare global {
  interface Window {
    storageGuardian?: StorageGuardianAPI;
  }
}
