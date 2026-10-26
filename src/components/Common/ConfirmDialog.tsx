import React from 'react';
import { AlertTriangleIcon, TrashIcon } from './Icons.tsx';
import { formatBytes } from '../../utils/formatters.ts';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  itemCount: number;
  totalBytes: number;
  method?: string;
  impactWarning?: string;
  confirmLabel?: string;
  confirmButtonVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  itemCount,
  totalBytes,
  method = '移至 Windows 資源回收筒 (可由回收筒還原)',
  impactWarning = '請再次確認所選項目無正在執行的關鍵程式依賴。已排程檔案將在確認後執行。',
  confirmLabel = '確認執行清理',
  confirmButtonVariant = 'danger',
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangleIcon size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {title}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              安全防護確認機制：操作前需經使用者審核
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Box */}
          <div
            style={{
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>預計處理項目</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {itemCount} 個檔案 / 目錄
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>預估可釋放容量</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                {formatBytes(totalBytes)}
              </div>
            </div>
          </div>

          {/* Method Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              清理方式
            </span>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-main)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {method}
            </div>
          </div>

          {/* Impact Warning */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              backgroundColor: 'var(--warning-light)',
              border: '1px solid var(--warning-border)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              color: 'var(--text-main)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }}>
              <AlertTriangleIcon size={16} />
            </span>
            <div>{impactWarning}</div>
          </div>
        </div>

        {/* Footer */}
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
          <button className="btn btn-secondary" onClick={onCancel} disabled={isProcessing}>
            取消操作
          </button>
          <button
            className={`btn btn-${confirmButtonVariant}`}
            onClick={onConfirm}
            disabled={isProcessing || itemCount === 0}
          >
            {isProcessing ? (
              '正在執行中...'
            ) : (
              <>
                <TrashIcon size={16} />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
