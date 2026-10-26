import React from 'react';
import { Sidebar } from './components/Layout/Sidebar.tsx';
import { Header } from './components/Layout/Header.tsx';
import { useAppState } from './context/AppStateContext.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { DiskAnalyzerPage } from './pages/DiskAnalyzerPage.tsx';
import { LargeFilesPage } from './pages/LargeFilesPage.tsx';
import { DuplicateFinderPage } from './pages/DuplicateFinderPage.tsx';
import { SafeCleanupPage } from './pages/SafeCleanupPage.tsx';
import { DevCleanerPage } from './pages/DevCleanerPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

export const AppContent: React.FC = () => {
  const { activePage } = useAppState();

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'analyzer':
        return <DiskAnalyzerPage />;
      case 'large_files':
        return <LargeFilesPage />;
      case 'duplicates':
        return <DuplicateFinderPage />;
      case 'safe_cleanup':
        return <SafeCleanupPage />;
      case 'dev_cleaner':
        return <DevCleanerPage />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  const isElectron = typeof window !== 'undefined' && !!window.storageGuardian;

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Header />
        {!isElectron && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              color: '#92400e',
              borderBottom: '1px solid #fde68a',
              padding: '8px 24px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              ℹ️ 目前處於純瀏覽器預覽模式（顯示範例數據）。真實磁碟掃描、SHA-256 雜湊與資源回收筒清理請執行 <code>dev.bat</code> 透過桌面視窗運行。
            </span>
          </div>
        )}
        {renderActivePage()}
      </main>
    </div>
  );
};
