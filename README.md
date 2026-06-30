# 3D to 2D Laser SVG Workflow

This project generates 2D laser cutting layouts from supported 3D parametric geometry.

The current webapp supports:

- Cubes
- Cuboids
- Cylinders with living-hinge side cuts and circular tab slots
- FlexBox5-style flexible boxes
- Simple gable-roof houses
- Adjustable 3mm material thickness defaults
- Adjustable tab width, tab depth, tab spacing, kerf, part spacing, and arc segments
- SVG and DXF export

Arbitrary organic STL mesh unfolding is intentionally out of scope for the first version.

## Current Version

- Version: `v1.0.0`
- Stage: Public final release
- Recorded: 2026-07-01

See `VERSION.md` for the version record.

## License

This project is released as public open source software under the MIT License. K12 maker and STEM educational institutions are especially welcome to use it. See `LICENSE`.

## Homepage Structure, Teaching Strategy, and Learning Map

The homepage is designed as a classroom-friendly learning hub for laser-cutting and SVG workflow practice, especially for K12 maker education and STEM learning. It starts from visual inspection, then moves into joinery logic, image-to-vector conversion, and SVG layer checking. The project is released under the MIT License, and educational institutions are welcome to use, adapt, and remix it for teaching.

### Homepage Pages

| Page | URL | Classroom Role | Learning Focus |
| --- | --- | --- | --- |
| Laser Lab Home | `/` | Learning hub and tool entry point. | Choose a learning activity and understand the workflow map. |
| Joinery Demo | `/demo/` | Concept demonstration. | Compare plain unfolded geometry, offset references, and sparse 4t red joinery cut lines. |
| Joinery Builder | `/interlock/` | Guided operation practice. | Upload SVG, select paired edges, and generate complementary f/F finger-joint geometry from inner dimensions. |
| Gradient Maker | `/bmptrace/` | Image-to-vector preparation. | Convert bitmap images into grayscale layered SVG assets for FLUX / Beam Studio engraving tests. |
| Layer Inspector | `/svglayers/` | Output inspection. | Check SVG layer names, visibility, vector details, and engraving/cutting readiness. |

### Teaching Strategy

1. Concept first: use `/demo/` to show why inner dimensions, offset references, and red cutting paths must be separated.
2. Hands-on construction: move to `/interlock/` so learners can select real SVG edges and observe how convex `f` and concave `F` joints match.
3. Material awareness: discuss material thickness, kerf, offset direction, and why the demo uses sparse 4t joinery for easier visual understanding.
4. Asset preparation: use `/bmptrace/` to turn images into layered SVGs before engraving.
5. Output review: use `/svglayers/` to inspect layers and confirm the SVG is ready before sending it to laser software.
6. Reflection and iteration: ask learners to compare preview geometry with assembled physical results, then revise their SVG or parameters.

### Suggested Learning Map

| Stage | Activity | Tool | Expected Outcome |
| --- | --- | --- | --- |
| 1 | Observe a ready-made unfold drawing. | `/demo/` | Learners can identify black inner-size lines, gray offset references, and red cut lines. |
| 2 | Switch between no-joinery and joined views. | `/demo/` | Learners understand what joinery changes and what should remain as reference geometry. |
| 3 | Practice edge pairing. | `/interlock/` | Learners can pair two SVG edges and explain `f`/`F` complementary joints. |
| 4 | Prepare engraving artwork. | `/bmptrace/` | Learners can convert a bitmap into grayscale SVG layers. |
| 5 | Inspect SVG layers. | `/svglayers/` | Learners can verify layer names, visibility, and vector details before production. |
| 6 | Export and test cut. | `/demo/` or `/interlock/` | Learners connect digital preview rules to real material assembly results. |

## Joint SVG Joinery Preview

The uploaded SVG edge-pair joinery workflow is versioned under:

```text
/joint/
```

Use the `/joint/` page for the SVG joinery workflow. It supports simple SVG polygon import, selecting paired polygon edges, generating complementary finger-joint boundaries with a 3mm default material thickness, previewing the result, and downloading SVG/DXF output.

Remote joint webapp:

```text
https://panggihsieh.github.io/3Dto2D/joint/
```

### Joint Notes

