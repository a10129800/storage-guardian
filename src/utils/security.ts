import path from 'path';
import fs from 'fs';

/**
 * List of critical Windows directories that MUST NEVER be automatically deleted,
 * emptied, or modified by Storage Guardian.
 */
export const FORBIDDEN_WINDOWS_PATHS = [
  'c:\\windows',
  'c:\\windows\\system32',
  'c:\\windows\\syswow64',
  'c:\\windows\\winsxs',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\users',
  'c:\\boot',
  'c:\\recovery',
  'c:\\system volume information',
  'c:\\$recycle.bin',
];

/**
 * Safely retrieves an environment variable without throwing ReferenceError in non-Node or browser contexts.
 */
function getSafeEnv(name: string): string {
  if (typeof process !== 'undefined' && process && process.env) {
    return process.env[name] || process.env[name.toUpperCase()] || process.env[name.toLowerCase()] || '';
  }
  return '';
}

/**
 * Resolves Windows environment variables (e.g. %TEMP%, %LOCALAPPDATA%) and canonicalizes path.
 */
export function resolveWindowsPath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') return '';
  const trimmed = inputPath.trim();
  const expanded = trimmed.replace(/%([^%]+)%/g, (_, name) => {
    return getSafeEnv(name);
  });
  try {
    return path.resolve(expanded);
  } catch {
    return path.normalize(expanded);
  }
}

/**
 * Normalizes and resolves a path string into a canonical, lowercase Windows absolute path.
 * Strips Windows extended-length prefixes (\\?\, \\.\) and resolves relative references.
 */
export function normalizeSafePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') return '';
  let cleaned = inputPath.trim().replace(/^\\\\\?\\/, '').replace(/^\\\\\.\\/, '');
  cleaned = cleaned.replace(/%([^%]+)%/g, (_, name) => {
    return getSafeEnv(name);
  });
  cleaned = cleaned.replace(/\//g, '\\');
  // Direct handling for root drive letters like "c:" or "c:\"
  if (/^[a-zA-Z]:\\?$/.test(cleaned)) {
    return cleaned.substring(0, 2).toLowerCase() + '\\';
  }
  try {
    return path.resolve(cleaned).toLowerCase();
  } catch {
    return path.normalize(cleaned).toLowerCase();
  }
}

/**
 * Checks if a path is considered a dangerous or system-critical location.
 */
export function isDangerousSystemPath(targetPath: string): boolean {
  if (!targetPath || typeof targetPath !== 'string') return true;
  const normalized = normalizeSafePath(targetPath);

  // Root drive checks like "c:\", "d:\", "c:"
  if (/^[a-z]:\\?$/i.test(normalized)) {
    return true;
  }

  // Any drive's $Recycle.Bin or System Volume Information (e.g. C:\$Recycle.Bin, D:\$Recycle.Bin)
  if (/^[a-z]:\\\$recycle\.bin(\\.*)?$/i.test(normalized)) {
    return true;
  }
  if (/^[a-z]:\\system volume information(\\.*)?$/i.test(normalized)) {
    return true;
  }

  for (const forbidden of FORBIDDEN_WINDOWS_PATHS) {
    if (normalized === forbidden || normalized === forbidden + '\\') {
      return true;
    }
    // Also block subdirectories of critical directories except temp folders
    if (normalized.startsWith(forbidden + '\\')) {
      // Allow temp folder under Windows (e.g. C:\Windows\Temp)
      if (forbidden === 'c:\\windows' && normalized.startsWith('c:\\windows\\temp')) {
        continue;
      }
      if (forbidden === 'c:\\users') {
        // Protect user home root folder itself (e.g. C:\Users\Username or C:\Users\Default)
        // from being purged as a whole, but allow user workspace, projects, and temp folders.
        if (/^c:\\users\\[^\\]+\\?$/i.test(normalized)) {
          return true;
        }
        continue;
      }
      return true;
    }
  }

  // Under C:\Windows but NOT temp
  if (normalized.startsWith('c:\\windows') && !normalized.includes('\\temp')) {
    return true;
  }

  return false;
}

