# 自動接榫繪製與自動接榫檢驗函數演算法

本文定義匯入內尺寸幾何展開區塊後，如何由內尺寸線自動產生 offset 參考線，再依照每一組黑線與灰線產生雷雕切割用的凹凸接榫紅線。

## 1. 名詞定義

### 1.1 內尺寸圖線：黑線

- 名稱：內尺寸圖、內尺寸線、黑線。
- 意義：使用者輸入或由 3D 展開後取得的內部容積邊界。
- 顏色語意：黑色。
- 幾何約束：黑線代表成品內尺寸，不可被切割紅線破壞、縮小或侵入。
- 典型資料：閉合 polygon 或由多段線段組成的展開輪廓。

### 1.2 offset 參考圖線：灰線

- 名稱：參考圖、參考線、offset 圖、offset 線、灰線。
- 意義：由黑線向外偏移材料厚度後得到的參考邊界。
- 顏色語意：灰色。
- 預設偏移量：`materialThicknessMm = 3`。
- 幾何約束：灰線是接榫外推或內縮的施工參考，不是最終切割線。

### 1.3 雷雕切割接榫圖線：紅線

- 名稱：切割圖、切割線、紅線。
- 意義：實際輸出給雷雕切割的凹凸接榫路徑。
- 顏色語意：紅色。
- 幾何約束：紅線可以位於黑線與灰線之間，或沿灰線形成外輪廓，但不得侵入黑線內側。

## 2. 核心原則

1. 黑線是不可破壞的內尺寸基準。
2. 灰線永遠由黑線向外 offset `materialThicknessMm` 產生。
3. 每一條接榫邊都以一組對應的黑線 edge 與灰線 edge 為單位。
4. 凸榫邊從黑線往灰線方向生成。
5. 凹榫邊從灰線往黑線方向生成。
6. 因為是內尺寸切割，任何紅線都不得破壞黑線所包圍的內部容積。
7. 同一條紅線的 start、end、tab、slot 點必須使用同一組黑線與灰線基準，不可混用不同 edge 的端點。

## 3. 建議資料模型

```ts
type Point = {
  x: number;
  y: number;
};

type Segment = {
  id: string;
  start: Point;
  end: Point;
};

type InnerLine = Segment & {
  kind: "inner";
  color: "black";
};

type OffsetLine = Segment & {
  kind: "offset";
  color: "gray";
  sourceInnerId: string;
  offsetDistanceMm: number;
};

type JoineryRole = "convex" | "concave";

type JoineryEdge = {
  id: string;
  inner: InnerLine;
  offset: OffsetLine;
  role: JoineryRole;
  materialThicknessMm: number;
  fingerWidthMm: number;
  clearanceMm: number;
};

type CutLine = {
  id: string;
  kind: "cut";
  color: "red";
  sourceJoineryEdgeId: string;
  points: Point[];
};
```

## 4. 函數分層

### 4.1 `normalizeInnerGeometry(inputGeometry)`

目的：將輸入的內尺寸幾何展開圖標準化為黑線。

輸入：

- SVG polygon、polyline、簡單 path，或內部幾何資料。

輸出：

- `InnerLine[]`

演算法：

1. 解析輸入幾何。
2. 將曲線或非線段資料拒絕或預先轉成線段。
3. 將所有點轉為 mm 單位。
4. 移除零長度線段。
5. 對相近端點進行 snapping。
6. 依照輪廓方向建立有序黑線。

檢驗：

- 黑線不可有 NaN 或無限值。
- 每條黑線長度必須大於容差。
- 閉合輪廓的最後點必須回到第一點，或可明確補上 closing segment。

### 4.2 `buildOffsetReferenceLines(innerLines, materialThicknessMm)`

目的：從黑線向外 offset 材料厚度，產生灰線。

重要規則：若內尺寸是閉合多邊形，必須以「整個多邊形」作為一個物件 offset，再把 offset 後的多邊形邊拆回灰線。不可只把單條邊各自平移後直接使用，否則斜頂小屋尖塔邊、五邊形山牆、斜邊角點會出現斷裂、交錯或錯誤接榫基準。

輸入：

- `innerLines: InnerLine[]`
- `materialThicknessMm: number`

輸出：

- `OffsetLine[]`

演算法：

