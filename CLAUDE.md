# CLAUDE.md

このファイルは、このリポジトリのコードを扱う際にClaude Code (claude.ai/code) に開発ガイダンスを提供します。

## プロジェクト概要

**SpeedTest Monitor** は、定期的なインターネット回線速度測定を実行し、結果を可視化するElectronベースのWindowsアプリケーションです。アプリケーションはトレイアイコンインターフェースでバックグラウンドで動作します。

## ドキュメント構成

- **CLAUDE.md** (本ファイル): 開発者向けガイド、技術スタック、開発手順
- **specs/requirement.md**: 要件定義書（ビジネス要件、機能要件、非機能要件）
- **specs/design.md**: 設計書（システム設計、データベース設計、API設計、UI設計）

## 技術スタック

- **フレームワーク**: Electron 40.6.1
- **ランタイム**: Node.js 20.18.1 LTS
- **データベース**: SQLite3 5.1.7
- **UIフレームワーク**: Bootstrap 5
- **チャート**: Chart.js
- **ビルドツール**: electron-builder 26.8.1
- **パッケージマネージャー**: npm

## アーキテクチャ概要

### マルチプロセス構成
```
┌─────────────────────────────────────┐
│           Electron App              │
├─────────────────────────────────────┤
│  Main Process (main.js)             │
│  ├─ Window Management               │
│  ├─ Tray Management                 │
│  ├─ Scheduler Service               │
│  └─ IPC Communication              │
├─────────────────────────────────────┤
│  Renderer Process                   │
│  ├─ Setup Window                    │
│  ├─ Dashboard Window                │
│  └─ Settings Window                 │
├─────────────────────────────────────┤
│  Services Layer                     │
│  ├─ SpeedTest Service               │
│  ├─ Database Service                │
│  ├─ Notification Service            │
│  └─ Config Service                  │
├─────────────────────────────────────┤
│  Data Layer                         │
│  ├─ SQLite Database                 │
│  └─ Config Files                    │
└─────────────────────────────────────┘
```

### ディレクトリ構造
```
speedtest-monitor/
├── package.json
├── main.js
├── preload.js
├── assets/
│   ├── icons/
│   └── logo.png
├── src/
│   ├── renderer/
│   │   ├── pages/          # HTMLページ
│   │   ├── js/             # ページ固有のJS
│   │   └── css/            # スタイルシート
│   ├── services/           # コアサービス
│   └── utils/              # ユーティリティ
├── specs/                  # 仕様書
├── build/                  # ビルド設定
└── dist/                   # ビルド出力
```

## 開発コマンド

利用可能なコマンド：
- `npm start` - 開発モードで実行
- `npm run dev` - 開発モードで実行（デバッグオプション付き）
- `npm run build` - プロダクション用ビルド
- `npm run build:win` - Windowsインストーラーのビルド
- `npm test` - テスト実行
- `npm run lint` - コードリンティング
- `npm run pack` - パッケージング（配布なし）
- `npm run dist` - 配布用ビルド

## 主要依存関係

```json
{
  "dependencies": {
    "universal-speedtest": "^3.0.0",
    "sqlite3": "^5.1.7",
    "electron-store": "^8.1.0",
    "node-schedule": "^2.1.1",
    "electron-log": "^5.0.1"
  },
  "devDependencies": {
    "electron": "^40.6.1",
    "electron-builder": "^26.8.1",
    "eslint": "^9.18.0",
    "jest": "^29.7.0"
  }
}
```

## IPC通信パターン

### Main → Renderer Events
```javascript
// 測定結果通知
ipcMain.send('speedtest-result', {
  id: number,
  timestamp: string,
  download: number,
  upload: number,
  ping: number,
  status: 'completed' | 'error'
});

// 設定変更通知
ipcMain.send('settings-updated', { key: string, value: any });

// 測定状態通知
ipcMain.send('measurement-status', {
  status: 'idle' | 'running' | 'error',
  nextMeasurement: string
});
```

### Renderer → Main Invocations
```javascript
// 測定開始要求
ipcRenderer.invoke('start-measurement');

// 設定更新要求
ipcRenderer.invoke('update-setting', { key: string, value: any });

// データ取得要求
ipcRenderer.invoke('get-speedtest-data', {
  startDate: string,
  endDate: string,
  limit: number
});

// データエクスポート要求
ipcRenderer.invoke('export-data', {
  format: 'csv',
  dateRange: { start: string, end: string }
});
```

## 開発ガイドライン

### セキュリティ考慮事項
- preloadスクリプトでcontextBridgeを使用してセキュアなIPC通信を実装
- 全データはローカル保存（外部送信は速度測定のみ）
- 個人識別情報の収集禁止

### エラーハンドリング
```javascript
const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR', 
  MEASUREMENT_ERROR: 'MEASUREMENT_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  UI_ERROR: 'UI_ERROR'
};
```

### 状態管理
- EventEmitterパターンでコンポーネント間通信
- スケジューラー、測定、設定、UI状態を管理

### コーディング規約
- ES6+構文を使用
- async/awaitでPromiseを処理
- JSDocでコメント記述
- エラーログは必ずファイル出力

## 開発環境

### 対象環境
- **プラットフォーム**: Windows 10/11（64ビット）
- **言語サポート**: 日本語のみ
- **配布形式**: NSISインストーラー（electron-builder）

### テスト
- **単体テスト**: Jest
- **E2Eテスト**: Spectron（予定）
- **カバレッジ**: 80%以上を目標

## セキュリティ

### 既知の脆弱性

現在、以下の依存関係に脆弱性が報告されていますが、開発環境での使用に限定されるため、実運用への影響は限定的です:

1. **universal-speedtest 3.0.0の依存関係**
   - `fast-xml-parser` 4.1.3 - 5.3.5: DoS脆弱性とエンティティエンコーディングバイパス

   **影響評価**:
   - XML解析に関する脆弱性
   - このアプリケーションでは外部からXMLを受け取らないため、実際のリスクは低い
   - Ookla APIからのレスポンス解析にのみ使用され、信頼できるソースのみ

   **対応方針**:
   - universal-speedtest 2.0.6へのダウングレードで解決可能だが、機能が制限される
   - パッケージの更新を監視し、修正版がリリースされ次第更新予定

2. **tar ≤ 7.5.7の脆弱性**
   - sqlite3とelectron-rebuildの依存関係経由
   - ビルド時のみ使用され、実行時には影響なし

   **対応方針**:
   - 開発環境のみで使用
   - 本番配布ファイルには影響なし

### 変更履歴

**2026-02-26**:
- `speedtest-net 2.2.0` から `universal-speedtest 3.0.0` へ移行
- 脆弱性を24個から8個に削減（-67%）
- 古い依存関係（got、http-cache-semantics、download）を排除

### セキュリティ監査

定期的にセキュリティ監査を実行してください:
```bash
npm audit
npm audit fix  # 安全な修正のみ適用
```