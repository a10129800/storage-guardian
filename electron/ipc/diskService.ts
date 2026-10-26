import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import { DriveInfo } from '../../src/types/index.ts';

const execFileAsync = util.promisify(execFile);

export class DiskService {
  async getDrives(lowDiskThreshold = 85): Promise<DriveInfo[]> {
    if (process.platform === 'win32') {
      try {
        const psCommand = `Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace, DriveType | ConvertTo-Json -Compress`;
        const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psCommand], {
          timeout: 5000,
        });

        if (stdout && stdout.trim()) {
          const raw = JSON.parse(stdout.trim());
          const disks = Array.isArray(raw) ? raw : [raw];
          
          return disks
            .filter((d) => d && d.DeviceID && d.DriveType === 3) // DriveType 3 = Local Fixed Disk
            .map((d, index) => {
              const totalBytes = Number(d.Size) || 0;
              const freeBytes = Number(d.FreeSpace) || 0;
              const usedBytes = Math.max(0, totalBytes - freeBytes);
              const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
              const mountPoint = String(d.DeviceID).toUpperCase();
              const isSystem = mountPoint.startsWith('C:');

              return {
                id: `drive-${mountPoint.replace(':', '')}-${index}`,
                mountPoint,
                label: d.VolumeName ? String(d.VolumeName).trim() : (isSystem ? '系統磁碟' : '本機磁碟'),
                fileSystem: d.FileSystem ? String(d.FileSystem).trim() : 'NTFS',
                totalBytes,
                freeBytes,
                usedBytes,
                usagePercent,
                isSystem,
                isReady: totalBytes > 0,
                warning: usagePercent >= lowDiskThreshold,
              };
            });
        }
      } catch (err) {
        console.warn('Failed to query drives via PowerShell CIM, falling back to fs detection:', err);
      }
    }

    // Fallback: check available drive letters on Windows using real fs.statfs
    const drives: DriveInfo[] = [];
    const candidateLetters = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'Z:'];
    
    for (let i = 0; i < candidateLetters.length; i++) {
      const letter = candidateLetters[i];
      const driveRoot = `${letter}\\`;
      try {
        if (fs.existsSync(driveRoot)) {
          let totalBytes = 0;
          let freeBytes = 0;
          let isReady = false;

          // In Node.js 18.15+, fs.statfs provides real filesystem block and byte statistics
          if (typeof fs.statfsSync === 'function') {
            try {
              const stat = fs.statfsSync(driveRoot);
              totalBytes = stat.blocks * stat.bsize;
              freeBytes = stat.bavail * stat.bsize;
              isReady = totalBytes > 0;
            } catch {
              // Could not query filesystem stats for this drive
            }
          }

          const usedBytes = Math.max(0, totalBytes - freeBytes);
          const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
          const isSystem = letter === 'C:';

          drives.push({
            id: `drive-${letter.replace(':', '')}-${i}`,
            mountPoint: letter,
            label: isSystem ? '系統磁碟 (C:)' : `本機磁碟 (${letter})`,
            fileSystem: 'NTFS',
            totalBytes,
            freeBytes,
            usedBytes,
            usagePercent,
            isSystem,
            isReady,
            warning: isReady && usagePercent >= lowDiskThreshold,
          });
        }
      } catch {
        // Drive not mounted or inaccessible
      }
    }

    return drives;
  }
}

