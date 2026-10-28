import * as electronPkg from 'electron';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';

const shell: any = (electronPkg as any)?.shell || (typeof (electronPkg as any)?.default === 'object' ? (electronPkg as any).default?.shell : null);

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
      // STRICT BEHAVIOR: In Electron, do not fall back to PowerShell with modal UI dialogs,
      // as that would trigger blocking Windows error dialogs. Throw directly so caller handles it safely.
      throw new Error(`無法將項目移至資源回收筒: ${err.message || '存取被拒或檔案使用中'}`);
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
