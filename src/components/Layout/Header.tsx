import React from 'react';
import { useAppState } from '../../context/AppStateContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { MoonIcon, RefreshCwIcon, SettingsIcon, SunIcon } from '../Common/Icons.tsx';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: '總覽儀表板', subtitle: '即時掌握本機所有磁碟的容量健康度與安全狀態' },
  analyzer: { title: '磁碟分析器', subtitle: '深入遞迴掃描目錄結構，視覺化掌握佔用大量空間的資料夾' },
  large_files: { title: '大型檔案管理器', subtitle: '快速定位數百 MB 以上的龐大檔案，審核並安全整理' },
  duplicates: { title: '重複檔案搜尋器', subtitle: '兩階段嚴格 SHA-256 內容比對，確保至少保留一份' },
  safe_cleanup: { title: '安全清理中心', subtitle: '透明預覽可釋放的系統與應用程式暫存，零誤刪安全確認' },
  dev_cleaner: { title: '開發者容量管理', subtitle: '安全審查專案內的 node_modules、dist 與快取目錄' },
  history: { title: '清理紀錄與容量審計', subtitle: '完整保存所有清理歷史紀錄與容量釋放數據，支援 CSV 匯出' },
  settings: { title: '設定與安全中心', subtitle: '偏好設定、掃描排除清單、容量警告門檻與本機隱私準則' },
};

export const Header: React.FC = () => {
  const { activePage, setActivePage, refreshDrives } = useAppState();
  const { theme, toggleTheme } = useTheme();

  const meta = PAGE_TITLES[activePage] || { title: 'Storage Guardian', subtitle: '' };

  return (
    <header
      style={{
        height: '70px',
        padding: '0 32px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
          {meta.title}
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {meta.subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => refreshDrives()}
          title="重新整理磁碟資訊"
        >
          <RefreshCwIcon size={14} />
          重新整理
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={toggleTheme}
          title={theme === 'light' ? '切換為深色模式' : '切換為淺色模式'}
          style={{ width: '36px', padding: 0 }}
        >
          {theme === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setActivePage('settings')}
          title="開啟設定"
          style={{ width: '36px', padding: 0 }}
        >
          <SettingsIcon size={16} />
        </button>
      </div>
    </header>
  );
};
