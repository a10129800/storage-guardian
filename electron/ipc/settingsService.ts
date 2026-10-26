import fs from 'fs';
import path from 'path';
import os from 'os';
import { AppSettings } from '../../src/types/index.ts';

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh-TW',
  theme: 'light',
  excludePaths: [
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\$Recycle.Bin',
    'C:\\System Volume Information',
  ],
  largeFileThresholdBytes: 524288000, // 500 MB
  enableSha256InScan: true,
  maxConcurrency: 4,
  lowDiskThresholdPercent: 85,
  defaultCleanMethod: 'recycle_bin',
  historyRetentionDays: 90,
  version: '1.0.0',
};

export class SettingsService {
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
      this.filePath = path.join(dir, 'settings.json');
    }
  }

  async getSettings(): Promise<AppSettings> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { ...DEFAULT_SETTINGS };
      }
      const data = await fs.promises.readFile(this.filePath, 'utf-8');
      const loaded = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...loaded };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(updated: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const merged: AppSettings = {
      ...current,
      ...updated,
    };

    try {
      await fs.promises.writeFile(this.filePath, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to save settings:', err);
    }

    return merged;
  }
}
