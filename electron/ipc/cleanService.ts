import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  CleanupCandidateItem,
  CleanupExecutionPlan,
  CleanupProgress,
  CleanupResult,
  CleanupResultDetail,
} from '../../src/types/index.ts';
import { isDangerousSystemPath, validateSafePath } from '../../src/utils/security.ts';
import { moveToRecycleBin } from './recycleBin.ts';

export class CleanService {
  private isCancelled = false;

  cancel(): void {
    this.isCancelled = true;
  }

  private computeQuickSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }
  /**
   * Scan system and user paths for safe cleanup candidates.
   */
  async scanSafeCleanCandidates(): Promise<CleanupCandidateItem[]> {
    const candidates: CleanupCandidateItem[] = [];

    // 1. User Temp Directory (%TEMP%)
    const userTempPath = os.tmpdir();
    if (fs.existsSync(userTempPath)) {
      const stats = await this.calcDirSummary(userTempPath, 2);
      candidates.push({
        id: 'user_temp',
        category: 'user_temp',
        categoryName: '使用者暫存檔案 (User Temp)',
        path: userTempPath,
        fileCount: stats.fileCount,
        estimatedBytes: stats.totalBytes,
        riskLevel: 'safe',
        description: '軟體執行時產生的臨時檔案，安全度高，釋放後不影響軟體設定。',
        recommendedAction: '建議定期清理釋放空間。',
        selected: true, // Safe items can be pre-selected in preview, but execution still requires user confirmation
        items: stats.sampleItems,
      });
    }

    // 2. Windows Crash Dumps / WER Report Queue (if exists under %LOCALAPPDATA%\CrashDumps)
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const crashDumpsPath = path.join(localAppData, 'CrashDumps');
    if (fs.existsSync(crashDumpsPath)) {
      const stats = await this.calcDirSummary(crashDumpsPath, 1);
      candidates.push({
        id: 'crash_dumps',
        category: 'windows_temp',
        categoryName: '程式當機報告與記憶體傾印 (Crash Dumps)',
        path: crashDumpsPath,
        fileCount: stats.fileCount,
        estimatedBytes: stats.totalBytes,
        riskLevel: 'safe',
        description: '應用程式發生錯誤時產生的傾印日誌 (.dmp)，通常佔用數百 MB 空間。',
        recommendedAction: '可安全清理，不會影響軟體正常運作。',
        selected: true,
        items: stats.sampleItems,
      });
    }

    // 3. Thumbnail / Icon Cache (Windows Explorer)
    const explorerCachePath = path.join(localAppData, 'Microsoft', 'Windows', 'Explorer');
    if (fs.existsSync(explorerCachePath)) {
      const stats = await this.calcFilePatternSummary(explorerCachePath, /^thumbcache_.*\.db$/i);
      if (stats.fileCount > 0) {
        candidates.push({
          id: 'thumb_cache',
          category: 'thumbnail_cache',
          categoryName: 'Windows 檔案總管縮圖快取',
          path: explorerCachePath,
          fileCount: stats.fileCount,
          estimatedBytes: stats.totalBytes,
          riskLevel: 'moderate',
          description: '預覽圖示快取檔案。清理後下次開啟圖片資料夾時會重新生成縮圖。',
          recommendedAction: '當縮圖顯示異常或空間緊縮時可清理。',
          selected: false,
          items: stats.sampleItems,
        });
      }
    }

    // 4. Browser Cache Candidates (e.g. Google Chrome / Microsoft Edge User Data Default Cache)
    const edgeCache = path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache');
    if (fs.existsSync(edgeCache)) {
      const stats = await this.calcDirSummary(edgeCache, 2);
      candidates.push({
        id: 'edge_cache',
        category: 'app_cache',
        categoryName: 'Microsoft Edge 瀏覽器快取',
        path: edgeCache,
        fileCount: stats.fileCount,
        estimatedBytes: stats.totalBytes,
        riskLevel: 'moderate',
        description: '網頁圖片與暫存檔案。清理後瀏覽器需重新下載網頁資產，可能稍慢一次。',
        recommendedAction: '若長時間未清理且體積龐大，建議選取釋放。',
        selected: false,
        items: stats.sampleItems,
      });
    }

    const chromeCache = path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache');
    if (fs.existsSync(chromeCache)) {
      const stats = await this.calcDirSummary(chromeCache, 2);
      candidates.push({
        id: 'chrome_cache',
        category: 'app_cache',
        categoryName: 'Google Chrome 瀏覽器快取',
        path: chromeCache,
        fileCount: stats.fileCount,
        estimatedBytes: stats.totalBytes,
        riskLevel: 'moderate',
        description: 'Chrome 網頁暫存。清理後不影響書籤、登入狀態或密碼。',
        recommendedAction: '空間不足時可勾選清理。',
        selected: false,
        items: stats.sampleItems,
      });
    }

    return candidates;
  }

  /**
   * Re-verify and execute cleanup plan.
   * Safety rules:
   * 1. Re-verify file existence, size, and ensure it is not locked or dangerous.
   * 2. Move to Recycle Bin unless permanent deletion was specifically requested.
   * 3. For cache directories (e.g. user_temp, crash_dumps, thumb_cache, browser cache),
   *    clean ONLY the contents or specific pattern files, NEVER delete the root folder itself!
   * 4. Record all successes, failures, and skipped items.
   */
  async executeCleanup(
    plan: CleanupExecutionPlan,
    onProgress?: (progress: CleanupProgress) => void
  ): Promise<CleanupResult> {
    this.isCancelled = false;
    const details: CleanupResultDetail[] = [];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let actualFreedBytes = 0;
    let processedBytes = 0;

    if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) {
      if (onProgress) {
        onProgress({
          totalItems: 0,
          completedItems: 0,
          successfulItems: 0,
          failedItems: 0,
          totalBytes: 0,
          processedBytes: 0,
          currentItem: '',
          percent: 100,
          elapsedTime: 0,
          estimatedRemainingTime: 0,
          status: 'completed',
        });
      }
      return {
        id: `clean-${Date.now()}`,
        timestamp: new Date().toISOString(),
        operationType: 'safe_cleanup',
        totalProcessed: 0,
        successCount: 0,
        failCount: 0,
        skippedCount: 0,
        actualFreedBytes: 0,
        details: [],
      };
    }

    // 0. Backend Duplicate Group Defense:
    // If incoming plan contains multiple duplicate copies of the exact same content,
    // protect at least ONE copy from being deleted even if all were selected.
    const protectedDuplicateKeepSet = new Set<string>();
    const hashToPaths = new Map<string, string[]>();

    for (const item of plan.items) {
      if (['user_temp', 'crash_dumps', 'thumb_cache', 'edge_cache', 'chrome_cache'].includes(item.id)) continue;
      try {
        if (fs.existsSync(item.path) && fs.statSync(item.path).isFile()) {
          const hash = await this.computeQuickSha256(item.path);
          if (!hashToPaths.has(hash)) {
            hashToPaths.set(hash, []);
          }
          hashToPaths.get(hash)!.push(item.path);
        }
      } catch {
        // Skip unreadable files
      }
    }

    for (const paths of hashToPaths.values()) {
      if (paths.length > 1) {
        // More than 1 copy of the exact same file in this cleanup batch.
        // Guarantee at least the last copy is preserved!
        protectedDuplicateKeepSet.add(paths[paths.length - 1]);
      }
    }

    // Expand category folders into actual work units so progress tracking is real and accurate
    interface CleanWorkItem {
      id: string;
      path: string;
      parentDir?: string;
      isCategoryDirEntry: boolean;
      isDirectory: boolean;
      estimatedBytes: number;
      toRecycleBin: boolean;
    }

    const workItems: CleanWorkItem[] = [];

    for (const item of plan.items) {
      const isCategoryCleaning = ['user_temp', 'crash_dumps', 'thumb_cache', 'edge_cache', 'chrome_cache'].includes(item.id);
      if (isCategoryCleaning) {
        if (!fs.existsSync(item.path)) {
          workItems.push({
            id: item.id,
            path: item.path,
            isCategoryDirEntry: false,
            isDirectory: true,
            estimatedBytes: item.estimatedBytes || 0,
            toRecycleBin: plan.method === 'recycle_bin',
          });
          continue;
        }

        try {
          const entries = await fs.promises.readdir(item.path, { withFileTypes: true });
          const pattern = item.id === 'thumb_cache' ? /^thumbcache_.*\.db$/i : null;
          let added = 0;
          for (const entry of entries) {
            if (pattern && (!entry.isFile() || !pattern.test(entry.name))) {
              continue;
            }
            workItems.push({
              id: item.id,
              path: path.join(item.path, entry.name),
              parentDir: item.path,
              isCategoryDirEntry: true,
              isDirectory: entry.isDirectory(),
              estimatedBytes: 0,
              toRecycleBin: plan.method === 'recycle_bin',
            });
            added++;
          }
        } catch (err: any) {
          workItems.push({
            id: item.id,
            path: item.path,
            isCategoryDirEntry: false,
            isDirectory: true,
            estimatedBytes: 0,
            toRecycleBin: plan.method === 'recycle_bin',
          });
        }
      } else {
        workItems.push({
          id: item.id,
          path: item.path,
          isCategoryDirEntry: false,
          isDirectory: false,
          estimatedBytes: item.estimatedBytes || 0,
          toRecycleBin: plan.method === 'recycle_bin',
        });
      }
    }

    const totalItems = workItems.length;
    const totalBytes = plan.totalEstimatedBytes || 0;
    const startTime = Date.now();
    let lastReportTime = 0;
    const REPORT_INTERVAL_MS = 60;

    const reportProgress = (currentItem: string, force = false, status: CleanupProgress['status'] = 'running') => {
      if (!onProgress) return;
      const now = Date.now();
      if (!force && now - lastReportTime < REPORT_INTERVAL_MS) {
        return;
      }
      lastReportTime = now;
      const elapsedSec = Math.max(0.1, (now - startTime) / 1000);
      const completed = successCount + failCount + skippedCount;
      const percent = totalItems > 0 ? Math.min(100, Math.round((completed / totalItems) * 1000) / 10) : 100;

      let estimatedRemainingTime: number | null = null;
      if (status === 'completed' || completed >= totalItems) {
        estimatedRemainingTime = 0;
      } else if (completed >= 2 && elapsedSec >= 0.5) {
        const itemsPerSec = completed / elapsedSec;
        const remainingItems = totalItems - completed;
        if (itemsPerSec > 0) {
          estimatedRemainingTime = Math.max(0, Math.round(remainingItems / itemsPerSec));
        }
      }

      onProgress({
        totalItems,
        completedItems: completed,
        successfulItems: successCount,
        failedItems: failCount,
        totalBytes,
        processedBytes,
        currentItem,
        percent,
        elapsedTime: Math.round(elapsedSec * 10) / 10,
        estimatedRemainingTime,
        status,
      });
    };

    // Report initial state
    reportProgress('', true, 'running');

    for (const item of workItems) {
      // Cancellation check
      if (this.isCancelled) {
        skippedCount++;
        details.push({
          path: item.path,
          size: item.estimatedBytes,
          status: 'skipped',
          reason: '使用者取消後續清理作業',
          movedToRecycleBin: false,
        });
        reportProgress(item.path, false, 'running');
        continue;
      }

      reportProgress(item.path);

      // Check duplicate preservation defense
      if (protectedDuplicateKeepSet.has(item.path)) {
        skippedCount++;
        details.push({
          path: item.path,
          size: item.estimatedBytes,
          status: 'skipped',
          reason: '後端強制安全防護：同組重複檔案必須保留至少一份完整正本，拒絕全部刪除',
          movedToRecycleBin: false,
        });
        reportProgress(item.path);
        continue;
      }

      // 1. Path safety check
      const safety = validateSafePath(item.path);
      if (!safety.safe) {
        skippedCount++;
        details.push({
          path: item.path,
          size: item.estimatedBytes,
          status: 'skipped',
          reason: safety.reason || '安全規則檢查失敗，已自動略過',
          movedToRecycleBin: false,
        });
        reportProgress(item.path);
        continue;
      }

      // 2. Re-verify item exists
      if (!fs.existsSync(item.path)) {
        skippedCount++;
        details.push({
          path: item.path,
          size: item.estimatedBytes,
          status: 'skipped',
          reason: '執行前重新驗證發現檔案或目錄已不存在',
          movedToRecycleBin: false,
        });
        reportProgress(item.path);
        continue;
      }

      // 3. Stat check
      let currentSize = item.estimatedBytes;
      try {
        const stats = await fs.promises.stat(item.path);
        currentSize = stats.size;
        if (!item.isCategoryDirEntry && !stats.isFile()) {
          skippedCount++;
          details.push({
            path: item.path,
            size: stats.size,
            status: 'skipped',
            reason: '安全保護機制阻止：一般清理項目必須為單一檔案，嚴格禁止將未明確授權之資料夾當成檔案刪除！',
            movedToRecycleBin: false,
          });
          reportProgress(item.path);
          continue;
        }
      } catch (err: any) {
        skippedCount++;
        details.push({
          path: item.path,
          size: currentSize,
          status: 'skipped',
          reason: `無法存取檔案屬性：${err.message || '檔案可能不存在或無存取權限'}`,
          movedToRecycleBin: false,
        });
        reportProgress(item.path);
        continue;
      }

      // 4. Perform actual deletion
      try {
        if (item.toRecycleBin) {
          await moveToRecycleBin(item.path);
          successCount++;
          actualFreedBytes += currentSize;
          details.push({
            path: item.path,
            size: currentSize,
            status: 'success',
            movedToRecycleBin: true,
          });
        } else {
          if (item.isDirectory) {
            await fs.promises.rm(item.path, { recursive: true, force: true });
          } else {
            await fs.promises.unlink(item.path);
          }
          successCount++;
          actualFreedBytes += currentSize;
          details.push({
            path: item.path,
            size: currentSize,
            status: 'success',
            movedToRecycleBin: false,
          });
        }
      } catch (err: any) {
        failCount++;
        details.push({
          path: item.path,
          size: currentSize,
          status: 'failed',
          reason: err.message || '刪除失敗 (檔案可能正被系統或應用程式鎖定)',
          movedToRecycleBin: false,
        });
      }

      processedBytes += currentSize;
      reportProgress(item.path);
    }

    reportProgress('', true, this.isCancelled ? 'cancelled' : 'completed');

    return {
      id: `clean-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operationType: 'safe_cleanup',
      totalProcessed: totalItems,
      successCount,
      failCount,
      skippedCount,
      actualFreedBytes,
      details,
    };
  }

  /**
   * Safely delete contents of a temporary directory without deleting the directory itself.
   */
  private async cleanDirectoryContents(
    dirPath: string,
    toRecycleBin: boolean
  ): Promise<{ successCount: number; failCount: number; skippedCount: number; actualFreedBytes: number; details: CleanupResultDetail[] }> {
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let actualFreedBytes = 0;
    const details: CleanupResultDetail[] = [];

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (err: any) {
      failCount++;
      details.push({
        path: dirPath,
        size: 0,
        status: 'failed',
        reason: `無法讀取目錄內容：${err.message}`,
        movedToRecycleBin: false,
      });
      return { successCount, failCount, skippedCount, actualFreedBytes, details };
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Verify sub-item is safe
      const safety = validateSafePath(fullPath, dirPath);
      if (!safety.safe) {
        skippedCount++;
        details.push({
          path: fullPath,
          size: 0,
          status: 'skipped',
          reason: safety.reason || '安全保護略過',
          movedToRecycleBin: false,
        });
        continue;
      }

      let itemSize = 0;
      try {
        const stats = await fs.promises.stat(fullPath);
        itemSize = stats.size;
      } catch {
        // Continue
      }

      try {
        if (toRecycleBin) {
          await moveToRecycleBin(fullPath);
        } else {
          if (entry.isDirectory()) {
            await fs.promises.rm(fullPath, { recursive: true, force: true });
          } else {
            await fs.promises.unlink(fullPath);
          }
        }
        successCount++;
        actualFreedBytes += itemSize;
        details.push({
          path: fullPath,
          size: itemSize,
          status: 'success',
          movedToRecycleBin: toRecycleBin,
        });
      } catch (err: any) {
        failCount++;
        details.push({
          path: fullPath,
          size: itemSize,
          status: 'failed',
          reason: err.message || '檔案可能正被系統或應用程式使用中',
          movedToRecycleBin: false,
        });
      }
    }

    return { successCount, failCount, skippedCount, actualFreedBytes, details };
  }

  /**
   * Safely delete specific pattern files within a directory (e.g. thumbcache_*.db).
   */
  private async cleanDirectoryPatternFiles(
    dirPath: string,
    pattern: RegExp,
    toRecycleBin: boolean
  ): Promise<{ successCount: number; failCount: number; skippedCount: number; actualFreedBytes: number; details: CleanupResultDetail[] }> {
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let actualFreedBytes = 0;
    const details: CleanupResultDetail[] = [];

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (err: any) {
      failCount++;
      details.push({
        path: dirPath,
        size: 0,
        status: 'failed',
        reason: `無法讀取目錄內容：${err.message}`,
        movedToRecycleBin: false,
      });
      return { successCount, failCount, skippedCount, actualFreedBytes, details };
    }

    for (const entry of entries) {
      if (!entry.isFile() || !pattern.test(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const safety = validateSafePath(fullPath, dirPath);
      if (!safety.safe) {
        skippedCount++;
        continue;
      }

      let itemSize = 0;
      try {
        const stats = await fs.promises.stat(fullPath);
        itemSize = stats.size;
      } catch {
        // Continue
      }

      try {
        if (toRecycleBin) {
          await moveToRecycleBin(fullPath);
        } else {
          await fs.promises.unlink(fullPath);
        }
        successCount++;
        actualFreedBytes += itemSize;
        details.push({
          path: fullPath,
          size: itemSize,
          status: 'success',
          movedToRecycleBin: toRecycleBin,
        });
      } catch (err: any) {
        failCount++;
        details.push({
          path: fullPath,
          size: itemSize,
          status: 'failed',
          reason: err.message || '縮圖快取檔案正被檔案總管鎖定',
          movedToRecycleBin: false,
        });
      }
    }

    return { successCount, failCount, skippedCount, actualFreedBytes, details };
  }

  private async calcDirSummary(
    dirPath: string,
    maxDepth: number
  ): Promise<{ fileCount: number; totalBytes: number; sampleItems: { path: string; size: number }[] }> {
    let fileCount = 0;
    let totalBytes = 0;
    const sampleItems: { path: string; size: number }[] = [];

    const walk = async (current: string, depth: number) => {
      if (depth > maxDepth) return;
      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const full = path.join(current, entry.name);
        try {
          if (entry.isDirectory()) {
            await walk(full, depth + 1);
          } else if (entry.isFile()) {
            const stats = await fs.promises.stat(full);
            fileCount++;
            totalBytes += stats.size;
            if (sampleItems.length < 50) {
              sampleItems.push({ path: full, size: stats.size });
            }
          }
        } catch {
          // Skip inaccessible
        }
      }
    };

    await walk(dirPath, 0);
    return { fileCount, totalBytes, sampleItems };
  }

  private async calcFilePatternSummary(
    dirPath: string,
    pattern: RegExp
  ): Promise<{ fileCount: number; totalBytes: number; sampleItems: { path: string; size: number }[] }> {
    let fileCount = 0;
    let totalBytes = 0;
    const sampleItems: { path: string; size: number }[] = [];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && pattern.test(entry.name)) {
          const full = path.join(dirPath, entry.name);
          try {
            const stats = await fs.promises.stat(full);
            fileCount++;
            totalBytes += stats.size;
            sampleItems.push({ path: full, size: stats.size });
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Ignore
    }

    return { fileCount, totalBytes, sampleItems };
  }
}
