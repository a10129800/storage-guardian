import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext.tsx';
import { api } from '../services/api.ts';
import { CleanupProgress, CleanupResult, DevProjectCandidate } from '../types/index.ts';
import { formatBytes, formatDate } from '../utils/formatters.ts';
import { ConfirmDialog } from '../components/Common/ConfirmDialog.tsx';
import { CleanupProgressModal } from '../components/Common/CleanupProgressModal.tsx';
import {
  AlertTriangleIcon,
  CodeIcon,
  ExternalLinkIcon,
  FolderIcon,
  RefreshCwIcon,
  TrashIcon,
} from '../components/Common/Icons.tsx';

export const DevCleanerPage: React.FC = () => {
  const { targetScanFolder, setTargetScanFolder, chooseFolderDialog, setLastCleanupResult } = useAppState();

  const [isLoading, setIsLoading] = useState(false);
  const [candidates, setCandidates] = useState<DevProjectCandidate[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState<CleanupProgress | null>(null);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  const handleScanProjects = async () => {
    if (!targetScanFolder) return;
    setIsLoading(true);
    setCandidates([]);
    try {
      const results = await api.scanDevProjects(targetScanFolder);
      setCandidates(results);
    } catch (err) {
      console.error('Scan dev projects failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectOnlyDependencies = () => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: c.targetType === 'node_modules' || c.targetType === '.vite' || c.targetType === 'coverage',
      }))
    );
  };

  const deselectAll = () => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: false,
      }))
    );
  };

  const selectedCandidates = candidates.filter((c) => c.selected);
  const selectedBytes = selectedCandidates.reduce((s, c) => s + c.size, 0);

  const handleExecuteCleanup = async () => {
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
      const result = await api.cleanDevCandidates(selectedCandidates);
      setLastResult(result);
      setLastCleanupResult(result);
    } catch (err: any) {
      console.error('Clean dev candidates error:', err);
      setExecuteError(err?.message || '專案快取清理作業失敗');
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
    handleScanProjects();
  };

  return (
    <div className="page-container">
      {/* Target Developer Workspace Directory Picker */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <CodeIcon size={20} />
            開發者專案目錄空間管理
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
            value={targetScanFolder}
            onChange={(e) => setTargetScanFolder(e.target.value)}
            placeholder="請選擇您的開發者工作區或專案資料夾 (例如 F:\IDE 或 C:\Users\YourName\Projects)"
            disabled={isLoading}
          />
          <button className="btn btn-secondary" onClick={chooseFolderDialog} disabled={isLoading}>
            <FolderIcon size={16} />
            選擇工作區
          </button>
          <button className="btn btn-primary" onClick={handleScanProjects} disabled={isLoading || !targetScanFolder}>
            <RefreshCwIcon size={16} />
            {isLoading ? '掃描專案中...' : '掃描開發產物'}
          </button>
        </div>

        {/* Selection controls */}
        {candidates.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={selectOnlyDependencies}>
                僅選取 node_modules 與快取
              </button>
              <button className="btn btn-secondary btn-sm" onClick={deselectAll}>
                全部取消選取
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                已選取 <strong>{selectedCandidates.length}</strong> 個專案目錄 (預估釋放{' '}
                <strong style={{ color: 'var(--primary)' }}>{formatBytes(selectedBytes)}</strong>)
              </span>
              <button
                className="btn btn-danger"
                disabled={selectedCandidates.length === 0 || isExecuting}
                onClick={() => setIsConfirmOpen(true)}
              >
                <TrashIcon size={16} />
                清理已勾選產物
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Safety Rules Banner */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          backgroundColor: 'var(--bg-hover)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          fontSize: '0.82rem',
          color: 'var(--text-main)',
          lineHeight: 1.5,
        }}
      >
        <div style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>
          <CodeIcon size={18} />
        </div>
        <div>
          <strong>開發者安全保護守則：</strong>
          本功能僅專注於識別 node_modules、.next、.turbo、dist 與建置輸出快取。
          <strong>絕對不會刪除</strong> package.json、package-lock.json、原始程式碼、設定檔或資料庫資料。清理 node_modules 後可隨時透過 <code>npm install</code> 重新還原依賴。
        </div>
      </div>

      {/* Candidates List */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">專案依賴與建置產物清單 ({candidates.length})</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            總計空間：{formatBytes(candidates.reduce((s, c) => s + c.size, 0))}
          </span>
        </div>

        {candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
            {isLoading ? '正在遍歷專案目錄...' : '未發現可清理的開發產物，請確認所選路徑是否為專案目錄。'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>選取</th>
                  <th>專案名稱</th>
                  <th>產物類型</th>
                  <th>佔用容量</th>
                  <th>檔案數</th>
                  <th>最後變動</th>
                  <th>路徑</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={candidate.selected}
                        onChange={() => toggleSelect(candidate.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {candidate.projectName}
                    </td>
                    <td>
                      <span
                        className={`badge ${candidate.isDangerous ? 'badge-caution' : 'badge-safe'}`}
                      >
                        {candidate.targetType}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatBytes(candidate.size)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {candidate.fileCount.toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {formatDate(candidate.lastModified)}
                    </td>
                    <td>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-dim)',
                          fontFamily: 'var(--font-mono)',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {candidate.targetDir}
                      </div>
                      {candidate.warningMessage && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--warning)', marginTop: '2px' }}>
                          ⚠️ {candidate.warningMessage}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => api.openPathInExplorer(candidate.targetDir)}
                        title="在檔案總管中顯示"
                      >
                        <ExternalLinkIcon size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="開發者目錄清理確認"
        itemCount={selectedCandidates.length}
        totalBytes={selectedBytes}
        method="移至 Windows 資源回收筒 (可隨時從回收筒還原)"
        impactWarning="已選取項目將移至 Windows 資源回收筒。若為 node_modules 目錄，下次執行專案前請先執行 npm install 重新下載套件。"
        confirmLabel="確認清理所選目錄"
        onConfirm={handleExecuteCleanup}
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
