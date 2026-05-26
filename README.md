# OBJ to 2D Laser Workflow

This project converts 3D OBJ geometry into 2D laser engraving or cutting files.

## Pipeline

1. Import OBJ
   - Read vertices, faces, groups, and material hints.
   - Normalize units to millimeters.
   - Validate mesh geometry before conversion.

2. Choose Output Mode
   - Surface unfold: flatten mesh faces into connected 2D patterns.
   - Layer slicing: slice the model into material-thickness layers.

3. Geometry Cleanup
   - Remove duplicate vertices and degenerate faces.
   - Repair or report open boundaries, self-intersections, and non-manifold edges.
   - Snap nearly identical points and paths using the configured snapping tolerance.

4. Layout Generation
   - Generate 2D paths from unfolded faces or sliced contours.
   - Join compatible path segments after snapping.
   - Assign cut, score, and engrave layers.
   - Generate tabs, slots, and part numbers when assembly output is enabled.

5. Joinery and Numbering
   - Automatically generate tab-and-slot joinery for matching edges.
   - Size tabs and slots from material thickness, kerf width, and configured clearance.
   - Add engraved part numbers and optional edge-pair labels for assembly.
   - Keep generated labels on an engrave layer so they do not become cut paths.

6. Kerf Compensation
   - Apply kerf compensation before final export.
   - For cut paths, offset geometry by half the configured kerf width when true dimensional compensation is requested.
   - For visual or machine-preview workflows, export the configured stroke width to represent the laser kerf.

7. Export
   - Write SVG or DXF.
   - Preserve layer names, colors, stroke widths, and path ordering.
   - Run final checks for duplicate paths, open cut paths, and incorrect scale.
   - Prefer DXF for laser engraving workflows that need cut, score, engrave, and numbering layers.

## Flow Control Parameters

| Parameter | Purpose | Default |
| --- | --- | --- |
| `unit` | Input and output unit normalization. | `mm` |
| `mode` | `surface-unfold` or `layer-slice`. | `layer-slice` |
| `materialThicknessMm` | Slice interval or construction material thickness. | `3.0` |
| `kerfWidthMm` | Laser cut width used for compensation or stroke output. | `0.15` |
| `kerfMode` | `none`, `stroke`, or `offset`. | `stroke` |
| `snappingToleranceMm` | Maximum distance for merging points or coincident paths. | `0.01` |
| `dedupePaths` | Merge duplicate or overlapping paths to reduce cutting time. | `true` |
| `generateJoinery` | Automatically create tab-and-slot assembly features. | `true` |
| `tabWidthMm` | Width of each generated tab. | `10.0` |
| `tabDepthMm` | Tab depth, usually based on material thickness. | `materialThicknessMm` |
| `slotClearanceMm` | Extra slot clearance for fit after kerf and material tolerance. | `0.1` |
| `numberParts` | Engrave part numbers on generated pieces. | `true` |
| `numberPrefix` | Prefix used for engraved part IDs. | `P` |
| `outputFormat` | `svg` or `dxf`. | `svg` |

## Kerf Rules

- `kerfMode: none`
  - Export exact geometry.
  - Use when the laser software handles kerf compensation.

- `kerfMode: stroke`
  - Keep geometry centerlines unchanged.
  - Set exported stroke width to `kerfWidthMm`.
  - Useful for previewing or workflows where line width is interpreted by the machine setup.

- `kerfMode: offset`
  - Offset closed cut paths by `kerfWidthMm / 2`.
  - Outer profiles offset outward.
  - Inner holes offset inward.
  - Use when the exported file must already contain final compensated dimensions.

## Snapping Rules

- Snap vertices whose distance is less than or equal to `snappingToleranceMm`.
- Join path endpoints after snapping when their endpoints coincide.
- Remove exact duplicate paths after normalization.
- Prefer longer continuous paths over many small segments when the geometry is equivalent.
- Report ambiguous overlaps instead of silently deleting paths that only partially overlap.

## Joinery and Numbering Rules

- Generate tabs only on edges that are intended to connect to another part.
- Generate matching slots or receiving cuts on the paired edge.
- Use `materialThicknessMm` as the default tab depth.
- Add `slotClearanceMm` so parts can assemble after real-world kerf and material variation.
- Avoid placing tabs too close to corners, small holes, engraved labels, or other tabs.
- Assign part numbers to an engrave layer, not a cut layer.
- Use stable numbering so repeated exports produce the same part IDs when geometry has not changed.
- Include optional edge-pair labels when assembly order matters.

## Verification

An output is considered valid when:

- The output scale matches the requested millimeter dimensions.
- Closed cut paths remain closed after snapping and kerf compensation.
- Duplicate full-length paths are removed.
- Stroke width reflects `kerfWidthMm` when `kerfMode` is `stroke`.
- Offset geometry changes dimensions by the expected `kerfWidthMm / 2` per cut edge when `kerfMode` is `offset`.
- Generated tabs and slots have matching dimensions after kerf and clearance rules.
- Part numbers are present on the engrave layer and do not intersect cut paths.
- DXF output preserves separate cut, score, engrave, numbering, and joinery layers.

## 繁體中文說明

本專案目標是將 3D OBJ 模型轉換成可用於雷射雕刻或雷射切割的 2D 檔案，例如 SVG 或 DXF。

### 轉換流程

1. 匯入 OBJ
   - 讀取頂點、面、群組與材質提示。
   - 將單位統一轉換為毫米。
   - 在轉換前檢查模型幾何是否可用。

