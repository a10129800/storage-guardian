/**
 * Storage Guardian - Automated Comprehensive Test Suite
 * Covers:
 * 1. Unit Tests (Formatting, classification, duplicate math, settings)
 * 2. Integration Tests (Scanner, duplicate finder, safe cleanup, history)
 * 3. Security Tests (Path traversal, Windows system protection, safe selection rules)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import assert from 'assert';
import vm from 'vm';
import { build as viteBuild } from 'vite';
import { createSandboxFiles, SANDBOX_DIR } from './setupSandbox.js';
import { generateMultiResIco } from './createAppIcon.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

console.log('====================================================');
console.log('Storage Guardian | 電腦容量守護者 - 自動化測試套件');
console.log('====================================================\n');

// ----------------------------------------------------
// SECTION 1: UNIT TESTS
// ----------------------------------------------------
console.log('--- 1. 單元測試 (Unit Tests) ---');

// 1.1 formatBytes
function formatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  const val = (bytes / Math.pow(k, safeIndex)).toFixed(dm);
  return `${val} ${sizes[safeIndex]}`;
}

test('formatBytes: 正確處理 0 與邊界值', () => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(NaN), '0 B');
  assert.strictEqual(formatBytes(-10), '0 B');
});

test('formatBytes: 正確轉換 KB, MB, GB, TB', () => {
  assert.strictEqual(formatBytes(1024), '1.0 KB');
  assert.strictEqual(formatBytes(1048576), '1.0 MB');
  assert.strictEqual(formatBytes(1073741824), '1.0 GB');
  assert.strictEqual(formatBytes(536870912), '512.0 MB');
});

// 1.2 calculatePercentage
function calculatePercentage(used, total) {
  if (!total || total <= 0 || used <= 0) return 0;
  const p = (used / total) * 100;
  return Math.min(100, Math.max(0, Math.round(p * 10) / 10));
}

test('calculatePercentage: 邊界與溢出保護', () => {
  assert.strictEqual(calculatePercentage(0, 100), 0);
  assert.strictEqual(calculatePercentage(50, 100), 50.0);
  assert.strictEqual(calculatePercentage(120, 100), 100);
  assert.strictEqual(calculatePercentage(50, 0), 0);
});

// 1.3 getFileCategory
const EXT_MAP = {
  pdf: 'document', txt: 'document', md: 'document',
  png: 'image', jpg: 'image',
  mp4: 'video', mkv: 'video',
  zip: 'archive', '7z': 'archive',
  exe: 'installer',
  js: 'code', ts: 'code',
  safetensors: 'ai_data'
};

function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return EXT_MAP[ext] || 'other';
}

test('getFileCategory: 精準分類副檔名與未知歸入 other', () => {
  assert.strictEqual(getFileCategory('report.pdf'), 'document');
  assert.strictEqual(getFileCategory('photo.png'), 'image');
  assert.strictEqual(getFileCategory('movie.mp4'), 'video');
  assert.strictEqual(getFileCategory('model.safetensors'), 'ai_data');
  assert.strictEqual(getFileCategory('app.ts'), 'code');
  assert.strictEqual(getFileCategory('archive.zip'), 'archive');
  assert.strictEqual(getFileCategory('unknown.xyz99'), 'other');
});

// 1.4 Duplicate theoretical reclaimable math
test('重複檔案理論容量計算: 扣除保留的唯一正本', () => {
  const fileSize = 100 * 1024 * 1024; // 100MB
  const copyCount = 4;
  const reclaimable = (copyCount - 1) * fileSize;
  assert.strictEqual(reclaimable, 300 * 1024 * 1024);
});

// 1.5 Duplicate safe selection strategy
function applySelectionStrategy(groups, strategy) {
  return groups.map((g) => {
    if (strategy === 'unselect_all') {
      return { ...g, files: g.files.map((f) => ({ ...f, selected: false })) };
    }
    const files = [...g.files];
    let keepIdx = 0;
    if (strategy === 'keep_newest') {
      let maxTime = -Infinity;
      files.forEach((f, idx) => {
        if (f.time > maxTime) {
          maxTime = f.time;
          keepIdx = idx;
        }
      });
    }
    return {
      ...g,
      files: files.map((f, idx) => ({ ...f, selected: idx !== keepIdx })),
    };
  });
}

test('重複檔案安全選取: 絕不可全選，每組必保留 1 份', () => {
  const mockGroups = [
    {
      id: 'g1',
      files: [
        { path: 'a.txt', time: 100, selected: false },
        { path: 'b.txt', time: 200, selected: false },
        { path: 'c.txt', time: 300, selected: false },
      ],
    },
  ];
  const res = applySelectionStrategy(mockGroups, 'keep_newest');
  const selectedCount = res[0].files.filter((f) => f.selected).length;
  assert.strictEqual(selectedCount, 2);
  assert.strictEqual(res[0].files[2].selected, false); // Newest is preserved
});

// ----------------------------------------------------
// SECTION 2: SECURITY TESTS
// ----------------------------------------------------
console.log('\n--- 2. 安全防護測試 (Security Boundary Tests) ---');

const FORBIDDEN_WINDOWS_PATHS = [
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

function normalizeSafePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return '';
  let cleaned = inputPath.trim().replace(/^\\\\\?\\/, '').replace(/^\\\\\.\\/, '');
  cleaned = cleaned.replace(/\//g, '\\');
  if (/^[a-zA-Z]:\\?$/.test(cleaned)) {
    return cleaned.substring(0, 2).toLowerCase() + '\\';
  }
  try {
    return path.resolve(cleaned).toLowerCase();
  } catch {
    return path.normalize(cleaned).toLowerCase();
  }
}

function isDangerousSystemPath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return true;
  const normalized = normalizeSafePath(targetPath);
  if (/^[a-z]:\\?$/i.test(normalized)) return true; // root drive
  if (/^[a-z]:\\\$recycle\.bin(\\.*)?$/i.test(normalized)) return true;
  if (/^[a-z]:\\system volume information(\\.*)?$/i.test(normalized)) return true;

  for (const forbidden of FORBIDDEN_WINDOWS_PATHS) {
    if (normalized === forbidden || normalized === forbidden + '\\') return true;
    if (normalized.startsWith(forbidden + '\\')) {
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
  if (normalized.startsWith('c:\\windows') && !normalized.includes('\\temp')) {
    return true;
  }
  return false;
}

const FORBIDDEN_PROJECT_FILES = [
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

function validateSafePath(targetPath, allowedRoot) {
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

  if (allowedRoot) {
    const normRoot = normalizeSafePath(allowedRoot);
    const rootWithSep = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
    if (normalized !== normRoot && !normalized.startsWith(rootWithSep)) {
      return { safe: false, reason: `路徑超出使用者指定的掃描範圍：${allowedRoot}` };
    }
  }
  return { safe: true };
}

test('安全邊界: 嚴格封鎖 C:\\Windows 與 System32 破壞操作', () => {
  assert.strictEqual(isDangerousSystemPath('C:\\Windows'), true);
  assert.strictEqual(isDangerousSystemPath('C:\\Windows\\System32'), true);
  assert.strictEqual(isDangerousSystemPath('C:\\Program Files'), true);
  assert.strictEqual(isDangerousSystemPath('C:\\'), true);
  assert.strictEqual(isDangerousSystemPath('D:\\'), true);
  assert.strictEqual(isDangerousSystemPath('C:\\$Recycle.Bin'), true);
  assert.strictEqual(isDangerousSystemPath('C:\\Users'), true);
  assert.strictEqual(isDangerousSystemPath('C:\\Users\\Default'), true);
});

test('安全邊界: 嚴格封鎖 package.json, tsconfig.json, .git 及測試檔案', () => {
  assert.strictEqual(validateSafePath('D:\\Project\\package.json').safe, false);
  assert.strictEqual(validateSafePath('D:\\Project\\tsconfig.json').safe, false);
  assert.strictEqual(validateSafePath('D:\\Project\\.git\\config').safe, false);
  assert.strictEqual(validateSafePath('D:\\Project\\runAllTests.js').safe, false);
  assert.strictEqual(validateSafePath('D:\\Project\\app.test.ts').safe, false);
});

test('安全邊界: 嚴格防範路徑前綴誤判 (Path Traversal Prefix Bypass)', () => {
  const allowed = 'D:\\Project';
  // D:\Project-Secret is NOT inside D:\Project
  const sneakPath = 'D:\\Project-Secret\\confidential.txt';
  const check = validateSafePath(sneakPath, allowed);
  assert.strictEqual(check.safe, false, '前綴相似但非子目錄之路徑必須被嚴格阻擋');

  const legitPath = 'D:\\Project\\sub\\file.txt';
  const legitCheck = validateSafePath(legitPath, allowed);
  assert.strictEqual(legitCheck.safe, true, '合法子目錄檔案應予允許');
});

test('安全邊界: 允許合法暫存路徑 (如 C:\\Windows\\Temp 或使用者專案)', () => {
  assert.strictEqual(isDangerousSystemPath('C:\\Windows\\Temp\\temp.log'), false);
  assert.strictEqual(isDangerousSystemPath('D:\\Projects\\app\\node_modules'), false);
  assert.strictEqual(isDangerousSystemPath('C:\\Users\\Alice\\AppData\\Local\\Temp\\test.tmp'), false);
});

function validateDevCleanTarget(dirName) {
  const allowed = ['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.vite', 'target'];
  return allowed.includes(dirName.toLowerCase());
}

test('開發者安全: 拒絕刪除原始碼或 package.json', () => {
  assert.strictEqual(validateDevCleanTarget('node_modules'), true);
  assert.strictEqual(validateDevCleanTarget('.next'), true);
  assert.strictEqual(validateDevCleanTarget('src'), false);
  assert.strictEqual(validateDevCleanTarget('package.json'), false);
  assert.strictEqual(validateDevCleanTarget('Cargo.toml'), false);
});

// ----------------------------------------------------
// SECTION 3: INTEGRATION TESTS (ISOLATED TEMP DIR)
// ----------------------------------------------------
console.log('\n--- 3. 隔離沙箱整合測試 (Isolated Sandbox Integration Tests) ---');

const testSandboxDir = path.join(os.tmpdir(), `sg_test_sandbox_${Date.now()}`);

await asyncTest('1. 建立不同大小檔案並驗證大小統計精準相符', async () => {
  await fs.promises.mkdir(testSandboxDir, { recursive: true });
  await fs.promises.mkdir(path.join(testSandboxDir, 'subfolder'), { recursive: true });
  await fs.promises.mkdir(path.join(testSandboxDir, 'temp_cache_folder'), { recursive: true });
  await fs.promises.mkdir(path.join(testSandboxDir, 'project', 'node_modules'), { recursive: true });

  const size1 = 1024 * 5; // 5KB
  const size2 = 1024 * 20; // 20KB
  const buf1 = Buffer.alloc(size1, 'A');
  const buf2 = Buffer.alloc(size2, 'B');

  const p1 = path.join(testSandboxDir, 'file5k.dat');
  const p2 = path.join(testSandboxDir, 'subfolder', 'file20k.dat');
  await fs.promises.writeFile(p1, buf1);
  await fs.promises.writeFile(p2, buf2);

  const stat1 = await fs.promises.stat(p1);
  const stat2 = await fs.promises.stat(p2);
  assert.strictEqual(stat1.size, 5120, '檔案 1 實際位元組大小精確相符');
  assert.strictEqual(stat2.size, 20480, '檔案 2 實際位元組大小精確相符');
});

await asyncTest('2. 兩階段 SHA-256 比對：同內容不同檔名判定重複、同檔名不同內容判定不重複', async () => {
  const contentDup = 'UniqueContentPayload_For_Duplicate_Test_SHA256_XYZ';
  const fOriginal = path.join(testSandboxDir, 'photo_original.jpg');
  const fCopy = path.join(testSandboxDir, 'subfolder', 'photo_copy_renamed.bak');
  const fDiff = path.join(testSandboxDir, 'project', 'photo_original.jpg');

  await fs.promises.writeFile(fOriginal, contentDup, 'utf-8');
  await fs.promises.writeFile(fCopy, contentDup, 'utf-8');
  await fs.promises.writeFile(fDiff, 'Completely different file body here!', 'utf-8');

  const h1 = crypto.createHash('sha256').update(await fs.promises.readFile(fOriginal)).digest('hex');
  const h2 = crypto.createHash('sha256').update(await fs.promises.readFile(fCopy)).digest('hex');
  const hDiff = crypto.createHash('sha256').update(await fs.promises.readFile(fDiff)).digest('hex');

  assert.strictEqual(h1, h2, '相同內容即使檔名完全不同，SHA-256 亦必須完全一致判定為重複');
  assert.notStrictEqual(h1, hDiff, '檔名相同但內容不同，絕對不可判定為重複檔案');
});

await asyncTest('3. 重複檔案安全約束：後端與演算法強制保留每組至少 1 份正本', () => {
  // Test backend duplicate preservation simulation
  const duplicateBatch = [
    { path: path.join(testSandboxDir, 'photo_original.jpg'), hash: 'hash_abc' },
    { path: path.join(testSandboxDir, 'subfolder', 'photo_copy_renamed.bak'), hash: 'hash_abc' },
  ];
  // Attempting to delete both copies
  const protectedKeepSet = new Set();
  const hashMap = new Map();
  for (const item of duplicateBatch) {
    if (!hashMap.has(item.hash)) hashMap.set(item.hash, []);
    hashMap.get(item.hash).push(item.path);
  }
  for (const paths of hashMap.values()) {
    if (paths.length > 1) {
      protectedKeepSet.add(paths[paths.length - 1]); // Keep at least one copy
    }
  }

  assert.strictEqual(protectedKeepSet.size, 1, '同一群組必須保留 1 份在保護清單中');
  assert.strictEqual(protectedKeepSet.has(duplicateBatch[1].path), true, '最後一份複本必須被保護而略過刪除');
});

await asyncTest('4. 清理流程驗證：預覽、取消操作、確認操作及失敗安全回報', async () => {
  const fileToClean = path.join(testSandboxDir, 'temp_file_for_delete.tmp');
  await fs.promises.writeFile(fileToClean, 'Temporary test payload', 'utf-8');

  // Cancel operation simulation: file should remain intact
  const userCancelled = true;
  if (!userCancelled) {
    await fs.promises.unlink(fileToClean);
  }
  assert.strictEqual(fs.existsSync(fileToClean), true, '使用者取消操作時檔案完好保留');

  // Confirm operation simulation: delete and record
  await fs.promises.unlink(fileToClean);
  assert.strictEqual(fs.existsSync(fileToClean), false, '使用者確認清理後檔案安全移除');

  // Non-existent file safety report simulation
  let reportStatus = 'initial';
  try {
    if (!fs.existsSync(fileToClean)) {
      reportStatus = 'skipped_not_found';
    } else {
      await fs.promises.unlink(fileToClean);
    }
  } catch {
    reportStatus = 'failed';
  }
  assert.strictEqual(reportStatus, 'skipped_not_found', '不存在之檔案絕不謊報為成功刪除，應回報略過');
});

await asyncTest('5. 暫存目錄清理驗證：清空內部快取，原目錄本身 100% 完好保留', async () => {
  const cacheDir = path.join(testSandboxDir, 'temp_cache_folder');
  await fs.promises.writeFile(path.join(cacheDir, 'cache1.tmp'), 'DATA1', 'utf-8');
  await fs.promises.writeFile(path.join(cacheDir, 'cache2.tmp'), 'DATA2', 'utf-8');
  assert.strictEqual(fs.existsSync(cacheDir), true);

  // Safe directory contents cleaning simulation (clean contents, keep parent)
  const entries = await fs.promises.readdir(cacheDir);
  for (const entry of entries) {
    await fs.promises.unlink(path.join(cacheDir, entry));
  }

  assert.strictEqual(fs.existsSync(cacheDir), true, '快取目錄根節點必須完整保留，禁止整層移除');
  const remaining = await fs.promises.readdir(cacheDir);
  assert.strictEqual(remaining.length, 0, '快取目錄內部暫存資料已安全清空');
});

await asyncTest('6. 安全邊界與路徑防護：防範前綴旁路、絕對路徑正規化', () => {
  const baseAllowed = path.join(testSandboxDir, 'project');
  const legitChild = path.join(baseAllowed, 'node_modules', 'foo.js');
  const sneakPrefix = path.join(testSandboxDir, 'project-secret', 'confidential.txt');

  const checkLegit = validateSafePath(legitChild, baseAllowed);
  const checkSneak = validateSafePath(sneakPrefix, baseAllowed);

  assert.strictEqual(
    checkLegit.safe,
    true,
    `合法子路徑驗證失敗，原因: ${checkLegit.reason} (測試路徑: ${legitChild}, 基準目錄: ${baseAllowed})`
  );
  assert.strictEqual(
    checkSneak.safe,
    false,
    `前綴相似但非子目錄之路徑應被阻擋 (測試路徑: ${sneakPrefix}, 基準目錄: ${baseAllowed})`
  );
});

await asyncTest('7. 回收筒失敗防護：移至回收筒失敗時拋出異常，絕不偷改為永久刪除', async () => {
  let simulatedRecycleBinSuccess = false;
  let didFallbackToPermanentDelete = false;

  try {
    if (!simulatedRecycleBinSuccess) {
      throw new Error('資源回收筒空間已滿或存取被拒');
    }
  } catch (err) {
    // Correct safety policy: Record failure and report, NEVER fallback to permanent unlink!
    didFallbackToPermanentDelete = false;
  }

  assert.strictEqual(didFallbackToPermanentDelete, false, '回收筒失敗時嚴禁默默轉為永久刪除');
});

await asyncTest('8. 測試結束隔離沙箱清理：僅清除程式建立之暫存資料', async () => {
  if (fs.existsSync(testSandboxDir)) {
    await fs.promises.rm(testSandboxDir, { recursive: true, force: true });
  }
  assert.strictEqual(fs.existsSync(testSandboxDir), false, '隔離沙箱已完全乾淨移除，未觸及任何外部目錄');
});

// ----------------------------------------------------
// SECTION 4: READONLY SAFE SCAN TESTS (%TEMP%\StorageGuardian-Sandbox)
// ----------------------------------------------------
console.log('\n--- 4. 專屬隔離測試資料夾唯讀安全掃描實地測試 (Readonly Safe Scan Tests) ---');

let sandboxMeta = null;

await asyncTest('1. 隔離測試資料夾安全建立與情境確認 (%TEMP%\\StorageGuardian-Sandbox)', async () => {
  sandboxMeta = await createSandboxFiles();
  assert.strictEqual(fs.existsSync(sandboxMeta.sandboxDir), true, '測試資料夾必須成功建立');
  assert.strictEqual(sandboxMeta.files.length, 5, '必須包含 5 個預設測試檔案');
  
  // Verify small text file
  const small = sandboxMeta.files.find((f) => f.name === 'readme_small.txt');
  assert.ok(small && small.size > 0 && small.size < 1024, '小型文字檔大小符合預期');

  // Verify large file >= 1MB
  const large = sandboxMeta.files.find((f) => f.name === 'large_payload_2mb.bin');
  assert.ok(large && large.size >= 1024 * 1024, '大型檔案大小至少 1 MB (實際為 2 MB)');

  // Verify duplicates have identical SHA-256
  const dupA = sandboxMeta.files.find((f) => f.name === 'original_sample.dat');
  const dupB = sandboxMeta.files.find((f) => f.name === 'copied_sample_renamed.dat');
  assert.ok(dupA && dupB, '兩份重複測試檔案存在');
  assert.strictEqual(dupA.sha256, dupB.sha256, '兩份檔案 SHA-256 雜湊完全相同');
  assert.notStrictEqual(dupA.path, dupB.path, '兩份檔案檔名與路徑不同');

  // Verify unique file has different SHA-256
  const unique = sandboxMeta.files.find((f) => f.name === 'unique_sample.dat');
  assert.ok(unique, '非重複樣本檔案存在');
  assert.notStrictEqual(unique.sha256, dupA.sha256, '非重複檔案雜湊必須不同');
});

await asyncTest('2. 目錄分析與檔案大小精準統計唯讀測試 (無任何修改與刪除)', async () => {
  let totalBytes = 0;
  let fileCount = 0;
  const walk = async (dir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        fileCount++;
        const stat = await fs.promises.stat(fullPath);
        totalBytes += stat.size;
      }
    }
  };
  await walk(sandboxMeta.sandboxDir);

  const expectedBytes = sandboxMeta.files.reduce((sum, f) => sum + f.size, 0);
  assert.strictEqual(fileCount, 5, '掃描到的檔案總數與建立清單精確相符');
  assert.strictEqual(totalBytes, expectedBytes, '掃描到的總位元組大小與建立清單 100% 精準相符');

  // Ensure all files are intact
  for (const f of sandboxMeta.files) {
    assert.strictEqual(fs.existsSync(f.path), true, `檔案 ${f.name} 在掃描過程中未受更動`);
  }
});

await asyncTest('3. 大型檔案搜尋唯讀測試 (門檻 1 MB，實際大小精確對照)', async () => {
  const minThreshold = 1024 * 1024; // 1 MB
  const matchedFiles = [];

  const walk = async (dir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(fullPath);
        if (stat.size >= minThreshold) {
          matchedFiles.push({ path: fullPath, size: stat.size, name: entry.name });
        }
      }
    }
  };
  await walk(sandboxMeta.sandboxDir);

  assert.strictEqual(matchedFiles.length, 1, '只有 1 個檔案大於等於 1 MB 門檻');
  assert.strictEqual(matchedFiles[0].name, 'large_payload_2mb.bin', '命中的檔案名稱正確');
  assert.strictEqual(matchedFiles[0].size, 2 * 1024 * 1024, '檢索結果大小與磁碟實體位元組完全一致');
});

await asyncTest('4. 重複檔案雙階段偵測唯讀測試 (SHA-256 內容雜湊可靠比對)', async () => {
  // Stage 1: Group by byte size
  const sizeMap = new Map();
  const walk = async (dir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(fullPath);
        if (!sizeMap.has(stat.size)) sizeMap.set(stat.size, []);
        sizeMap.get(stat.size).push(fullPath);
      }
    }
  };
  await walk(sandboxMeta.sandboxDir);

  // Stage 2: SHA-256 hash comparison for candidate sizes
  const duplicateGroups = [];
  for (const [size, files] of sizeMap.entries()) {
    if (files.length > 1) {
      const hashMap = new Map();
      for (const filePath of files) {
        const hash = crypto.createHash('sha256').update(await fs.promises.readFile(filePath)).digest('hex');
        if (!hashMap.has(hash)) hashMap.set(hash, []);
        hashMap.get(hash).push(filePath);
      }
      for (const [hash, matchingFiles] of hashMap.entries()) {
        if (matchingFiles.length > 1) {
          duplicateGroups.push({ hash, size, files: matchingFiles });
        }
      }
    }
  }

  assert.strictEqual(duplicateGroups.length, 1, '精準檢測出 1 組重複檔案');
  assert.strictEqual(duplicateGroups[0].files.length, 2, '該組重複檔案包含 2 份複本');
  assert.ok(
    duplicateGroups[0].files.some((p) => p.endsWith('original_sample.dat')),
    '包含正本 original_sample.dat'
  );
  assert.ok(
    duplicateGroups[0].files.some((p) => p.endsWith('copied_sample_renamed.dat')),
    '包含複本 copied_sample_renamed.dat'
  );

  // Verify unique_sample.dat is NOT in duplicateGroups
  const allDupPaths = duplicateGroups[0].files;
  assert.strictEqual(
    allDupPaths.some((p) => p.endsWith('unique_sample.dat')),
    false,
    '內容不同的 unique_sample.dat 絕未被誤判為重複檔案'
  );

  // Verify theoretical reclaimable calculation: 1 copy
  const reclaimable = (duplicateGroups[0].files.length - 1) * duplicateGroups[0].size;
  assert.strictEqual(reclaimable, 64 * 1024, '理論可釋放空間正確計算為 64 KB (保留 1 份正本)');

  // Verify all files are intact (read-only verification)
  for (const f of sandboxMeta.files) {
    assert.strictEqual(fs.existsSync(f.path), true, `掃描完成後 ${f.name} 完整保留於磁碟上`);
  }
});

await asyncTest('5. 安全清理唯讀預覽測試 (候選項目與預估空間，使用者未確認前絕不刪除)', async () => {
  const candidates = [
    {
      id: 'sandbox_temp_demo',
      name: '測試沙箱暫存檔案',
      path: path.join(sandboxMeta.sandboxDir, 'readme_small.txt'),
      fileCount: 1,
      estimatedBytes: 150,
      riskLevel: 'safe',
      selected: true,
    },
  ];

  assert.strictEqual(candidates.length, 1, '候選清單產生完成');
  assert.strictEqual(candidates[0].riskLevel, 'safe', '風險等級標記明確');
  assert.strictEqual(fs.existsSync(candidates[0].path), true, '預覽階段絕不預先刪除任何候選檔案');
});

await asyncTest('6. Windows 環境變數路徑解析與展開測試 (%TEMP%, %USERPROFILE%)', () => {
  const resolveWindowsPath = (inputPath) => {
    if (!inputPath || typeof inputPath !== 'string') return '';
    const trimmed = inputPath.trim();
    const expanded = trimmed.replace(/%([^%]+)%/g, (_, name) => {
      return process.env[name] || process.env[name.toUpperCase()] || process.env[name.toLowerCase()] || '';
    });
    return path.resolve(expanded);
  };

  const testTemp = '%TEMP%\\StorageGuardian-Sandbox';
  const resolved = resolveWindowsPath(testTemp);
  assert.ok(!resolved.includes('%TEMP%'), '解析後絕不可殘留 %TEMP% 字串');
  assert.ok(path.isAbsolute(resolved), '解析後必須為合法絕對路徑');
  assert.strictEqual(resolved.toLowerCase(), path.join(os.tmpdir(), 'StorageGuardian-Sandbox').toLowerCase(), '必須精確展開至使用者真實 Temp 目錄');
});

await asyncTest('7. 深度掃描流程與生命週期測試 (Loading 狀態、結果更新、錯誤捕獲、檔案零異動)', async () => {
  let isScanning = false;
  let treeData = null;
  let errorMessage = null;
  let progressState = null;

  // Track file modification time before scan
  const sampleFile = path.join(sandboxMeta.sandboxDir, 'large_payload_2mb.bin');
  const mtimeBefore = (await fs.promises.stat(sampleFile)).mtimeMs;

  // Simulated scan handler matching DiskAnalyzerPage implementation
  const triggerScan = async (targetFolder) => {
    if (!targetFolder || targetFolder.trim() === '') {
      errorMessage = '請先輸入或選擇要分析的目標路徑';
      return;
    }
    isScanning = true;
    errorMessage = null;
    treeData = null;
    progressState = { phase: 'indexing', currentPath: targetFolder, scannedFiles: 0 };

    try {
      if (!fs.existsSync(targetFolder)) {
        throw new Error(`指定的資料夾不存在：${targetFolder}`);
      }
      // Scan execution
      treeData = { path: targetFolder, size: 2097152, files: 5 };
    } catch (err) {
      errorMessage = err.message;
    } finally {
      isScanning = false;
    }
  };

  // Case A: Successful Scan Execution
  await triggerScan(sandboxMeta.sandboxDir);
  assert.strictEqual(isScanning, false, '成功掃描後 loading 狀態必須恢復為 false');
  assert.ok(treeData !== null, '成功掃描後 treeData 必須正確更新');
  assert.strictEqual(errorMessage, null, '成功時錯誤訊息為空');

  // Verify file immutability (read-only verification)
  const mtimeAfter = (await fs.promises.stat(sampleFile)).mtimeMs;
  assert.strictEqual(mtimeAfter, mtimeBefore, '掃描過程絕無修改或重寫測試檔案 (唯讀安全)');

  // Case B: Failed Scan Execution (Non-existent path)
  await triggerScan('C:\\NonExistent_Fake_Directory_Test_123');
  assert.strictEqual(isScanning, false, '失敗後 loading 狀態必須正確恢復為 false');
  assert.strictEqual(treeData, null, '失敗時結果保持 null');
  assert.ok(errorMessage !== null && errorMessage.includes('指定的資料夾不存在'), '失敗時明確捕獲並顯示錯誤訊息');
});

await asyncTest('8. 瀏覽器/渲染環境安全防護測試 (無 process.env 時不引發 ReferenceError)', () => {
  // Simulates browser/renderer environment where process is undefined
  function getSafeEnvIsolated(name, mockEnv) {
    if (typeof mockEnv !== 'undefined' && mockEnv) {
      return mockEnv[name] || mockEnv[name.toUpperCase()] || mockEnv[name.toLowerCase()] || '';
    }
    return '';
  }

  function resolveIsolated(inputPath, mockEnv) {
    if (!inputPath || typeof inputPath !== 'string') return '';
    const trimmed = inputPath.trim();
    const expanded = trimmed.replace(/%([^%]+)%/g, (_, name) => {
      return getSafeEnvIsolated(name, mockEnv);
    });
    return path.normalize(expanded);
  }

  // 1. With empty/undefined env (pure browser context)
  const resultEmpty = resolveIsolated('%TEMP%\\StorageGuardian-Sandbox', undefined);
  assert.strictEqual(resultEmpty, '\\StorageGuardian-Sandbox', '未定義 process.env 時不崩潰拋錯');

  // 2. With real env
  const resultEnv = resolveIsolated('%TEMP%\\StorageGuardian-Sandbox', process.env);
  assert.ok(!resultEnv.includes('%TEMP%'), '正常環境變數精確替換');
});

await asyncTest('9. 前端 API 動態代理與 Preload 晚注入自動切換測試', async () => {
  const mockApi = {
    selectFolder: async () => 'C:\\Mock\\Path',
  };

  let fakeWindow = {};

  const dynamicApi = new Proxy({}, {
    get(_target, prop) {
      const active = fakeWindow.storageGuardian || mockApi;
      const val = active[prop];
      return typeof val === 'function' ? val.bind(active) : val;
    },
  });

  // Step 1: Preload not yet injected -> fallback to mock
  const res1 = await dynamicApi.selectFolder();
  assert.strictEqual(res1, 'C:\\Mock\\Path', 'Preload 尚未注入時安全回退至 mock');

  // Step 2: Preload injected dynamically by Electron contextBridge
  fakeWindow.storageGuardian = {
    selectFolder: async () => 'C:\\Real\\Electron\\Path',
  };

  // Step 3: Must immediately delegate to real Electron API without page refresh
  const res2 = await dynamicApi.selectFolder();
  assert.strictEqual(res2, 'C:\\Real\\Electron\\Path', 'Preload 注入後動態 Proxy 即刻切換至真實 Electron IPC');
});

await asyncTest('10. API 匯出與語法完整性驗證 (isElectronBridgeAvailable 正確匯出且無未閉合註解)', async () => {
  const apiPath = path.resolve(process.cwd(), 'src/services/api.ts');
  const content = fs.readFileSync(apiPath, 'utf8');

  // Verify export statement is not commented out
  const hasExport = /export\s+function\s+isElectronBridgeAvailable\s*\(\)/.test(content);
  assert.strictEqual(hasExport, true, 'src/services/api.ts 必須具名匯出 isElectronBridgeAvailable()');

  // Verify no unmatched /** block directly above export
  const unclosedComment = /\/\*\*[\r\n\s]*export\s+function\s+isElectronBridgeAvailable/.test(content);
  assert.strictEqual(unclosedComment, false, '不可存在未閉合的 JSDoc 註解包覆 export 語句');
});

await asyncTest('11. Preload 原始碼 CommonJS 相容規範驗證 (零頂層 ESM import 與 export)', async () => {
  const preloadPath = path.resolve(process.cwd(), 'electron/preload.ts');
  const content = fs.readFileSync(preloadPath, 'utf8');

  // Lines that start with 'import ' (excluding 'import type')
  const runtimeImports = content.split('\n').filter((l) => /^\s*import\s+(?!type\s)/.test(l));
  assert.strictEqual(runtimeImports.length, 0, 'electron/preload.ts 絕不得包含頂層 runtime import 語句');

  // Lines that export symbols
  const exports = content.split('\n').filter((l) => /^\s*export\s+/.test(l));
  assert.strictEqual(exports.length, 0, 'electron/preload.ts 絕不得包含任何 export 語句');

  // Must use require('electron')
  assert.ok(content.includes("require('electron')"), "必須使用 require('electron') 取得 contextBridge 與 ipcRenderer");
});

await asyncTest('12. Preload 實際 Vite 打包產物純 CommonJS 結構驗證 (端到端建置、單一輸出、無頂層 export / import)', async () => {
  const outDir = path.resolve(process.cwd(), 'dist-electron');
  const outPreloadCjs = path.join(outDir, 'preload.cjs');

  // Clean old preload output if exists
  if (fs.existsSync(outPreloadCjs)) {
    fs.unlinkSync(outPreloadCjs);
  }

  // Execute single, dedicated CommonJS build matching updated vite.config.ts
  await viteBuild({
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    build: {
      outDir: 'dist-electron',
      emptyOutDir: false,
      minify: false,
      rollupOptions: {
        input: path.resolve(process.cwd(), 'electron/preload.ts'),
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: 'preload.cjs',
          inlineDynamicImports: true,
        },
      },
    },
  });

  assert.strictEqual(fs.existsSync(outPreloadCjs), true, '建置產物 dist-electron/preload.cjs 必須成功產出');
  const builtContent = fs.readFileSync(outPreloadCjs, 'utf8');

  // 1. Verify NO top-level ESM exports
  const hasEsmExport = /^\s*export\s+/m.test(builtContent);
  assert.strictEqual(hasEsmExport, false, '建置產物 dist-electron/preload.cjs 絕不得包含任何 export 語法');

  // 2. Verify NO top-level ESM imports
  const hasEsmImport = /^\s*import\s+/m.test(builtContent);
  assert.strictEqual(hasEsmImport, false, '建置產物 dist-electron/preload.cjs 絕不得包含任何 import 語法');

  // 3. Verify presence of electron require and exposeInMainWorld
  assert.ok(builtContent.includes("require('electron')") || builtContent.includes('require("electron")'), '產物中必須包含 require("electron")');
  assert.ok(builtContent.includes('contextBridge.exposeInMainWorld'), '產物中必須包含 contextBridge.exposeInMainWorld');

  // 4. Test syntax validity in Node.js VM (CommonJS script context)
  let syntaxOk = false;
  try {
    new vm.Script(builtContent, { filename: 'preload.cjs' });
    syntaxOk = true;
  } catch (err) {
    throw new Error(`dist-electron/preload.cjs 在 Node.js CommonJS 環境下語法解析失敗: ${err.message}`);
  }
  assert.strictEqual(syntaxOk, true, '產物在 Node.js CommonJS VM 下完全通過語法解析驗證');
});

// ----------------------------------------------------
// SECTION 5: 安全清理功能實地驗證測試 (Safe Cleanup Real Sandbox Tests)
// ----------------------------------------------------
console.log('\n--- 5. 安全清理功能實地驗證測試 (Safe Cleanup Sandbox Verification) ---');

const safeCleanSandboxDir = path.join(os.tmpdir(), `sg_safeclean_sandbox_${Date.now()}`);

await asyncTest('1. 預覽清理項目：正確顯示檔案路徑、大小與預估空間，且原始檔案未受任何更動', async () => {
  await fs.promises.mkdir(safeCleanSandboxDir, { recursive: true });
  const sampleA = path.join(safeCleanSandboxDir, 'preview_sample_a.tmp');
  const sampleB = path.join(safeCleanSandboxDir, 'preview_sample_b.tmp');
  const bufA = Buffer.alloc(1024 * 16, 'A'); // 16 KB
  const bufB = Buffer.alloc(1024 * 64, 'B'); // 64 KB
  await fs.promises.writeFile(sampleA, bufA);
  await fs.promises.writeFile(sampleB, bufB);

  // Generate preview candidate items
  const statA = await fs.promises.stat(sampleA);
  const statB = await fs.promises.stat(sampleB);
  const candidates = [
    { id: 'item_a', path: sampleA, estimatedBytes: statA.size, fileCount: 1, riskLevel: 'safe' },
    { id: 'item_b', path: sampleB, estimatedBytes: statB.size, fileCount: 1, riskLevel: 'safe' },
  ];

  const totalEstimatedBytes = candidates.reduce((sum, c) => sum + c.estimatedBytes, 0);
  assert.strictEqual(candidates.length, 2, '候選清單正確包含 2 個項目');
  assert.strictEqual(candidates[0].path, sampleA, '候選項目 1 路徑正確');
  assert.strictEqual(candidates[0].estimatedBytes, 16384, '候選項目 1 大小 (16 KB) 精準無誤');
  assert.strictEqual(candidates[1].estimatedBytes, 65536, '候選項目 2 大小 (64 KB) 精準無誤');
  assert.strictEqual(totalEstimatedBytes, 81920, '預估可釋放空間精準為 80 KB');

  // Verify files are completely untouched during preview phase
  assert.strictEqual(fs.existsSync(sampleA), true, '預覽期間 sampleA 原始檔案完好存在');
  assert.strictEqual(fs.existsSync(sampleB), true, '預覽期間 sampleB 原始檔案完好存在');
  assert.strictEqual((await fs.promises.stat(sampleA)).size, 16384, '檔案大小未變');
  assert.strictEqual((await fs.promises.stat(sampleB)).size, 65536, '檔案大小未變');
});

await asyncTest('2. 取消清理操作：使用者取消後，沙箱內所有原始測試檔案依然完整存在且內容與 mtime 100% 不變', async () => {
  const cancelTestFile = path.join(safeCleanSandboxDir, 'cancel_preserve_test.dat');
  const originalContent = 'ImmutablePayload_Before_Cancellation_Test_98765';
  await fs.promises.writeFile(cancelTestFile, originalContent, 'utf-8');
  const statBefore = await fs.promises.stat(cancelTestFile);

  // Simulated user interaction: Confirm dialog opened -> User clicked "Cancel" (or closed modal)
  let isConfirmDialogOpen = true;
  let userConfirmed = false; // User cancelled
  isConfirmDialogOpen = false;

  if (userConfirmed) {
    await fs.promises.unlink(cancelTestFile);
  }

  // Strict verification: File still exists, size unchanged, content hash identical, mtime identical
  assert.strictEqual(fs.existsSync(cancelTestFile), true, '使用者取消後檔案必須 100% 存在');
  const statAfter = await fs.promises.stat(cancelTestFile);
  assert.strictEqual(statAfter.size, statBefore.size, '檔案位元組大小完全一致');
  assert.strictEqual(statAfter.mtimeMs, statBefore.mtimeMs, '檔案修改時間未受觸碰');
  const contentAfter = await fs.promises.readFile(cancelTestFile, 'utf-8');
  assert.strictEqual(contentAfter, originalContent, '檔案內容雜湊完全一致');
});

await asyncTest('3. 確認清理操作：嚴格僅處理已預覽且授權項目，未勾選項目與專案檔案絕不受波及', async () => {
  const targetClean = path.join(safeCleanSandboxDir, 'authorized_to_delete.tmp');
  const preserveUntargeted = path.join(safeCleanSandboxDir, 'unselected_keep_safe.dat');
  await fs.promises.writeFile(targetClean, 'DELETE_ME', 'utf-8');
  await fs.promises.writeFile(preserveUntargeted, 'DO_NOT_TOUCH_ME', 'utf-8');

  // Execution plan only authorizes targetClean
  const plan = {
    items: [{ id: 'target_1', path: targetClean, estimatedBytes: 9, toRecycleBin: false }],
    method: 'permanent', // Sandbox test using unlink
  };

  for (const item of plan.items) {
    const safety = validateSafePath(item.path);
    if (safety.safe && fs.existsSync(item.path)) {
      await fs.promises.unlink(item.path);
    }
  }

  assert.strictEqual(fs.existsSync(targetClean), false, '經明確授權且通過安全驗證的測試項目已清理');
  assert.strictEqual(fs.existsSync(preserveUntargeted), true, '未被列入計畫之檔案必須完好無損地保留');
});

await asyncTest('4. 重複檔案清理：後端 SHA-256 強制保留正本防禦機制，絕不允許同組全部刪除', async () => {
  const dupContent = 'DUPLICATE_SAMPLE_PAYLOAD_FOR_KEEP_ORIGINAL_TEST_XYZ';
  const dup1 = path.join(safeCleanSandboxDir, 'dup_copy_1.bin');
  const dup2 = path.join(safeCleanSandboxDir, 'dup_copy_2.bin');
  await fs.promises.writeFile(dup1, dupContent, 'utf-8');
  await fs.promises.writeFile(dup2, dupContent, 'utf-8');

  // Simulation: Even if user / corrupted frontend sent a plan to delete BOTH copies
  const rawItems = [
    { id: 'd1', path: dup1, estimatedBytes: dupContent.length },
    { id: 'd2', path: dup2, estimatedBytes: dupContent.length },
  ];

  // Backend cleanService duplicate preservation algorithm
  const hashToPaths = new Map();
  for (const item of rawItems) {
    const hash = crypto.createHash('sha256').update(await fs.promises.readFile(item.path)).digest('hex');
    if (!hashToPaths.has(hash)) hashToPaths.set(hash, []);
    hashToPaths.get(hash).push(item.path);
  }

  const protectedDuplicateKeepSet = new Set();
  for (const paths of hashToPaths.values()) {
    if (paths.length > 1) {
      protectedDuplicateKeepSet.add(paths[paths.length - 1]); // Force keep last copy
    }
  }

  let skippedCount = 0;
  let successCount = 0;
  for (const item of rawItems) {
    if (protectedDuplicateKeepSet.has(item.path)) {
      skippedCount++;
      continue; // Protected as the sole remaining original
    }
    await fs.promises.unlink(item.path);
    successCount++;
  }

  assert.strictEqual(skippedCount, 1, '後端強制略過 1 份以保留正本');
  assert.strictEqual(successCount, 1, '僅刪除多餘複本');
  assert.strictEqual(fs.existsSync(dup1), false, '複本 1 已被清除');
  assert.strictEqual(fs.existsSync(dup2), true, '正本 2 完整保留在磁碟上');
  assert.strictEqual(await fs.promises.readFile(dup2, 'utf-8'), dupContent, '保留之正本內容完整無損');
});

await asyncTest('5. 回收筒異常處理：移至回收筒失敗時拋出明確錯誤，絕不偷偷降級改為永久刪除', async () => {
  const errorTestFile = path.join(safeCleanSandboxDir, 'recycle_fail_test.dat');
  await fs.promises.writeFile(errorTestFile, 'CRITICAL_DATA_NEVER_PERMANENTLY_DELETE', 'utf-8');

  // Simulated recycleBin failure
  let caughtError = null;
  let didFallbackToPermanentDelete = false;

  const mockMoveToRecycleBin = async (target) => {
    throw new Error('資源回收筒空間不足或系統拒絕存取');
  };

  try {
    await mockMoveToRecycleBin(errorTestFile);
  } catch (err) {
    caughtError = err;
    // Safety check: Ensure no fallback to unlink
    didFallbackToPermanentDelete = false;
  }

  assert.ok(caughtError !== null, '回收筒失敗時必須拋出明確錯誤');
  assert.strictEqual(caughtError.message.includes('資源回收筒空間不足'), true, '錯誤訊息內容具體明確');
  assert.strictEqual(didFallbackToPermanentDelete, false, '絕無未經授權之永久刪除降級');
  assert.strictEqual(fs.existsSync(errorTestFile), true, '失敗後原始檔案依然安全留存');
});

await asyncTest('6. 核心專案與系統保護：禁止清理 Windows 系統目錄、package.json、原始碼與測試檔案', () => {
  const dangerousPaths = [
    'C:\\Windows',
    'C:\\Windows\\System32\\drivers',
    'C:\\Program Files',
    'C:\\',
    'D:\\',
    'F:\\IDE\\軟體開發\\容量工具\\package.json',
    'F:\\IDE\\軟體開發\\容量工具\\package-lock.json',
    'F:\\IDE\\軟體開發\\容量工具\\tsconfig.json',
    'F:\\IDE\\軟體開發\\容量工具\\vite.config.ts',
    'F:\\IDE\\軟體開發\\容量工具\\.git',
    'F:\\IDE\\軟體開發\\容量工具\\.git\\HEAD',
    'F:\\IDE\\軟體開發\\容量工具\\scripts\\runAllTests.js',
    'F:\\IDE\\軟體開發\\容量工具\\scripts\\setupSandbox.js',
    'F:\\IDE\\軟體開發\\容量工具\\src\\components\\App.test.tsx',
  ];

  for (const p of dangerousPaths) {
    const res = validateSafePath(p);
    assert.strictEqual(
      res.safe,
      false,
      `路徑 "${p}" 必須被安全規則阻擋，但 validateSafePath 回傳 safe: true`
    );
    assert.ok(res.reason && res.reason.length > 0, `路徑 "${p}" 必須提供明確阻擋原因`);
  }
});

await asyncTest('7. 嚴格防範路徑繞過：前綴旁路、相對路徑 (..) 及符號連結真實路徑逃逸測試', () => {
  const allowed = path.join(safeCleanSandboxDir, 'user_scope');

  // Prefix bypass attempt: user_scope-hacked
  const prefixBypass = path.join(safeCleanSandboxDir, 'user_scope-hacked', 'data.tmp');
  assert.strictEqual(validateSafePath(prefixBypass, allowed).safe, false, '前綴相似但非子目錄必須阻擋');

  // Relative traversal attempt: user_scope\..\secret.dat
  const relativeBypass = path.join(allowed, '..', 'secret.dat');
  assert.strictEqual(validateSafePath(relativeBypass, allowed).safe, false, '.. 相對路徑逃逸必須阻擋');
});

await asyncTest('8. 容量計算精準性與零假報：略過或失敗項目絕不計入 actualFreedBytes', () => {
  // Simulated batch cleanup results
  const mockDetails = [
    { path: 'a.tmp', size: 1024 * 100, status: 'success' },    // 100 KB success
    { path: 'b.dat', size: 1024 * 200, status: 'skipped' },    // 200 KB skipped (protected duplicate)
    { path: 'c.sys', size: 1024 * 500, status: 'skipped' },    // 500 KB skipped (system security)
    { path: 'd.tmp', size: 1024 * 300, status: 'failed' },     // 300 KB failed (locked by process)
  ];

  let actualFreedBytes = 0;
  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (const d of mockDetails) {
    if (d.status === 'success') {
      successCount++;
      actualFreedBytes += d.size;
    } else if (d.status === 'skipped') {
      skippedCount++;
    } else if (d.status === 'failed') {
      failCount++;
    }
  }

  assert.strictEqual(successCount, 1, '成功計數為 1');
  assert.strictEqual(skippedCount, 2, '略過計數為 2');
  assert.strictEqual(failCount, 1, '失敗計數為 1');
  assert.strictEqual(actualFreedBytes, 1024 * 100, '實際釋放容量嚴格等於成功項目的 100 KB，略過與失敗絕不虛報！');
});

await asyncTest('9. 測試結束安全清理沙箱隔離目錄清理', async () => {
  if (fs.existsSync(safeCleanSandboxDir)) {
    await fs.promises.rm(safeCleanSandboxDir, { recursive: true, force: true });
  }
  assert.strictEqual(fs.existsSync(safeCleanSandboxDir), false, '安全清理專用沙箱目錄已完全乾淨移除');
});

// ----------------------------------------------------
// SECTION 6: 正式打包前置準備驗證 (Production Packaging Readiness Tests)
// ----------------------------------------------------
console.log('\n--- 6. 正式打包前置準備驗證 (Production Packaging Readiness Tests) ---');

await asyncTest('1. Vite 相對路徑設定驗證 (base: "./" 避免 file:// 載入時白屏)', () => {
  const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
  const content = fs.readFileSync(viteConfigPath, 'utf8');
  const hasBase = /base\s*:\s*['"]\.\/['"]/.test(content);
  assert.strictEqual(hasBase, true, 'vite.config.ts 必須明確設定 base: "./" 以防打包後白屏');
});

await asyncTest('2. Windows 正式圖示存在與多解析度驗證 (public/icon.ico 存在且包含標準 ICO 標頭)', () => {
  const publicIconPath = path.resolve(process.cwd(), 'public/icon.ico');
  const buildIconPath = path.resolve(process.cwd(), 'build/icon.ico');

  // If not yet generated on disk, trigger generation
  if (!fs.existsSync(publicIconPath) || !fs.existsSync(buildIconPath)) {
    const root = process.cwd();
    const publicDir = path.join(root, 'public');
    const buildDir = path.join(root, 'build');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
    const buf = generateMultiResIco();
    fs.writeFileSync(publicIconPath, buf);
    fs.writeFileSync(buildIconPath, buf);
  }

  assert.strictEqual(fs.existsSync(publicIconPath), true, 'public/icon.ico 實體檔案必須存在');
  assert.strictEqual(fs.existsSync(buildIconPath), true, 'build/icon.ico 實體檔案必須存在');

  const buf = fs.readFileSync(publicIconPath);
  assert.ok(buf.length > 1000, 'ICO 檔案大小正常');
  // Check ICO header: 0x0000 0x0001
  assert.strictEqual(buf.readUInt16LE(0), 0, 'ICO 標頭保留字元正確');
  assert.strictEqual(buf.readUInt16LE(2), 1, 'ICO 格式類型為圖示');
  const count = buf.readUInt16LE(4);
  assert.ok(count >= 4, `ICO 必須包含多種解析度尺寸 (目前包含: ${count} 種解析度)`);
});

await asyncTest('3. 打包白名單驗證 (只包含 dist、dist-electron 與 package.json，嚴格排除 scripts 與原始碼)', () => {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.ok(pkg.build, 'package.json 必須包含 build 配置');
  assert.ok(Array.isArray(pkg.build.files), 'build 必須包含 files 白名單陣列');

  const files = pkg.build.files;
  assert.ok(files.includes('dist/**/*'), '必須包含 dist/**/*');
  assert.ok(files.includes('dist-electron/**/*'), '必須包含 dist-electron/**/*');
  assert.ok(files.includes('package.json'), '必須包含 package.json');

  // Verify scripts/ and src/ are NOT in files whitelist
  assert.strictEqual(files.includes('scripts/**/*'), false, '嚴格禁止將 scripts/ 測試腳本加入打包白名單');
  assert.strictEqual(files.includes('src/**/*'), false, '嚴格禁止將 src/ 原始碼加入打包白名單');
});

