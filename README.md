# Storage Guardian｜電腦容量守護者

> **Windows 本機儲存空間分析、磁碟容量管理及安全清理桌面應用程式**  
> 具備真實遞迴掃描、兩階段 SHA-256 重複檔案分析、透明安全預覽、使用者二次確認、資源回收筒無損還原、開發者產物清理與本機審計日誌。

---

## 專案核心特色與安全準則

1. **真實磁碟與檔案操作**：不使用靜態假數據；透過 Windows CIM / PowerShell 與 Node.js 檔案串流，精確取得實體磁碟容量、目錄樹結構及檔案大小。
2. **零隱蔽刪除與人工審核**：任何可能造成磁碟變動的操作，必須經過：**掃描 → 分類 → 透明預覽 → 使用者勾選 → 確認對話框 → 執行前再次驗證檔案 → 執行結果回報**。
3. **Windows 資源回收筒優先**：清理項目一律優先移至 Windows 資源回收筒，使用者可隨時由回收筒直接還原，避免永久遺失風險。
4. **兩階段精準重複檔案比對**：
   - 第一階段：依檔案精確位元組大小分組。
   - 第二階段：僅針對大小相符者進行串流 SHA-256 雜湊比對。
   - **強制保護規則**：每組重複檔案強制保留至少一份正本，嚴格禁止將整組複本全數刪除。
5. **開發者工作區專屬清理**：針對 `node_modules`、`.next`、`dist`、`build`、`.turbo`、`.vite`、`target (Cargo)` 等目錄，絕對不觸碰 `package.json`、原始程式碼、設定檔或資料庫。
6. **本機導向與隱私保護**：核心功能（磁碟掃描、檔案分析與清理操作）均於本機離線執行，無雲端帳號相依、不需 API Key，未設計任何主動資料上傳或後台遙測追蹤機制。

---

## 軟體架構說明

本專案採用 **Electron + React 18 + TypeScript + Vite** 現代商業桌面軟體架構：

```text
容量工具/
├── electron/                   # Electron 主程序與安全 IPC 服務層
│   ├── main.ts                 # 主程序生命週期與安全邊界防護
│   ├── preload.ts              # 受限 contextBridge API 曝露層
│   └── ipc/                    # 職責分離的後端檔案系統服務
│       ├── channels.ts         # IPC 頻道常數定義
│       ├── diskService.ts      # 本機磁碟偵測與容量警戒
│       ├── scannerService.ts   # 遞迴目錄樹掃描與大型檔案檢索
│       ├── duplicateService.ts # 兩階段 SHA-256 雜湊重複檔案比對
│       ├── cleanService.ts     # 系統與使用者暫存安全清理
│       ├── devCleanerService.ts# 開發者專案依賴與產物管理
│       ├── recycleBin.ts       # Windows 資源回收筒跨平台整合
│       ├── historyService.ts   # 本機歷史審計紀錄與 CSV 匯出
│       ├── sandboxService.ts   # 測試沙箱目錄與模擬環境支援
│       └── settingsService.ts  # 本機設定持久化存儲
├── src/                        # 前端 React 渲染層
│   ├── main.tsx                # 前端主入口 (ThemeProvider, AppStateProvider)
│   ├── App.tsx                 # 主視窗路由與版面控制
│   ├── index.css               # 商業級明暗主題與 CSS 設計系統
│   ├── types/index.ts          # 完整 TypeScript 型別定義
│   ├── context/                # 全域主題與狀態管理 Context
│   ├── components/             # 通用元件 (Sidebar, Header, StatCard, ConfirmDialog, Icons)
│   ├── pages/                  # 八大功能頁面
│   │   ├── DashboardPage.tsx   # 總覽儀表板
│   │   ├── DiskAnalyzerPage.tsx# 磁碟分析器
│   │   ├── LargeFilesPage.tsx  # 大型檔案管理器
│   │   ├── DuplicateFinderPage.tsx # 重複檔案搜尋器
│   │   ├── SafeCleanupPage.tsx # 安全清理中心
│   │   ├── DevCleanerPage.tsx  # 開發者容量管理
│   │   ├── HistoryPage.tsx     # 清理紀錄與審計
│   │   └── SettingsPage.tsx    # 設定與安全中心
│   ├── services/api.ts         # IPC 通訊介面與瀏覽器預覽 Fallback
│   └── utils/                  # 格式化、檔案分類與安全路徑過濾工具
├── scripts/
│   ├── runAllTests.js          # 自動化單元測試、整合測試與安全防護測試套件
│   ├── setupSandbox.js         # 獨立測試沙箱環境建立工具
│   └── createAppIcon.js        # 多解析度應用程式圖示生成工具
├── install.bat                 # Windows 一鍵依賴套件安裝腳本
├── dev.bat                     # Windows 一鍵啟動開發預覽腳本
├── test.bat                    # Windows 一鍵自動化測試腳本
├── build.bat                   # Windows 一鍵前端與正式建置腳本
├── setup-sandbox.bat           # Windows 一鍵建立隔離測試沙箱腳本
└── package.json
```

