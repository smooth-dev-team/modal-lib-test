---
applyTo: "**"
description: Sheet Navigation System 要件定義（v1）
---

## 重要

- **参考**：このプロジェクトではMotionを使うので、必ずdocs/motion-docs/フォルダにあるドキュメント群をこまめに参照してください。

## 0. 目的と範囲

- **目的**：アプリ内の“Sheet（下から出るモーダル）”で、**URL による状態共有**と**直感的なスワイプ遷移/閉じる**を両立し、**壊れにくく拡張しやすい**実装基盤を提供する。
- **対象**：Next.js App Router + Framer Motion（Motion）で構築する **軽量シート型 UI**。
  Intercepting/Parallel は**使わない**（将来一部画面を昇格できる拡張点は残す）。
- **非対象**（v1）：SEO最適化・SSR専用ページ、複数同時シート、ドラッグでの複雑な multi-stack。

---

## 1. URL 仕様

- **クエリ構造（単一シート）**

    - `m=<modalId>` … シートの種類（例：`settings`, `dashboard`）
    - `p=<panelPath>` … パネルパス（階層可、`/` 区切り・ケバブ or スネーク英語）
    - 例：

        - `?m=settings&p=main`
        - `?m=settings&p=profile/address`
        - `?m=dashboard&p=insights`

- **直リンク**：`m`/`p` 付き URL はリロード/共有で同じ面を再現（履歴スタックは復元しない）。
- **未定義値の扱い**

    - 未知の `m` は**無視してシート非表示**。
    - 既知の `m` で未知の `p` は**定義済みデフォルト（例：`main`）へフォールバック**。

- **セキュリティ**

    - `modalId`/`panelPath` は**ホワイトリスト照合**（レジストリで定義されたもののみ有効）。
    - 受け取った文字列は**正規表現**でバリデーション（`^[a-z0-9\-\/]+$` など）。

---

## 2. シートの開閉・遷移と履歴モデル

- **開く**：`router.push('?m=<id>&p=<path>', { shallow: true, scroll: false })`

    - 戻るで閉じられるよう**push**固定。

- **閉じる**：原則 `router.back()`。

    - **直リンク起点**と判定した場合のみ、**ベースURLへ replace**（例：`router.replace(pathname)`）。
    - 直リンク判定：`sessionStorage` の内部履歴が空、かつ `document.referrer` が同一オリジンでなく `m/p` の変更前状態が不明、など複合条件で実装。

- **パネル遷移**：**常に push**。

    - 戻る＝`router.back()`、進む＝`window.history.forward()` を呼ぶ。

- **内部履歴スタック（forward 可否表示用）**

    - `sessionStorage['sheet:<modalId>'] = { stack: string[], cursor: number }`

        - `stack`：URL 断片（`p` の列）。
        - `cursor`：現在位置のインデックス。

    - `popstate` で URL と **cursor** を同期し、UI の「戻る/進む」活性/非活性を制御。

- **リロード時**：URL の `m/p` だけ再現。`stack/cursor` は**破棄**。

---

## 3. ジェスチャ & 操作仕様

- **横スワイプ（パネル履歴）**

    - 右スワイプ＝**戻る**（履歴がある場合のみ確定）
    - 左スワイプ＝**進む**（forward がある場合のみ確定）

- **縦スワイプ（シートの閉鎖）**

    - **下方向ドラッグ**で**シートを閉じる**（距離・速度しきい値を満たすと確定）。

- **しきい値（調整可能）**

    - 横遷移確定：距離 `≥ 80px` **or** 速度 `≥ 0.35 px/ms`
    - 下閉じる確定：距離 `≥ 120px` **or** 速度 `≥ 0.5 px/ms`
    - これらは `SHEET_GESTURE_THRESHOLD` 定数で集中管理。

- **適用範囲**

    - モバイル：フルエリアで横/縦スワイプ有効。
    - デスクトップ：スワイプ**も**ボタン**も**有効（ポインタ/トラックパッド前提）。

