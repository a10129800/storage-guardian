import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { AppSettings } from '../types/index.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  CheckCircleIcon,
  MoonIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
} from '../components/Common/Icons.tsx';

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [newExcludePath, setNewExcludePath] = useState('');
  const [savedNotification, setSavedNotification] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => setSettings(s));
  }, []);

  const handleUpdate = async (field: keyof AppSettings, value: any) => {
    if (!settings) return;
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    await api.saveSettings({ [field]: value });
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  const handleAddExclude = async () => {
    if (!newExcludePath || !settings) return;
    const trimmed = newExcludePath.trim();
    if (settings.excludePaths.includes(trimmed)) return;

    const updatedPaths = [...settings.excludePaths, trimmed];
    await handleUpdate('excludePaths', updatedPaths);
    setNewExcludePath('');
  };

  const handleRemoveExclude = async (pathToRemove: string) => {
    if (!settings) return;
    const updatedPaths = settings.excludePaths.filter((p) => p !== pathToRemove);
    await handleUpdate('excludePaths', updatedPaths);
  };

  if (!settings) {
    return <div className="page-container">載入設定中...</div>;
  }

  return (
    <div className="page-container">
      {/* Save Notification Toast */}
      {savedNotification && (
        <div
          style={{
            backgroundColor: 'var(--success-light)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: 'var(--success)',
            fontWeight: 600,
          }}
        >
          <CheckCircleIcon size={16} />
          設定已自動儲存至本機
        </div>
      )}

      {/* General Settings */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <SettingsIcon size={20} />
            一般與介面設定
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              系統語言
            </label>
            <select
              value={settings.language}
              disabled
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
              }}
            >
              <option value="zh-TW">繁體中文 (台灣) - 預設</option>
            </select>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
              第一階段嚴格支援全繁體中文介面
            </span>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              外觀色彩主題
            </label>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={toggleTheme}
            >
              <span>目前模式：{theme === 'light' ? '專業淺色模式 (Light)' : '極致深色模式 (Dark)'}</span>
              {theme === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Safety & Thresholds */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldIcon size={20} />
            安全性與掃描門檻
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              磁碟容量警報門檻 (%)
            </label>
            <input
              type="number"
              min="50"
              max="99"
              value={settings.lowDiskThresholdPercent}
              onChange={(e) => handleUpdate('lowDiskThresholdPercent', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
              }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
              當磁碟使用率超過此比例時，儀表板將主動發出警戒提示 (預設 85%)
            </span>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              預設清理安全機制
            </label>
            <select
              value={settings.defaultCleanMethod}
              onChange={(e) => handleUpdate('defaultCleanMethod', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
              }}
            >
              <option value="recycle_bin">移至 Windows 資源回收筒 (優先推薦，支援無損還原)</option>
              <option value="permanent">直接安全刪除 (不可還原，需額外確認)</option>
            </select>
          </div>
        </div>

        {/* Exclude Paths */}
        <div style={{ marginTop: '24px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
            掃描排除目錄保護清單 (系統與自訂保護區域)
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="新增自訂排除資料夾路徑 (例如 D:\ImportantVault)"
              value={newExcludePath}
              onChange={(e) => setNewExcludePath(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
              }}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleAddExclude}>
              新增保護
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {settings.excludePaths.map((pathStr) => (
              <span
                key={pathStr}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid var(--border-strong)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-main)',
                }}
              >
                {pathStr}
                <button
                  onClick={() => handleRemoveExclude(pathStr)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '0 2px',
                  }}
                  title="移除排除項目"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Privacy and Open Source Info */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">隱私權與開放原始碼宣告</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            版本 {settings.version}
          </span>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <strong>100% 本機執行：</strong>
            Storage Guardian 不包含任何第三方追蹤分析工具，絕不上傳檔案清單、檔案名稱或雜湊至任何外部伺服器。所有運算一律於本機處理。
          </div>
          <div>
            <strong>免責與開源協議：</strong>
            本專案遵循 MIT 開源授權協議，完全免費開源，不含任何付費牆、訂閱機制或商業廣告。
          </div>
        </div>
      </div>
    </div>
  );
};
