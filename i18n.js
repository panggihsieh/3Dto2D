(() => {
  const defaultLanguage = "zh-Hant";
  const languages = [
    ["zh-Hant", "zh-hant (中文)"],
    ["en", "en(英文)"],
    ["de", "de(德文)"],
    ["de-AT", "de-AT(奧地利文)"]
  ];

  const shared = {
    "zh-Hant": {
      language: "語言",
      ready: "Ready",
      generating: "Generating",
      noWarnings: "No warnings.",
      widthUnit: "mm W",
      heightUnit: "mm H",
      parts: "parts",
      zoomOut: "縮小",
      zoomIn: "放大",
      resetZoom: "重設",
      previewZoomControls: "預覽縮放控制",
      layerLegend: "圖層圖例",
      preview2d: "2D 輸出預覽",
      generatedPreview: "產生的 2D 雷雕預覽"
    },
    en: {
      language: "Language",
      ready: "Ready",
      generating: "Generating",
      noWarnings: "No warnings.",
      widthUnit: "mm W",
      heightUnit: "mm H",
      parts: "parts",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      resetZoom: "Reset",
      previewZoomControls: "Preview zoom controls",
      layerLegend: "Layer legend",
      preview2d: "2D output preview",
      generatedPreview: "Generated 2D laser preview"
    },
    de: {
      language: "Sprache",
      ready: "Bereit",
      generating: "Wird erzeugt",
      noWarnings: "Keine Hinweise.",
      widthUnit: "mm B",
      heightUnit: "mm H",
      parts: "Teile",
      zoomOut: "Verkleinern",
      zoomIn: "Vergrößern",
      resetZoom: "Zurücksetzen",
      previewZoomControls: "Vorschau-Zoom",
      layerLegend: "Ebenenlegende",
      preview2d: "2D-Ausgabevorschau",
      generatedPreview: "Erzeugte 2D-Laservorschau"
    },
    "de-AT": {
      language: "Sprache",
      ready: "Bereit",
      generating: "Wird erzeugt",
      noWarnings: "Keine Hinweise.",
      widthUnit: "mm B",
      heightUnit: "mm H",
      parts: "Teile",
      zoomOut: "Verkleinern",
      zoomIn: "Vergrößern",
      resetZoom: "Zurücksetzen",
      previewZoomControls: "Vorschau-Zoom",
      layerLegend: "Ebenenlegende",
      preview2d: "2D-Ausgabevorschau",
      generatedPreview: "Erzeugte 2D-Laservorschau"
    }
  };

  const pages = {
    basic: {
      title: {
        "zh-Hant": "3D to 2D Basic",
        en: "3D to 2D Basic",
        de: "3D zu 2D Basic",
        "de-AT": "3D zu 2D Basic"
      },
      text: {
        ".eyebrow": ["Basic mode", "Basic mode", "Basismodus", "Basismodus"],
        "h1": ["基本切割展開", "Basic Cut Layout", "Einfache Schnittabwicklung", "Einfache Schnittabwicklung"],
        "#statusPill": ["Ready", "Ready", "Bereit", "Bereit"],
        "#modelTitle": ["模型", "Model", "Modell", "Modell"],
        "label:has(#modelType) span": ["模型類型", "Model type", "Modelltyp", "Modelltyp"],
        "#modelType option[value='cuboid']": ["長方體", "Cuboid", "Quader", "Quader"],
        "#modelType option[value='cube']": ["正立方體", "Cube", "Würfel", "Würfel"],
        "#modelType option[value='gable_house']": ["雙斜屋頂小屋", "Gable-roof house", "Haus mit Satteldach", "Haus mit Satteldach"],
        "#sizeTitle": ["尺寸 mm", "Size mm", "Maße mm", "Maße mm"],
        "#innerDimensionButton": ["內尺寸", "Inner size", "Innenmaß", "Innenmaß"],
        "#dimensionModeStatus": ["目前：內尺寸(長寬高為內部尺寸)", "Current: inner size (L/W/H are internal dimensions)", "Aktuell: Innenmaß (L/B/H sind Innenmaße)", "Aktuell: Innenmaß (L/B/H sind Innenmaße)"],
        "label:has(#length) span": ["長度", "Length", "Länge", "Länge"],
        "label:has(#width) span": ["寬度", "Width", "Breite", "Breite"],
        "label:has(#height) span": ["高度", "Height", "Höhe", "Höhe"],
        "label:has(#wallHeight) span": ["牆高", "Wall height", "Wandhöhe", "Wandhöhe"],
        "label:has(#roofHeight) span": ["屋頂高", "Roof height", "Dachhöhe", "Dachhöhe"],
        "#outerDimensionStatus": ["外尺寸：-- × -- × -- mm", "Outer size: -- x -- x -- mm", "Außenmaß: -- x -- x -- mm", "Außenmaß: -- x -- x -- mm"],
        "#materialTitle": ["材料與輸出", "Material and Output", "Material und Ausgabe", "Material und Ausgabe"],
        "label:has(#materialThickness) span": ["材料厚度", "Material thickness", "Materialstärke", "Materialstärke"],
        "label:has(#kerfWidth) span": ["Kerf", "Kerf", "Schnittfuge", "Schnittfuge"],
        "label:has(#partGap) span": ["零件間距", "Part gap", "Teileabstand", "Teileabstand"],
        "label:has(#segments) span": ["圓弧段數", "Arc segments", "Bogensegmente", "Bogensegmente"],
        "label:has(#projectName) span": ["專案名稱", "Project name", "Projektname", "Projektname"],
        "#joineryModeButton": ["顯示接榫後", "Show with joinery", "Mit Zapfen anzeigen", "Mit Zapfen anzeigen"],
        "#joineryModeStatus": ["目前：沒有接榫", "Current: no joinery", "Aktuell: ohne Zapfen", "Aktuell: ohne Zapfen"],
        "#downloadsTitle": ["輸出", "Export", "Ausgabe", "Ausgabe"],
        ".red-only-note": ["(限紅線)", "(red lines only)", "(nur rote Linien)", "(nur rote Linien)"],
        "#manualTitle": ["使用者簡易操作手冊", "Quick User Guide", "Kurzanleitung", "Kurzanleitung"],
        ".manual-panel .section-head span": ["Basic", "Basic", "Basic", "Basic"],
        ".manual-list li:nth-child(1)": ["選擇模型類型，例如長方體、正立方體或雙斜屋頂小屋。", "Choose a model type, such as cuboid, cube, or gable-roof house.", "Wählen Sie einen Modelltyp, z. B. Quader, Würfel oder Haus mit Satteldach.", "Wählen Sie einen Modelltyp, z. B. Quader, Würfel oder Haus mit Satteldach."],
        ".manual-list li:nth-child(2)": ["輸入長、寬、高等尺寸，並確認目前使用的是內尺寸。", "Enter length, width, height, and confirm that inner size is selected.", "Geben Sie Länge, Breite und Höhe ein und prüfen Sie, dass Innenmaß gewählt ist.", "Geben Sie Länge, Breite und Höhe ein und prüfen Sie, dass Innenmaß gewählt ist."],
        ".manual-list li:nth-child(3)": ["設定材料厚度、Kerf 與零件間距，讓切割尺寸符合實際材料。", "Set material thickness, kerf, and part gap so the cut size matches the material.", "Stellen Sie Materialstärke, Schnittfuge und Teileabstand passend zum Material ein.", "Stellen Sie Materialstärke, Schnittfuge und Teileabstand passend zum Material ein."],
        ".manual-list li:nth-child(4)": ["需要接榫時按「顯示接榫後」，預覽會更新紅色切割線。", "Press \"Show with joinery\" when joints are needed; the red cut preview updates.", "Drücken Sie „Mit Zapfen anzeigen“, wenn Verbindungen benötigt werden; die roten Schnittlinien werden aktualisiert.", "Drücken Sie „Mit Zapfen anzeigen“, wenn Verbindungen benötigt werden; die roten Schnittlinien werden aktualisiert."],
        ".manual-list li:nth-child(5)": ["檢查右側預覽與提示，確認沒有警告後下載 SVG 或 DXF。", "Check the preview and notices, then download SVG or DXF when there are no warnings.", "Prüfen Sie Vorschau und Hinweise und laden Sie SVG oder DXF herunter, wenn keine Warnungen vorliegen.", "Prüfen Sie Vorschau und Hinweise und laden Sie SVG oder DXF herunter, wenn keine Warnungen vorliegen."],
        ".legend .dimension": ["黑色：內尺寸", "Black: inner size", "Schwarz: Innenmaß", "Schwarz: Innenmaß"],
        ".legend .cut": ["紅色：切割區", "Red: cut area", "Rot: Schnittbereich", "Rot: Schnittbereich"],
        "#zoomResetButton": ["Reset", "Reset", "Zurücksetzen", "Zurücksetzen"],
        ".warnings h2": ["提示", "Notices", "Hinweise", "Hinweise"]
      },
      attr: {
        ".controls": { "aria-label": ["Basic 2D layout controls", "Basic 2D layout controls", "Steuerung für einfache 2D-Abwicklung", "Steuerung für einfache 2D-Abwicklung"] },
        ".dimension-mode-row": { "aria-label": ["尺寸基準", "Dimension basis", "Maßbezug", "Maßbezug"] },
        ".workspace": { "aria-label": ["2D output preview", "2D output preview", "2D-Ausgabevorschau", "2D-Ausgabevorschau"] },
        ".legend": { "aria-label": ["Layer legend", "Layer legend", "Ebenenlegende", "Ebenenlegende"] },
        ".zoom-controls": { "aria-label": ["Preview zoom controls", "Preview zoom controls", "Vorschau-Zoom", "Vorschau-Zoom"] },
        "#zoomOutButton": { title: ["Zoom out", "Zoom out", "Verkleinern", "Verkleinern"], "aria-label": ["Zoom out", "Zoom out", "Verkleinern", "Verkleinern"] },
        "#zoomInButton": { title: ["Zoom in", "Zoom in", "Vergrößern", "Vergrößern"], "aria-label": ["Zoom in", "Zoom in", "Vergrößern", "Vergrößern"] },
        "#zoomResetButton": { title: ["Reset zoom", "Reset zoom", "Zoom zurücksetzen", "Zoom zurücksetzen"], "aria-label": ["Reset zoom", "Reset zoom", "Zoom zurücksetzen", "Zoom zurücksetzen"] },
        "#previewSvg": { "aria-label": ["產生的 2D 雷雕預覽", "Generated 2D laser preview", "Erzeugte 2D-Laservorschau", "Erzeugte 2D-Laservorschau"] }
      }
    },
    joint: {
      title: {
        "zh-Hant": "SVG Joinery",
        en: "SVG Joinery",
        de: "SVG-Zapfen",
        "de-AT": "SVG-Zapfen"
      },
      text: {
        ".eyebrow": ["Joint standalone tool", "Joint standalone tool", "Eigenständiges Zapfenwerkzeug", "Eigenständiges Zapfenwerkzeug"],
        "h1": ["SVG 接榫選邊", "SVG Edge Joinery", "SVG-Kantenverzapfung", "SVG-Kantenverzapfung"],
        "#statusPill": ["Ready", "Ready", "Bereit", "Bereit"],
        "#svgImportTitle": ["SVG 接榫選邊", "SVG Edge Joinery", "SVG-Kantenverzapfung", "SVG-Kantenverzapfung"],
        "label:has(#svgUpload) span": ["匯入 SVG", "Import SVG", "SVG importieren", "SVG importieren"],
        "#downloadCuboidSample": ["下載長方體練習 SVG", "Download cuboid practice SVG", "Quader-Übungs-SVG laden", "Quader-Übungs-SVG laden"],
        "#downloadHouseSample": ["下載斜頂房屋練習 SVG", "Download gable house practice SVG", "Satteldach-Übungs-SVG laden", "Satteldach-Übungs-SVG laden"],
        "#tagTopPiece": ["Top tag", "Top tag", "Top markieren", "Top markieren"],
        "#tagBottomPiece": ["Bottom tag", "Bottom tag", "Bottom markieren", "Bottom markieren"],
        "#toggleEdgeSelect": ["選取接榫邊", "Select joint edges", "Zapfenkanten wählen", "Zapfenkanten wählen"],
        "#applyEdgePairs": ["確認產生接榫", "Apply joinery", "Zapfen erzeugen", "Zapfen erzeugen"],
        "#clearEdgePairs": ["清除配對", "Clear pairs", "Paare löschen", "Paare löschen"],
        "#sizeTitle": ["尺寸 mm", "Size mm", "Maße mm", "Maße mm"],
        "#innerDimensionButton": ["內尺寸", "Inner size", "Innenmaß", "Innenmaß"],
        "#dimensionModeStatus": ["目前：內尺寸(長寬高為內部尺寸)", "Current: inner size (L/W/H are internal dimensions)", "Aktuell: Innenmaß (L/B/H sind Innenmaße)", "Aktuell: Innenmaß (L/B/H sind Innenmaße)"],
        "label:has(#length) span": ["長度", "Length", "Länge", "Länge"],
        "label:has(#width) span": ["寬度", "Width", "Breite", "Breite"],
        "label:has(#height) span": ["高度", "Height", "Höhe", "Höhe"],
        "label:has(#radius) span": ["半徑", "Radius", "Radius", "Radius"],
        "label:has(#wallHeight) span": ["牆高", "Wall height", "Wandhöhe", "Wandhöhe"],
        "label:has(#roofHeight) span": ["屋頂高", "Roof height", "Dachhöhe", "Dachhöhe"],
        "#outerDimensionStatus": ["外尺寸：-- × -- × -- mm", "Outer size: -- x -- x -- mm", "Außenmaß: -- x -- x -- mm", "Außenmaß: -- x -- x -- mm"],
        "#joineryTitle": ["材料與接榫", "Material and Joinery", "Material und Zapfen", "Material und Zapfen"],
        "label:has(#materialThickness) span": ["材料厚度", "Material thickness", "Materialstärke", "Materialstärke"],
        "label:has(#kerfWidth) span": ["Kerf", "Kerf", "Schnittfuge", "Schnittfuge"],
        "label:has(#tabWidth) span": ["接榫寬度", "Tab width", "Zapfenbreite", "Zapfenbreite"],
        "label:has(#tabDepth) span": ["接榫深度", "Tab depth", "Zapfentiefe", "Zapfentiefe"],
        "label:has(#tabSpacing) span": ["接榫間距", "Tab spacing", "Zapfenabstand", "Zapfenabstand"],
        "label:has(#partGap) span": ["零件間距", "Part gap", "Teileabstand", "Teileabstand"],
        "label:has(#segments) span": ["圓弧段數", "Arc segments", "Bogensegmente", "Bogensegmente"],
        "label:has(#projectName) span": ["專案名稱", "Project name", "Projektname", "Projektname"],
        "label:has(#joineryToggle) span": ["產生 f/F 互補接榫", "Generate matching f/F joinery", "Passende f/F-Zapfen erzeugen", "Passende f/F-Zapfen erzeugen"],
        "#downloadsTitle": ["輸出", "Export", "Ausgabe", "Ausgabe"],
        ".red-only-note": ["(限紅線)", "(red lines only)", "(nur rote Linien)", "(nur rote Linien)"],
        "#manualTitle": ["使用者簡易操作手冊", "Quick User Guide", "Kurzanleitung", "Kurzanleitung"],
        ".manual-panel .section-head span": ["SVG 接榫", "SVG Joinery", "SVG-Zapfen", "SVG-Zapfen"],
        ".manual-list li:nth-child(1)": ["先上傳要處理的 SVG，或下載範例 SVG 後再匯入。", "Upload the SVG to process, or download a practice SVG and import it.", "Laden Sie zuerst die SVG hoch oder importieren Sie eine Übungs-SVG.", "Laden Sie zuerst die SVG hoch oder importieren Sie eine Übungs-SVG."],
        ".manual-list li:nth-child(2)": ["輸入成品尺寸、材料厚度、Kerf、接榫寬度與深度。", "Enter final dimensions, material thickness, kerf, tab width, and tab depth.", "Geben Sie Endmaße, Materialstärke, Schnittfuge, Zapfenbreite und Zapfentiefe ein.", "Geben Sie Endmaße, Materialstärke, Schnittfuge, Zapfenbreite und Zapfentiefe ein."],
        ".manual-list li:nth-child(3)": ["按「Top tag」或「Bottom tag」標記上蓋與底板，方便系統判斷方向。", "Use Top tag or Bottom tag to mark lid and base so the system can infer direction.", "Markieren Sie Deckel und Boden mit Top oder Bottom, damit die Richtung erkannt wird.", "Markieren Sie Deckel und Boden mit Top oder Bottom, damit die Richtung erkannt wird."],
        ".manual-list li:nth-child(4)": ["按「選擇接榫邊」，依序點選兩條要配對的邊，再按套用。", "Press Select joint edges, click two matching edges in order, then apply.", "Wählen Sie Zapfenkanten, klicken Sie zwei passende Kanten nacheinander an und wenden Sie sie an.", "Wählen Sie Zapfenkanten, klicken Sie zwei passende Kanten nacheinander an und wenden Sie sie an."],
        ".manual-list li:nth-child(5)": ["確認預覽中的紅線與接榫方向正確後，下載 SVG 或 DXF。", "Confirm the red preview lines and joint direction, then download SVG or DXF.", "Prüfen Sie rote Vorschau-Linien und Zapfenrichtung und laden Sie SVG oder DXF herunter.", "Prüfen Sie rote Vorschau-Linien und Zapfenrichtung und laden Sie SVG oder DXF herunter."],
        ".legend .source": ["原始SVG展開圖", "Original SVG layout", "Originale SVG-Abwicklung", "Originale SVG-Abwicklung"],
        "#zoomResetButton": ["Reset", "Reset", "Zurücksetzen", "Zurücksetzen"],
        ".warnings h2": ["提示", "Notices", "Hinweise", "Hinweise"]
      },
      attr: {
        ".controls": { "aria-label": ["SVG joinery controls", "SVG joinery controls", "Steuerung für SVG-Zapfen", "Steuerung für SVG-Zapfen"] },
        ".dimension-mode-row": { "aria-label": ["尺寸基準", "Dimension basis", "Maßbezug", "Maßbezug"] },
        ".tag-actions": { "aria-label": ["上蓋與底板標籤", "Top and bottom tags", "Top- und Bottom-Markierungen", "Top- und Bottom-Markierungen"] },
        ".workspace": { "aria-label": ["2D output preview", "2D output preview", "2D-Ausgabevorschau", "2D-Ausgabevorschau"] },
        ".legend": { "aria-label": ["Layer legend", "Layer legend", "Ebenenlegende", "Ebenenlegende"] },
        ".zoom-controls": { "aria-label": ["Preview zoom controls", "Preview zoom controls", "Vorschau-Zoom", "Vorschau-Zoom"] },
        "#zoomOutButton": { title: ["Zoom out", "Zoom out", "Verkleinern", "Verkleinern"], "aria-label": ["Zoom out", "Zoom out", "Verkleinern", "Verkleinern"] },
        "#zoomInButton": { title: ["Zoom in", "Zoom in", "Vergrößern", "Vergrößern"], "aria-label": ["Zoom in", "Zoom in", "Vergrößern", "Vergrößern"] },
        "#zoomResetButton": { title: ["Reset zoom", "Reset zoom", "Zoom zurücksetzen", "Zoom zurücksetzen"], "aria-label": ["Reset zoom", "Reset zoom", "Zoom zurücksetzen", "Zoom zurücksetzen"] },
        "#previewSvg": { "aria-label": ["產生的 2D 雷雕預覽", "Generated 2D laser preview", "Erzeugte 2D-Laservorschau", "Erzeugte 2D-Laservorschau"] }
      }
    },
    bmptrace: {
      title: {
        "zh-Hant": "Z-Axis Gradient Lab",
        en: "Z-Axis Gradient Lab",
        de: "Z-Achsen-Verlaufslabor",
        "de-AT": "Z-Achsen-Verlaufslabor"
      },
      text: {
        ".top-tool-badge span:last-child": ["Potrace：檢查中", "Potrace: checking", "Potrace: Prüfung läuft", "Potrace: Prüfung läuft"],
        "h1": ["Z-Axis Gradient Lab", "Z-Axis Gradient Lab", "Z-Achsen-Verlaufslabor", "Z-Achsen-Verlaufslabor"],
        "#statusText": ["待上傳", "Waiting for upload", "Wartet auf Upload", "Wartet auf Upload"],
        ".input-column > .section-head h2": ["Input", "Input", "Eingabe", "Eingabe"],
        ".input-column > .section-head span": ["彩色去背圖片", "Color image with background removed", "Farbbild mit entferntem Hintergrund", "Farbbild mit entferntem Hintergrund"],
        "label:has(#imageInput) span": ["上傳 PNG / JPG / WebP / SVG", "Upload PNG / JPG / WebP / SVG", "PNG / JPG / WebP / SVG hochladen", "PNG / JPG / WebP / SVG hochladen"],
        "#loadSample": ["載入老虎範例", "Load tiger sample", "Tiger-Beispiel laden", "Tiger-Beispiel laden"],
        "#traceTab .section-head h2": ["Bitmap Trace", "Bitmap Trace", "Bitmap-Trace", "Bitmap-Trace"],
        "#traceTab .section-head span": ["內建灰階", "Built-in grayscale", "Integrierte Graustufen", "Integrierte Graustufen"],
        "label:has(#traceScans) span": ["掃描數", "Scan count", "Scan-Anzahl", "Scan-Anzahl"],
        "#traceScans option[value='5']": ["5 層", "5 layers", "5 Ebenen", "5 Ebenen"],
        "#traceScans option[value='7']": ["7 層", "7 layers", "7 Ebenen", "7 Ebenen"],
        "#traceScans option[value='12']": ["12 層", "12 layers", "12 Ebenen", "12 Ebenen"],
        "#traceScans option[value='24']": ["24 層", "24 layers", "24 Ebenen", "24 Ebenen"],
        "#fluxTab .section-head h2": ["FLUX Output", "FLUX Output", "FLUX-Ausgabe", "FLUX-Ausgabe"],
        "#fluxTab .section-head span": ["功率設定", "Power settings", "Leistungseinstellungen", "Leistungseinstellungen"],
        "label:has(#machineWatts) span": ["機型額定功率", "Machine rated power", "Nennleistung der Maschine", "Nennleistung der Maschine"],
        "label:has(#outputWidthMm) span": ["輸出寬度 mm", "Output width mm", "Ausgabebreite mm", "Ausgabebreite mm"],
        "label:has(#minPower) span": ["最低功率 %", "Minimum power %", "Minimale Leistung %", "Minimale Leistung %"],
        "label:has(#maxPower) span": ["最高功率 %", "Maximum power %", "Maximale Leistung %", "Maximale Leistung %"],
        "label:has(#engraveSpeed) span": ["速度 mm/s", "Speed mm/s", "Geschwindigkeit mm/s", "Geschwindigkeit mm/s"],
        "label:has(#outputMode) span": ["輸出模式", "Output mode", "Ausgabemodus", "Ausgabemodus"],
        "#outputMode option[value='trace']": ["平滑 Trace 分層", "Smooth trace layers", "Geglättete Trace-Ebenen", "Geglättete Trace-Ebenen"],
        "#outputMode option[value='rect']": ["快速矩形分層", "Fast rectangle layers", "Schnelle Rechteck-Ebenen", "Schnelle Rechteck-Ebenen"],
        "label:has(#projectName) span": ["專案名稱", "Project name", "Projektname", "Projektname"],
        "#toolsTab .section-head h2": ["工具狀態", "Tool status", "Werkzeugstatus", "Werkzeugstatus"],
        "#checkTools": ["重新檢查工具", "Recheck tools", "Werkzeuge erneut prüfen", "Werkzeuge erneut prüfen"],
        ".manual-panel h2": ["使用者簡易操作手冊", "Quick User Guide", "Kurzanleitung", "Kurzanleitung"],
        ".manual-list li:nth-child(1)": ["上傳 PNG、JPG、WebP、BMP 或 SVG 圖片，也可以先載入範例測試。", "Upload a PNG, JPG, WebP, BMP, or SVG image, or load the sample first.", "Laden Sie ein PNG-, JPG-, WebP-, BMP- oder SVG-Bild hoch oder testen Sie zuerst das Beispiel.", "Laden Sie ein PNG-, JPG-, WebP-, BMP- oder SVG-Bild hoch oder testen Sie zuerst das Beispiel."],
        ".manual-list li:nth-child(2)": ["在 Trace 分頁選擇掃描層數，層數越多灰階越細。", "Choose the scan count in the Trace tab; more layers give finer grayscale steps.", "Wählen Sie im Trace-Tab die Scan-Anzahl; mehr Ebenen ergeben feinere Graustufen.", "Wählen Sie im Trace-Tab die Scan-Anzahl; mehr Ebenen ergeben feinere Graustufen."],
        ".manual-list li:nth-child(3)": ["在 FLUX 分頁設定輸出寬度、功率範圍、速度與專案名稱。", "Set output width, power range, speed, and project name in the FLUX tab.", "Stellen Sie im FLUX-Tab Ausgabebreite, Leistungsbereich, Geschwindigkeit und Projektname ein.", "Stellen Sie im FLUX-Tab Ausgabebreite, Leistungsbereich, Geschwindigkeit und Projektname ein."],
        ".manual-list li:nth-child(4)": ["檢查中央預覽；可用 +、-、rest 調整檢視倍率，不影響輸出尺寸。", "Check the center preview; use +, -, and rest to change view zoom without changing output size.", "Prüfen Sie die Vorschau; mit +, - und rest ändern Sie nur die Ansicht, nicht die Ausgabegröße.", "Prüfen Sie die Vorschau; mit +, - und rest ändern Sie nur die Ansicht, nicht die Ausgabegröße."],
        ".manual-list li:nth-child(5)": ["按「開啟圖層檢視器」檢查分層，確認後再下載 SVG 匯入 Beam Studio。", "Open the layer inspector to check layers, then download the SVG for Beam Studio.", "Öffnen Sie den Ebenenprüfer, kontrollieren Sie die Ebenen und laden Sie danach die SVG für Beam Studio herunter.", "Öffnen Sie den Ebenenprüfer, kontrollieren Sie die Ebenen und laden Sie danach die SVG für Beam Studio herunter."],
        "#imageMetric": ["未載入圖片", "No image loaded", "Kein Bild geladen", "Kein Bild geladen"],
        "#emptyState": ["上傳彩色去背圖片後會依掃描數產生灰階 trace 分離圖層", "Upload a color image with background removed to generate separated grayscale trace layers.", "Laden Sie ein freigestelltes Farbbild hoch, um getrennte Graustufen-Trace-Ebenen zu erzeugen.", "Laden Sie ein freigestelltes Farbbild hoch, um getrennte Graustufen-Trace-Ebenen zu erzeugen."],
        "#resetView": ["rest", "reset", "Zurücksetzen", "Zurücksetzen"],
        "figcaption": ["原始彩色", "Original color", "Originalfarbe", "Originalfarbe"],
        ".export-column > .section-head:first-child h2": ["匯出", "Export", "Export", "Export"],
        "#layerSummary": ["5 灰階 / 5 層", "5 grayscale / 5 layers", "5 Graustufen / 5 Ebenen", "5 Graustufen / 5 Ebenen"],
        "#openLayerInspector": ["開啟圖層檢視器", "Open layer inspector", "Ebenenprüfer öffnen", "Ebenenprüfer öffnen"],
        "#downloadSvg": ["下載 SVG", "Download SVG", "SVG herunterladen", "SVG herunterladen"],
        ".section-head:has(> #profileSummary) h2": ["功率對照", "Power Table", "Leistungstabelle", "Leistungstabelle"],
        "th:nth-child(2)": ["灰階", "Grayscale", "Graustufe", "Graustufe"],
        ".section-head:has(+ #legend) h2": ["圖層參數", "Layer Parameters", "Ebenenparameter", "Ebenenparameter"],
        ".install-title": ["Potrace 安裝檢查", "Potrace installation check", "Potrace-Installationsprüfung", "Potrace-Installationsprüfung"],
        "#potraceInstallBadge": ["檢查中", "Checking", "Prüfung läuft", "Prüfung läuft"],
        ".section-head:has(.install-title) > span": ["安裝指令", "Install commands", "Installationsbefehle", "Installationsbefehle"],
        ".install-actions .step-button:nth-child(1)": ["1 安裝 Potrace", "1 Install Potrace", "1 Potrace installieren", "1 Potrace installieren"],
        ".install-actions .step-button:nth-child(2)": ["2 驗證安裝", "2 Verify installation", "2 Installation prüfen", "2 Installation prüfen"],
        ".install-actions .step-button:nth-child(3)": ["3 重新檢查", "3 Recheck", "3 Erneut prüfen", "3 Erneut prüfen"],
        ".install-actions .step-button:nth-child(4)": ["4 macOS 指令", "4 macOS command", "4 macOS-Befehl", "4 macOS-Befehl"],
        ".install-actions .step-button:nth-child(5)": ["5 Ubuntu 指令", "5 Ubuntu command", "5 Ubuntu-Befehl", "5 Ubuntu-Befehl"],
        "#installModalTitle": ["尚未偵測到 Potrace，請用三步驟完成 Windows 安裝與驗證", "Potrace was not detected. Complete Windows installation and verification in three steps.", "Potrace wurde nicht erkannt. Schließen Sie Installation und Prüfung unter Windows in drei Schritten ab.", "Potrace wurde nicht erkannt. Schließen Sie Installation und Prüfung unter Windows in drei Schritten ab."],
        "#installModal .section-head > span": ["請安裝", "Please install", "Bitte installieren", "Bitte installieren"],
        ".install-modal .step-button:nth-of-type(1)": ["1 安裝 Potrace", "1 Install Potrace", "1 Potrace installieren", "1 Potrace installieren"],
        ".install-modal .step-button:nth-of-type(2)": ["2 驗證安裝", "2 Verify installation", "2 Installation prüfen", "2 Installation prüfen"],
        ".install-modal .step-button:nth-of-type(3)": ["3 重新檢查", "3 Recheck", "3 Erneut prüfen", "3 Erneut prüfen"],
        "#closeInstallModal": ["稍後再說", "Later", "Später", "Später"],
        "#layerInspectorModalTitle": ["SVG 圖層檢視器", "SVG Layer Inspector", "SVG-Ebenenprüfer", "SVG-Ebenenprüfer"],
        "#closeLayerInspectorModal": ["關閉", "Close", "Schließen", "Schließen"]
      },
      html: {
        ".install-note": [
          "Potrace 是開源的點陣圖轉 SVG 向量輪廓工具，只處理影像轉檔，不會控制雷切機。Windows 請先按「安裝 Potrace」，完成後關閉 PowerShell、重新開啟，再用「驗證安裝」確認；若顯示 <code>potrace 1.16</code> 即成功。",
          "Potrace is an open-source bitmap-to-SVG outline tool. It only converts images and does not control the laser cutter. On Windows, press \"Install Potrace\", close and reopen PowerShell after installation, then use \"Verify installation\". Seeing <code>potrace 1.16</code> means it worked.",
          "Potrace ist ein Open-Source-Werkzeug zum Umwandeln von Bitmaps in SVG-Konturen. Es konvertiert nur Bilder und steuert keinen Lasercutter. Unter Windows zuerst „Potrace installieren“ drücken, danach PowerShell schließen und neu öffnen und mit „Installation prüfen“ kontrollieren. <code>potrace 1.16</code> bedeutet Erfolg.",
          "Potrace ist ein Open-Source-Werkzeug zum Umwandeln von Bitmaps in SVG-Konturen. Es konvertiert nur Bilder und steuert keinen Lasercutter. Unter Windows zuerst „Potrace installieren“ drücken, danach PowerShell schließen und neu öffnen und mit „Installation prüfen“ kontrollieren. <code>potrace 1.16</code> bedeutet Erfolg."
        ]
      },
      attr: {
        ".top-grid": { "aria-label": ["漸層雷雕流程", "Gradient laser workflow", "Workflow für Verlaufslaser", "Workflow für Verlaufslaser"] },
        ".tabs": { "aria-label": ["參數分頁", "Parameter tabs", "Parameter-Tabs", "Parameter-Tabs"] },
        ".workspace": { "aria-label": ["漸層預覽", "Gradient preview", "Verlaufsvorschau", "Verlaufsvorschau"] },
        ".zoom-controls": { "aria-label": ["預覽縮放控制", "Preview zoom controls", "Vorschau-Zoom", "Vorschau-Zoom"] },
        "#zoomOut": { "aria-label": ["縮小", "Zoom out", "Verkleinern", "Verkleinern"] },
        "#zoomIn": { "aria-label": ["放大", "Zoom in", "Vergrößern", "Vergrößern"] },
        "#sourcePreview": { alt: ["原始彩色圖片預覽", "Original color image preview", "Vorschau des Originalfarbbildes", "Vorschau des Originalfarbbildes"] },
        "#previewSvg": { "aria-label": ["產生的 Beam Studio 圖層預覽", "Generated Beam Studio layer preview", "Erzeugte Beam-Studio-Ebenenvorschau", "Erzeugte Beam-Studio-Ebenenvorschau"] },
        "#closeLayerInspectorModal": { "aria-label": ["關閉圖層檢視器", "Close layer inspector", "Ebenenprüfer schließen", "Ebenenprüfer schließen"] },
        "#layerInspectorFrame": { title: ["SVG 圖層檢視器", "SVG Layer Inspector", "SVG-Ebenenprüfer", "SVG-Ebenenprüfer"] }
      }
    },
    svglayers: {
      title: {
        "zh-Hant": "SVG Layer Inspector",
        en: "SVG Layer Inspector",
        de: "SVG-Ebenenprüfer",
        "de-AT": "SVG-Ebenenprüfer"
      },
      text: {
        "h1": ["SVG Layer Inspector", "SVG Layer Inspector", "SVG-Ebenenprüfer", "SVG-Ebenenprüfer"],
        ".side-panel .section-head h2": ["SVG 檔案", "SVG File", "SVG-Datei", "SVG-Datei"],
        "label:has(#svgInput) span": ["上傳 SVG", "Upload SVG", "SVG hochladen", "SVG hochladen"],
        "#loadSample": ["載入樣本", "Load sample", "Beispiel laden", "Beispiel laden"],
        "#fitView": ["置中", "Fit view", "Ansicht einpassen", "Ansicht einpassen"],
        ".zoom-panel h2": ["縮放", "Zoom", "Zoom", "Zoom"],
        "#manualTitle": ["使用者簡易操作手冊", "Quick User Guide", "Kurzanleitung", "Kurzanleitung"],
        ".manual-list li:nth-child(1)": ["上傳 SVG，或按「載入樣本」快速查看圖層效果。", "Upload an SVG or press Load sample to preview layer behavior.", "Laden Sie eine SVG hoch oder drücken Sie Beispiel laden, um Ebenen schnell zu prüfen.", "Laden Sie eine SVG hoch oder drücken Sie Beispiel laden, um Ebenen schnell zu prüfen."],
        ".manual-list li:nth-child(2)": ["中間畫布可拖曳檢視，使用縮放滑桿或 +、- 調整比例。", "Drag the center canvas and use the zoom slider or + / - to adjust scale.", "Ziehen Sie die mittlere Arbeitsfläche und ändern Sie den Maßstab mit Regler oder + / -.", "Ziehen Sie die mittlere Arbeitsfläche und ändern Sie den Maßstab mit Regler oder + / -."],
        ".manual-list li:nth-child(3)": ["請特別注意：圖層名稱就是雷雕機圖層功率 % 與速度的參數控制量。", "Important: layer names are the parameter controls for laser power % and speed.", "Wichtig: Ebenennamen steuern Laserleistung in % und Geschwindigkeit.", "Wichtig: Ebenennamen steuern Laserleistung in % und Geschwindigkeit."],
        ".manual-list li:nth-child(4)": ["右側清單會列出 SVG 圖層；勾選可顯示或隱藏單一圖層。", "The right list shows SVG layers; use checkboxes to show or hide each layer.", "Die rechte Liste zeigt SVG-Ebenen; per Checkbox blenden Sie einzelne Ebenen ein oder aus.", "Die rechte Liste zeigt SVG-Ebenen; per Checkbox blenden Sie einzelne Ebenen ein oder aus."],
        ".manual-list li:nth-child(5)": ["按「全部顯示」或「全部隱藏」可快速檢查圖層分離狀態。", "Use Show all or Hide all to quickly check layer separation.", "Mit Alle anzeigen oder Alle ausblenden prüfen Sie die Ebenentrennung schnell.", "Mit Alle anzeigen oder Alle ausblenden prüfen Sie die Ebenentrennung schnell."],
        ".manual-list li:nth-child(6)": ["檢查圖層名稱與可見性後，再回到原工具下載或修正 SVG。", "After checking names and visibility, return to the original tool to download or fix the SVG.", "Nach Prüfung von Namen und Sichtbarkeit kehren Sie zum Werkzeug zurück, um die SVG zu laden oder zu korrigieren.", "Nach Prüfung von Namen und Sichtbarkeit kehren Sie zum Werkzeug zurück, um die SVG zu laden oder zu korrigieren."],
        "#emptyState": ["上傳 SVG 後可檢視圖層名稱、顯示狀態與縮放", "Upload an SVG to inspect layer names, visibility, and zoom.", "Laden Sie eine SVG hoch, um Ebenennamen, Sichtbarkeit und Zoom zu prüfen.", "Laden Sie eine SVG hoch, um Ebenennamen, Sichtbarkeit und Zoom zu prüfen."],
        ".layer-panel .section-head h2": ["圖層", "Layers", "Ebenen", "Ebenen"],
        "#layerDepthNote": ["功率調高、速率調慢則刻得深；以灰階雕刻為例，深色區用功率 35%、速率 120 mm/s 刻出凹陷感。", "Higher power and slower speed engrave deeper; for grayscale engraving, dark areas can use 35% power at 120 mm/s to create a recessed effect.", "Mehr Leistung und geringere Geschwindigkeit gravieren tiefer; bei Graustufengravur können dunkle Bereiche mit 35 % Leistung und 120 mm/s eine Vertiefung erzeugen.", "Mehr Leistung und geringere Geschwindigkeit gravieren tiefer; bei Graustufengravur können dunkle Bereiche mit 35 % Leistung und 120 mm/s eine Vertiefung erzeugen."],
        "#showAll": ["全部顯示", "Show all", "Alle anzeigen", "Alle anzeigen"],
        "#hideAll": ["全部隱藏", "Hide all", "Alle ausblenden", "Alle ausblenden"]
      },
      attr: {
        "#zoomOut": { "aria-label": ["縮小", "Zoom out", "Verkleinern", "Verkleinern"] },
        "#zoomRange": { "aria-label": ["縮放比例", "Zoom level", "Zoomstufe", "Zoomstufe"] },
        "#zoomIn": { "aria-label": ["放大", "Zoom in", "Vergrößern", "Vergrößern"] }
      }
    }
  };

  const exactText = {
    "Ready": { en: "Ready", de: "Bereit", "de-AT": "Bereit" },
    "Generating": { en: "Generating", de: "Wird erzeugt", "de-AT": "Wird erzeugt" },
    "No warnings.": { en: "No warnings.", de: "Keine Hinweise.", "de-AT": "Keine Hinweise." },
    "目前：沒有接榫": { en: "Current: no joinery", de: "Aktuell: ohne Zapfen", "de-AT": "Aktuell: ohne Zapfen" },
    "目前：接榫後": { en: "Current: with joinery", de: "Aktuell: mit Zapfen", "de-AT": "Aktuell: mit Zapfen" },
    "顯示接榫後": { en: "Show with joinery", de: "Mit Zapfen anzeigen", "de-AT": "Mit Zapfen anzeigen" },
    "顯示沒有接榫": { en: "Show without joinery", de: "Ohne Zapfen anzeigen", "de-AT": "Ohne Zapfen anzeigen" },
    "目前：內尺寸(長寬高為內部尺寸)": { en: "Current: inner size (L/W/H are internal dimensions)", de: "Aktuell: Innenmaß (L/B/H sind Innenmaße)", "de-AT": "Aktuell: Innenmaß (L/B/H sind Innenmaße)" },
    "目前：外尺寸": { en: "Current: outer size", de: "Aktuell: Außenmaß", "de-AT": "Aktuell: Außenmaß" },
    "選取接榫邊": { en: "Select joint edges", de: "Zapfenkanten wählen", "de-AT": "Zapfenkanten wählen" },
    "結束選邊": { en: "Finish edge selection", de: "Kantenauswahl beenden", "de-AT": "Kantenauswahl beenden" },
    "尚未建立接榫配對。": { en: "No joinery pairs yet.", de: "Noch keine Zapfenpaare.", "de-AT": "Noch keine Zapfenpaare." },
    "已載入正立方體展開圖；確認後會使用內建正確接榫拓撲輸出。": { en: "Cube layout loaded. After confirmation, the built-in correct joinery topology will be used.", de: "Würfelabwicklung geladen. Nach Bestätigung wird die integrierte korrekte Zapfentopologie verwendet.", "de-AT": "Würfelabwicklung geladen. Nach Bestätigung wird die integrierte korrekte Zapfentopologie verwendet." },
    "請再點選第二條邊建立凹槽 F。": { en: "Click a second edge to create the concave F side.", de: "Klicken Sie eine zweite Kante für die konkave F-Seite.", "de-AT": "Klicken Sie eine zweite Kante für die konkave F-Seite." },
    "尚未完成配對。": { en: "Pairing is not complete yet.", de: "Paarung ist noch nicht abgeschlossen.", "de-AT": "Paarung ist noch nicht abgeschlossen." },
    "刪除": { en: "Delete", de: "Löschen", "de-AT": "Löschen" },
    "移除": { en: "Remove", de: "Entfernen", "de-AT": "Entfernen" },
    "套用建議": { en: "Apply suggestion", de: "Vorschlag anwenden", "de-AT": "Vorschlag anwenden" },
    "檢查中": { en: "Checking", de: "Prüfung läuft", "de-AT": "Prüfung läuft" },
    "已安裝": { en: "Installed", de: "Installiert", "de-AT": "Installiert" },
    "未安裝": { en: "Not installed", de: "Nicht installiert", "de-AT": "Nicht installiert" },
    "Potrace：檢查中": { en: "Potrace: checking", de: "Potrace: Prüfung läuft", "de-AT": "Potrace: Prüfung läuft" },
    "Potrace：已安裝": { en: "Potrace: installed", de: "Potrace: installiert", "de-AT": "Potrace: installiert" },
    "Potrace：未安裝": { en: "Potrace: not installed", de: "Potrace: nicht installiert", "de-AT": "Potrace: nicht installiert" },
    "正在檢查 Potrace...": { en: "Checking Potrace...", de: "Potrace wird geprüft...", "de-AT": "Potrace wird geprüft..." },
    "已找到 Potrace": { en: "Potrace found", de: "Potrace gefunden", "de-AT": "Potrace gefunden" },
    "尚未偵測到 Potrace。": { en: "Potrace was not detected.", de: "Potrace wurde nicht erkannt.", "de-AT": "Potrace wurde nicht erkannt." },
    "手動驗證": { en: "Manual check", de: "Manuelle Prüfung", "de-AT": "Manuelle Prüfung" },
    "待上傳": { en: "Waiting for upload", de: "Wartet auf Upload", "de-AT": "Wartet auf Upload" },
    "已建立": { en: "Created", de: "Erstellt", "de-AT": "Erstellt" },
    "未載入圖片": { en: "No image loaded", de: "Kein Bild geladen", "de-AT": "Kein Bild geladen" },
    "待載入": { en: "Waiting", de: "Wartet", "de-AT": "Wartet" },
    "已載入": { en: "Loaded", de: "Geladen", "de-AT": "Geladen" },
    "未選擇": { en: "No file selected", de: "Keine Datei gewählt", "de-AT": "Keine Datei gewählt" },
    "SVG 解析失敗": { en: "SVG parse failed", de: "SVG-Analyse fehlgeschlagen", "de-AT": "SVG-Analyse fehlgeschlagen" },
    "無法載入剛下載的 SVG，請手動上傳": { en: "Could not load the downloaded SVG. Please upload it manually.", de: "Die geladene SVG konnte nicht geöffnet werden. Bitte manuell hochladen.", "de-AT": "Die geladene SVG konnte nicht geöffnet werden. Bitte manuell hochladen." },
    "此 SVG 沒有可辨識的群組圖層。": { en: "This SVG has no recognizable group layers.", de: "Diese SVG enthält keine erkennbaren Gruppenebenen.", "de-AT": "Diese SVG enthält keine erkennbaren Gruppenebenen." }
  };

  const langIndex = (language) => languages.findIndex(([code]) => code === language);
  const pageKey = () => {
    const segment = location.pathname.split("/").filter(Boolean).pop();
    if (segment && pages[segment]) return segment;
    const parent = location.pathname.split("/").filter(Boolean).at(-2);
    return pages[parent] ? parent : "";
  };

  function switcherHost() {
    const toolbar = document.querySelector(".workspace .toolbar");
    if (toolbar) {
      const zoomControls = toolbar.querySelector(".zoom-controls");
      const legend = toolbar.querySelector(".legend");
      return { element: toolbar, before: zoomControls, after: legend };
    }
    const brand = document.querySelector(".brand");
    if (brand) return { element: brand };
    return document.body;
  }

  function ensureSwitcher() {
    if (document.querySelector("#languageSelect")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "language-switcher";
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.dataset.i18nLanguageLabel = "true";
    labelText.textContent = shared[defaultLanguage].language;
    const select = document.createElement("select");
    select.id = "languageSelect";
    select.setAttribute("aria-label", shared[defaultLanguage].language);
    for (const [value, text] of languages) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    label.append(labelText, select);
    wrapper.append(label);
    const host = switcherHost();
    if (host === document.body) {
      document.body.prepend(wrapper);
    } else if (host.after) {
      host.after.insertAdjacentElement("afterend", wrapper);
    } else if (host.before) {
      host.element.insertBefore(wrapper, host.before);
    } else {
      host.element.append(wrapper);
    }
  }

  function setText(selector, values, index) {
    document.querySelectorAll(selector).forEach((element) => {
      const text = values[index] ?? values[0];
      if (element.classList.contains("step-button")) {
        const match = text.match(/^(\d+)\s*(.*)$/);
        if (match) {
          element.replaceChildren();
          const badge = document.createElement("span");
          badge.className = "step-badge";
          badge.textContent = match[1];
          element.append(badge, ` ${match[2]}`);
          return;
        }
      }
      element.textContent = text;
    });
  }

  function setHtml(selector, values, index) {
    document.querySelectorAll(selector).forEach((element) => {
      element.innerHTML = values[index] ?? values[0];
    });
  }

  function setAttributes(selector, attrs, index) {
    document.querySelectorAll(selector).forEach((element) => {
      Object.entries(attrs).forEach(([name, values]) => {
        element.setAttribute(name, values[index] ?? values[0]);
      });
    });
  }

  function translateExact(language) {
    const skipTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "OPTION"]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      if (skipTags.has(node.parentElement?.tagName)) continue;
      const raw = node.nodeValue;
      const trimmed = raw.trim();
      let translated = "";
      for (const [source, values] of Object.entries(exactText)) {
        const knownValues = [source, ...Object.values(values)];
        if (!knownValues.includes(trimmed)) continue;
        translated = language === defaultLanguage ? source : values[language] || source;
        break;
      }
      if (translated) node.nodeValue = raw.replace(trimmed, translated);
    }
  }

  function translateDynamicPatterns(language) {
    const modelLabels = {
      "長方體": { en: "Cuboid", de: "Quader", "de-AT": "Quader" },
      "正立方體": { en: "Cube", de: "Würfel", "de-AT": "Würfel" },
      "雙斜屋頂房子": { en: "Gable-roof house", de: "Haus mit Satteldach", "de-AT": "Haus mit Satteldach" },
      "柔性盒子5": { en: "Flex box 5", de: "Flexbox 5", "de-AT": "Flexbox 5" },
      "圓柱體": { en: "Cylinder", de: "Zylinder", "de-AT": "Zylinder" }
    };
    const summary = document.querySelector("#summaryText");
    if (summary && language !== defaultLanguage) {
      Object.entries(modelLabels).forEach(([source, values]) => {
        summary.textContent = summary.textContent.replace(source, values[language] || source);
      });
    }

    document.querySelectorAll("#potraceStatus, .top-tool-badge span:last-child").forEach((element) => {
      const text = element.textContent.trim();
      if (language === defaultLanguage) {
        if (/Potrace: (installed|installiert)/i.test(text)) element.textContent = "Potrace：已安裝";
        if (/Potrace: (not installed|nicht installiert)/i.test(text)) element.textContent = "Potrace：未安裝";
        return;
      }
      if (text.startsWith("已找到 Potrace：")) {
        const path = text.slice("已找到 Potrace：".length);
        element.textContent = language === "en" ? `Potrace found: ${path}` : `Potrace gefunden: ${path}`;
      }
      if (text === "Potrace：已安裝") element.textContent = language === "en" ? "Potrace: installed" : "Potrace: installiert";
      if (text === "Potrace：未安裝") element.textContent = language === "en" ? "Potrace: not installed" : "Potrace: nicht installiert";
    });
  }

  function applyLanguage(language) {
    window.__applyingI18n = true;
    const key = pageKey();
    const page = pages[key];
    const safeLanguage = shared[language] ? language : defaultLanguage;
    const index = langIndex(safeLanguage);
    document.documentElement.lang = safeLanguage;
    document.documentElement.classList.add("notranslate");
    document.documentElement.setAttribute("translate", "no");
    document.body.setAttribute("translate", "no");
    if (!document.querySelector("meta[name='google'][content='notranslate']")) {
      const meta = document.createElement("meta");
      meta.name = "google";
      meta.content = "notranslate";
      document.head.append(meta);
    }
    document.querySelector("[data-i18n-language-label]")?.replaceChildren(shared[safeLanguage].language);
    document.querySelector("#languageSelect")?.setAttribute("aria-label", shared[safeLanguage].language);
    if (page?.title) document.title = page.title[safeLanguage] || page.title[defaultLanguage];

    Object.entries(page?.text || {}).forEach(([selector, values]) => setText(selector, values, index));
    Object.entries(page?.html || {}).forEach(([selector, values]) => setHtml(selector, values, index));
    Object.entries(page?.attr || {}).forEach(([selector, attrs]) => setAttributes(selector, attrs, index));
    translateExact(safeLanguage);
    translateDynamicPatterns(safeLanguage);

    const select = document.querySelector("#languageSelect");
    if (select) select.value = safeLanguage;
    localStorage.setItem("homeLanguage", safeLanguage);
    window.__applyingI18n = false;
  }

  function boot() {
    ensureSwitcher();
    const select = document.querySelector("#languageSelect");
    const language = localStorage.getItem("homeLanguage") || defaultLanguage;
    window.applyCurrentLanguage = () => applyLanguage(select?.value || language);
    applyLanguage(language);
    select?.addEventListener("change", (event) => applyLanguage(event.target.value));
    setTimeout(() => applyLanguage(select?.value || language), 300);
    setTimeout(() => applyLanguage(select?.value || language), 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
