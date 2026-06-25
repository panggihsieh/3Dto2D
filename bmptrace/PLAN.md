# BMPTrace 漸層雷刻測試規劃

## 目標

建立一個獨立的 BMPTrace 工作流程，用來產生 5 個灰階分離 SVG 圖層，作為漸層雷射雕刻測試檔案。

第一個目標機型設定為 FLUX 30W。工具也應允許切換到 40W 與 50W 額定雷射功率設定，方便未來校正。

## 中文說明

BMPTrace 是一個獨立的 FLUX / Beam Studio 漸層雷刻測試工具。它會把上傳的 bitmap 圖片轉成 5 個灰階分離圖層，每一層使用固定灰階填色，方便在 Beam Studio 裡用「依顏色 / 灰階填色分層」匯入。

預設機型是 `FLUX 30W`，也可以切換成 `FLUX 40W` 或 `FLUX 50W`。這裡的 30W / 40W / 50W 是機器額定功率，不是直接輸出的雷射功率。

5 層的建議雷刻功率從 `8%` 到 `40%` 均分：

- `L01` 是最淺層，建議 `8.0%`
- `L05` 是最深層，建議 `40.0%`

SVG 匯出時會保留：

- 圖層名稱
- 顏色
- 建議功率百分比
- 估算瓦數
- FLUX 機型設定
- 校正提醒

Beam Studio 不一定會自動讀取 SVG metadata 或圖層名稱來設定功率，所以實務上建議用「5 個灰階填色分層 + CSV 功率表」手動或半自動設定 Beam Studio 參數。

## English Summary

BMPTrace is a standalone FLUX / Beam Studio gradient engraving test tool. It converts an uploaded bitmap image into 5 grayscale-separated layers. Each layer uses a fixed grayscale fill so the exported SVG can be imported into Beam Studio by color/gray fill.

The default machine profile is `FLUX 30W`, with optional `FLUX 40W` and `FLUX 50W` profiles. These values represent the machine's rated laser power, not the direct engraving output.

The 5 suggested engraving layers are evenly distributed from `8%` to `40%` power:

- `L01` is the lightest layer, suggested at `8.0%`
- `L05` is the darkest layer, suggested at `40.0%`

The exported SVG includes:

- Layer names
- Grayscale layer fills
- Suggested power percentage
- Estimated watts
- FLUX machine profile
- Calibration notes

Beam Studio should not be assumed to automatically apply power settings from SVG metadata or layer names. The safer workflow is to import by color and use the exported CSV power table to set each Beam Studio color layer.

## 機器功率設定

將 `30W`、`40W`、`50W` 視為機器額定功率設定，而不是直接套用到每個圖層的雷射輸出功率。

預設設定：

- 機器：FLUX
- 額定功率：30W
- 圖層數：5
- 雕刻功率範圍：8% 到 40%

可選設定：

- FLUX 30W
- FLUX 40W
- FLUX 50W

## 5 層漸層功率表

在預設 30W 設定下，從淺到深產生 5 個圖層。建議雕刻功率由 8% 到 40% 均分。

| 圖層 | 色調 | 建議功率 |
| --- | --- | --- |
| L01 | 最淺 | 8.0% |
| L02 |  | 16.0% |
| L03 |  | 24.0% |
| L04 |  | 32.0% |
| L05 | 最深 | 40.0% |

估算光學輸出功率只作為參考：

```text
estimated watts = rated machine watts * suggested power percent / 100
```

以 30W 機器為例，8% 到 40% 約等於 2.4W 到 12.0W 的估算輸出。實際雕刻效果仍必須依材質、速度、焦距、鏡片狀態與光路校正結果測試。

## SVG 圖層中繼資料

每個匯出的 SVG 圖層應包含：

- 圖層 id：`L01` 到 `L05`
- 色調範圍：由淺到深的灰階門檻區段
- 機器設定：`FLUX 30W`、`FLUX 40W` 或 `FLUX 50W`
- 建議功率百分比
- 參考用估算瓦數
- 校正提醒：正式製作前必須用實際 FLUX beamo 材料測試確認

