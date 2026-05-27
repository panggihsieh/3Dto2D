# OBJ to 2D Laser Workflow

This project converts 3D OBJ geometry into 2D laser engraving or cutting files.

## Webapp

The V1 static webapp is available in `index.html`.

Run a local static server from the project folder:

```powershell
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8'};http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/' )u='/index.html';const f=path.join(root,u);if(!f.startsWith(root)){res.writeHead(403);return res.end('Forbidden')}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('Not found')}else{res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(d)}})}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173/'))"
```

Then open:

```text
http://127.0.0.1:4173/
```

V1 currently supports:

- OBJ upload in the browser.
- XY projection into 2D laser paths.
- Snapping and duplicate edge removal.
- Kerf mode parameters.
- Basic tab and slot preview marks.
- No default part-number watermark text.
- SVG preview.
- DXF and SVG download.

The current webapp is a frontend V1 prototype. Production-quality surface unfolding, polygon offsetting, and robust joinery generation should move into a backend geometry engine.

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
- Generate tabs and slots when assembly output is enabled.

5. Joinery
   - Automatically generate tab-and-slot joinery for matching edges.
   - Size tabs and slots from material thickness, kerf width, and configured clearance.
   - Do not add default watermark or part-number text in V1.

6. Kerf Compensation
   - Apply kerf compensation before final export.
   - For cut paths, offset geometry by half the configured kerf width when true dimensional compensation is requested.
   - For visual or machine-preview workflows, export the configured stroke width to represent the laser kerf.

7. Export
   - Write SVG or DXF.
   - Preserve layer names, colors, stroke widths, and path ordering.
   - Run final checks for duplicate paths, open cut paths, and incorrect scale.
   - Prefer DXF for laser engraving workflows that need cut, score, engrave, and joinery layers.

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

## Joinery Rules

- Generate tabs only on edges that are intended to connect to another part.
- Generate matching slots or receiving cuts on the paired edge.
- Use `materialThicknessMm` as the default tab depth.
- Add `slotClearanceMm` so parts can assemble after real-world kerf and material variation.
- Avoid placing tabs too close to corners, small holes, or other tabs.
- Do not add default part-number text or watermark text in V1.

## Verification

An output is considered valid when:

- The output scale matches the requested millimeter dimensions.
- Closed cut paths remain closed after snapping and kerf compensation.
- Duplicate full-length paths are removed.
- Stroke width reflects `kerfWidthMm` when `kerfMode` is `stroke`.
- Offset geometry changes dimensions by the expected `kerfWidthMm / 2` per cut edge when `kerfMode` is `offset`.
- Generated tabs and slots have matching dimensions after kerf and clearance rules.
- No default watermark text such as `P-001` appears in preview, SVG, or DXF output.
- DXF output preserves separate cut, score, engrave, and joinery layers.

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
   - 啟用組裝輸出時，自動產生卡榫與插槽。

5. 卡榫
   - 針對需要組裝的對應邊，自動產生卡榫與插槽。
   - 依材料厚度、切縫寬度與組裝間隙計算卡榫尺寸。
   - V1 不加入預設浮水印或零件編號文字。

6. 切縫補償
   - 在輸出前套用 kerf 設定。
   - 若只是要模擬雷射切縫，可用 `kerfMode: stroke` 設定輸出線寬。
   - 若需要真正尺寸補償，可用 `kerfMode: offset` 對封閉切割路徑做幾何偏移。

7. 輸出檔案
   - 輸出 SVG 或 DXF。
   - 保留圖層名稱、顏色、線寬與路徑順序。
   - 最後檢查重複路徑、未閉合切割線與比例錯誤。
   - 若目標是雷射雕刻與切割流程，優先輸出 DXF，並保留切割、折線、雕刻與卡榫圖層。

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

### 卡榫規則