---

## 一鍵啟動與快速上手指南

本軟體專為 Windows 環境提供原生 `.bat` 批次檔，無須手動輸入複雜終端機指令：

### 1. 安裝套件依賴
直接雙擊執行根目錄的 **`install.bat`**，或於命令提示字元執行：
```bash
npm install
```

### 2. 啟動桌面軟體 (開發模式)
直接雙擊執行根目錄的 **`dev.bat`**，或執行：
```bash
npm run dev
```

### 3. 執行完整自動化測試
直接雙擊執行根目錄的 **`test.bat`**，或執行：
```bash
npm test
# 或直接透過 node 執行獨立測試套件：
node scripts/runAllTests.js
```

### 4. 正式打包與建置
直接雙擊執行根目錄的 **`build.bat`**，或執行：
```bash
npm run build
```

### 5. 建立安全隔離測試沙箱（選用）
直接雙擊執行根目錄的 **`setup-sandbox.bat`**，或執行：
```bash
node scripts/setupSandbox.js
```
此指令將於系統暫存目錄（`%TEMP%\StorageGuardian-Sandbox`）建立安全隔離的測試檔案與目錄結構，供功能驗證使用，不影響使用者實際日常檔案。

---

## 自動化測試覆蓋範圍

測試套件位於 `scripts/runAllTests.js`，無須任何額外測試套件即可在乾淨的 Node.js 環境中獨立運行：

1. **單元測試 (Unit Tests)**：
   - 檔案大小格式化 (`formatBytes`) 0 與邊界值校驗。
   - 容量百分比與溢出保護計算 (`calculatePercentage`)。
   - 10+ 種檔案類型分類 (`getFileCategory`) 與未辨識副檔名安全歸類。
   - 重複檔案理論可回收容量計算。
   - 重複檔案群組安全選取演算法 (保留最新、保留最舊、全不選取)。
2. **安全防護邊界測試 (Security Tests)**：
   - 封鎖 `C:\Windows`、`System32`、`Program Files`、磁碟根目錄等系統保護區。
   - 開發者清理安全目標驗證，絕對禁止選取原始碼檔案或 `package.json`。
3. **整合測試 (Integration Tests)**：
   - 於隔離的系統暫存測試目錄建立測試檔案與子資料夾。
   - 兩階段 SHA-256 驗證：內容相符判定為重複、檔名相同但內容不同嚴格判定為非重複。
   - 清理前後狀態校驗：確保被清理檔案移除，正本檔案完好留存。
   - 測試結束後自動安全清除隔離沙箱。

---

## 授權與隱私說明

- **授權條款**：本專案採用 [MIT License](LICENSE) 授權開源。
- **本機隱私**：核心磁碟掃描、雜湊計算與清理紀錄均於使用者本機電腦執行，專案未設計雲端同步、資料上傳或後台遙測追蹤機制。
