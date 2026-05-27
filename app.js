const MAX_FILE_BYTES = 20 * 1024 * 1024;
const NS = "http://www.w3.org/2000/svg";

const state = {
  fileName: "",
  rawObj: "",
  result: null,
  warnings: []
};

const els = {
  objFile: document.querySelector("#objFile"),
  dropZone: document.querySelector("#dropZone"),
  fileMeta: document.querySelector("#fileMeta"),
  statusPill: document.querySelector("#statusPill"),
  materialThickness: document.querySelector("#materialThickness"),
  kerfWidth: document.querySelector("#kerfWidth"),
  snappingTolerance: document.querySelector("#snappingTolerance"),
  tabWidth: document.querySelector("#tabWidth"),
  slotClearance: document.querySelector("#slotClearance"),
  projectName: document.querySelector("#projectName"),
  joineryToggle: document.querySelector("#joineryToggle"),
  numberingToggle: document.querySelector("#numberingToggle"),
  resetButton: document.querySelector("#resetButton"),
  summaryText: document.querySelector("#summaryText"),
  downloadDxf: document.querySelector("#downloadDxf"),
  downloadSvg: document.querySelector("#downloadSvg"),
  previewSvg: document.querySelector("#previewSvg"),
  emptyState: document.querySelector("#emptyState"),
  widthMetric: document.querySelector("#widthMetric"),
  heightMetric: document.querySelector("#heightMetric"),
  pathMetric: document.querySelector("#pathMetric"),
  warningList: document.querySelector("#warningList")
};

function getParams() {
  return {
    materialThicknessMm: readNumber(els.materialThickness, 3),
    kerfWidthMm: readNumber(els.kerfWidth, 0.15),
    snappingToleranceMm: readNumber(els.snappingTolerance, 0.01),
    tabWidthMm: readNumber(els.tabWidth, 10),
    slotClearanceMm: readNumber(els.slotClearance, 0.1),
    kerfMode: document.querySelector("input[name='kerfMode']:checked").value,
    generateJoinery: els.joineryToggle.checked,
    numberParts: els.numberingToggle.checked,
    outputFormat: "dxf"
  };
}

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function parseObj(text) {
  const vertices = [];
  const faces = [];
  const warnings = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);

    if (parts[0] === "v") {
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3] || 0);
      if ([x, y, z].every(Number.isFinite)) {
        vertices.push({ x, y, z });
      } else {
        warnings.push(`Line ${i + 1}: invalid vertex skipped.`);
      }
    }

    if (parts[0] === "f") {
      const face = parts.slice(1).map(token => {
        const value = Number(token.split("/")[0]);
        return value < 0 ? vertices.length + value : value - 1;
      });
      if (face.length >= 3 && face.every(index => index >= 0 && index < vertices.length)) {
        faces.push(face);
      } else {
        warnings.push(`Line ${i + 1}: invalid face skipped.`);
      }
    }
  }

  if (!vertices.length) warnings.push("No OBJ vertices found.");
  if (!faces.length) warnings.push("No OBJ faces found; preview will use vertex bounds only.");

  return { vertices, faces, warnings };
}

function convertObj(text, params) {
  const parsed = parseObj(text);
  const warnings = [...parsed.warnings];
  const scale = inferUnitScale(parsed.vertices);
  const points = parsed.vertices.map(v => ({ x: v.x * scale, y: v.y * scale }));
  const segments = [];
  const seen = new Set();

  for (const face of parsed.faces) {
    for (let i = 0; i < face.length; i += 1) {
      const a = snapPoint(points[face[i]], params.snappingToleranceMm);
      const b = snapPoint(points[face[(i + 1) % face.length]], params.snappingToleranceMm);
      const key = segmentKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      if (distance(a, b) > params.snappingToleranceMm) {
        segments.push({ layer: "CUT", a, b });
      }
    }
  }

  if (!segments.length && points.length > 1) {
    warnings.push("No faces available; using vertex bounding box as fallback preview.");
    segments.push(...boundsToSegments(getBounds(points)));
  }

  const cutSegments = applyKerf(segments, params);
  const joinery = params.generateJoinery ? createJoineryMarks(cutSegments, params) : [];
  const labels = params.numberParts ? createLabels(cutSegments) : [];
  const allGeometry = [...cutSegments, ...joinery, ...labels];
  const bounds = getGeometryBounds(allGeometry);

  if (scale !== 1) {
    warnings.push("OBJ appears unitless and small; coordinates were treated as centimeters and converted to millimeters.");
  }

  if (params.kerfMode === "offset") {
    warnings.push("Kerf offset in this V1 prototype applies a simple center-based preview offset; production offset should use robust polygon geometry.");
  }

  return {
    segments: cutSegments,
    joinery,
    labels,
    bounds,
    warnings,
    params
  };
}

function inferUnitScale(vertices) {
  const bounds = getBounds(vertices.map(v => ({ x: v.x, y: v.y })));
  const size = Math.max(bounds.width, bounds.height);
  return size > 0 && size < 10 ? 10 : 1;
}