- 只在需要與其他零件接合的邊上產生卡榫。
- 對應邊必須產生匹配的插槽或接收切口。
- 預設使用 `materialThicknessMm` 作為卡榫深度。
- 透過 `slotClearanceMm` 增加插槽間隙，避免實際材料公差造成無法組裝。
- 避免把卡榫放在太靠近角落、小孔或其他卡榫的位置。
- V1 不加入預設零件編號或浮水印文字。

### 驗證標準

輸出結果需符合下列條件：

- 輸出比例與毫米尺寸正確。
- 封閉切割路徑在 snapping 與 kerf 補償後仍保持封閉。
- 完全重複的切割路徑已移除。
- `kerfMode: stroke` 時，輸出線寬等於 `kerfWidthMm`。
- `kerfMode: offset` 時，幾何尺寸依每側 `kerfWidthMm / 2` 正確補償。
- 自動產生的卡榫與插槽在套用 kerf 與 clearance 後尺寸相符。
- 預覽、SVG 與 DXF 輸出不會出現 `P-001` 這類預設浮水印文字。
- DXF 輸出保留切割、折線、雕刻與卡榫相關圖層。

## V1 Public Webapp Requirements

V1 is the first public webapp version. It should stay small, testable, and focused on converting one OBJ file into laser-ready 2D output.

### V1 Scope

- Upload one `.obj` file.
- Validate file type and file size before conversion.
- Set core laser parameters:
  - `materialThicknessMm`
  - `kerfWidthMm`
  - `kerfMode`
  - `snappingToleranceMm`
  - `generateJoinery`
  - `tabWidthMm`
  - `slotClearanceMm`
  - `outputFormat`
- Convert OBJ geometry into 2D laser paths.
- Do not add default watermark or part-number text.
- Optionally generate tab-and-slot joinery when `generateJoinery` is enabled.
- Preview the 2D output before download.
- Export DXF for laser engraving and cutting.
- Export SVG as a secondary preview or compatibility format.

### V1 Non-Goals

- No user accounts.
- No permanent cloud storage.
- No payment system.
- No multi-file batch conversion.
- No advanced 3D editor.
- No guaranteed support for arbitrary organic curved meshes.
- No automatic repair of severely broken OBJ geometry.

### V1 Webapp Screens

1. Upload Screen
   - File picker for `.obj`.
   - File size limit notice.
   - Basic project name field.

2. Parameter Screen
   - Material thickness input.
   - Kerf width input.
   - Kerf mode selector: `none`, `stroke`, `offset`.
   - Snapping tolerance input.
   - Joinery toggle.
   - Tab width and slot clearance inputs.
   - Output format selector, defaulting to DXF.

3. Preview Screen
   - 2D layer preview.
   - Distinct colors for cut, score, engrave, and joinery layers.
   - Overall width and height in millimeters.
   - Warning list for open paths, duplicate paths, or unsupported geometry.

4. Download Screen
   - Download DXF.
   - Download SVG when enabled.
   - Show conversion summary and warnings.

### V1 Backend Requirements

- Parse OBJ without executing or trusting file content.
- Reject files above the configured size limit.
- Run conversion with a timeout.
- Keep uploaded and generated files temporary.
- Produce deterministic output for the same OBJ and same parameters.
- Separate generated output into named layers:
  - `CUT`
  - `SCORE`
  - `ENGRAVE`
  - `JOINERY`
- Return structured warnings instead of silently dropping ambiguous geometry.

### V1 Security Requirements

- Accept only `.obj` uploads in V1.
- Rate-limit public conversion requests.
- Do not expose uploaded files through public directory listing.
- Delete temporary files after the job expires.
- Do not store original files permanently unless a later version adds explicit user accounts and consent.
- Limit CPU time, memory use, file size, and output path count.

### V1 Acceptance Criteria

- A valid OBJ can be uploaded and converted into DXF.
- DXF opens in common laser or CAD software.
- Output units are millimeters.
- No default watermark text such as `P-001` appears in preview, SVG, or DXF output.
- Kerf stroke mode exports stroke width equal to `kerfWidthMm`.
- Snapping removes exact duplicate paths without deleting ambiguous partial overlaps.
- Joinery output creates matching tabs and slots when enabled.
- The preview shows layer colors and final dimensions before download.
- Invalid or unsupported OBJ files produce clear warnings or errors.

