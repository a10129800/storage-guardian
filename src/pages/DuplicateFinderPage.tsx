import React, { useEffect, useState } from 'react';
import { useAppState } from '../context/AppStateContext.tsx';
import { api } from '../services/api.ts';
import { CleanupProgress, CleanupResult, DuplicateGroup, ScanProgress } from '../types/index.ts';
import { formatBytes, formatDate } from '../utils/formatters.ts';
import { ConfirmDialog } from '../components/Common/ConfirmDialog.tsx';
import { CleanupProgressModal } from '../components/Common/CleanupProgressModal.tsx';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CopyIcon,
  ExternalLinkIcon,
  FolderIcon,
  RefreshCwIcon,
  TrashIcon,
} from '../components/Common/Icons.tsx';

export const DuplicateFinderPage: React.FC = () => {
  const {
    targetScanFolder,
    setTargetScanFolder,
    chooseFolderDialog,
    setLastCleanupResult,
    setupSandboxFolder,
  } = useAppState();

  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState<CleanupProgress | null>(null);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const unsubscribe = api.onDuplicateProgress((p) => {
      setProgress(p);
      if (p.phase === 'completed' || p.phase === 'cancelled') {
        setIsSearching(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleBrowseFolder = async () => {
    setErrorMessage(null);
    try {
      await chooseFolderDialog();
    } catch (err: any) {
      setErrorMessage(`無法開啟資料夾選擇視窗：${err.message || String(err)}`);
    }
  };

  const handleSetupSandbox = async () => {
    setErrorMessage(null);
    try {
      await setupSandboxFolder();
    } catch (err: any) {
      setErrorMessage(`建立測試沙箱失敗：${err.message || String(err)}`);
    }
  };

  const handleStartSearch = async () => {
    if (!targetScanFolder || targetScanFolder.trim() === '') {
      setErrorMessage('請先輸入或選擇目標路徑，或點擊「🧪 隔離測試沙箱」。');
      return;
    }
    setIsSearching(true);
    setErrorMessage(null);
    setGroups([]);
    try {
      const results = await api.findDuplicates(targetScanFolder);
      setGroups(results);
    } catch (err: any) {
      console.error('Duplicate search failed:', err);
      setErrorMessage(err.message || '搜尋重複檔案時發生錯誤，請確認路徑是否存在。');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelSearch = async () => {
    await api.cancelDuplicateScan();
    setIsSearching(false);
  };

  // Toggle selection for a specific file within a group
  // STRICT RULE: Cannot select all files in the group! At least one copy MUST be kept.
  const handleToggleFileSelection = (groupId: string, filePath: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;

        const updatedFiles = g.files.map((f) => {
          if (f.path === filePath) {
            return { ...f, selectedForDeletion: !f.selectedForDeletion };
          }
          return f;
        });

        // Check if all files in the group would be selected
        const allSelected = updatedFiles.every((f) => f.selectedForDeletion);
        if (allSelected) {
          // Deny selecting all files - keep at least the current one or first one!
          setErrorMessage('安全保護規則：每組重複檔案必須至少保留一份完整複本，不可將同組全部複本皆標記刪除！');
          return g;
        }

        return { ...g, files: updatedFiles };
      })
    );
  };

  // Selection strategies
  const applyStrategy = (strategy: 'keep_newest' | 'keep_oldest' | 'unselect_all') => {
    setGroups((prev) =>
      prev.map((group) => {
        if (strategy === 'unselect_all') {
          return {
            ...group,
            files: group.files.map((f) => ({ ...f, selectedForDeletion: false })),
          };
        }

        const files = [...group.files];
        let keepIdx = 0;

        if (strategy === 'keep_newest') {
          let maxTime = -Infinity;
          files.forEach((f, idx) => {
            const t = new Date(f.modifiedAt).getTime();
            if (t > maxTime) {
              maxTime = t;
              keepIdx = idx;
            }
          });
        } else if (strategy === 'keep_oldest') {
          let minTime = Infinity;
          files.forEach((f, idx) => {
            const t = new Date(f.modifiedAt).getTime();
            if (t < minTime) {
              minTime = t;
              keepIdx = idx;
            }
          });
        }

        return {
          ...group,
          files: files.map((f, idx) => ({
            ...f,
            selectedForDeletion: idx !== keepIdx, // Keep the chosen index, select others
          })),
        };
      })
    );
  };

  // Calculate selected stats
  const selectedFilesList = groups.flatMap((g) =>
    g.files.filter((f) => f.selectedForDeletion).map((f) => ({ path: f.path, size: g.size }))
  );
  const selectedBytes = selectedFilesList.reduce((s, f) => s + f.size, 0);
  const totalTheoretical = groups.reduce((s, g) => s + g.theoreticalReclaimableBytes, 0);

  const handleExecuteCleanup = async () => {
    if (selectedFilesList.length === 0 || isExecuting) return;

    // STRICT SAFETY CHECK: Ensure every affected group retains at least 1 unselected copy
    for (const g of groups) {
      const selectedInGroup = g.files.filter((f) => f.selectedForDeletion);
      if (selectedInGroup.length > 0 && selectedInGroup.length === g.files.length) {
        setErrorMessage('安全保護阻擋：每組重複檔案必須至少保留一份完整複本，絕不允許將整組檔案全數刪除！');
        setIsConfirmOpen(false);
        return;
      }
    }

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
        items: selectedFilesList.map((f) => ({
          id: f.path,
          path: f.path,
          estimatedBytes: f.size,
          toRecycleBin: true,
        })),
        totalFiles: selectedFilesList.length,
        totalEstimatedBytes: selectedBytes,
        method: 'recycle_bin' as const,
      };

      const result = await api.executeCleanup(plan);
      setLastResult(result);
      setLastCleanupResult(result);

      // Remove cleaned files from the current groups
      const deletedPaths = new Set(result.details.filter((d) => d.status === 'success').map((d) => d.path));
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            files: g.files.filter((f) => !deletedPaths.has(f.path)),
          }))
          .filter((g) => g.files.length > 1) // Keep only remaining duplicate sets
      );
    } catch (err: any) {
      console.error('Execution failed:', err);
      setExecuteError(err?.message || '重複檔案清理作業失敗');
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
  };

  return (
    <div className="page-container">
      {/* Search Input & Actions */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <CopyIcon size={20} />
            重複檔案精準比對 (SHA-256 雜湊)
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
            placeholder="選擇要檢索重複檔案的目標資料夾"
            disabled={isSearching}
          />
          <button className="btn btn-secondary" onClick={handleBrowseFolder} disabled={isSearching}>
            <FolderIcon size={16} />
            選擇路徑
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSetupSandbox}
            disabled={isSearching}
            title="一鍵建立並載入隔離測試沙箱 (%TEMP%\StorageGuardian-Sandbox)"
          >
            🧪 隔離測試沙箱
          </button>
          {isSearching ? (
            <button className="btn btn-danger" onClick={handleCancelSearch}>
              取消搜尋
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleStartSearch} disabled={!targetScanFolder}>
              <RefreshCwIcon size={16} />
              開始重複檔案搜尋
            </button>
          )}
        </div>

        {/* Scope and safety indicator */}
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            比對目標範圍：<strong style={{ color: targetScanFolder ? 'var(--text-main)' : 'var(--text-muted)' }}>{targetScanFolder || '尚未選擇目標路徑'}</strong>
          </span>
          <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>
            🛡️ 唯讀比對 (SHA-256 嚴格驗證，未點擊清理前絕不刪除)
          </span>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--danger, #ef4444)',
              color: 'var(--danger, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.875rem',
            }}
          >
            <AlertTriangleIcon size={18} />
            <span style={{ fontWeight: 500 }}>{errorMessage}</span>
          </div>
        )}

        {/* Real-time search progress */}
        {isSearching && progress && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              backgroundColor: 'var(--bg-hover)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>
                {progress.phase === 'hashing'
                  ? `正在計算候選檔案 SHA-256 雜湊內容 (${progress.percent || 0}%)...`
                  : '正在依檔案大小分組收集...'}
              </span>
              <span style={{ color: 'var(--primary)' }}>已檢核 {progress.scannedFiles} 檔案</span>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              目前檔案：{progress.currentPath}
            </div>
          </div>
        )}
      </div>

      {/* Strategy and Selection Control Bar */}
      {groups.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                安全快速選取輔助：
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => applyStrategy('keep_newest')}>
                優先保留最新
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => applyStrategy('keep_oldest')}>
                優先保留最舊
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => applyStrategy('unselect_all')}>
                全部取消選取
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                已選取 <strong style={{ color: 'var(--danger)' }}>{selectedFilesList.length}</strong> 個副本 (釋放容量{' '}
                <strong style={{ color: 'var(--primary)' }}>{formatBytes(selectedBytes)}</strong>)
              </div>
              <button
                className="btn btn-danger"
                disabled={selectedFilesList.length === 0 || isExecuting}
                onClick={() => setIsConfirmOpen(true)}
              >
                <TrashIcon size={16} />
                清理已勾選複本
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Notice */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          backgroundColor: 'var(--primary-light)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          fontSize: '0.82rem',
          color: 'var(--text-main)',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--primary)' }}>
          <CheckCircleIcon size={18} />
        </span>
        <span>
          <strong>安全保證機制：</strong>
          預設不自動勾選任何待刪檔案；每組重複檔案強制保留至少一份正本，系統絕不允許將整組檔案全數刪除。操作一律移至 Windows 資源回收筒。
        </span>
      </div>

      {/* Group List View */}
      {groups.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-dim)' }}
        >
          {isSearching ? '正在透過 SHA-256 嚴格比對中...' : '尚未搜尋或目前路徑無內容完全相同的重複檔案。'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groups.map((group, groupIdx) => (
            <div key={group.id} className="card" style={{ padding: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    群組 #{groupIdx + 1}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    檔案大小: {formatBytes(group.size)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    SHA-256: {group.hash.substring(0, 16)}...
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  重複數量：{group.files.length} 份 | 理論可回收容量：{formatBytes(group.theoreticalReclaimableBytes)}
                </span>
              </div>

              {/* Duplicate Copies List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.files.map((file, fileIdx) => {
                  const isMarked = file.selectedForDeletion;
                  return (
                    <div
                      key={file.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isMarked ? 'var(--danger-light)' : 'var(--bg-hover)',
                        border: `1px solid ${isMarked ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={isMarked}
                          onChange={() => handleToggleFileSelection(group.id, file.path)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {file.name}
                            </span>
                            {!isMarked && (
                              <span className="badge badge-safe" style={{ fontSize: '0.7rem' }}>
                                保留複本
                              </span>
                            )}
                            {isMarked && (
                              <span className="badge badge-caution" style={{ fontSize: '0.7rem' }}>
                                標記移至回收筒
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-dim)',
                              maxWidth: '550px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {file.path}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          修改於 {formatDate(file.modifiedAt)}
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => api.openPathInExplorer(file.path)}
                          title="在檔案總管中顯示"
                        >
                          <ExternalLinkIcon size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="重複檔案清理確認"
        itemCount={selectedFilesList.length}
        totalBytes={selectedBytes}
        method="移至 Windows 資源回收筒 (保留每組至少 1 份完整複本)"
        impactWarning="執行前系統會再次驗證檔案存在狀態與內容一致性。所選複本將移至資源回收筒，若有誤刪可於回收筒隨時還原。"
        confirmLabel="確認清理所選複本"
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
