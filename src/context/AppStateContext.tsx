import React, { createContext, useContext, useEffect, useState } from 'react';
import { CleanupResult, DriveInfo } from '../types/index.ts';
import { api } from '../services/api.ts';

export type PageId =
  | 'dashboard'
  | 'analyzer'
  | 'large_files'
  | 'duplicates'
  | 'safe_cleanup'
  | 'dev_cleaner'
  | 'history'
  | 'settings';

interface AppStateContextType {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  drives: DriveInfo[];
  selectedDrive: DriveInfo | null;
  setSelectedDrive: (drive: DriveInfo | null) => void;
  targetScanFolder: string;
  setTargetScanFolder: (folder: string) => void;
  lastScanTime: string | null;
  setLastScanTime: (time: string | null) => void;
  lastCleanupResult: CleanupResult | null;
  setLastCleanupResult: (res: CleanupResult | null) => void;
  totalCleanedStats: number;
  refreshDrives: () => Promise<void>;
  chooseFolderDialog: () => Promise<string | null>;
  useSandboxFolder: () => Promise<string>;
  setupSandboxFolder: () => Promise<string>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<DriveInfo | null>(null);
  const [targetScanFolder, setTargetScanFolder] = useState<string>('');
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [lastCleanupResult, setLastCleanupResult] = useState<CleanupResult | null>(null);
  const [totalCleanedStats, setTotalCleanedStats] = useState<number>(0);

  const refreshDrives = async () => {
    try {
      const list = await api.getDrives();
      setDrives(list);
      if (list.length > 0 && !selectedDrive) {
        setSelectedDrive(list[0]);
        // Do NOT default targetScanFolder to root drive directly for safety
      }
    } catch (err) {
      console.error('Failed to query drives:', err);
    }
  };

  const chooseFolderDialog = async (): Promise<string | null> => {
    try {
      const chosen = await api.selectFolder();
      if (chosen) {
        setTargetScanFolder(chosen);
        return chosen;
      }
      return null;
    } catch (err) {
      console.error('Failed to select folder:', err);
      throw err;
    }
  };

  const useSandboxFolder = async (): Promise<string> => {
    try {
      const sandboxPath = await api.getSandboxPath();
      setTargetScanFolder(sandboxPath);
      return sandboxPath;
    } catch (err) {
      console.error('Failed to get sandbox path:', err);
      return '';
    }
  };

  const setupSandboxFolder = async (): Promise<string> => {
    try {
      const sandboxPath = await api.setupSandbox();
      setTargetScanFolder(sandboxPath);
      return sandboxPath;
    } catch (err) {
      console.error('Failed to setup sandbox:', err);
      return '';
    }
  };

  const initLifetimeCleaned = async () => {
    try {
      const records = await api.getHistory();
      const sum = records.reduce((acc, r) => acc + (r.freedBytes || 0), 0);
      setTotalCleanedStats(sum);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    refreshDrives();
    initLifetimeCleaned();
  }, []);

  // Update total cleaned stats when lastCleanupResult updates
  useEffect(() => {
    if (lastCleanupResult) {
      setTotalCleanedStats((prev) => prev + lastCleanupResult.actualFreedBytes);
    }
  }, [lastCleanupResult]);

  return (
    <AppStateContext.Provider
      value={{
        activePage,
        setActivePage,
        drives,
        selectedDrive,
        setSelectedDrive,
        targetScanFolder,
        setTargetScanFolder,
        lastScanTime,
        setLastScanTime,
        lastCleanupResult,
        setLastCleanupResult,
        totalCleanedStats,
        refreshDrives,
        chooseFolderDialog,
        useSandboxFolder,
        setupSandboxFolder,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
