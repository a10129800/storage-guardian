import React from 'react';

interface ProgressBarProps {
  percent: number;
  height?: number;
  showLabel?: boolean;
  warningThreshold?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  height = 8,
  showLabel = false,
  warningThreshold = 85,
}) => {
  const safePercent = Math.min(100, Math.max(0, percent));
  
  let barColor = 'var(--primary)';
  if (safePercent >= warningThreshold) {
    barColor = 'var(--danger)';
  } else if (safePercent >= 70) {
    barColor = 'var(--warning)';
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--text-muted)' }}>磁碟使用率</span>
          <span style={{ color: barColor }}>{safePercent.toFixed(1)}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'var(--bg-active)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${safePercent}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: '999px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
};