- **競合回避**：横と縦の同時判定は**初期 8–12px で優勢方向をロック**。

---

## 4. アニメーション規約（Motion）

- **方向決定**

    - `panelDepth(next) > panelDepth(prev)` → **forward**（左→右基準のスライド）
    - `<` → **back**
    - `===`（同深度の横移動）：**左右固定**（例：常に左→右）
    - **深度が大きく飛ぶ**（例：`a`→`a/x/y/z` など）場合：**フェード + わずかなスライド**に切替。

- **トランジション**

    - `spring { stiffness: 400, damping: 34 }`（共通プリセット）
    - オーバースクロール表現：60–80px の弾性で**抵抗感**を出す。

- **ドラッグ追従**

    - `drag="x"`/`drag="y"` をシート内コンテナに付与。
    - `onDrag` で**追従描画**、`onDragEnd` で**確定/キャンセル**。

---

## 5. 動的インポート / プリフェッチ / スケルトン

- **レジストリ**：`PanelRegistry` に各 `modalId/panelPath` を登録（遅延 importer・深度・隣接候補）。
- **動的 import**：`next/dynamic`（SSR は用途に応じて可否を設定、デフォルトは CSR）。
- **プリフェッチ**

    - **隣接候補**（次/前 panel）を `requestIdleCallback` で先読み。
    - 既訪問パネルは**メモ化**して、横スワイプ時に**隣画面チラ見せ**を瞬時に行う。

- **フォールバック**

    - 各パネルに**軽量スケルトン**（アイコン/文言の骨格）を持つ。
    - データ取得が必要なパネルは**先に UI 骨格を表示**し、コンテンツ差し替え。

---

## 6. アクセシビリティ / キーボード / スクロール

- **ロール**：`role="dialog"` `aria-modal="true"`、`aria-labelledby`（シートタイトル）。
- **フォーカストラップ**：シート表示中は内部にフォーカスを閉じ込める。
- **初期フォーカス**：タイトル or 最初の操作ボタン。
- **閉じる操作**：Esc、オーバーレイクリック、クローズボタン、戻るスワイプ、縦スワイプ。
- **背景スクロール固定**：`body { overflow: hidden }` + スクロールバー補正（右パディング）。
- **閉じた後のフォーカス返却**：開ボタンへ戻す（`ref` を保持）。

---

## 7. 型・API（抜粋）

```ts
// URL state
type ModalId = "settings" | "dashboard"; // v1
type PanelPath = string; // 'main' | 'profile' | 'profile/address' ...

// Registry item
type PanelDef = {
    import: () => Promise<{ default: React.ComponentType<any> }>;
    depth: number; // パネル深度
    neighbors?: PanelPath[]; // プリフェッチ候補
    guard?: () => boolean; // 例: ログイン必須など（false なら p=login へ置換）
    fallback?: React.ReactNode; // スケルトン
};

type PanelRegistry = Record<ModalId, Record<PanelPath, PanelDef>>;

// Session history
type SheetHistory = {
    stack: PanelPath[]; // ['main','profile','profile/address']
    cursor: number; // 現在位置
};
```

- **公開ユーティリティ**

    - `openSheet(m: ModalId, p?: PanelPath)`
    - `closeSheet()`（直リンク検知時は replace）
    - `goPanel(p: PanelPath)`（push）
    - `canGoBack(): boolean` / `canGoForward(): boolean`
    - `goBack()`（router.back()）/ `goForward()`（window\.history.forward()）
    - `panelDepth(p: PanelPath): number`

---

## 8. エラーハンドリング / フォールバック

- **未知 `m`**：シート非表示、ログ記録のみ。
- **未知 `p`**：`defaultPanel`（例：`main`）へ差替え。
- **ガード不通過**：`p=login` へ置換（同一シート内で処理）。
- \*\* importer 失敗\*\*：エラーパネル（再試行ボタン）を表示。
- **データ取得失敗**：スケルトン→エラーカード（リトライ・エラーコード）。

