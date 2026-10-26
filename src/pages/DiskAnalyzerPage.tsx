import React, { useEffect, useState } from 'react';
import { useAppState } from '../context/AppStateContext.tsx';
import { api, isElectronBridgeAvailable } from '../services/api.ts';
import { DirectoryTreeNode, FileCategory, ScanProgress } from '../types/index.ts';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../utils/fileTypes.ts';
import { formatBytes } from '../utils/formatters.ts';
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  FolderIcon,
  HardDriveIcon,
  RefreshCwIcon,
  SearchIcon,
} from '../components/Common/Icons.tsx';

export const DiskAnalyzerPage: React.FC = () => {
  const {
    targetScanFolder,
    setTargetScanFolder,
    chooseFolderDialog,
    setLastScanTime,
    setupSandboxFolder,
  } = useAppState();

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [treeData, setTreeData] = useState<DirectoryTreeNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagTrail, setDiagTrail] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = api.onScanProgress((p) => {
      setProgress(p);
      if (p.phase === 'error' && p.errors && p.errors.length > 0) {
        setErrorMessage(`掃描時發生錯誤：${p.errors.map((e) => e.message).join('; ')}`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleBrowseFolder = async () => {
    setErrorMessage(null);
    setDiagTrail('[A] 點擊「瀏覽資料夾」按鈕事件已觸發');
    console.log('[DIAG-A] 點擊「瀏覽資料夾」按鈕事件已觸發');

    const hasBridge = isElectronBridgeAvailable();
    if (!hasBridge) {
      const msg = '[診斷警告] window.storageGuardian 未注入！目前處於前端 Mock 模式，無法開啟原生資料夾對話框。請檢查 CMD 主程序控制台日誌。';
      console.error('[DIAG-C-FAIL]', msg);
      setErrorMessage(msg);
      setDiagTrail('[A] 按鈕已觸發 ➔ [B/C-FAIL] window.storageGuardian 不存在 (Preload 離線)');
      return;
    }

    setDiagTrail('[A] 按鈕已觸發 ➔ [B] API 已呼叫 ➔ [C] Preload 轉發至主程序...');
    try {
      const chosen = await chooseFolderDialog();
      if (chosen) {
        setDiagTrail(`[A] 按鈕 ➔ [B] API ➔ [C] Preload ➔ [D/E/F] 成功選定路徑: ${chosen}`);
      } else {
        setDiagTrail('[A] 按鈕 ➔ [B] API ➔ [C] Preload ➔ [D/E/F] 使用者取消了選擇視窗');
      }
    } catch (err: any) {
      console.error('[DIAG-FAIL] Choose folder error:', err);
      setErrorMessage(`無法開啟資料夾選擇視窗：${err.message || String(err)}`);
      setDiagTrail(`[DIAG-ERROR] ${err.message || String(err)}`);
    }
  };

  const handleStartScan = async () => {
    const target = targetScanFolder ? targetScanFolder.trim() : '';
    if (!target) {
      setErrorMessage('請先輸入或選擇要分析的目標路徑，或點擊「🧪 隔離測試沙箱」自動載入。');
      return;
    }
    setDiagTrail(`[A] 點擊開始深度掃描 (目標: "${target}")`);
    console.log(`[DIAG-A] 點擊「開始深度掃描」按鈕，目標路徑: "${target}"`);

    const hasBridge = isElectronBridgeAvailable();
    if (!hasBridge) {
      console.warn('[DIAG-B-WARN] 目前處於 Mock 模式，將使用模擬資料');
    }

    setIsScanning(true);
    setErrorMessage(null);
    setTreeData(null);
    // Provide instant loading progress feedback so the UI reacts immediately
    setProgress({
      phase: 'indexing',
      currentPath: target,
      scannedFiles: 0,
      scannedDirs: 0,
      totalBytes: 0,
      errors: [],
    });

    setDiagTrail('[A] 開始掃描 ➔ [B] API 呼叫 ➔ [C/D] 主程序唯讀掃描中...');
    try {
      const scanResult = await api.startFolderScan(target);
      const finalResult = scanResult || (await api.getScanResult());
      if (finalResult) {
        setTreeData(finalResult);
        setExpandedPaths(new Set([finalResult.path]));
        setLastScanTime(new Date().toISOString());
        setDiagTrail(`[A➔F] 深度掃描成功完成！共統計 ${finalResult.fileCount} 檔案，容量 ${formatBytes(finalResult.size)}`);
      } else {
        setErrorMessage('掃描已完成，但未發現任何檔案或目錄。');
        setDiagTrail('[A➔F] 掃描完成但目錄為空');
      }
    } catch (err: any) {
      console.error('[DIAG-SCAN-FAIL] Scan failed:', err);
      setErrorMessage(err.message || '掃描發生未知錯誤，請檢查該資料夾是否存在或是否有足夠權限。');
      setDiagTrail(`[DIAG-SCAN-ERROR] 掃描失敗: ${err.message || String(err)}`);
    } finally {
      setIsScanning(false);
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

  const handleCancelScan = async () => {
    try {
      await api.cancelFolderScan();
    } catch (err: any) {
      console.error('Cancel scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleExpand = (pathStr: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathStr)) {
        next.delete(pathStr);
      } else {
        next.add(pathStr);
      }
      return next;
    });
  };

  const renderTree = (node: DirectoryTreeNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${depth * 20 + 12}px`,
            borderRadius: 'var(--radius-sm)',
            cursor: hasChildren ? 'pointer' : 'default',
            gap: '8px',
            backgroundColor: isExpanded ? 'var(--bg-hover)' : 'transparent',
            transition: 'background-color 0.1s ease',
          }}
          onClick={() => hasChildren && toggleExpand(node.path)}
        >
          <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}>
            <FolderIcon size={16} />
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', flex: 1 }}>
            {node.name}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {node.fileCount} 檔案
          </span>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--primary)',
              minWidth: '90px',
              textAlign: 'right',
            }}
          >
            {formatBytes(node.size)}
          </span>
        </div>

        {isExpanded && hasChildren && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children!.map((child) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      {/* Target Selector & Scan Action Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title">
            <HardDriveIcon size={20} />
            選擇分析目標路徑
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: isElectronBridgeAvailable() ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isElectronBridgeAvailable() ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title={isElectronBridgeAvailable() ? 'window.storageGuardian 已正確掛載' : 'window.storageGuardian 不存在 (Preload 離線)'}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isElectronBridgeAvailable() ? '#10b981' : '#ef4444' }} />
              {isElectronBridgeAvailable() ? 'Electron 原生橋接就緒' : 'Mock 模式 (Preload 離線)'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            className="input"
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
            placeholder="請輸入或選擇要掃描的磁碟或資料夾路徑 (例如 C:\ 或 D:\Work)"
            disabled={isScanning}
          />

          <button
            className="btn btn-secondary"
            onClick={handleBrowseFolder}
            disabled={isScanning}
          >
            <FolderIcon size={16} />
            瀏覽資料夾
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleSetupSandbox}
            disabled={isScanning}
            title="一鍵建立並載入隔離測試沙箱 (%TEMP%\StorageGuardian-Sandbox)"
          >
            🧪 隔離測試沙箱
          </button>

          {isScanning ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" disabled style={{ opacity: 0.9 }}>
                <span className="spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>正在深度分析目錄...</span>
              </button>
              <button className="btn btn-danger" onClick={handleCancelScan} title="中止當前掃描操作">
                取消
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={handleStartScan} disabled={!targetScanFolder}>
              <RefreshCwIcon size={16} />
              開始深度掃描
            </button>
          )}
        </div>

        {/* Scan scope and safety indicator */}
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            目前掃描目標範圍：<strong style={{ color: targetScanFolder ? 'var(--text-main)' : 'var(--text-muted)' }}>{targetScanFolder || '尚未選擇 (請點擊「瀏覽資料夾」或「🧪 隔離測試沙箱」)'}</strong>
          </span>
          <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>
            🛡️ 唯讀安全掃描模式 (絕不修改或刪除任何檔案)
          </span>
        </div>

        {/* Live Diagnostic Trail HUD */}
        {diagTrail && (
          <div
            style={{
              marginTop: '8px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-hover)',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              fontFamily: 'Consolas, monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ color: 'var(--primary)' }}>⚡ 呼叫鏈診斷軌跡:</span>
            <span>{diagTrail}</span>
          </div>
        )}

        {/* Error message alert display */}
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

        {/* Real-time scanning progress */}
        {isScanning && progress && (
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
              <span>正在分析目錄結構...</span>
              <span style={{ color: 'var(--primary)' }}>
                已統計 {progress.scannedFiles} 檔案 / {formatBytes(progress.totalBytes)}
              </span>
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
              目前處理：{progress.currentPath}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Results View */}
      {treeData && (
        <>
          {/* File Category Breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">檔案類型空間佔用分佈</div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                總計容量：{formatBytes(treeData.size)}
              </span>
            </div>

            {/* Visual Colored Bar */}
            <div
              style={{
                width: '100%',
                height: '16px',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                backgroundColor: 'var(--bg-active)',
                marginBottom: '16px',
              }}
            >
              {(Object.keys(treeData.categoryBreakdown) as FileCategory[]).map((cat) => {
                const bytes = treeData.categoryBreakdown[cat] || 0;
                if (bytes <= 0 || treeData.size <= 0) return null;
                const percent = (bytes / treeData.size) * 100;
                return (
                  <div
                    key={cat}
                    style={{
                      width: `${percent}%`,
                      height: '100%',
                      backgroundColor: CATEGORY_COLORS[cat],
                    }}
                    title={`${CATEGORY_LABELS[cat]}: ${formatBytes(bytes)} (${percent.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Category Legend Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
              }}
            >
              {(Object.keys(treeData.categoryBreakdown) as FileCategory[]).map((cat) => {
                const bytes = treeData.categoryBreakdown[cat] || 0;
                if (bytes <= 0) return null;
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '3px',
                        backgroundColor: CATEGORY_COLORS[cat],
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatBytes(bytes)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Directory Tree & Largest Files Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Tree View */}
            <div className="card" style={{ maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <div className="card-title">目錄階層大小排行</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {renderTree(treeData)}
              </div>
            </div>

            {/* Largest Files Table */}
            <div className="card" style={{ maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <div className="card-title">最大檔案排行 Top 25</div>
              </div>
              <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>檔名</th>
                      <th>大小</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treeData.largestFiles.map((file, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{file.name}</div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-dim)',
                              maxWidth: '220px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {file.path}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {formatBytes(file.size)}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => api.openPathInExplorer(file.path)}
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
            </div>
          </div>
        </>
      )}

      {/* Empty State before scanning */}
      {!isScanning && !treeData && (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ color: 'var(--text-dim)' }}>
            <FolderIcon size={48} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            尚未執行磁碟深度分析
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
            請在上方選擇磁碟或目標資料夾，並點選「開始深度掃描」以探索資料夾佔用結構、檔案類型分佈與最大檔案清單。
          </p>
        </div>
      )}
    </div>
  );
};
