import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext.tsx';
import { api } from '../services/api.ts';
import { FileItem } from '../types/index.ts';
import { formatBytes, formatDate } from '../utils/formatters.ts';
import { ConfirmDialog } from '../components/Common/ConfirmDialog.tsx';
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  FileStackIcon,
  FolderIcon,
  RefreshCwIcon,
  SearchIcon,
  TrashIcon,
} from '../components/Common/Icons.tsx';

const SIZE_PRESETS = [
  { label: '1 MB+ (測試)', bytes: 1 * 1024 * 1024 },
  { label: '100 MB+', bytes: 100 * 1024 * 1024 },
  { label: '500 MB+', bytes: 500 * 1024 * 1024 },
  { label: '1 GB+', bytes: 1024 * 1024 * 1024 },
  { label: '5 GB+', bytes: 5 * 1024 * 1024 * 1024 },
];

export const LargeFilesPage: React.FC = () => {
  const {
    targetScanFolder,
    setTargetScanFolder,
    chooseFolderDialog,
    setLastCleanupResult,
    setupSandboxFolder,
  } = useAppState();

  const [minSize, setMinSize] = useState<number>(500 * 1024 * 1024);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'size' | 'date' | 'name'>('size');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Confirmation state for deleting single/multiple files
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBrowseFolder = async () => {
    setErrorMessage(null);
    try {
      await chooseFolderDialog();
    } catch (err: any) {
      setErrorMessage(`無法開啟資料夾選擇視窗：${err.message || String(err)}`);
    }
  };

  const handleSearch = async () => {
    if (!targetScanFolder || targetScanFolder.trim() === '') {
      setErrorMessage('請先選擇要檢索的目標路徑，或點擊「🧪 隔離測試沙箱」。');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const results = await api.findLargeFiles(targetScanFolder, minSize);
      setFiles(results);
    } catch (err: any) {
      console.error('Failed to find large files:', err);
      setErrorMessage(err.message || '檢索大型檔案時發生錯誤，請確認路徑是否存在。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupSandbox = async () => {
    setErrorMessage(null);
    try {
      await setupSandboxFolder();
      setMinSize(1 * 1024 * 1024);
    } catch (err: any) {
      setErrorMessage(`建立測試沙箱失敗：${err.message || String(err)}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.executeCleanup({
        items: [
          {
            id: fileToDelete.path,
            path: fileToDelete.path,
            estimatedBytes: fileToDelete.size,
            toRecycleBin: true,
          },
        ],
        totalFiles: 1,
        totalEstimatedBytes: fileToDelete.size,
        method: 'recycle_bin',
      });
      setLastCleanupResult(res);
      setFiles((prev) => prev.filter((f) => f.path !== fileToDelete.path));
      setFileToDelete(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredFiles = files
    .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'size') return b.size - a.size;
      if (sortBy === 'date') return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="page-container">
      {/* Search & Filter Bar */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileStackIcon size={20} />
            大型檔案檢索條件
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Path picker */}
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
              placeholder="選擇要檢索大型檔案的資料夾路徑"
              disabled={isLoading}
            />
            <button className="btn btn-secondary" onClick={handleBrowseFolder} disabled={isLoading}>
              <FolderIcon size={16} />
              選擇路徑
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleSetupSandbox}
              disabled={isLoading}
              title="一鍵建立並載入隔離測試沙箱 (%TEMP%\StorageGuardian-Sandbox)，並切換門檻為 1 MB+"
            >
              🧪 隔離測試沙箱
            </button>
            <button className="btn btn-primary" onClick={handleSearch} disabled={isLoading || !targetScanFolder}>
              <RefreshCwIcon size={16} />
              {isLoading ? '搜尋中...' : '開始搜尋大型檔案'}
            </button>
          </div>

          {/* Scope and safety indicator */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              檢索範圍：<strong style={{ color: targetScanFolder ? 'var(--text-main)' : 'var(--text-muted)' }}>{targetScanFolder || '尚未選擇目標路徑'}</strong>
            </span>
            <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>
              🛡️ 唯讀檢索 (點擊清理前絕不異動檔案)
            </span>
          </div>

          {/* Error alert */}
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--danger, #ef4444)',
                color: 'var(--danger, #ef4444)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangleIcon size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Size threshold presets & sorting */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                最低檔案大小門檻：
              </span>
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className={`btn btn-sm ${minSize === preset.bytes ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMinSize(preset.bytes)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="過濾檔名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              >
                <option value="size">依大小排序 (大到小)</option>
                <option value="date">依修改時間 (新到舊)</option>
                <option value="name">依檔案名稱</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          backgroundColor: 'var(--warning-light)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          fontSize: '0.82rem',
          color: 'var(--text-main)',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--warning)' }}>
          <AlertTriangleIcon size={18} />
        </span>
        <span>
          <strong>安全準則提醒：</strong>不得僅因檔案巨大或許久未修改就自動判定可刪除。刪除前請確認檔案性質，操作一律優先移至資源回收筒。
        </span>
      </div>

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">搜尋結果清單 ({filteredFiles.length} 個大型檔案)</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            合計空間：{formatBytes(filteredFiles.reduce((s, f) => s + f.size, 0))}
          </span>
        </div>

        {filteredFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
            {isLoading ? '正在遍歷檔案系統...' : '查無符合條件的大型檔案，請調整篩選門檻或路徑後重試。'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>檔案名稱</th>
                  <th>類型</th>
                  <th>容量大小</th>
                  <th>修改日期</th>
                  <th>動作</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.path}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{file.name}</div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-dim)',
                          maxWidth: '380px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.path}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-safe">
                        {file.extension.toUpperCase() || 'FILE'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatBytes(file.size)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDate(file.modifiedAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => api.openPathInExplorer(file.path)}
                          title="在檔案總管中顯示"
                        >
                          <ExternalLinkIcon size={14} />
                          檔案總管
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setFileToDelete(file)}
                          title="移至資源回收筒"
                        >
                          <TrashIcon size={14} />
                          回收清理
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safe Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!fileToDelete}
        title="大型檔案回收確認"
        itemCount={1}
        totalBytes={fileToDelete?.size || 0}
        method="移至 Windows 資源回收筒"
        impactWarning={`目標檔案：${fileToDelete?.name}。請確認此檔案非系統相依元件或正在運行的程式資料庫。移至回收筒後如需復原可至 Windows 資源回收筒還原。`}
        confirmLabel="確認移至回收筒"
        onConfirm={handleConfirmDelete}
        onCancel={() => setFileToDelete(null)}
        isProcessing={isDeleting}
      />
    </div>
  );
};