1. 將同一個閉合輪廓視為一個 polygon 物件。
2. 判斷整體 polygon 方向。
3. 依整體方向取得每條邊的外側法向量。
4. 對 polygon 的每條邊建立 offset 輔助線。
5. 以相鄰兩條 offset 輔助線的交點，求出新的灰線角點。
6. 形成完整且連續的 offset polygon。
7. 再把 offset polygon 拆回與黑線一一對應的灰線 edge。
8. 保留 `sourceInnerId`，讓每條灰線可回查原始黑線。

檢驗：

- 灰線與對應黑線的距離應等於材料厚度，允許數值容差。
- 灰線不可穿入黑線內側。
- 相鄰灰線端點不可產生不合理交叉。
- 對五邊形或任意多邊形，灰線角點必須是相鄰 offset 邊的交點。
- 灰線點數應與原始 polygon 角點數一致，除非後續明確加入圓角、倒角或布林修正。

### 4.3 `pairInnerAndOffsetEdges(innerLines, offsetLines)`

目的：建立每一條黑線與對應灰線的運算單位。

輸入：

- `innerLines: InnerLine[]`
- `offsetLines: OffsetLine[]`

輸出：

- `{ inner: InnerLine; offset: OffsetLine }[]`

演算法：

1. 依 `sourceInnerId` 配對。
2. 檢查黑線與灰線方向是否一致。
3. 若方向相反，反轉灰線 start/end。
4. 計算 edge 座標系：
   - `u`：沿黑線 start 到 end 的單位方向。
   - `n`：由黑線指向灰線的單位方向。
   - `length`：黑線長度。

檢驗：

- 每條黑線必須有一條灰線。
- 黑線與灰線長度差不可超過角點修正後允許範圍。
- 黑線到灰線的方向必須與 outward normal 一致。

### 4.4 `generateConvexCutLine(joineryEdge)`

目的：從黑線往灰線畫出凸榫紅線。

輸入：

- `JoineryEdge`，其中 `role = "convex"`。

輸出：

- `CutLine`

演算法：

1. 以黑線作為 base line。
2. 以黑線到灰線方向 `n` 作為凸榫深度方向。
3. 沿 edge 長度分配 finger：
   - 預設 finger 寬度可用 `2 * materialThicknessMm`。
   - 兩端保留 end margin，避免接榫碰撞角點。
4. 紅線路徑依序在黑線與灰線之間切換：
   - 黑線上的平段表示未凸出區。
   - 往灰線方向推出的矩形段表示凸榫。
5. 凸榫最高點不得超過灰線外側。

輸出語意：

- 凸榫紅線的主要工作區間是黑線到灰線。
- 紅線不能落在黑線內側。

### 4.5 `generateConcaveCutLine(joineryEdge)`

目的：從灰線往黑線畫出凹榫紅線。

輸入：

- `JoineryEdge`，其中 `role = "concave"`。

輸出：

- `CutLine`

演算法：

1. 以灰線作為 base line。
2. 以灰線到黑線方向 `-n` 作為凹榫深度方向。
3. 沿 edge 長度分配 slot：
   - slot 位置要與配對凸榫互補。
   - slot 寬度加入 `clearanceMm`。
4. 紅線路徑依序在灰線與黑線之間切換：
   - 灰線上的平段表示外輪廓。
   - 往黑線方向縮入的矩形段表示凹榫。
5. 凹榫最低點只能到達黑線，不得越過黑線進入內尺寸區域。

輸出語意：

- 凹榫紅線可以從灰線向黑線回切。
- 紅線的內側極限是黑線。

### 4.6 `generateJoineryCutLines(edgePairs, joineryAssignments)`

目的：對全部 edge 產生紅線。

輸入：

- 黑線與灰線配對結果。
- 每條 edge 的接榫角色：`convex` 或 `concave`。

輸出：

- `CutLine[]`

演算法：

1. 逐條讀取 edge pair。
2. 若角色為 `convex`，呼叫 `generateConvexCutLine()`。
3. 若角色為 `concave`，呼叫 `generateConcaveCutLine()`。
4. 收集全部紅線。
5. 合併可連續銜接的紅線端點。
6. 保持 SVG/DXF 輸出路徑順序穩定。

## 5. 自動接榫檢驗函數

### 5.1 `validateInnerDimensionPreserved(innerLines, cutLines)`

