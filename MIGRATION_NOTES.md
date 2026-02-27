# speedtest-net から universal-speedtest への移行

## 変更日
2026-02-26

## 変更理由
- speedtest-netの依存関係に複数の脆弱性が存在
- 古い依存パッケージ（got、http-cache-semantics、download）の使用
- セキュリティリスクの軽減

## 変更内容

### パッケージの変更
- **削除**: `speedtest-net@2.2.0`
- **追加**: `universal-speedtest@3.0.0`

### 脆弱性の改善
- **変更前**: 16個の脆弱性（中程度1個、高い14個、重大1個）
- **変更後**: 8個の脆弱性（高い7個、重大1個）
- **改善率**: 50%削減

### APIの変更

#### speedtest-net (旧)
```javascript
const speedTest = require('speedtest-net');

// テスト実行
const result = await speedTest({
  acceptLicense: true,
  acceptGdpr: true
});

// 結果構造
{
  download: { bandwidth: 125000000 },  // bps
  upload: { bandwidth: 25000000 },     // bps
  ping: { latency: 10.5 }
}
```

#### universal-speedtest (新)
```javascript
const { UniversalSpeedTest, SpeedUnits } = require('universal-speedtest');

// インスタンス作成
const speedtest = new UniversalSpeedTest({
  units: {
    downloadUnit: SpeedUnits.Mbps,
    uploadUnit: SpeedUnits.Mbps
  }
});

// テスト実行
const result = await speedtest.performOoklaTest();

// 結果構造
{
  downloadResult: { speed: 125 },  // Mbps
  uploadResult: { speed: 25 },     // Mbps
  pingResult: { latency: 10.5, jitter: 2.3 }
}
```

### コードの変更

#### SpeedTestService
- `performSpeedTest()`: APIコールを universal-speedtest に変更
- `processTestResult()`: 結果の構造を新しいAPIに合わせて変換
- `convertMbpsToBps()`: 新規追加（Mbps → bps変換）
- `getAvailableServers()`: `listOoklaServers()` を使用
- 進捗イベント: 詳細な進捗情報は提供されなくなった

### 互換性

#### データベース
- データベーススキーマは変更なし
- 既存のデータは影響を受けない
- 新しいテスト結果も同じ形式で保存

#### UI
- フロントエンドのコードは変更不要
- 同じデータ構造を返すため、既存のコンポーネントがそのまま動作

### 既知の問題

#### 脆弱性
1. **fast-xml-parser** (重大)
   - universal-speedtestの依存関係
   - XML解析に関するDoS脆弱性
   - 影響: 限定的（外部からXMLを受け取らない）

2. **tar** (高)
   - sqlite3とelectron-rebuildの依存関係
   - ビルド時のみ使用
   - 影響: 実行時には影響なし

#### 進捗イベント
- speedtest-netの詳細な進捗イベント（downloadprogress、uploadprogress）は利用不可
- 基本的な phase: 'start' のみ提供

### テスト計画
1. 手動テスト実行の確認
2. 自動スケジュール測定の確認
3. サーバー選択機能の確認
4. エラーハンドリングの確認
5. データベース保存の確認
6. UIでの結果表示の確認

### ロールバック手順
万が一問題が発生した場合：

```bash
# universal-speedtest を削除
npm uninstall universal-speedtest

# speedtest-net を再インストール
npm install speedtest-net@2.2.0

# src/services/speedtest-service.js を旧バージョンに戻す
git checkout HEAD~1 src/services/speedtest-service.js
```

## 参考リンク
- [universal-speedtest GitHub](https://github.com/karelkryda/universal-speedtest)
- [universal-speedtest npm](https://www.npmjs.com/package/universal-speedtest)
- [ドキュメント](https://karel-kryda.gitbook.io/universal-speedtest/v/3)
