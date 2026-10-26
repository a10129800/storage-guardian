import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { CleanupHistoryRecord } from '../types/index.ts';
import { formatBytes, formatDate } from '../utils/formatters.ts';
import { ConfirmDialog } from '../components/Common/ConfirmDialog.tsx';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  HistoryIcon,
  RefreshCwIcon,
  TrashIcon,
} from '../components/Common/Icons.tsx';

export const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<CleanupHistoryRecord[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadHistory = async () => {
    try {
      const records = await api.getHistory();
      setHistory(records);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearHistory = async () => {
    await api.clearHistory();
    setHistory([]);
    setIsClearConfirmOpen(false);
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const csv = await api.exportHistoryCsv();
      // Browser download trigger
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `StorageGuardian_History_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredHistory = history.filter((r) => {
    if (filterType === 'all') return true;
    return r.operationType === filterType;
  });

  const totalFreedLifetime = history.reduce((s, r) => s + r.freedBytes, 0);

  return (
    <div className="page-container">
      {/* Overview Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <HistoryIcon size={20} />
            本機清理紀錄與容量審計日誌
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} disabled={isExporting || history.length === 0}>
              匯出 CSV 報表
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setIsClearConfirmOpen(true)}
              disabled={history.length === 0}
            >
              <TrashIcon size={14} />
              清除紀錄
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>累計執行次數</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {history.length} 次
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>實際累計釋放容量</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>
                {formatBytes(totalFreedLifetime)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>操作類別過濾：</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
              }}
            >
              <option value="all">全部操作</option>
              <option value="safe_cleanup">安全清理</option>
              <option value="large_file">大型檔案清理</option>
              <option value="duplicate_cleanup">重複檔案清理</option>
              <option value="dev_cleanup">開發者產物清理</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">詳細操作紀錄 ({filteredHistory.length})</div>
        </div>

        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
            尚無任何清理操作歷史紀錄。
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>執行時間</th>
                  <th>操作類型</th>
                  <th>處理項目</th>
                  <th>成功 / 失敗</th>
                  <th>實際釋放容量</th>
                  <th>清理方式</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record) => (
                  <tr key={record.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDate(record.timestamp)}
                    </td>
                    <td>
                      <span className="badge badge-safe">
                        {record.operationType === 'safe_cleanup'
                          ? '安全清理'
                          : record.operationType === 'large_file'
                          ? '大型檔案'
                          : record.operationType === 'duplicate_cleanup'
                          ? '重複檔案'
                          : '開發者產物'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {record.itemCount} 個項目
                    </td>
                    <td>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {record.successCount} 成功
                      </span>
                      {record.failCount > 0 && (
                        <span style={{ color: 'var(--danger)', marginLeft: '6px', fontWeight: 600 }}>
                          ({record.failCount} 失敗)
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatBytes(record.freedBytes)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {record.method}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog to clear logs */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        title="清除歷史審計紀錄確認"
        itemCount={history.length}
        totalBytes={0}
        method="僅清除本機記錄檔 (絕不會刪除磁碟上的任何實際檔案)"
        impactWarning="此操作只會清空操作紀錄日誌，不會影響或刪除任何實際磁碟檔案。清空後日誌將不可恢復。"
        confirmLabel="確認清空紀錄"
        onConfirm={handleClearHistory}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