2. 選擇輸出模式
   - 表面展開：將 3D 模型表面攤平成可切割或折疊的 2D 圖形。
   - 分層切片：依材料厚度將模型切成多層 2D 輪廓。

3. 幾何清理
   - 移除重複頂點與無效面。
   - 修復或回報破洞、自交、非流形邊等問題。
   - 依 `snappingToleranceMm` 將非常接近的點、端點與路徑精準對齊。

4. 產生 2D 版面
   - 從展開面或切片輪廓產生 2D 路徑。
   - Snapping 後合併可連接的路徑段。
   - 分配切割、折線、雕刻等圖層。
   - 啟用組裝輸出時，自動產生卡榫、插槽與零件編號。

5. 卡榫與編號
   - 針對需要組裝的對應邊，自動產生卡榫與插槽。
   - 依材料厚度、切縫寬度與組裝間隙計算卡榫尺寸。
   - 在零件上加入雷雕編號，也可加入對應邊標籤，方便組裝。
   - 編號與標籤必須放在雕刻圖層，避免被當成切割線。

6. 切縫補償
   - 在輸出前套用 kerf 設定。
   - 若只是要模擬雷射切縫，可用 `kerfMode: stroke` 設定輸出線寬。
   - 若需要真正尺寸補償，可用 `kerfMode: offset` 對封閉切割路徑做幾何偏移。

7. 輸出檔案
   - 輸出 SVG 或 DXF。
   - 保留圖層名稱、顏色、線寬與路徑順序。
   - 最後檢查重複路徑、未閉合切割線與比例錯誤。
   - 若目標是雷射雕刻與切割流程，優先輸出 DXF，並保留切割、折線、雕刻與編號圖層。

### 流程控制參數

| 參數 | 用途 | 預設值 |
| --- | --- | --- |
| `unit` | 輸入與輸出的單位標準化。 | `mm` |
| `mode` | `surface-unfold` 表面展開，或 `layer-slice` 分層切片。 | `layer-slice` |
| `materialThicknessMm` | 材料厚度或切片間距。 | `3.0` |
| `kerfWidthMm` | 雷射切縫寬度，用於線寬模擬或尺寸補償。 | `0.15` |
| `kerfMode` | `none`、`stroke` 或 `offset`。 | `stroke` |
| `snappingToleranceMm` | 合併近似點或重合路徑的距離容許值。 | `0.01` |
| `dedupePaths` | 是否合併重複或重疊路徑以節省切割時間。 | `true` |
| `generateJoinery` | 是否自動產生卡榫與插槽組裝結構。 | `true` |
| `tabWidthMm` | 每個卡榫的寬度。 | `10.0` |
| `tabDepthMm` | 卡榫深度，通常等於材料厚度。 | `materialThicknessMm` |
| `slotClearanceMm` | 插槽額外間隙，用於補償實際材料與切縫誤差。 | `0.1` |
| `numberParts` | 是否在零件上雷雕編號。 | `true` |
| `numberPrefix` | 零件編號前綴。 | `P` |
| `outputFormat` | 輸出格式，`svg` 或 `dxf`。 | `svg` |

### Kerf 切縫規則

- `kerfMode: none`
  - 直接輸出原始幾何。
  - 適合由雷射軟體自行處理切縫補償。

- `kerfMode: stroke`
  - 路徑中心線不變。
  - 將輸出線寬設為 `kerfWidthMm`。
  - 適合用於預覽切縫，或機台流程會解讀線寬的情況。

- `kerfMode: offset`
  - 封閉切割路徑依 `kerfWidthMm / 2` 做偏移。
  - 外輪廓向外偏移。
  - 內孔洞向內偏移。
  - 適合輸出檔案本身就必須包含最終補償尺寸的情況。

### Snapping 對齊與去重規則

- 距離小於或等於 `snappingToleranceMm` 的頂點會被合併。
- 路徑端點經 snapping 後重合時，會嘗試接成連續路徑。
- 正規化後完全重複的路徑會被移除。
- 在幾何等價時，優先保留較長、較連續的路徑，減少機台空跑與重切。
- 若路徑只是部分重疊且無法安全判斷，應回報問題，而不是直接刪除。

### 卡榫與編號規則

- 只在需要與其他零件接合的邊上產生卡榫。
- 對應邊必須產生匹配的插槽或接收切口。
- 預設使用 `materialThicknessMm` 作為卡榫深度。
- 透過 `slotClearanceMm` 增加插槽間隙，避免實際材料公差造成無法組裝。
- 避免把卡榫放在太靠近角落、小孔、雕刻文字或其他卡榫的位置。
- 零件編號必須放在雕刻圖層，不可放在切割圖層。
- 幾何未改變時，重複輸出應產生相同的零件編號。
- 若組裝順序重要，可加入對應邊標籤。

### 驗證標準

輸出結果需符合下列條件：

- 輸出比例與毫米尺寸正確。
- 封閉切割路徑在 snapping 與 kerf 補償後仍保持封閉。
- 完全重複的切割路徑已移除。
- `kerfMode: stroke` 時，輸出線寬等於 `kerfWidthMm`。
- `kerfMode: offset` 時，幾何尺寸依每側 `kerfWidthMm / 2` 正確補償。
- 自動產生的卡榫與插槽在套用 kerf 與 clearance 後尺寸相符。
- 零件編號存在於雕刻圖層，且不與切割線相交。
- DXF 輸出保留切割、折線、雕刻、編號與卡榫相關圖層。
