import { shell } from 'electron';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';

const execFileAsync = util.promisify(execFile);

export async function moveToRecycleBin(targetPath: string): Promise<boolean> {
  if (!fs.existsSync(targetPath)) {
    throw new Error('檔案或資料夾不存在');
  }

  // 1. Try Electron native shell.trashItem
  if (shell && typeof shell.trashItem === 'function') {
    try {
      await shell.trashItem(targetPath);
      return true;
    } catch (err: any) {
      console.warn(`shell.trashItem failed for ${targetPath}:`, err.message);
    }
  }

  // 2. Windows PowerShell Recycle Bin fallback
  if (process.platform === 'win32') {
    try {
      const sanitized = targetPath.replace(/'/g, "''");
      const isDir = fs.statSync(targetPath).isDirectory();
      const psCode = isDir
        ? `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${sanitized}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
        : `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${sanitized}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;

      await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psCode], { timeout: 10000 });
      return true;
    } catch (psErr: any) {
      throw new Error(`無法將項目移至資源回收筒: ${psErr.message}`);
    }
  }

  // 3. Fallback for non-Windows testing: delete or throw
  throw new Error('當前環境不支援將項目移至資源回收筒');
}
