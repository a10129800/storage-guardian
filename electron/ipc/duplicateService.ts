import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DuplicateGroup, ScanProgress } from '../../src/types/index.ts';

interface CandidateFile {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
}

export class DuplicateService {
  private isCancelled = false;
  private currentProgress: ScanProgress = {
    phase: 'idle',
    currentPath: '',
    scannedFiles: 0,
    scannedDirs: 0,
    totalBytes: 0,
    errors: [],
  };

  cancel(): void {
    this.isCancelled = true;
    this.currentProgress.phase = 'cancelled';
  }

  async findDuplicates(
    targetPath: string,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<DuplicateGroup[]> {
    this.isCancelled = false;
    this.currentProgress = {
      phase: 'indexing',
      currentPath: targetPath,
      scannedFiles: 0,
      scannedDirs: 0,
      totalBytes: 0,
      errors: [],
    };

    // Stage 1: Group files by exact byte size
    const sizeMap = new Map<number, CandidateFile[]>();
    await this.collectFilesBySize(targetPath, sizeMap, onProgress);

    if (this.isCancelled) return [];

    // Filter sizes with at least 2 files
    const candidateSizes = Array.from(sizeMap.entries()).filter(([_, files]) => files.length > 1);
    const totalCandidates = candidateSizes.reduce((sum, [_, files]) => sum + files.length, 0);

    this.currentProgress.phase = 'hashing';
    let processedCandidates = 0;

    const duplicateGroups: DuplicateGroup[] = [];

    // Stage 2: Calculate SHA-256 hash in streams for candidate files
    for (const [size, files] of candidateSizes) {
      if (this.isCancelled) break;

      const hashMap = new Map<string, CandidateFile[]>();

      for (const file of files) {
        if (this.isCancelled) break;
        processedCandidates++;
        this.currentProgress.currentPath = file.path;
        this.currentProgress.percent = Math.round((processedCandidates / totalCandidates) * 100);

        if (onProgress && processedCandidates % 5 === 0) {
          onProgress({ ...this.currentProgress });
        }

        try {
          const hash = await this.computeFileSha256(file.path);
          if (!hashMap.has(hash)) {
            hashMap.set(hash, []);
          }
          hashMap.get(hash)!.push(file);
        } catch (err: any) {
          this.currentProgress.errors.push({
            path: file.path,
            message: `無法計算雜湊: ${err.message}`,
          });
        }
      }

      // Identify actual duplicates (same SHA-256 hash, >= 2 files)
      for (const [hash, matchingFiles] of hashMap.entries()) {
        if (matchingFiles.length > 1) {
          // Reclaimable = (count - 1) * size (since at least 1 must be kept)
          const reclaimable = (matchingFiles.length - 1) * size;
          duplicateGroups.push({
            id: `dup-${hash.substring(0, 12)}`,
            size,
            hash,
            files: matchingFiles.map((f) => ({
              path: f.path,
              name: f.name,
              modifiedAt: f.modifiedAt,
              selectedForDeletion: false, // Default: NEVER select anything by default
            })),
            theoreticalReclaimableBytes: reclaimable,
          });
        }
      }
    }

    this.currentProgress.phase = this.isCancelled ? 'cancelled' : 'completed';
    if (onProgress) onProgress({ ...this.currentProgress });

    // Sort groups by reclaimable size descending
    duplicateGroups.sort((a, b) => b.theoreticalReclaimableBytes - a.theoreticalReclaimableBytes);
    return duplicateGroups;
  }

  private async collectFilesBySize(
    currentDir: string,
    sizeMap: Map<number, CandidateFile[]>,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<void> {
    if (this.isCancelled) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err: any) {
      this.currentProgress.errors.push({
        path: currentDir,
        message: err.message,
      });
      return;
    }

    this.currentProgress.scannedDirs++;
    this.currentProgress.currentPath = currentDir;

    if (this.currentProgress.scannedDirs % 20 === 0 && onProgress) {
      onProgress({ ...this.currentProgress });
      await new Promise((r) => setImmediate(r));
    }

    for (const entry of entries) {
      if (this.isCancelled) break;
      const fullPath = path.join(currentDir, entry.name);

      try {
        if (entry.isDirectory()) {
          await this.collectFilesBySize(fullPath, sizeMap, onProgress);
        } else if (entry.isFile()) {
          const stats = await fs.promises.stat(fullPath);
          // Only files > 0 bytes
          if (stats.size > 0) {
            this.currentProgress.scannedFiles++;
            this.currentProgress.totalBytes += stats.size;

            if (!sizeMap.has(stats.size)) {
              sizeMap.set(stats.size, []);
            }
            sizeMap.get(stats.size)!.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              modifiedAt: stats.mtime.toISOString(),
            });
          }
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  }

  /**
   * Compute streaming SHA-256 hash to prevent reading full files into memory
   */
  private computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Helper to apply safe selection strategy.
   * STRICT SAFETY RULE: Every group MUST keep at least 1 file.
   */
  static applySelectionStrategy(
    groups: DuplicateGroup[],
    strategy: 'keep_newest' | 'keep_oldest' | 'keep_in_folder' | 'unselect_all',
    preferredFolder?: string
  ): DuplicateGroup[] {
    return groups.map((group) => {
      if (strategy === 'unselect_all') {
        return {
          ...group,
          files: group.files.map((f) => ({ ...f, selectedForDeletion: false })),
        };
      }

      const files = [...group.files];
      let keepIndex = 0;

      if (strategy === 'keep_newest') {
        // Find newest file to keep
        let newestTime = -Infinity;
        files.forEach((f, idx) => {
          const time = new Date(f.modifiedAt).getTime();
          if (time > newestTime) {
            newestTime = time;
            keepIndex = idx;
          }
        });
      } else if (strategy === 'keep_oldest') {
        // Find oldest file to keep
        let oldestTime = Infinity;
        files.forEach((f, idx) => {
          const time = new Date(f.modifiedAt).getTime();
          if (time < oldestTime) {
            oldestTime = time;
            keepIndex = idx;
          }
        });
      } else if (strategy === 'keep_in_folder' && preferredFolder) {
        // Find file residing inside preferredFolder to keep
        const normPref = path.normalize(preferredFolder).toLowerCase();
        const found = files.findIndex((f) => path.normalize(f.path).toLowerCase().startsWith(normPref));
        if (found !== -1) {
          keepIndex = found;
        }
      }

      return {
        ...group,
        files: files.map((f, idx) => ({
          ...f,
          // Only select other files, NEVER select the kept file
          selectedForDeletion: idx !== keepIndex,
        })),
      };
    });
  }
}