---

## 9. 計測 / ロギング

- **仮想PV**：`m/p` 変更時に`page_view`（`page='/__sheet/<m>/<p>'` の仮想パス）。
- **操作イベント**：`sheet_open/close/panel_next/panel_prev/swipe_confirm/swipe_cancel`。
- **性能**：TTI 目標 < 150ms（再訪問パネル）、初回動的 import < 200ms（mid端末）。

---

## 10. パフォーマンス & 最適化

- **バンドル**：パネル単位でコード分割。
- **先読み**：隣接のみ。広範囲の prefetch は禁止。
- **Memo**：訪問済みパネルは**コンポーネントツリーを保持**して戻りを高速化（ただしメモリ上限 5 面などの LRU で管理）。
- **画像/リスト**：仮想化（必要時）と遅延読み込み。

---

## 11. 拡張性（将来）

- **Intercepting/Parallel への昇格**：
  特定の `panelPath` を通常ルートに昇格できるよう、**URL 設計はそのまま**でも意味が揃う命名を推奨（例：`settings/billing` → `/settings/billing`）。
- **複数シート**：`m` を配列に拡張可能だが、v1 は**単一のみ**。

---

## 12. スタイル / レイアウト（要点）

- **コンテナ**：`fixed inset-0 z-[sheet]`、安全領域（iOS）に配慮。
- **背景**：`bg-black/40`（クリックで閉じる）。
- **Sheet**：`rounded-t-3xl`、ハンドル（上部 24px のドラッグ領域）。
- **高さ**：内容に応じて `max-h-[86vh]`、内部は縦スクロール。
- **Z-index 規約**：`overlay: 1000`、`sheet: 1010`、`toast: 2000` など。

---

## 13. 受け入れ基準（Acceptance Criteria）

1. `?m=settings&p=main` でシートが開き、`Esc`/オーバーレイ/下スワイプ/クローズボタンで閉じる。
2. `p=main → p=profile → p=profile/address` と連続遷移で**方向アニメ**が期待通り。
3. 戻る/進むボタン・スワイプが**内部履歴**と**ブラウザ履歴**の双方と整合。
4. リロードで**現在の `m/p` のみ再現**し、内部履歴は消える。
5. 未知 `p` は `main` へ、未知 `m` はシート非表示。
6. スケルトン表示と importer 失敗時のリトライ UI がある。
7. フォーカストラップ・フォーカス返却が正しく動作。
8. `page_view`（仮想）と主要操作イベントが計測に送信される。
9. 端末中位で初回遷移の白画面が**200ms 未満**（スケルトン表示含む）。

---

## 14. 実装タスク（概略）

- [ ] `PanelRegistry` とバリデーション実装
- [ ] URL 同期フック：`useSheetUrlState()`（`m/p` の get/set）
- [ ] 履歴スタック：`useSheetHistory(modalId)`（`sessionStorage` + `popstate`）
- [ ] Sheet コンテナ：縦/横ドラッグ、方向アニメ、フォーカストラップ
- [ ] `openSheet/closeSheet/goPanel` ユーティリティ
- [ ] スケルトン/エラーパネル雛形
- [ ] 計測フック：`useSheetAnalytics()`
- [ ] E2E/ユニット：URL 遷移、履歴、A11y、しきい値、直リンク検知
- [ ] パフォーマンス計測 & しきい値/スプリング調整

---

## 15. 既定値（環境切替可能な定数）

```ts
export const SHEET_GESTURE_THRESHOLD = {
    horizontalDistance: 80,
    horizontalVelocity: 0.35,
    verticalDistanceToClose: 120,
    verticalVelocityToClose: 0.5,
    directionLockPx: 10, // 最初のこの距離で優勢方向をロック
};

export const SHEET_ANIMATION = {
    spring: { stiffness: 400, damping: 34 },
    overshootPx: 70,
};

export const SHEET_CACHE = {
    keepAlivePanels: 5, // LRU 上限
};
```
