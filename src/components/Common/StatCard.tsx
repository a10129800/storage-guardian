import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  badge?: string;
  badgeColor?: 'safe' | 'moderate' | 'caution';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  badgeColor = 'safe',
}) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {title}
        </span>
        {icon && <span style={{ color: 'var(--primary)' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
        {subtitle && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {subtitle}
          </span>
        )}
        {badge && (
          <span className={`badge badge-${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};
