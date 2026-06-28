# Function Samples

此目錄放置 `function/` 自動接榫繪製與檢驗用的獨立 SVG 範例。

來源概念沿用 `joint/` 頁面的兩個練習範例，但檔案放在 `function/`，避免影響目前既有專案目錄與 UI。

## Samples

- `basic_cube.svg`
  - 來源：`basic/` 的正立方體範本。
  - 部件：`top`、`bottom`、`front`、`back`、`left`、`right`。
  - 內尺寸：`60mm x 60mm x 60mm`。

- `basic_cuboid.svg`
  - 來源：`basic/` 的長方體範本。
  - 部件：`top`、`bottom`、`front`、`back`、`left`、`right`。
  - 內尺寸：`length = 120mm`、`width = 80mm`、`height = 60mm`。

- `basic_gable_house.svg`
  - 來源：`basic/` 的雙斜屋頂小屋範本。
  - 部件：`floor`、`left_wall`、`right_wall`、`front_gable`、`back_gable`、`roof_left`、`roof_right`。
  - 內尺寸參數：`length = 120mm`、`width = 80mm`、`wallHeight = 55mm`、`roofHeight = 35mm`。

- `cuboid_practice.svg`
  - 長方體練習 SVG。
  - 部件：`top`、`bottom`、`front`、`back`、`left`、`right`。
  - 尺寸：`length = 120mm`、`width = 80mm`、`height = 60mm`。

- `gable_house_practice.svg`
  - 斜頂房屋練習 SVG。
  - 部件：`floor`、`left_wall`、`right_wall`、`front_gable`、`back_gable`、`roof_left`、`roof_right`。
  - 內尺寸參數：`length = 120mm`、`width = 80mm`、`wallHeight = 55mm`、`roofHeight = 35mm`、`materialThickness = 3mm`。
  - 因為是內尺寸模式，底板與牆面參考尺寸會先加上兩側板厚。

## Intended Use

### Check Function Tests

使用 basic 範例作為 check 函數測試：

- `basic_cube.svg`
- `basic_cuboid.svg`
- `basic_gable_house.svg`

測試目的：

1. 匯入 SVG path 作為黑線。
2. 產生灰線。
3. 產生測試紅線。
4. 執行 `checkJoineryPath()` 與整體 polygon offset 檢驗。

### Draw Function Tests

使用 joint 範例作為 draw 函數測試：

- `cuboid_practice.svg`
- `gable_house_practice.svg`

測試目的：

1. 匯入 SVG path 作為黑線。
2. 產生灰線。
3. 執行 `drawJoineryPath()` 產生紅線。
4. 輸出黑線、灰線、紅線三層 SVG 到 `function/output/`。
