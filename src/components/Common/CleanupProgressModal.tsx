import React from 'react';
import { CleanupProgress, CleanupResult } from '../../types/index.ts';
import { formatBytes } from '../../utils/formatters.ts';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  StopCircleIcon,
} from './Icons.tsx';

interface CleanupProgressModalProps {
  isOpen: boolean;
  progress: CleanupProgress | null;
  result: CleanupResult | null;
  error: string | null;
  isExecuting: boolean;
  isCancelling?: boolean;
  onCancel: () => void;
  onClose: () => void;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '計算中...';
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const CleanupProgressModal: React.FC<CleanupProgressModalProps> = ({
  isOpen,
  progress,
  result,
  error,
  isExecuting,
  isCancelling = false,
  onCancel,
  onClose,
}) => {
  if (!isOpen) return null;

  const isCompleted = !isExecuting && !!result;
  const isCancelled = !isExecuting && progress?.status === 'cancelled';
  const hasError = !isExecuting && !!error;

  const percent = progress ? Math.min(100, Math.max(0, progress.percent)) : isCompleted ? 100 : 0;
  const currentItem = progress?.currentItem || (isExecuting ? '準備中...' : '處理完畢');

  let title = '正在批次清理檔案...';
  let headerColor = 'var(--primary)';
  let headerBg = 'rgba(59, 130, 246, 0.12)';

  if (isCancelling) {
    title = '正在安全中斷後續清理...';
    headerColor = 'var(--warning)';
    headerBg = 'rgba(245, 158, 11, 0.12)';
  } else if (isCancelled) {
    title = '清理作業已中途停止 (部分完成)';
    headerColor = 'var(--warning)';
    headerBg = 'rgba(245, 158, 11, 0.12)';
  } else if (hasError) {
    title = '清理作業發生異常';
    headerColor = 'var(--danger)';
    headerBg = 'rgba(239, 68, 68, 0.12)';
  } else if (isCompleted) {
    title = '批次清理作業完成';
    headerColor = 'var(--success)';
    headerBg = 'rgba(34, 197, 94, 0.12)';
  }

  // Extract failed or skipped details for transparency
  const failedDetails = result?.details?.filter((d) => d.status === 'failed') || [];
  const skippedDetails = result?.details?.filter((d) => d.status === 'skipped') || [];

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ maxWidth: '620px', width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backgroundColor: headerBg,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              color: headerColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isExecuting ? (
              <RefreshCwIcon size={22} className="spin-slow" />
            ) : hasError ? (
              <AlertTriangleIcon size={22} />
            ) : isCancelled ? (
              <StopCircleIcon size={22} />
            ) : (
              <CheckCircleIcon size={22} />
            )}
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {title}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {isExecuting
                ? '系統正安全校驗並批次處理選取之項目，可隨時中途取消'
                : isCompleted || isCancelled
                ? '已處理項目狀態回報與釋放容量核算'
                : '請確認錯誤原因'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Progress Bar & Percent */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                執行進度
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: headerColor }}>
                {percent.toFixed(1)}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '10px',
                backgroundColor: 'var(--bg-hover)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  backgroundColor: headerColor,
                  borderRadius: '999px',
                  transition: 'width 0.2s ease-out',
                }}
              />
            </div>
          </div>

          {/* Key Metrics Grid (4 items) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              backgroundColor: 'var(--bg-hover)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {/* Processed Count */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>已處理數量 / 總數</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {progress?.completedItems ?? result?.totalProcessed ?? 0} / {progress?.totalItems ?? result?.totalProcessed ?? 0} 個
              </div>
            </div>

            {/* Processed Bytes */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>已處理容量 / 總預估</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                {formatBytes(progress?.processedBytes ?? result?.actualFreedBytes ?? 0)}
                {progress?.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ''}
              </div>
            </div>

            {/* Success & Failed */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>成功 / 失敗數量</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '2px' }}>
                <span style={{ color: 'var(--success)' }}>
                  {progress?.successfulItems ?? result?.successCount ?? 0} 成功
                </span>
                {' / '}
                <span style={{ color: 'var(--danger)' }}>
                  {progress?.failedItems ?? result?.failCount ?? 0} 失敗
                </span>
              </div>
            </div>

            {/* Elapsed & Estimated Remaining Time */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>經過時間 / 預估剩餘</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ClockIcon size={14} style={{ color: 'var(--text-dim)' }} />
                <span>{formatDuration(progress?.elapsedTime)}</span>
                {' / '}
                <span style={{ color: isCompleted ? 'var(--text-dim)' : 'var(--warning)' }}>
                  {isCompleted || isCancelled ? '00:00' : formatDuration(progress?.estimatedRemainingTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Current Processing Item (Live Path) */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontWeight: 600, flexShrink: 0, color: 'var(--text-main)' }}>目前項目：</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                direction: 'rtl',
                textAlign: 'left',
              }}
              title={currentItem}
            >
              {currentItem}
            </span>
          </div>

          {/* Execution Error Banner */}
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangleIcon size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {/* Completion Summary & Freed Capacity */}
          {(isCompleted || isCancelled) && result && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isCancelled ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                border: `1px solid ${isCancelled ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {isCancelled ? '清理作業已中斷，已完成部分結果：' : '清理結果摘要：'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                成功處理：<strong style={{ color: 'var(--success)' }}>{result.successCount}</strong> 個 |
                略過項目：<strong>{result.skippedCount}</strong> 個 |
                失敗項目：<strong style={{ color: result.failCount > 0 ? 'var(--danger)' : 'inherit' }}>{result.failCount}</strong> 個
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                實際確認釋放容量：{formatBytes(result.actualFreedBytes)}
              </div>
            </div>
          )}

          {/* Failed / Skipped Details Scrollbox */}
          {(failedDetails.length > 0 || (isCancelled && skippedDetails.length > 0)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {failedDetails.length > 0 ? `失敗或略過明細 (${failedDetails.length + skippedDetails.length} 項)：` : `略過未執行明細 (${skippedDetails.length} 項)：`}
              </span>
              <div
                style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.75rem',
                }}
              >
                {failedDetails.map((item, idx) => (
                  <div key={`fail-${idx}`} style={{ color: 'var(--danger)', wordBreak: 'break-all' }}>
                    ❌ {item.path} - {item.reason || '刪除失敗'}
                  </div>
                ))}
                {skippedDetails.slice(0, 10).map((item, idx) => (
                  <div key={`skip-${idx}`} style={{ color: 'var(--text-dim)', wordBreak: 'break-all' }}>
                    ⚠️ {item.path} - {item.reason || '已略過'}
                  </div>
                ))}
                {skippedDetails.length > 10 && (
                  <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    ...其餘 {skippedDetails.length - 10} 項已略過
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-hover)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          {isExecuting ? (
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isCancelling}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)' }}
            >
              <StopCircleIcon size={16} />
              {isCancelling ? '正在中斷中...' : '取消後續清理'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>
              完成並關閉
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

