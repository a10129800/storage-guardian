import fs from 'fs';
import path from 'path';
import { CleanupProgress, CleanupResult, DevProjectCandidate } from '../../src/types/index.ts';
import { validateDevCleanTarget, validateSafePath } from '../../src/utils/security.ts';
import { moveToRecycleBin } from './recycleBin.ts';

export class DevCleanerService {
  private isCancelled = false;

  cancel(): void {
    this.isCancelled = true;
  }
  /**
   * Scan user-specified workspace or project folder for dependency and build artifact folders.
   */
  async scanDevProjects(targetRoot: string, maxDepth = 4): Promise<DevProjectCandidate[]> {
    const candidates: DevProjectCandidate[] = [];
    if (!fs.existsSync(targetRoot)) return candidates;

    const targetFolderNames = new Set([
      'node_modules',
      '.next',
      'dist',
      'build',
      'coverage',
      '.turbo',
      '.vite',
      'target', // Cargo
      '.cache',
    ]);

    const PROJECT_MARKERS = [
      'package.json',
      'Cargo.toml',
      'go.mod',
      'pom.xml',
      'requirements.txt',
      'pyproject.toml',
      'build.gradle',
      'CMakeLists.txt',
      'composer.json',
    ];

    const walk = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      // Check if currentDir contains any legitimate project markers
      const isProjectRoot = PROJECT_MARKERS.some((marker) => fs.existsSync(path.join(currentDir, marker)));

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const folderName = entry.name.toLowerCase();
        const fullPath = path.join(currentDir, entry.name);

        if (targetFolderNames.has(folderName)) {
          // STRICT RULE: Only consider as dev build artifact if parent directory has a recognized project marker!
          // This prevents accidental deletion of non-project user folders named 'dist' or 'build'.
          if (!isProjectRoot && (folderName === 'dist' || folderName === 'build')) {
            // Not in a project root, skip treating as dev artifact
            await walk(fullPath, depth + 1);
            continue;
          }

          const projectName = path.basename(currentDir);

          let isDangerous = false;
          let warningMessage: string | undefined;

          if (folderName === 'dist' || folderName === 'build') {
            isDangerous = true;
            warningMessage = '此目錄可能為專案正式發佈成果 (Production Build)，清理後需重新建置。';
          }

          try {
            const summary = await this.calcDirStats(fullPath);
            candidates.push({
              id: `dev-${candidates.length}-${Date.now()}`,
              projectRoot: currentDir,
              projectName: projectName || '未知專案',
              targetDir: fullPath,
              targetType: folderName as any,
              size: summary.size,
              fileCount: summary.count,
              lastModified: summary.mtime,
              isDangerous,
              warningMessage,
              selected: !isDangerous, // Default unselect dangerous build directories
            });
          } catch {
            // Skip
          }
          // Do not recurse into node_modules or dist themselves
          continue;
        }

        // Recurse into sub-projects
        await walk(fullPath, depth + 1);
      }
    };

    await walk(targetRoot, 0);
    candidates.sort((a, b) => b.size - a.size);
    return candidates;
  }

  /**
   * Safely clean selected developer directories into the Recycle Bin.
   */
  async cleanCandidates(
    items: DevProjectCandidate[],
    onProgress?: (progress: CleanupProgress) => void
  ): Promise<CleanupResult> {
    this.isCancelled = false;
    const details = [];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let actualFreedBytes = 0;
    let processedBytes = 0;

    const selectedItems = items.filter((i) => i.selected);
    const totalItems = selectedItems.length;
    const totalBytes = selectedItems.reduce((s, i) => s + i.size, 0);
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

    reportProgress('', true, 'running');

    for (const item of selectedItems) {
      if (this.isCancelled) {
        skippedCount++;
        details.push({
          path: item.targetDir,
          size: item.size,
          status: 'skipped' as const,
          reason: '使用者取消後續清理作業',
          movedToRecycleBin: false,
        });
        reportProgress(item.targetDir, false, 'running');
        continue;
      }

      reportProgress(item.targetDir);

      const folderName = path.basename(item.targetDir);
      if (!validateDevCleanTarget(folderName)) {
        skippedCount++;
        details.push({
          path: item.targetDir,
          size: item.size,
          status: 'skipped' as const,
          reason: '目標不屬於安全允許清理的開發目錄類型',
          movedToRecycleBin: false,
        });
        reportProgress(item.targetDir);
        continue;
      }

      // STRICT PROTECTION: Never delete project root itself or source directories
      const normTarget = path.normalize(item.targetDir).toLowerCase();
      const normProjectRoot = path.normalize(item.projectRoot).toLowerCase();
      if (normTarget === normProjectRoot) {
        skippedCount++;
        details.push({
          path: item.targetDir,
          size: item.size,
          status: 'skipped' as const,
          reason: '安全保護：目標為專案根目錄，絕對禁止刪除！',
          movedToRecycleBin: false,
        });
        reportProgress(item.targetDir);
        continue;
      }

      const safety = validateSafePath(item.targetDir);
      if (!safety.safe) {
        skippedCount++;
        details.push({
          path: item.targetDir,
          size: item.size,
          status: 'skipped' as const,
          reason: safety.reason || '系統保護目錄',
          movedToRecycleBin: false,
        });
        reportProgress(item.targetDir);
        continue;
      }

      if (!fs.existsSync(item.targetDir)) {
        skippedCount++;
        details.push({
          path: item.targetDir,
          size: item.size,
          status: 'skipped' as const,
          reason: '目錄已不存在',
          movedToRecycleBin: false,
        });
        reportProgress(item.targetDir);
        continue;
      }

      try {
        await moveToRecycleBin(item.targetDir);
        successCount++;
        actualFreedBytes += item.size;
        details.push({
          path: item.targetDir,
          size: item.size,
          status: 'success' as const,
          movedToRecycleBin: true,
        });
      } catch (err: any) {
        failCount++;
        details.push({
          path: item.targetDir,
          size: item.size,
          status: 'failed' as const,
          reason: err.message,
          movedToRecycleBin: false,
        });
      }

      processedBytes += item.size;
      reportProgress(item.targetDir);
    }

    reportProgress('', true, this.isCancelled ? 'cancelled' : 'completed');

    return {
      id: `devclean-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operationType: 'dev_cleanup',
      totalProcessed: totalItems,
      successCount,
      failCount,
      skippedCount,
      actualFreedBytes,
      details,
    };
  }

  private async calcDirStats(dirPath: string): Promise<{ size: number; count: number; mtime: string }> {
    let size = 0;
    let count = 0;
    let maxMtime = 0;

    const walk = async (current: string) => {
      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const full = path.join(current, entry.name);
        try {
          const stats = await fs.promises.stat(full);
          if (stats.mtimeMs > maxMtime) maxMtime = stats.mtimeMs;
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.isFile()) {
            count++;
            size += stats.size;
          }
        } catch {
          // Skip
        }
      }
    };

    await walk(dirPath);
    return {
      size,
      count,
      mtime: maxMtime ? new Date(maxMtime).toISOString() : new Date().toISOString(),
    };
  }
}
