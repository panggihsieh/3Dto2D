# 3D 模型轉 2D 雷切 SVG 規劃

## 目標

建立一個可將特定 3D 幾何模型轉換成 2D 雷射切割 SVG 展開圖的工具。

第一版重點不是任意 STL 自動展開，而是：

1. 支援可參數化描述的規則幾何模型。
2. 產生可用於 3mm 板材的 2D SVG 切割圖。
3. 讓材料厚度、模型尺寸、卡榫尺寸與間距可調。
4. STL 輸入只做幾何辨識，成功辨識後轉成參數化模型再輸出 SVG。
5. 明確排除不適合第一版自動展開的任意 STL 模型。

## 核心假設

- SVG 單位使用 `mm`。
- 預設材料厚度為 `3mm`，但必須可調。
- 輸出目標是雷射切割或雷射雕刻軟體可開啟的 2D SVG。
- 第一版以可組裝的板材展開圖為主，不處理任意曲面攤平。
- STL 不直接進行 mesh unfolding，而是先辨識成支援的幾何類型。
- 若 STL 無法可靠辨識，系統應停止轉換並回報原因。

## 共用參數

所有模型至少應支援以下參數：

```ts
{
  materialThickness: 3,
  length: number,
  width: number,
  height: number,
  tabWidth: number,
  tabDepth: number,
  tabSpacing: number,
  kerf: number
}
```

圓形或弧形模型額外支援：

```ts
{
  radius?: number,
  diameter?: number,
  segments: number
}
```

雙斜屋頂房子額外支援：

```ts
{
  wallHeight: number,
  roofHeight: number
}
```

## 第一版支援模型

### 1. 正立方體

- 6 個相同正方形面。
- 邊長由 `length` 或統一尺寸參數決定。
- 可產生含卡榫與插槽的 2D 展開圖。
- 適合用來驗證卡榫生成邏輯。

### 2. 長方體

- 6 個矩形面：
  - `length x width` 兩片
  - `length x height` 兩片
  - `width x height` 兩片
- 支援依邊長自動配置卡榫。
- 為第一版主要驗證模型。

### 3. 圓柱體

- 上下兩個圓形面。
- 側面展開為矩形：

```txt
sideWidth = 2 * PI * radius
sideHeight = height
```

- 圓周可依 `segments` 分段配置插槽。
- 側面上下邊配置對應卡榫。

### 4. 圓錐體

- 底面為圓形。
- 側面展開為扇形。
- 母線長：

```txt
slantHeight = sqrt(radius^2 + height^2)
```

- 扇形角度：

```txt
angle = 360 * radius / slantHeight
```

- 底面圓與扇形弧線可配置對應卡榫或插槽。

### 5. 雙斜屋頂房子

此模型用於支援類似傳統斜瓦屋頂的簡單房屋。

組成零件：

- 1 片底板：`length x width`
- 2 片長牆：`length x wallHeight`
- 2 片山牆：五邊形，底寬為 `width`
- 2 片屋頂斜板：`length x roofSlopeLength`

計算：

```txt
roofSlopeLength = sqrt((width / 2)^2 + roofHeight^2)
totalHeight = wallHeight + roofHeight
```

第一版屋頂接合可採簡化設計：

- 牆與底板使用標準直角卡榫。
- 牆與牆使用標準直角卡榫。
- 屋頂可使用插槽定位或外蓋式屋頂。
- 屋脊處先以貼合或簡化卡榫處理。

## STL 輸入支援範圍

第一版 STL 輸入只支援可辨識為規則幾何或簡單組合的模型，例如：

- 正立方體
- 長方體
- 圓柱體
- 圓錐體
- 雙斜屋頂房子
- 由上述幾何構成，且邊界清楚的簡單模型

處理流程：

```txt
STL 輸入
  -> 讀取 mesh
  -> 分析三角面、法線、邊界與尺寸
  -> 判斷是否屬於支援模型
  -> 抽取幾何參數
  -> 使用參數化模型產生 2D SVG
```

## 第一版明確排除