## V1 Public Webapp 規格需求

V1 是第一版公開網頁應用程式，目標是保持範圍小、可測試、可交付：讓使用者上傳一個 OBJ 檔，設定雷射加工參數，並輸出可用於雷射雕刻與切割的 2D 檔案。

### V1 範圍

- 上傳單一 `.obj` 檔案。
- 轉換前檢查檔案格式與檔案大小。
- 可設定核心雷射參數：
  - `materialThicknessMm`
  - `kerfWidthMm`
  - `kerfMode`
  - `snappingToleranceMm`
  - `generateJoinery`
  - `tabWidthMm`
  - `slotClearanceMm`
  - `outputFormat`
- 將 OBJ 幾何轉換成 2D 雷射路徑。
- 不加入預設浮水印或零件編號文字。
- 啟用 `generateJoinery` 時，自動產生卡榫與插槽。
- 下載前提供 2D 預覽。
- 主要輸出 DXF，供雷射雕刻與切割使用。
- SVG 作為輔助預覽或相容格式。

### V1 不做的項目

- 不做使用者帳號。
- 不做永久雲端儲存。
- 不做付款系統。
- 不做多檔批次轉換。
- 不做進階 3D 編輯器。
- 不保證支援任意有機曲面模型。
- 不自動修復嚴重破損的 OBJ 幾何。

### V1 網頁畫面

1. 上傳畫面
   - `.obj` 檔案選擇器。
   - 顯示檔案大小限制。
   - 簡單的專案名稱欄位。

2. 參數畫面
   - 材料厚度輸入。
   - 切縫寬度輸入。
   - 切縫模式選擇：`none`、`stroke`、`offset`。
   - Snapping 容許值輸入。
   - 卡榫功能開關。
   - 卡榫寬度與插槽間隙輸入。
   - 輸出格式選擇，預設為 DXF。

3. 預覽畫面
   - 2D 圖層預覽。
   - 切割、折線、雕刻、編號、卡榫圖層使用不同顏色。
   - 顯示整體寬度與高度，單位為毫米。
   - 顯示未閉合路徑、重複路徑或不支援幾何的警告。

4. 下載畫面
   - 下載 DXF。
   - 啟用時可下載 SVG。
   - 顯示轉換摘要與警告。

### V1 後端需求

- 解析 OBJ 時不可執行或信任檔案內容。
- 超過大小限制的檔案必須拒絕。
- 轉換任務必須有 timeout。
- 上傳檔與產生檔應為暫存。
- 相同 OBJ 與相同參數應產生一致輸出。
- 輸出需分成固定圖層：
  - `CUT`
  - `SCORE`
  - `ENGRAVE`
  - `JOINERY`
- 對於無法安全判斷的幾何，回傳結構化警告，不可靜默刪除。

### V1 安全需求

- V1 僅接受 `.obj` 上傳。
- 公開轉換請求必須做 rate limit。
- 不可透過公開目錄列出上傳檔案。
- 任務過期後刪除暫存檔。
- 除非未來版本加入帳號與明確同意，否則不永久保存原始檔。
- 限制 CPU 時間、記憶體、檔案大小與輸出路徑數量。

### V1 驗收標準

- 有效 OBJ 可以上傳並轉換為 DXF。
- DXF 可被常見雷射或 CAD 軟體開啟。
- 輸出單位為毫米。
- 預覽、SVG 與 DXF 輸出不會出現 `P-001` 這類預設浮水印文字。
- `kerfMode: stroke` 時，輸出線寬等於 `kerfWidthMm`。
- Snapping 可移除完全重複路徑，但不會誤刪模糊的部分重疊路徑。
- 啟用卡榫時，會產生尺寸匹配的卡榫與插槽。
- 下載前預覽會顯示圖層顏色與最終尺寸。
- 無效或不支援的 OBJ 會產生清楚的警告或錯誤。