function snapPoint(point, tolerance) {
  if (!tolerance) return { x: point.x, y: point.y };
  return {
    x: Math.round(point.x / tolerance) * tolerance,
    y: Math.round(point.y / tolerance) * tolerance
  };
}

function segmentKey(a, b) {
  const first = `${roundKey(a.x)},${roundKey(a.y)}`;
  const second = `${roundKey(b.x)},${roundKey(b.y)}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function roundKey(value) {
  return Number(value).toFixed(4);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getBounds(points) {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function getGeometryBounds(items) {
  const points = [];
  for (const item of items) {
    if (item.a) points.push(item.a, item.b);
    if (item.x !== undefined) points.push({ x: item.x, y: item.y });
  }
  return getBounds(points);
}

function boundsToSegments(bounds) {
  const a = { x: bounds.minX, y: bounds.minY };
  const b = { x: bounds.maxX, y: bounds.minY };
  const c = { x: bounds.maxX, y: bounds.maxY };
  const d = { x: bounds.minX, y: bounds.maxY };
  return [
    { layer: "CUT", a, b },
    { layer: "CUT", a: b, b: c },
    { layer: "CUT", a: c, b: d },
    { layer: "CUT", a: d, b: a }
  ];
}

function applyKerf(segments, params) {
  if (params.kerfMode !== "offset" || params.kerfWidthMm <= 0) {
    return segments.map(segment => ({
      ...segment,
      strokeWidth: params.kerfMode === "stroke" ? params.kerfWidthMm : 0.1
    }));
  }

  const bounds = getGeometryBounds(segments);
  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;
  const offset = params.kerfWidthMm / 2;
  return segments.map(segment => ({
    ...segment,
    a: offsetPoint(segment.a, cx, cy, offset),
    b: offsetPoint(segment.b, cx, cy, offset),
    strokeWidth: 0.1
  }));
}

function offsetPoint(point, cx, cy, offset) {
  const dx = point.x - cx;
  const dy = point.y - cy;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: point.x + (dx / length) * offset,
    y: point.y + (dy / length) * offset
  };
}

function createJoineryMarks(segments, params) {
  const marks = [];
  const sorted = [...segments].sort((one, two) => distance(two.a, two.b) - distance(one.a, one.b));
  const candidates = sorted.slice(0, Math.min(12, sorted.length));

  candidates.forEach((segment, index) => {
    const length = distance(segment.a, segment.b);
    if (length < params.tabWidthMm * 1.8) return;
    const mid = {
      x: (segment.a.x + segment.b.x) / 2,
      y: (segment.a.y + segment.b.y) / 2
    };
    const dx = (segment.b.x - segment.a.x) / length;
    const dy = (segment.b.y - segment.a.y) / length;
    const half = params.tabWidthMm / 2;
    const depth = params.materialThicknessMm + params.slotClearanceMm;
    const normal = { x: -dy, y: dx };
    const start = { x: mid.x - dx * half, y: mid.y - dy * half };
    const end = { x: mid.x + dx * half, y: mid.y + dy * half };
    const outerStart = { x: start.x + normal.x * depth, y: start.y + normal.y * depth };
    const outerEnd = { x: end.x + normal.x * depth, y: end.y + normal.y * depth };

    marks.push({ layer: "JOINERY", a: start, b: outerStart });
    marks.push({ layer: "JOINERY", a: outerStart, b: outerEnd });
    marks.push({ layer: "JOINERY", a: outerEnd, b: end });

    if (index < 6) {
      marks.push({ layer: "SCORE", a: start, b: end });
    }
  });

  return marks;
}

function createLabels(segments) {
  const bounds = getGeometryBounds(segments);
  if (!bounds.width && !bounds.height) return [];
  return [{
    layer: "NUMBERING",
    text: "P-001",
    x: bounds.minX + bounds.width * 0.08,
    y: bounds.minY + bounds.height * 0.12,
    height: Math.max(3, Math.min(bounds.width, bounds.height) * 0.05)
  }];
}

function render(result) {
  clearSvg();
  const padding = 10;
  const width = Math.max(result.bounds.width, 1);
  const height = Math.max(result.bounds.height, 1);
  const viewBox = [
    result.bounds.minX - padding,
    -result.bounds.maxY - padding,
    width + padding * 2,
    height + padding * 2
  ];

  els.previewSvg.setAttribute("viewBox", viewBox.join(" "));
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const groups = {
    CUT: createSvgElement("g", { class: "svg-cut" }),
    SCORE: createSvgElement("g", { class: "svg-score" }),
    JOINERY: createSvgElement("g", { class: "svg-joinery" }),
    NUMBERING: createSvgElement("g", { class: "svg-engrave" })
  };

  for (const group of Object.values(groups)) {
    els.previewSvg.appendChild(group);
  }

  for (const segment of [...result.segments, ...result.joinery]) {
    const line = createSvgElement("line", {
      x1: segment.a.x,
      y1: -segment.a.y,
      x2: segment.b.x,
      y2: -segment.b.y,
      "vector-effect": "non-scaling-stroke",
      "stroke-width": segment.strokeWidth || 0.35
    });
    groups[segment.layer]?.appendChild(line);
  }

  for (const label of result.labels) {
    const text = createSvgElement("text", {
      x: label.x,
      y: -label.y,
      "font-size": label.height,
      "dominant-baseline": "middle"
    });
    text.textContent = label.text;
    groups.NUMBERING.appendChild(text);
  }

  addSvgStyles();
  els.emptyState.style.display = "none";
  els.widthMetric.textContent = formatNumber(width);
  els.heightMetric.textContent = formatNumber(height);
  els.pathMetric.textContent = String(result.segments.length + result.joinery.length);
  els.summaryText.textContent = `${result.segments.length} cut paths`;
  els.downloadDxf.disabled = false;
  els.downloadSvg.disabled = false;
  renderWarnings(result.warnings);
}

function createSvgElement(name, attributes) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value);
  }
  return el;
}

function clearSvg() {
  while (els.previewSvg.firstChild) {
    els.previewSvg.removeChild(els.previewSvg.firstChild);
  }
}

function addSvgStyles() {
  const style = createSvgElement("style", {});
  style.textContent = `
    .svg-cut line { stroke: #d42929; }
    .svg-score line { stroke: #2468d8; stroke-dasharray: 3 2; }
    .svg-joinery line { stroke: #16855e; }
    .svg-engrave text { fill: #2f343a; font-family: Arial, sans-serif; }
  `;
  els.previewSvg.insertBefore(style, els.previewSvg.firstChild);
}

function renderWarnings(warnings) {
  els.warningList.innerHTML = "";
  const items = warnings.length ? warnings : ["No warnings."];
  for (const warning of items) {
    const li = document.createElement("li");
    li.textContent = warning;
    els.warningList.appendChild(li);
  }
}

function exportSvg(result) {
  const clone = els.previewSvg.cloneNode(true);
  clone.setAttribute("xmlns", NS);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}\n`;
}

function exportDxf(result) {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  for (const segment of [...result.segments, ...result.joinery]) {
    lines.push(
      "0", "LINE",
      "8", segment.layer,
      "10", dxfNum(segment.a.x),
      "20", dxfNum(segment.a.y),
      "30", "0",
      "11", dxfNum(segment.b.x),
      "21", dxfNum(segment.b.y),
      "31", "0"
    );
  }
  for (const label of result.labels) {
    lines.push(
      "0", "TEXT",
      "8", label.layer,
      "10", dxfNum(label.x),
      "20", dxfNum(label.y),
      "30", "0",
      "40", dxfNum(label.height),
      "1", label.text
    );
  }
  lines.push("0", "ENDSEC", "0", "EOF");
  return `${lines.join("\n")}\n`;
}

function dxfNum(value) {
  return Number(value).toFixed(4);
}

function formatNumber(value) {
  return Number(value).toFixed(value >= 100 ? 0 : 1);
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeBaseName() {
  return (els.projectName.value || state.fileName || "laser_parts")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "laser_parts";
}

function runConversion() {
  if (!state.rawObj) return;
  els.statusPill.textContent = "Converting";
  state.result = convertObj(state.rawObj, getParams());
  render(state.result);
  els.statusPill.textContent = "Ready";
}

async function handleFile(file) {
  if (!file) return;
  state.warnings = [];
  if (!file.name.toLowerCase().endsWith(".obj")) {
    setError("Only .obj files are accepted in V1.");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    setError("File is larger than the V1 20 MB limit.");
    return;
  }
  state.fileName = file.name;
  state.rawObj = await file.text();
  els.fileMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
  els.projectName.value = file.name.replace(/\.[^.]+$/, "") || els.projectName.value;
  runConversion();
}

function setError(message) {
  els.statusPill.textContent = "Error";
  renderWarnings([message]);
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resetParams() {
  els.materialThickness.value = "3.0";
  els.kerfWidth.value = "0.15";
  els.snappingTolerance.value = "0.01";
  els.tabWidth.value = "10.0";
  els.slotClearance.value = "0.10";
  document.querySelector("input[name='kerfMode'][value='stroke']").checked = true;
  els.joineryToggle.checked = true;
  els.numberingToggle.checked = true;
  runConversion();
}

els.objFile.addEventListener("change", event => handleFile(event.target.files[0]));
els.resetButton.addEventListener("click", resetParams);

for (const input of document.querySelectorAll("input")) {
  if (input.type !== "file" && input.type !== "text") {
    input.addEventListener("input", runConversion);
    input.addEventListener("change", runConversion);
  }
}

els.projectName.addEventListener("input", () => {});

els.downloadDxf.addEventListener("click", () => {
  if (!state.result) return;
  download(`${safeBaseName()}.dxf`, exportDxf(state.result), "application/dxf");
});

els.downloadSvg.addEventListener("click", () => {
  if (!state.result) return;
  download(`${safeBaseName()}.svg`, exportSvg(state.result), "image/svg+xml");
});

for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
}

els.dropZone.addEventListener("drop", event => {
  handleFile(event.dataTransfer.files[0]);
});
