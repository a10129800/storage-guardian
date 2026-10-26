import fs from 'fs';
import path from 'path';
import { DirectoryTreeNode, FileCategory, FileItem, ScanProgress } from '../../src/types/index.ts';
import { getFileCategory } from '../../src/utils/fileTypes.ts';
import { resolveWindowsPath } from '../../src/utils/security.ts';

export class ScannerService {
  private isCancelled = false;
  private currentProgress: ScanProgress = {
    phase: 'idle',
    currentPath: '',
    scannedFiles: 0,
    scannedDirs: 0,
    totalBytes: 0,
    errors: [],
  };
  private lastResult: DirectoryTreeNode | null = null;

  cancelScan(): void {
    this.isCancelled = true;
    this.currentProgress.phase = 'cancelled';
  }

  getProgress(): ScanProgress {
    return { ...this.currentProgress };
  }

  getLastResult(): DirectoryTreeNode | null {
    return this.lastResult;
  }

  async scanDirectory(
    targetPath: string,
    onProgress?: (progress: ScanProgress) => void,
    maxDepth = 10
  ): Promise<DirectoryTreeNode | null> {
    const resolvedPath = resolveWindowsPath(targetPath);
    this.isCancelled = false;
    this.currentProgress = {
      phase: 'indexing',
      currentPath: resolvedPath,
      scannedFiles: 0,
      scannedDirs: 0,
      totalBytes: 0,
      errors: [],
    };
    this.lastResult = null;

    // Immediately trigger initial progress so UI displays loading state instantly
    if (onProgress) {
      onProgress({ ...this.currentProgress });
    }

    const visitedRealPaths = new Set<string>();

    const rootNode = await this.scanNodeRecursive(
      resolvedPath,
      0,
      maxDepth,
      visitedRealPaths,
      onProgress
    );

    if (this.isCancelled) {
      this.currentProgress.phase = 'cancelled';
      if (onProgress) onProgress(this.currentProgress);
      return null;
    }

    this.currentProgress.phase = 'completed';
    if (onProgress) onProgress(this.currentProgress);
    this.lastResult = rootNode;
    return rootNode;
  }

  private async scanNodeRecursive(
    dirPath: string,
    depth: number,
    maxDepth: number,
    visitedRealPaths: Set<string>,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<DirectoryTreeNode> {
    const node: DirectoryTreeNode = {
      path: dirPath,
      name: path.basename(dirPath) || dirPath,
      size: 0,
      fileCount: 0,
      dirCount: 0,
      children: [],
      categoryBreakdown: {
        document: 0,
        image: 0,
        video: 0,
        audio: 0,
        archive: 0,
        installer: 0,
        model3d: 0,
        code: 0,
        ai_data: 0,
        other: 0,
      },
      largestFiles: [],
    };

    if (this.isCancelled) return node;

    // Track real path of directory to prevent cyclic symlinks/junction points
    try {
      const realDirPath = fs.realpathSync(dirPath).toLowerCase();
      if (visitedRealPaths.has(realDirPath)) {
        return node;
      }
      visitedRealPaths.add(realDirPath);
    } catch {
      // Inaccessible dir
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (err: any) {
      this.currentProgress.errors.push({
        path: dirPath,
        message: err.message || '無法讀取目錄內容 (存取被拒或目錄不存在)',
      });
      return node;
    }

    this.currentProgress.scannedDirs++;
    this.currentProgress.currentPath = dirPath;

    // Periodic progress throttle: update immediately for initial dirs, and every 5 dirs thereafter
    if (onProgress && (this.currentProgress.scannedDirs <= 5 || this.currentProgress.scannedDirs % 5 === 0)) {
      onProgress({ ...this.currentProgress });
      // Allow event loop tick
      await new Promise((resolve) => setImmediate(resolve));
    }

    const subNodes: DirectoryTreeNode[] = [];
    const directFiles: FileItem[] = [];

    for (const entry of entries) {
      if (this.isCancelled) break;

      const fullPath = path.join(dirPath, entry.name);

      try {
        const stats = await fs.promises.stat(fullPath);

        if (entry.isDirectory()) {
          node.dirCount++;
          if (depth < maxDepth) {
            const childNode = await this.scanNodeRecursive(
              fullPath,
              depth + 1,
              maxDepth,
              visitedRealPaths,
              onProgress
            );
            subNodes.push(childNode);
            node.size += childNode.size;
            node.fileCount += childNode.fileCount;
            node.dirCount += childNode.dirCount;

            // Merge category breakdown
            for (const catKey of Object.keys(childNode.categoryBreakdown) as FileCategory[]) {
              node.categoryBreakdown[catKey] += childNode.categoryBreakdown[catKey];
            }

            // Merge largest files
            this.mergeLargestFiles(node.largestFiles, childNode.largestFiles);
          }
        } else if (entry.isFile()) {
          node.fileCount++;
          const fileSize = stats.size;
          node.size += fileSize;
          this.currentProgress.scannedFiles++;
          this.currentProgress.totalBytes += fileSize;

          const category = getFileCategory(entry.name);
          node.categoryBreakdown[category] += fileSize;

          const fileItem: FileItem = {
            path: fullPath,
            name: entry.name,
            size: fileSize,
            extension: path.extname(entry.name).replace('.', '').toLowerCase(),
            category,
            modifiedAt: stats.mtime.toISOString(),
            isDirectory: false,
            parentPath: dirPath,
          };

          directFiles.push(fileItem);
          this.insertLargestFile(node.largestFiles, fileItem);
        }
      } catch (err: any) {
        // Skip unreadable files or permission errors without halting
        this.currentProgress.errors.push({
          path: fullPath,
          message: err.message || '無法存取檔案屬性',
        });
      }
    }

    // Sort sub-directories by size descending
    subNodes.sort((a, b) => b.size - a.size);
    node.children = subNodes;

    return node;
  }

  private insertLargestFile(list: FileItem[], item: FileItem, maxLimit = 25): void {
    list.push(item);
    list.sort((a, b) => b.size - a.size);
    if (list.length > maxLimit) {
      list.pop();
    }
  }

  private mergeLargestFiles(target: FileItem[], incoming: FileItem[], maxLimit = 25): void {
    target.push(...incoming);
    target.sort((a, b) => b.size - a.size);
    if (target.length > maxLimit) {
      target.length = maxLimit;
    }
  }

  /**
   * Search for large files matching minimum size filter.
   */
  async findLargeFiles(targetPath: string, minSizeBytes: number): Promise<FileItem[]> {
    const results: FileItem[] = [];
    const maxEntries = 500; // Guard against memory saturation

    const walk = async (currentDir: string) => {
      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        try {
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.promises.stat(fullPath);
            if (stats.size >= minSizeBytes) {
              results.push({
                path: fullPath,
                name: entry.name,
                size: stats.size,
                extension: path.extname(entry.name).replace('.', '').toLowerCase(),
                category: getFileCategory(entry.name),
                modifiedAt: stats.mtime.toISOString(),
                isDirectory: false,
                parentPath: currentDir,
              });

              if (results.length >= maxEntries) {
                return;
              }
            }
          }
        } catch {
          // Continue
        }
      }
    };

    await walk(targetPath);
    results.sort((a, b) => b.size - a.size);
    return results;
  }
}