- The first selected edge is treated as convex `f`; the second selected edge is treated as concave `F`.
- Each selected pair previews immediately. Clicking the same pending edge cancels it; clicking an already paired edge removes that pair.
- Manual pairing only changes the selected pair. The built-in cube topology is used only when no manual pairs exist and the built-in cube flow is confirmed.
- Gray preview lines are important inner-dimension offset references. Keep unselected gray offset lines visible; only hide the specific gray edge after it has been selected and replaced by a convex/concave joinery preview.
- Practice SVG downloads are available for a cuboid and a gable-roof house. The gable-roof practice file includes English position labels such as `bottom`, `left`, `right`, `front`, `back`, `roof left`, and `roof right`.
- Imported practice SVG paths preserve their `id` values so the joint workflow can display position labels on the preview for spatial matching practice.
- The joint workflow supports simple SVG `polygon`, `polyline`, and path commands `M`, `L`, `H`, `V`, `Z`. Curves, complex transforms, and illustration-style SVG artwork should be expanded to straight paths before import.
- Exported production SVG removes selection overlays, source overlays, and preview labels; the output contains the cut geometry.
- Browser download behavior varies. On supported Chromium browsers the joint workflow uses the native save picker; otherwise it shows a downloadable fallback link.

## Webapp

The static webapp root is a mode selector in `index.html`.

- `demo/`: fixed-value sparse 4t joinery demonstration for cube, cuboid, and gable-roof examples.
- `interlock/`: standalone uploaded SVG edge-pair joinery tool.
- `bmptrace/`: bitmap-to-grayscale-layered-SVG workflow for engraving preparation.
- `svglayers/`: SVG layer inspection workflow.
- `basic/`: earlier basic SVG/DXF layout without joinery, kept for reference.
- `joint/`: earlier standalone uploaded SVG edge-pair joinery tool, kept for reference.

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
- Do not store original files permanently.
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
## 中文翻譯

本專案為公開專案，採 MIT 授權公開釋出，歡迎教育單位使用。特別歡迎 K12 創客教育與 STEM 教育單位使用、改編，並延伸為課堂教學教材。

### 首頁架構、教學策略與學習地圖

本專案首頁規劃為適合課堂使用的雷射切割與 SVG 工作流程學習入口。學習順序從視覺觀察開始，逐步進入接榫邏輯、圖片轉向量、SVG 圖層檢查與實作輸出。

#### 首頁四個 Page 連結架構

| 頁面 | URL | 課堂角色 | 學習重點 |
| --- | --- | --- | --- |
| 雷雕實驗室首頁 | `/` | 學習入口與工具總覽。 | 選擇學習活動，理解整體學習路徑。 |
| 接榫展示區 | `/demo/` | 概念展示。 | 比較未接榫展開圖、灰色 offset 參考線，以及稀疏 4t 紅色接榫切割線。 |
| 接榫製作區 | `/interlock/` | 操作練習。 | 上傳 SVG、選取成對邊線，並從內尺寸產生互補的 f/F 接榫。 |
| 漸層一鍵生 | `/bmptrace/` | 圖像轉向量準備。 | 將點陣圖片轉成灰階分層 SVG，供 FLUX / Beam Studio 雕刻測試。 |
| 漸層檢視區 | `/svglayers/` | 輸出檢查。 | 檢查 SVG 圖層名稱、顯示狀態、向量細節與輸出準備度。 |

#### 教學策略

1. 先建立概念：使用 `/demo/` 說明內尺寸黑線、offset 灰線、紅色切割線為什麼要分開看。
2. 再做操作：使用 `/interlock/` 讓學生選取 SVG 成對邊線，觀察凸榫 `f` 與凹榫 `F` 如何互補。
3. 連結材料知識：討論材料厚度、kerf、offset 方向，以及為何展示版採用稀疏 4t 接榫方便理解。
4. 準備雕刻素材：使用 `/bmptrace/` 將圖片轉成灰階分層 SVG。
5. 檢查輸出檔案：使用 `/svglayers/` 檢查圖層與向量細節，再送入雷雕軟體。
6. 反思與修正：讓學生比較預覽圖與實際組裝結果，再修正 SVG 或參數。

#### 學習地圖

| 階段 | 活動 | 工具 | 預期成果 |
| --- | --- | --- | --- |
| 1 | 觀察內建展開圖。 | `/demo/` | 學生能辨識黑色內尺寸線、灰色 offset 參考線與紅色切割線。 |
| 2 | 切換未接榫與接榫後視圖。 | `/demo/` | 學生理解接榫改變了哪些切割路徑，哪些線只是參考。 |
| 3 | 練習邊線配對。 | `/interlock/` | 學生能配對兩條 SVG 邊線，並說明 f/F 互補接榫。 |
| 4 | 準備雕刻圖像。 | `/bmptrace/` | 學生能將點陣圖轉成灰階 SVG 圖層。 |
| 5 | 檢查 SVG 圖層。 | `/svglayers/` | 學生能確認圖層名稱、顯示狀態與向量細節。 |
| 6 | 輸出並試切。 | `/demo/` 或 `/interlock/` | 學生能把數位預覽規則連結到實際材料組裝成果。 |
