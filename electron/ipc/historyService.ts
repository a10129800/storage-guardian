import fs from 'fs';
import path from 'path';
import os from 'os';
import { CleanupHistoryRecord, CleanupResult } from '../../src/types/index.ts';

export class HistoryService {
  private filePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const dir = path.join(appData, 'StorageGuardian');
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {
          // Fallback
        }
      }
      this.filePath = path.join(dir, 'cleanup_history.json');
    }
  }

  async getHistory(): Promise<CleanupHistoryRecord[]> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      const data = await fs.promises.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to read history log:', err);
      return [];
    }
  }

  async appendRecord(result: CleanupResult, originalBytes = 0): Promise<CleanupHistoryRecord> {
    const history = await this.getHistory();
    const record: CleanupHistoryRecord = {
      id: result.id || `record-${Date.now()}`,
      timestamp: result.timestamp || new Date().toISOString(),
      operationType: result.operationType as any,
      itemCount: result.totalProcessed,
      originalBytes: originalBytes || result.actualFreedBytes,
      freedBytes: result.actualFreedBytes,
      successCount: result.successCount,
      failCount: result.failCount,
      method: result.details.some((d) => d.movedToRecycleBin) ? '資源回收筒' : '安全刪除',
      details: result.details.map((d) => ({
        path: d.path,
        size: d.size,
        status: d.status,
        reason: d.reason,
      })),
    };

    history.unshift(record);
    // Keep max 500 records
    if (history.length > 500) {
      history.length = 500;
    }

    try {
      await fs.promises.writeFile(this.filePath, JSON.stringify(history, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to save history record:', err);
    }

    return record;
  }

  async clearHistory(): Promise<boolean> {
    try {
      if (fs.existsSync(this.filePath)) {
        await fs.promises.writeFile(this.filePath, JSON.stringify([]), 'utf-8');
      }
      return true;
    } catch {
      return false;
    }
  }

  async exportCsv(): Promise<string> {
    const records = await this.getHistory();
    const headers = ['紀錄ID', '操作時間', '操作類型', '處理項目數', '成功數', '失敗數', '釋放容量(位元組)', '清理方式'];
    const rows = records.map((r) => [
      `"${r.id}"`,
      `"${r.timestamp}"`,
      `"${r.operationType}"`,
      r.itemCount,
      r.successCount,
      r.failCount,
      r.freedBytes,
      `"${r.method}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    return '\ufeff' + csvContent; // Add BOM for Excel UTF-8 compatibility
  }
}