目的：確認紅線沒有破壞黑線內尺寸。

檢查項目：

1. 紅線點不可位於黑線內側。
2. 凹榫最深點不可越過黑線。
3. 凸榫起點必須在黑線或黑線外側。
4. 任一紅線 segment 不可穿越黑線進入內尺寸區域。

失敗條件：

- 任一紅線點或線段侵入內尺寸 polygon。
- 任一凹榫深度大於 `materialThicknessMm + tolerance`。

### 5.2 `validateOffsetDistance(innerLines, offsetLines, materialThicknessMm)`

目的：確認灰線是正確的外偏移參考線。

檢查項目：

1. 黑線到灰線的垂直距離。
2. 灰線方向是否與黑線一致。
3. 角點是否有合理交會。

失敗條件：

- offset 距離偏差超過 tolerance。
- 灰線穿入黑線內側。
- 灰線角點產生自交。

### 5.3 `validateJoineryComplement(convexCutLine, concaveCutLine)`

目的：確認凸榫與凹榫可以互補接合。

檢查項目：

1. finger 數量與 slot 數量一致。
2. finger 中心位置與 slot 中心位置一致。
3. slot 寬度等於 finger 寬度加 clearance。
4. 凸榫深度與凹榫深度接近材料厚度。

失敗條件：

- 數量不一致。
- 中心位置偏差超過 tolerance。
- slot 太窄或太淺。

### 5.4 `validateCutPathContinuity(cutLines)`

目的：確認紅線可被雷雕軟體穩定切割。

檢查項目：

1. path 不含 NaN。
2. path 不含零長度 segment。
3. 相鄰端點距離小於 snapping tolerance 時要合併。
4. 水平/垂直模型不可出現意外斜線。
5. closed path 的 closing segment 不可跨越黑線與灰線造成斜切。

## 6. 總流程

```txt
input inner-dimension geometry
  -> normalizeInnerGeometry()
  -> black inner lines
  -> buildOffsetReferenceLines(materialThicknessMm = 3)
  -> gray offset reference lines
  -> pairInnerAndOffsetEdges()
  -> per-edge black/gray operation units
  -> assign convex/concave roles
  -> generateJoineryCutLines()
  -> red laser cut lines
  -> validateOffsetDistance()
  -> validateInnerDimensionPreserved()
  -> validateJoineryComplement()
  -> validateCutPathContinuity()
  -> export SVG/DXF
```

## 7. 偽程式

```ts
function buildAutoJoinery(inputGeometry, options) {
  const materialThicknessMm = options.materialThicknessMm ?? 3;
  const clearanceMm = options.clearanceMm ?? 0.1;
  const fingerWidthMm = options.fingerWidthMm ?? materialThicknessMm * 2;

  const innerLines = normalizeInnerGeometry(inputGeometry);
  const offsetLines = buildOffsetReferenceLines(innerLines, materialThicknessMm);
  const edgePairs = pairInnerAndOffsetEdges(innerLines, offsetLines);

  validateOffsetDistance(innerLines, offsetLines, materialThicknessMm);

  const joineryEdges = edgePairs.map((pair) => ({
    id: pair.inner.id,
    inner: pair.inner,
    offset: pair.offset,
    role: options.roleByEdgeId[pair.inner.id],
    materialThicknessMm,
    fingerWidthMm,
    clearanceMm,
  }));

  const cutLines = generateJoineryCutLines(joineryEdges);

  validateInnerDimensionPreserved(innerLines, cutLines);
  validateCutPathContinuity(cutLines);

  return {
    blackLines: innerLines,
    grayLines: offsetLines,
    redLines: cutLines,
  };
}
```

## 8. 最小成功標準

此演算法輸出視為成功時，必須同時滿足：

1. 黑線完整保留原始內尺寸幾何。
2. 灰線全部由黑線向外偏移 `3mm` 或指定材料厚度。
3. 每一條紅線都能追溯到一組黑線與灰線。
4. 凸榫由黑線往灰線生成。
5. 凹榫由灰線往黑線生成。
6. 紅線沒有任何點、線段或 closing segment 侵入黑線內側。
7. SVG/DXF 輸出可清楚分層：
   - black：內尺寸線。
   - gray：offset 參考線。
   - red：雷雕切割線。