圖層命名範例：

```text
L01_lightest_power_8.0pct_flux_30w
L05_darkest_power_40.0pct_flux_30w
```

## Trace 策略

先從純瀏覽器灰階分離流程開始：

1. 將 bitmap 載入 Canvas。
2. 將像素轉成灰階。
3. 將灰階值分成 5 個門檻區段。
4. 每個區段產生一個 SVG group。
5. 匯出分層 SVG，供 FLUX 軟體或 Inkscape 檢查。

BMPTrace 應支援兩種純瀏覽器輸出模式：

- 快速矩形分層：將取樣後的連續像素區段輸出成 SVG rectangles。
- 平滑 Trace 分層：對每個灰階區段遮罩使用 ImageTracerJS 產生向量 paths。

平滑 Trace 模式屬於 Potrace 風格的瀏覽器端向量化，但不需要安裝 Inkscape 或 Potrace。它適合較平滑的輪廓輸出；矩形分層模式則保留作為較可預測的密集雕刻測試輸出。

預設 Bitmap Trace 參數對應 Inkscape「多次掃描 / 灰階」設定：

- 偵測模式：灰階
- 掃描數：5
- 平滑：啟用
- 移除背景：啟用
- 斑點：2
- 平滑轉角：1.00
- 最佳化：0.200

匯出的 SVG 應包含 5 個 traced path 圖層，而不是單一合併影像。CSV 功率表與 SVG metadata 需記錄這些 trace 參數，方便之後導入真正的 Inkscape CLI helper。

## Inkscape CLI 模式

若要改用 Inkscape CLI 品質模式，使用端或伺服端必須先安裝 Inkscape。此模式品質接近 Inkscape 的 trace / 向量處理流程，但純 GitHub Pages 或一般瀏覽器頁面無法直接啟動本機 `inkscape` 指令。

可行架構：

- 使用端安裝 Inkscape，並執行本機 helper，由 helper 呼叫 `inkscape` CLI。
- 伺服端安裝 Inkscape，由後端服務接收圖片或 SVG 後呼叫 `inkscape` CLI。
- BMPTrace 頁面載入時先詢問本機 helper：`http://127.0.0.1:4175/status`。
- 若 helper 回報找到 Inkscape，頁面顯示 `inkscape.exe` 安裝位置。
- 若 helper 未啟動或找不到 Inkscape，頁面提示使用者安裝 Inkscape 或啟動 helper。

## GitHub Actions 批次高品質 Trace

GitHub Pages 不能安裝或執行 Inkscape，但 GitHub Actions runner 可以。BMPTrace 以 `BMPTrace Batch High Quality Trace` workflow 提供批次輸出流程。

批次流程：

1. 手動啟動 GitHub Actions workflow。
2. 指定 repo 內的輸入圖片路徑，例如 `bmptrace/assets/sample.png`。
3. Actions 安裝 Inkscape、Potrace、Pillow。
4. 腳本依灰階分成 5 個遮罩。
5. 使用 Potrace 逐層輸出向量 path。
6. 組合成 5 層 SVG，並輸出 Beam Studio 功率表 CSV。
7. 將 SVG 與 CSV 上傳為 workflow artifact。

注意：Inkscape GUI 的 Trace Bitmap 面板目前不適合作為穩定 CLI 自動化入口。批次 workflow 以 Potrace 執行實際 tracing，Inkscape 則用於 SVG 輸入 rasterize 或檢查支援。

官方下載頁面：

```text
https://inkscape.org/release/
```

本機 helper 啟動方式：

```powershell
node bmptrace/helper/inkscape-helper.js
```

## 驗證標準

- 預設設定為 FLUX 30W。
- 可選擇 40W 與 50W 設定。
- 當額定功率設定改變時，5 個圖層會重新計算估算瓦數。
- 除非使用者調整雕刻範圍，建議功率百分比維持 8% 到 40%。
- 匯出的 SVG 包含 5 個命名圖層與機器 / 功率中繼資料。
