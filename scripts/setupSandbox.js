/**
 * Storage Guardian - Test Sandbox Generator
 * Generates an isolated, safe, reproducible test environment in %TEMP%\StorageGuardian-Sandbox.
 * NEVER modifies or touches any files outside this folder.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export const SANDBOX_DIR = path.join(os.tmpdir(), 'StorageGuardian-Sandbox');

export async function createSandboxFiles(targetDir = SANDBOX_DIR) {
  // Ensure target folder exists and is clean
  if (fs.existsSync(targetDir)) {
    await fs.promises.rm(targetDir, { recursive: true, force: true });
  }
  await fs.promises.mkdir(targetDir, { recursive: true });

  const dupDir = path.join(targetDir, 'duplicates');
  await fs.promises.mkdir(dupDir, { recursive: true });

  // 1. Small text file (approx 150 bytes)
  const smallTextContent = 'Storage Guardian - Readonly Scan Test Sandbox File.\nThis is a small known-size text file for metadata and sizing verification.\n';
  const smallFilePath = path.join(targetDir, 'readme_small.txt');
  await fs.promises.writeFile(smallFilePath, smallTextContent, 'utf-8');

  // 2. Large test file (2 MB = 2,097,152 bytes)
  const largeFileSize = 2 * 1024 * 1024;
  const largeBuffer = Buffer.alloc(largeFileSize, 0x5a); // Filled with 'Z'
  const largeFilePath = path.join(targetDir, 'large_payload_2mb.bin');
  await fs.promises.writeFile(largeFilePath, largeBuffer);

  // 3. Two identical files with different names for duplicate scan verification (64 KB each)
  const dupContent = Buffer.alloc(64 * 1024, 0x47); // Filled with 'G'
  const dupFileA = path.join(dupDir, 'original_sample.dat');
  const dupFileB = path.join(dupDir, 'copied_sample_renamed.dat');
  await fs.promises.writeFile(dupFileA, dupContent);
  await fs.promises.writeFile(dupFileB, dupContent);

  // 4. One unique file with different content to verify false-positive immunity (64 KB)
  const uniqueContent = Buffer.alloc(64 * 1024, 0x58); // Filled with 'X'
  const uniqueFilePath = path.join(targetDir, 'unique_sample.dat');
  await fs.promises.writeFile(uniqueFilePath, uniqueContent);

  const hashFile = async (p) => {
    const data = await fs.promises.readFile(p);
    return crypto.createHash('sha256').update(data).digest('hex');
  };

  const fileStats = [
    {
      name: 'readme_small.txt',
      relPath: 'readme_small.txt',
      path: smallFilePath,
      size: (await fs.promises.stat(smallFilePath)).size,
      sha256: await hashFile(smallFilePath),
      description: '小型文字檔 (驗證基本檔案大小與屬性統計)',
    },
    {
      name: 'large_payload_2mb.bin',
      relPath: 'large_payload_2mb.bin',
      path: largeFilePath,
      size: (await fs.promises.stat(largeFilePath)).size,
      sha256: await hashFile(largeFilePath),
      description: '大型測試檔 (2 MB，供大型檔案篩選測試)',
    },
    {
      name: 'original_sample.dat',
      relPath: 'duplicates/original_sample.dat',
      path: dupFileA,
      size: (await fs.promises.stat(dupFileA)).size,
      sha256: await hashFile(dupFileA),
      description: '重複檔案測試正本 A (64 KB)',
    },
    {
      name: 'copied_sample_renamed.dat',
      relPath: 'duplicates/copied_sample_renamed.dat',
      path: dupFileB,
      size: (await fs.promises.stat(dupFileB)).size,
      sha256: await hashFile(dupFileB),
      description: '重複檔案測試複本 B (64 KB，與 A 內容完全一致，檔名不同)',
    },
    {
      name: 'unique_sample.dat',
      relPath: 'unique_sample.dat',
      path: uniqueFilePath,
      size: (await fs.promises.stat(uniqueFilePath)).size,
      sha256: await hashFile(uniqueFilePath),
      description: '非重複檔案 (64 KB，內容不同，確認不被誤判為重複)',
    },
  ];

  return {
    sandboxDir: targetDir,
    files: fileStats,
  };
}

// Direct execution CLI support
if (process.argv[1] && process.argv[1].endsWith('setupSandbox.js')) {
  createSandboxFiles()
    .then((result) => {
      console.log('====================================================');
      console.log('Storage Guardian | 隔離測試沙箱建立完成');
      console.log('====================================================');
      console.log(`\n測試資料夾路徑: ${result.sandboxDir}\n`);
      console.log('建立檔案清單:');
      for (const item of result.files) {
        console.log(`- [${item.size} 位元組] ${item.relPath}`);
        console.log(`  說明: ${item.description}`);
        console.log(`  SHA-256: ${item.sha256.substring(0, 16)}...`);
      }
      console.log('\n[提示] 此資料夾完全獨立，所有掃描均為唯讀操作，測試完成後可安全重複建置。');
    })
    .catch((err) => {
      console.error('[錯誤] 建立測試沙箱失敗:', err);
      process.exit(1);
    });
}