/**
 * Critical project configuration and environment files that MUST NEVER be deleted.
 */
export const FORBIDDEN_PROJECT_FILES = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'vite.config.js',
  'cargo.toml',
  'cargo.lock',
  'pom.xml',
  'build.gradle',
  '.env',
  '.env.local',
  '.env.production',
  '.gitignore',
  'runalltests.js',
  'setupsandbox.js',
];

/**
 * Validates whether a file/directory path is eligible for safe cleanup or deletion.
 * Protects against symlink escape, path traversal, project configuration/source code deletion, and unauthorized system access.
 */
export function validateSafePath(targetPath: string, allowedRoot?: string): { safe: boolean; reason?: string } {
  if (!targetPath || typeof targetPath !== 'string' || targetPath.trim() === '') {
    return { safe: false, reason: '路徑不得為空' };
  }

  const normalized = normalizeSafePath(targetPath);

  if (isDangerousSystemPath(normalized)) {
    return { safe: false, reason: '目標路徑屬於 Windows 核心系統保護區域，禁止刪除' };
  }

  // Version control (.git) protection
  const basename = path.basename(normalized).toLowerCase();
  if (basename === '.git' || normalized.includes('\\.git\\') || normalized.endsWith('\\.git')) {
    return { safe: false, reason: '版本控制保護機制：禁止刪除 .git 相關資料' };
  }

  // Critical project configuration and test files protection
  if (FORBIDDEN_PROJECT_FILES.includes(basename)) {
    return { safe: false, reason: `核心專案檔案保護機制：禁止刪除 ${basename}` };
  }

  if (/\.(test|spec)\.[a-z0-9]+$/i.test(basename)) {
    return { safe: false, reason: `測試程式碼保護機制：禁止刪除測試檔案 ${basename}` };
  }

  // Symlink escape verification if file/folder exists
  try {
    if (fs.existsSync(targetPath)) {
      const realPath = normalizeSafePath(fs.realpathSync(targetPath));
      if (isDangerousSystemPath(realPath)) {
        return { safe: false, reason: '目標為符號連結，其真實實體路徑屬於 Windows 核心系統保護區域，禁止刪除' };
      }

      const realBasename = path.basename(realPath).toLowerCase();
      if (FORBIDDEN_PROJECT_FILES.includes(realBasename)) {
        return { safe: false, reason: `符號連結目標為核心專案檔案 (${realBasename})，禁止刪除` };
      }

      if (allowedRoot) {
        const normAllowed = normalizeSafePath(allowedRoot);
        const rootWithSep = normAllowed.endsWith(path.sep) ? normAllowed : normAllowed + path.sep;
        if (realPath !== normAllowed && !realPath.startsWith(rootWithSep)) {
          return { safe: false, reason: `符號連結目標真實路徑超出使用者指定的掃描範圍：${allowedRoot}` };
        }
      }
    }
  } catch (err: any) {
    // If realpath cannot be resolved, err on the side of caution
    return { safe: false, reason: `無法解析檔案實體路徑：${err.message || '存取被拒'}` };
  }

  if (allowedRoot) {
    const normRoot = normalizeSafePath(allowedRoot);
    const rootWithSep = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
    if (normalized !== normRoot && !normalized.startsWith(rootWithSep)) {
      return { safe: false, reason: `路徑超出使用者指定的掃描範圍：${allowedRoot}` };
    }
  }

  return { safe: true };
}

/**
 * Checks if a candidate developer directory is legitimate to clean (e.g. node_modules, dist)
 * and ensures package.json or source files are not deleted.
 */
export function validateDevCleanTarget(dirName: string): boolean {
  const allowed = [
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.vite',
    'target',
    '.cache',
    '__pycache__',
    '.pytest_cache',
  ];
  return allowed.includes(dirName.toLowerCase());
}