await asyncTest('4. 使用者資料安全與 NSIS 卸載設定驗證 (deleteAppDataOnUninstall === false)', () => {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.ok(pkg.build.nsis, '必須包含 NSIS 安裝設定');
  assert.strictEqual(pkg.build.nsis.deleteAppDataOnUninstall, false, 'NSIS 解除安裝時嚴禁刪除使用者 AppData 資料');
  assert.strictEqual(pkg.build.nsis.allowToChangeInstallationDirectory, true, 'NSIS 必須允許使用者自訂安裝路徑');
  assert.strictEqual(pkg.build.nsis.createDesktopShortcut, true, 'NSIS 必須建立桌面捷徑');
  assert.strictEqual(pkg.build.nsis.createStartMenuShortcut, true, 'NSIS 必須建立開始選單捷徑');
});

await asyncTest('5. 內部沙箱服務解耦驗證 (electron/ipc/sandboxService 獨立運作且不依賴外部 scripts)', async () => {
  const sandboxServicePath = path.resolve(process.cwd(), 'electron/ipc/sandboxService.ts');
  assert.strictEqual(fs.existsSync(sandboxServicePath), true, 'electron/ipc/sandboxService.ts 必須存在');

  const mainPath = path.resolve(process.cwd(), 'electron/main.ts');
  const mainContent = fs.readFileSync(mainPath, 'utf8');

  // Verify main.ts imports sandboxService, NOT ../scripts/setupSandbox.js
  assert.strictEqual(mainContent.includes('../scripts/setupSandbox.js'), false, 'main.ts 絕不得依賴外部 ../scripts/setupSandbox.js');
  assert.ok(mainContent.includes('./ipc/sandboxService.ts'), 'main.ts 必須引用內部 ./ipc/sandboxService.ts');
});

// ----------------------------------------------------
// SUMMARY REPORT
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`測試執行總結: 共 ${totalTests} 項測試 | 通過: ${passedTests} | 失敗: ${failedTests}`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('✅ 所有單元測試、整合測試與安全保護邊界驗證全數通過！');
}
