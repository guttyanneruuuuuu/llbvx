# NEON RUSH — Cyber Arena Shooter 🎮

スマホブラウザ向けのネオン系トップダウン・アクションシューター。
グラフィック&デザイン重視。依存ライブラリなしの Vanilla JS + Canvas 製。

## 遊び方
- **左側タッチ**: バーチャルスティックで移動
- **射撃**: 最寄りの敵に自動照準で連射
- **右側タップ**: ダッシュ(無敵回避)
- 敵のウェーブを生き延びてハイスコアを狙おう!

## 特徴
- ネオングロー / パーティクル / 画面シェイク / コンボ演出
- WebAudio によるプロシージャルSE
- localStorage ハイスコア保存
- PC でも動作(WASD/矢印 + Space ダッシュ)

## 起動
静的サイトなのでそのままホスティング可能:
```bash
python3 -m http.server 8000
```

## 構成
```
index.html
css/style.css     # UI / HUD / タイトル演出
js/audio.js       # WebAudio SE エンジン
js/particles.js   # パーティクルシステム
js/entities.js    # プレイヤー / 敵 / 弾
js/game.js        # メインループ / 入力 / ウェーブ管理
```
