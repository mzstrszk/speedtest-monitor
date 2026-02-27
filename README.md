# SpeedTest Monitor

Windows向けインターネット速度測定・モニタリングElectronアプリケーション

![SpeedTest Monitor](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Electron](https://img.shields.io/badge/electron-40.6.1-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-20.18.1-green.svg)
![Platform](https://img.shields.io/badge/platform-windows-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 概要

SpeedTest Monitorは、インターネット接続速度を定期的に測定し、結果をグラフィカルに表示するWindows向けデスクトップアプリケーションです。システムトレイに常駐し、バックグラウンドで自動的に速度測定を実行できます。

## 主な機能

### 🚀 自動速度測定
- 5分〜24時間の間隔で自動測定
- バックグラウンドでの非停止動作
- 静寂時間設定（夜間の測定停止）

### 📊 データ可視化
- リアルタイムチャートによる速度推移表示
- ダウンロード・アップロード・レイテンシの統計
- 期間別の詳細分析

### 💾 データ管理
- SQLiteによるローカルデータ保存
- CSV形式でのデータエクスポート
- 自動データクリーンアップ（設定可能な保存期間）

### 🔔 通知機能
- 測定完了・エラー時の通知
- システムトレイからの操作
- カスタマイズ可能な通知設定

### ⚙️ 柔軟な設定
- 測定間隔の調整
- 通知設定のカスタマイズ
- アプリケーション動作の細かな制御

## システム要件

- **OS**: Windows 10 (64-bit) 以降
- **メモリ**: 4GB RAM 推奨
- **ストレージ**: 100MB の空き容量
- **ネットワーク**: インターネット接続

## インストール

### 方法1: リリースからダウンロード
1. [Releases](https://github.com/speedtest-monitor/speedtest-monitor/releases)から最新版をダウンロード
2. `SpeedTest-Monitor-Setup-1.0.0.exe`を実行
3. インストールウィザードに従ってインストール

### 方法2: ソースからビルド
```bash
# リポジトリをクローン
git clone https://github.com/speedtest-monitor/speedtest-monitor.git
cd speedtest-monitor

# 依存関係をインストール
npm install

# アプリケーションを起動（開発モード）
npm start

# Windows向けにビルド
npm run build:win
```

## 使用方法

### 初回セットアップ
1. アプリケーションを起動
2. セットアップウィザードで基本設定を行う
3. 測定間隔とデータ保存期間を選択
4. 通知設定を構成

### 基本操作
- **手動測定**: ダッシュボードの「測定実行」ボタンをクリック
- **自動測定開始/停止**: ダッシュボードまたはトレイメニューから操作
- **履歴表示**: 「履歴」タブで過去の測定結果を確認
- **統計表示**: 「統計」タブで期間別の統計を表示

### システムトレイ
- **左クリック**: ダッシュボードの表示/非表示切り替え
- **右クリック**: コンテキストメニューを表示
- **ダブルクリック**: ダッシュボードを表示

## 設定項目

### 測定設定
- **測定間隔**: 5分〜24時間
- **データ保存期間**: 7日〜1年
- **サーバー選択**: 自動または手動

### 通知設定  
- **測定完了通知**: ON/OFF
- **エラー通知**: ON/OFF
- **通知音**: ON/OFF

### アプリケーション動作
- **自動開始**: Windows起動時の自動起動
- **最小化動作**: クローズ時のトレイ最小化
- **静寂時間**: 指定時間帯での測定停止

## データ構造

### データベーステーブル
- `speed_tests`: 測定結果の保存
- `settings`: アプリケーション設定
- `application_logs`: アプリケーションログ

### エクスポート形式
CSV形式で以下の項目をエクスポート:
- 測定日時
- ダウンロード速度 (Mbps)
- アップロード速度 (Mbps)
- レイテンシ (ms)
- サーバー情報

## トラブルシューティング

### よくある問題

**Q: 測定が開始されない**
A: ネットワーク接続を確認し、ファイアウォール設定を確認してください。

**Q: データが表示されない**
A: アプリケーションを再起動し、データベースファイルのアクセス権限を確認してください。

**Q: 通知が表示されない**
A: Windows の通知設定でアプリケーションからの通知が許可されているか確認してください。

### ログファイル
ログファイルは以下の場所に保存されます:
```
%APPDATA%\speedtest-monitor\logs\
```

### 設定ファイル
設定ファイルは以下の場所に保存されます:
```
%APPDATA%\speedtest-monitor\config.json
```

## 開発者向け情報

### プロジェクト構造
```
speedtest-monitor/
├── src/
│   ├── main.js                 # メインプロセス
│   ├── preload.js             # プリロードスクリプト
│   ├── services/              # バックエンドサービス
│   ├── renderer/              # フロントエンド
│   │   ├── pages/             # HTMLページ
│   │   ├── js/                # JavaScript
│   │   └── css/               # スタイルシート
│   └── utils/                 # ユーティリティ
├── assets/                    # アセット（アイコンなど）
└── package.json              # パッケージ設定
```

### 主要技術スタック
- **Electron 40.6.1**: デスクトップアプリケーションフレームワーク
- **Node.js 20.18.1 LTS**: JavaScript実行環境
- **SQLite3 5.1.7**: ローカルデータベース
- **Bootstrap 5**: UIフレームワーク
- **Chart.js**: グラフライブラリ
- **universal-speedtest 3.0.0**: Ookla速度測定ライブラリ

### 開発コマンド
```bash
npm start           # 開発モードで起動
npm run dev         # 開発モード（詳細ログ付き）
npm run build       # プロダクションビルド
npm run build:win   # Windows向けビルド
npm test            # テスト実行
npm run lint        # コード品質チェック
```

### コントリビューション
1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

このプロジェクトは MIT ライセンスのもとで公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## サポート

- **バグ報告**: [GitHub Issues](https://github.com/speedtest-monitor/speedtest-monitor/issues)
- **機能要求**: [GitHub Discussions](https://github.com/speedtest-monitor/speedtest-monitor/discussions)
- **ドキュメント**: [Wiki](https://github.com/speedtest-monitor/speedtest-monitor/wiki)

## 謝辞

- [universal-speedtest](https://github.com/karelkryda/universal-speedtest) - Ookla速度測定ライブラリ
- [Electron](https://www.electronjs.org/) - クロスプラットフォームデスクトップアプリ開発
- [Bootstrap](https://getbootstrap.com/) - UIコンポーネント
- [Chart.js](https://www.chartjs.org/) - データビジュアライゼーション

---

© 2024 SpeedTest Monitor Team. All rights reserved.