以下 STL 類型不做自動展開，也不輸出雷切 SVG：

- 人物、動物、雕塑等有機模型。
- 自由曲面模型。
- 有大量孔洞、倒角、圓角或細節裝飾的模型。
- 布林切割後難以判斷結構的模型。
- 非單一幾何形體，或多個物件黏在一起但無法拆分者。
- 三角面混亂、破面、非封閉、法線錯亂的 STL。
- 無法辨識為支援模型類型的 STL。

遇到排除類型時，系統不應嘗試硬轉，而是回傳清楚錯誤：

```txt
此 STL 無法轉換為可雷切的 2D 展開圖。
目前僅支援規則幾何模型：正立方體、長方體、圓柱體、圓錐體、雙斜屋頂房子。
```

## 建議實作架構

若專案既有架構允許，建議將邏輯拆成以下模組：

```txt
src/
  geometry/
    primitives.ts
    tabs.ts
    layout.ts
  models/
    cube.ts
    cuboid.ts
    cylinder.ts
    cone.ts
    gableHouse.ts
  stl/
    parser.ts
    classifier.ts
    measurements.ts
  svg/
    renderSvg.ts
  config/
    defaults.ts
```

目前專案若維持單頁前端，也可以先以較少檔案完成第一版，避免過早抽象化。

## 階段規劃

### Phase 1：參數化盒體展開

目標：

- 完成預設參數與輸入驗證。
- 完成正立方體 SVG 展開圖。
- 完成長方體 SVG 展開圖。
- 完成直線邊上的卡榫與插槽生成。

驗證：

- SVG 尺寸單位為 `mm`。
- 預設材料厚度為 `3mm`。
- 修改長、寬、高後，展開圖尺寸正確變化。
- 卡榫寬度、深度、間距可調。
- SVG 零件之間不重疊。

### Phase 2：圓形幾何展開

目標：

- 完成圓柱展開圖。
- 完成圓錐展開圖。
- 完成圓周分段與弧線近似。
- 完成圓形面與側面之間的卡榫或插槽對應。

驗證：

- 圓柱側面寬度等於圓周長。
- 圓錐扇形弧長等於底圓周長。
- `segments` 改變時，圓周分段與 SVG 路徑同步更新。

### Phase 3：雙斜屋頂房子

目標：

- 完成雙斜屋頂房子的參數化模型。
- 輸出底板、長牆、山牆與屋頂斜板。
- 支援牆體與底板的卡榫。
- 支援屋頂定位用插槽或簡化接合方式。

驗證：

- 山牆五邊形尺寸正確。
- 屋頂斜板長度符合 `roofSlopeLength`。
- 房屋總高度符合 `wallHeight + roofHeight`。

### Phase 4：STL 幾何辨識

目標：

- 支援 STL 檔案輸入。
- 讀取 mesh 並抽取 bounding box、法線、面群與尺寸。
- 判斷是否為支援的規則幾何。
- 成功辨識後轉成對應參數模型。
- 無法辨識時回傳明確錯誤。

驗證：

- 乾淨的 box STL 可辨識為正立方體或長方體。
- 乾淨的 cylinder STL 可辨識為圓柱。
- 乾淨的 cone STL 可辨識為圓錐。
- 簡單雙斜屋頂 STL 可辨識為房子模型。
- 任意有機模型或破損 STL 會被排除。

## 成功標準

- 使用者可輸入模型參數並產生 SVG。
- SVG 可被 Inkscape、Illustrator、LightBurn 等軟體開啟。
- 預設可用於 `3mm` 材料。
- 卡榫尺寸、深度與間距可調。
- 支援模型的展開尺寸與幾何公式一致。
- 不支援的 STL 會明確拒絕，不產生錯誤或誤導性的 SVG。

## 非目標

第一版不處理以下功能：

- 任意 STL mesh unfolding。
- 自由曲面自動攤平。
- 複雜模型自動拆件。
- 自動判斷最佳切線。
- 自動產生瓦片、窗框、門板等裝飾細節。
- 針對特定雷射機台的專有格式輸出。

