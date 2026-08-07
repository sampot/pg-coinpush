# pg-coinpush

**推幣機**：投下代幣、推板來回推動、從前方邊緣掉落得分。純前端，無建置步驟。

名稱與盤面為原創小品，致敬「推幣機」玩法類型，非任一商業機台復刻；**純娛樂計分**，代幣與分數無關真實金錢或賭博。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。手感想再調？開進來玩，再叫 AI 幫你改一版。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot%2Fpg-coinpush&name=%E6%8E%A8%E5%B9%A3%E6%A9%9F)**

```
https://play.samkuo.me/?open=sampot/pg-coinpush&name=推幣機
```

同源會重用本機已匯入的沙盒；要強制新建可加 `&fresh=1`。

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

點一下頁面後音效才會出聲。

## 操作

| 操作 | 說明 |
| --- | --- |
| 開台 | 開始一局（20 枚代幣） |
| **+20 幣** | 無限續幣（娛樂點數，可反覆加） |
| 點擊／觸控機台 | 在該 X 位置投下代幣（耗 1 枚） |
| 音效開／關 | 靜音 |
| 重來 | 分數與代幣重置、重新鋪幣 |

## 規則摘要

- 推板緩慢來回振盪，把幣推向機台前方
- 幣與幣簡易圓形碰撞堆疊（非完整物理引擎）
- 從前方邊緣掉落的幣各得 10 分
- 代幣用盡可點「+20 幣」無限續投，或「重來／再開一局」

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 結構 |
| `styles.css` | 亮／暗色主題 |
| `app.js` | Canvas、輸入、HUD |
| `game.js` | 推板、碰撞、計分 |
| `sprites.js` | 機台與代幣繪製 |
| `audio.js` | Web Audio 合成音效 |
| `functions.js` | Playgrounds 可選 stub |

## License

MIT
