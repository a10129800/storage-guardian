import React from 'react';
import { PageId, useAppState } from '../../context/AppStateContext.tsx';
import {
  CodeIcon,
  CopyIcon,
  DashboardIcon,
  FileStackIcon,
  HardDriveIcon,
  HistoryIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
} from '../Common/Icons.tsx';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const { activePage, setActivePage, drives } = useAppState();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: '總覽儀表板', icon: <DashboardIcon size={18} /> },
    { id: 'analyzer', label: '磁碟分析', icon: <HardDriveIcon size={18} /> },
    { id: 'large_files', label: '大型檔案', icon: <FileStackIcon size={18} /> },
    { id: 'duplicates', label: '重複檔案', icon: <CopyIcon size={18} /> },
    { id: 'safe_cleanup', label: '安全清理', icon: <SparklesIcon size={18} /> },
    { id: 'dev_cleaner', label: '開發者清理', icon: <CodeIcon size={18} /> },
    { id: 'history', label: '清理紀錄', icon: <HistoryIcon size={18} /> },
    { id: 'settings', label: '設定與安全中心', icon: <SettingsIcon size={18} /> },
  ];

  const hasWarning = drives.some((d) => d.warning);

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div
        style={{
          padding: '24px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
          }}
        >
          <ShieldIcon size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
            Storage Guardian
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            電腦容量守護者
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-dim)' }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === 'dashboard' && hasWarning && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--danger)',
                  }}
                  title="有磁碟容量不足"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Health Status */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-hover)',
          margin: '0 12px 12px 12px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            系統狀態
          </span>
          <span className={`badge ${hasWarning ? 'badge-caution' : 'badge-safe'}`}>
            {hasWarning ? '磁碟緊縮' : '運作良好'}
          </span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          {drives.length} 個本機儲存磁碟已就緒
        </div>
      </div>
    </aside>
  );
};
