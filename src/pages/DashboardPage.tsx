import React from 'react';
import { useAppState } from '../context/AppStateContext.tsx';
import { StatCard } from '../components/Common/StatCard.tsx';
import { ProgressBar } from '../components/Common/ProgressBar.tsx';
import {
  AlertTriangleIcon,
  CodeIcon,
  CopyIcon,
  FileStackIcon,
  FolderIcon,
  HardDriveIcon,
  HistoryIcon,
  SparklesIcon,
} from '../components/Common/Icons.tsx';
import { formatBytes, formatDate } from '../utils/formatters.ts';

export const DashboardPage: React.FC = () => {
  const {
    drives,
    selectedDrive,
    setSelectedDrive,
    setTargetScanFolder,
    setActivePage,
    lastScanTime,
    lastCleanupResult,
    totalCleanedStats,
  } = useAppState();

  const totalCapacity = drives.reduce((acc, d) => acc + d.totalBytes, 0);
  const totalFree = drives.reduce((acc, d) => acc + d.freeBytes, 0);
  const totalUsed = drives.reduce((acc, d) => acc + d.usedBytes, 0);
  const overallPercent = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
  const hasLowSpaceWarning = drives.some((d) => d.warning);

  return (
    <div className="page-container">
      {/* Low Disk Space Alert Banner if applicable */}
      {hasLowSpaceWarning && (
        <div
          style={{
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div style={{ color: 'var(--danger)' }}>
            <AlertTriangleIcon size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              偵測到部分磁碟空間低於安全門檻 (高於 85% 使用率)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              建議立即執行「安全清理」釋放臨時快取，或使用「大型檔案管理器」與「重複檔案搜尋器」整理空間。
            </div>
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => setActivePage('safe_cleanup')}
          >
            立即安全清理
          </button>
        </div>
      )}

      {/* Top Stat Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          title="電腦總儲存容量"
          value={formatBytes(totalCapacity)}
          subtitle={`已使用 ${formatBytes(totalUsed)} (${overallPercent.toFixed(1)}%)`}
          icon={<HardDriveIcon size={22} />}
        />
        <StatCard
          title="剩餘可用空間"
          value={formatBytes(totalFree)}
          subtitle={`${drives.length} 個磁碟已連線`}
          badge={hasLowSpaceWarning ? '需清理' : '充裕'}
          badgeColor={hasLowSpaceWarning ? 'caution' : 'safe'}
        />
        <StatCard
          title="累計確認釋放容量"
          value={formatBytes(totalCleanedStats)}
          subtitle={lastCleanupResult ? `最近一次: ${formatBytes(lastCleanupResult.actualFreedBytes)}` : '尚無近期清理記錄'}
          icon={<SparklesIcon size={22} />}
          badge="真實磁碟統計"
          badgeColor="safe"
        />
        <StatCard
          title="上次掃描狀態"
          value={lastScanTime ? formatDate(lastScanTime) : '尚未進行掃描'}
          subtitle="即時本機分析保護"
          icon={<HistoryIcon size={22} />}
        />
      </div>

      {/* Drives Grid */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <HardDriveIcon size={20} />
            本機磁碟容量即時監控
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            點選磁碟即可進入深入分析
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {drives.map((drive) => {
            const isSelected = selectedDrive?.id === drive.id;
            return (
              <div
                key={drive.id}
                style={{
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => {
                  setSelectedDrive(drive);
                  setTargetScanFolder(drive.mountPoint + '\\');
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {drive.mountPoint}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {drive.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      檔案系統: {drive.fileSystem} {drive.isSystem ? '• 系統分區' : ''}
                    </div>
                  </div>
                  <span className={`badge ${drive.warning ? 'badge-caution' : 'badge-safe'}`}>
                    {drive.usagePercent.toFixed(1)}%
                  </span>
                </div>

                <ProgressBar percent={drive.usagePercent} height={10} warningThreshold={85} />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>已用: {formatBytes(drive.usedBytes)}</span>
                  <span>可用: {formatBytes(drive.freeBytes)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <SparklesIcon size={20} />
            快速功能入口
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            依照需求選擇空間釋放工具
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <button
            className="btn btn-secondary"
            style={{ height: '80px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
            onClick={() => setActivePage('analyzer')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700 }}>
              <FolderIcon size={18} />
              磁碟空間分析
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              遞迴樹狀結構與類型分佈
            </span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ height: '80px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
            onClick={() => setActivePage('large_files')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700 }}>
              <FileStackIcon size={18} />
              大型檔案管理
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              篩選 500MB+ 巨型檔案
            </span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ height: '80px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
            onClick={() => setActivePage('duplicates')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', fontWeight: 700 }}>
              <CopyIcon size={18} />
              重複檔案搜尋
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              精準 SHA-256 比對
            </span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ height: '80px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
            onClick={() => setActivePage('safe_cleanup')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 700 }}>
              <SparklesIcon size={18} />
              安全清理中心
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              暫存檔、傾印日誌與快取
            </span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ height: '80px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
            onClick={() => setActivePage('dev_cleaner')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4', fontWeight: 700 }}>
              <CodeIcon size={18} />
              開發者清理
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              node_modules 及建置快取
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
