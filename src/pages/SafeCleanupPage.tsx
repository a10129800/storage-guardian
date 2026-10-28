import React, { useEffect, useState } from 'react';
import { useAppState } from '../context/AppStateContext.tsx';
import { api } from '../services/api.ts';
import { CleanupCandidateItem, CleanupProgress, CleanupResult } from '../types/index.ts';
import { formatBytes } from '../utils/formatters.ts';
import { ConfirmDialog } from '../components/Common/ConfirmDialog.tsx';
import { CleanupProgressModal } from '../components/Common/CleanupProgressModal.tsx';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  SparklesIcon,
  TrashIcon,
} from '../components/Common/Icons.tsx';

export const SafeCleanupPage: React.FC = () => {
  const { setLastCleanupResult } = useAppState();

  const [isLoading, setIsLoading] = useState(false);
  const [candidates, setCandidates] = useState<CleanupCandidateItem[]>([]);
  const [filterRisk, setFilterRisk] = useState<'all' | 'safe' | 'moderate'>('all');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState<CleanupProgress | null>(null);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  const scanCandidates = async () => {
    setIsLoading(true);
    setLastResult(null);
    setExecuteError(null);
    try {
      const items = await api.scanSafeCleanCandidates();
      setCandidates(items);
    } catch (err: any) {
      console.error('Scan safe clean candidates failed:', err);
      setExecuteError(err?.message || '掃描清理候選項目失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    scanCandidates();
  }, []);

  const toggleSelect = (id: string) => {
    setCandidates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // STRICT SAFETY RULE: Select all safe items ONLY selects riskLevel === 'safe'
  const handleSelectAllSafe = () => {
    setCandidates((prev) =>
      prev.map((item) => ({
        ...item,
        selected: item.riskLevel === 'safe',
      }))
    );
  };

  const handleDeselectAll = () => {
    setCandidates((prev) =>
      prev.map((item) => ({
        ...item,
        selected: false,
      }))
    );
  };

  const selectedCandidates = candidates.filter((c) => c.selected);
  const selectedBytes = selectedCandidates.reduce((sum, c) => sum + c.estimatedBytes, 0);
  const selectedFileCount = selectedCandidates.reduce((sum, c) => sum + c.fileCount, 0);

  const handleExecute = async () => {
    if (selectedCandidates.length === 0 || isExecuting) return;
    setIsConfirmOpen(false);
    setIsProgressModalOpen(true);
    setIsExecuting(true);
    setExecuteError(null);
    setCleanupProgress(null);

    const unsubscribe = api.onCleanupProgress((p) => {
      setCleanupProgress(p);
    });

    try {
      const plan = {
        items: selectedCandidates.map((c) => ({
          id: c.id,
          path: c.path,
          estimatedBytes: c.estimatedBytes,
          toRecycleBin: true,
        })),
        totalFiles: selectedFileCount,
        totalEstimatedBytes: selectedBytes,
        method: 'recycle_bin' as const,
      };

      const result = await api.executeCleanup(plan);
      setLastResult(result);
      setLastCleanupResult(result);
    } catch (err: any) {
      console.error('Cleanup execution error:', err);
      setExecuteError(err?.message || '清理作業執行失敗或中斷');
    } finally {
      unsubscribe();
      setIsExecuting(false);
    }
  };

  const handleCancelCleanup = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await api.cancelCleanup();
    } catch (err) {
      console.error('Cancel cleanup failed:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCloseProgressModal = () => {
    setIsProgressModalOpen(false);
    scanCandidates();
  };

  const filteredCandidates = candidates.filter((c) => {
    if (filterRisk === 'all') return true;
    return c.riskLevel === filterRisk;
  });

  return (
    <div className="page-container">
      {/* Top Banner & Scan trigger */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <SparklesIcon size={20} />
            安全清理中心 (透明預覽與保護機制)
          </div>
          <button className="btn btn-secondary btn-sm" onClick={scanCandidates} disabled={isLoading}>
            <RefreshCwIcon size={14} />
            {isLoading ? '掃描中...' : '重新掃描項目'}
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          系統會自動識別本機使用者暫存資料夾 (%TEMP%)、程式當機傾印紀錄、縮圖快取與常見瀏覽器快取。本軟體恪守零隱蔽刪除原則，所有項目均須使用者明確審核並確認。
        </p>

        {/* Action Controls */}
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleSelectAllSafe}>
              全選安全項目 (低風險)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleDeselectAll}>
              取消全選
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '8px' }}>
              篩選風險：
            </span>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value as any)}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
              }}
            >
              <option value="all">全部類別</option>
              <option value="safe">僅顯示安全 (Safe)</option>
              <option value="moderate">僅顯示中度 (Moderate)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              已勾選 <strong>{selectedCandidates.length}</strong> 個類別 (預估釋放{' '}
              <strong style={{ color: 'var(--primary)' }}>{formatBytes(selectedBytes)}</strong>)
            </div>
            <button
              className="btn btn-danger"
              disabled={selectedCandidates.length === 0 || isLoading || isExecuting}
              onClick={() => setIsConfirmOpen(true)}
            >
              <TrashIcon size={16} />
              執行清理
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert Box if cleanup failed */}
      {executeError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ color: 'var(--danger)' }}>
            <AlertTriangleIcon size={20} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--danger)' }}>
              清理作業發生異常或已被安全中斷
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {executeError}
            </span>
          </div>
        </div>
      )}

      {/* Execution Result Alert Box if recently cleaned */}
      {lastResult && (
        <div
          style={{
            backgroundColor: 'var(--success-light)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--success)' }}>
              <CheckCircleIcon size={20} />
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              清理作業完成回報
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            成功處理項目：<strong>{lastResult.successCount}</strong> 個 | 略過項目：
            <strong>{lastResult.skippedCount}</strong> 個 | 失敗項目：<strong>{lastResult.failCount}</strong> 個 |
            實際確認釋放容量：
            <strong style={{ color: 'var(--success)', marginLeft: '4px' }}>
              {formatBytes(lastResult.actualFreedBytes)}
            </strong>
          </div>
        </div>
      )}

      {/* Candidate Items Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredCandidates.map((item) => {
          const isSelected = item.selected;
          return (
            <div
              key={item.id}
              className="card"
              style={{
                border: `1.5px solid ${isSelected ? 'var(--primary-border)' : 'var(--border-subtle)'}`,
                background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(item.id)}
                style={{ width: '18px', height: '18px', marginTop: '4px', cursor: 'pointer' }}
              />

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {item.categoryName}
                    </span>
                    <span className={`badge badge-${item.riskLevel}`}>
                      {item.riskLevel === 'safe'
                        ? '安全等級：高 (Safe)'
                        : item.riskLevel === 'moderate'
                        ? '建議審核 (Moderate)'
                        : '高度注意 (Caution)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {formatBytes(item.estimatedBytes)}
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {item.description}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                    fontSize: '0.78rem',
                    color: 'var(--text-dim)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    路徑：{item.path} ({item.fileCount} 個檔案)
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    建議操作：{item.recommendedAction}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="執行安全清理確認"
        itemCount={selectedFileCount}
        totalBytes={selectedBytes}
        method="優先移至 Windows 資源回收筒"
        impactWarning="執行前系統將逐一重新校驗檔案路徑與存在狀態。移至資源回收筒之檔案隨時可還原。若包含瀏覽器快取，下次開啟該瀏覽器網頁時資產將重新自伺服器下載。"
        confirmLabel="立即確認清理"
        onConfirm={handleExecute}
        onCancel={() => setIsConfirmOpen(false)}
        isProcessing={isExecuting}
      />

      {/* Real-time Cleanup Progress & Cancellation Modal */}
      <CleanupProgressModal
        isOpen={isProgressModalOpen}
        progress={cleanupProgress}
        result={lastResult}
        error={executeError}
        isExecuting={isExecuting}
        isCancelling={isCancelling}
        onCancel={handleCancelCleanup}
        onClose={handleCloseProgressModal}
      />
    </div>
  );
};
