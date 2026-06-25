# V4 Gradient Laser Engraving Test Plan

## Goal

Create a standalone V4 workflow for generating 12 grayscale-separated SVG layers for gradient laser engraving tests.

The first target machine profile is FLUX 30W. The tool should also allow switching to 40W and 50W rated laser profiles for future calibration.

## 中文說明

V4 是一個獨立的 FLUX / Beam Studio 漸層雷刻測試工具。它會把上傳的 bitmap 圖片轉成 12 個灰階分離圖層，每一層使用不同顏色，方便在 Beam Studio 裡用「依顏色分層」匯入。

預設機型是 `FLUX 30W`，也可以切換成 `FLUX 40W` 或 `FLUX 50W`。這裡的 30W / 40W / 50W 是機器額定功率，不是直接輸出的雷射功率。

12 層的建議雷刻功率從 `8%` 到 `40%` 均分：

- `L01` 是最淺層，建議 `8.0%`
- `L12` 是最深層，建議 `40.0%`

SVG 匯出時會保留：

- 圖層名稱
- 顏色
- 建議功率百分比
- 估算瓦數
- FLUX 機型設定
- 校正提醒

Beam Studio 不一定會自動讀取 SVG metadata 或圖層名稱來設定功率，所以實務上建議用「12 色分層 + CSV 功率表」手動或半自動設定 Beam Studio 參數。

## English Description

V4 is a standalone FLUX / Beam Studio gradient engraving test tool. It converts an uploaded bitmap image into 12 grayscale-separated layers. Each layer uses a fixed color so the exported SVG can be imported into Beam Studio by color.

The default machine profile is `FLUX 30W`, with optional `FLUX 40W` and `FLUX 50W` profiles. These values represent the machine's rated laser power, not the direct engraving output.

The 12 suggested engraving layers are evenly distributed from `8%` to `40%` power:

- `L01` is the lightest layer, suggested at `8.0%`
- `L12` is the darkest layer, suggested at `40.0%`

The exported SVG includes:

- Layer names
- Layer colors
- Suggested power percentage
- Estimated watts
- FLUX machine profile
- Calibration notes

Beam Studio should not be assumed to automatically apply power settings from SVG metadata or layer names. The safer workflow is to import by color and use the exported CSV power table to set each Beam Studio color layer.

## Machine Power Profiles

Treat `30W`, `40W`, and `50W` as machine rated-power profiles, not as direct layer power values.

Default profile:

- Machine: FLUX
- Rated power: 30W
- Layer count: 12
- Engraving power range: 8% to 40%

Selectable profiles:

- FLUX 30W
- FLUX 40W
- FLUX 50W

## 12-Layer Gradient Power Table

For the default 30W profile, generate 12 layers from light to dark. The suggested engraving power is evenly distributed from 8% to 40%.

| Layer | Tone | Suggested power |
| --- | --- | --- |
| L01 | Lightest | 8.0% |
| L02 |  | 10.9% |
| L03 |  | 13.8% |
| L04 |  | 16.7% |
| L05 |  | 19.6% |
| L06 |  | 22.5% |
| L07 |  | 25.5% |
| L08 |  | 28.4% |
| L09 |  | 31.3% |
| L10 |  | 34.2% |
| L11 |  | 37.1% |
| L12 | Darkest | 40.0% |

Estimated optical power can be shown as a reference only:

```text
estimated watts = rated machine watts * suggested power percent / 100
```

For a 30W machine, the 8% to 40% range corresponds to about 2.4W to 12.0W estimated output. Actual engraving behavior must be calibrated by material, speed, focus, lens condition, and beam alignment.

## SVG Layer Metadata

Each exported SVG layer should include:

- Layer id: `L01` through `L12`
- Tone range: light to dark grayscale threshold band
- Machine profile: `FLUX 30W`, `FLUX 40W`, or `FLUX 50W`
- Suggested power percent
- Estimated watts as reference
- Calibration note: verify with real FLUX beamo material tests before production

Example layer naming:

```text
L01_lightest_power_8.0pct_flux_30w
L12_darkest_power_40.0pct_flux_30w
```

## Trace Strategy

Start with a browser-only grayscale separation workflow:

1. Load bitmap into Canvas.
2. Convert pixels to grayscale.
3. Split grayscale values into 12 threshold bands.
4. Generate one SVG group per band.
5. Export a layered SVG for FLUX software or Inkscape inspection.

Bitmap trace quality can be improved later with Potrace-style path fitting if the first browser-only contour output is too jagged.

## Verification

- Default profile is FLUX 30W.
- 40W and 50W profiles are selectable.
- The 12 layers recalculate their estimated watts when the rated profile changes.
- The suggested power percent table remains 8% to 40% unless the user changes the engraving range.
- Exported SVG contains 12 named layers and machine/power metadata.
