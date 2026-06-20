const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;

const state = {
  result: null
};

const els = {
  modelType: document.querySelector("#modelType"),
  length: document.querySelector("#length"),
  width: document.querySelector("#width"),
  height: document.querySelector("#height"),
  radius: document.querySelector("#radius"),
  wallHeight: document.querySelector("#wallHeight"),
  roofHeight: document.querySelector("#roofHeight"),
  materialThickness: document.querySelector("#materialThickness"),
  kerfWidth: document.querySelector("#kerfWidth"),
  tabWidth: document.querySelector("#tabWidth"),
  tabDepth: document.querySelector("#tabDepth"),
  tabSpacing: document.querySelector("#tabSpacing"),
  partGap: document.querySelector("#partGap"),
  segments: document.querySelector("#segments"),
  projectName: document.querySelector("#projectName"),
  joineryToggle: document.querySelector("#joineryToggle"),
  resetButton: document.querySelector("#resetButton"),
  summaryText: document.querySelector("#summaryText"),
  downloadDxf: document.querySelector("#downloadDxf"),
  downloadSvg: document.querySelector("#downloadSvg"),
  previewSvg: document.querySelector("#previewSvg"),
  widthMetric: document.querySelector("#widthMetric"),
  heightMetric: document.querySelector("#heightMetric"),
  pathMetric: document.querySelector("#pathMetric"),
  warningList: document.querySelector("#warningList"),
  statusPill: document.querySelector("#statusPill"),
  circularFields: document.querySelectorAll("[data-field='circular']"),
  houseFields: document.querySelectorAll("[data-field='house']")
};

const defaults = {
  cube: { length: 60, width: 60, height: 60, radius: 30, wallHeight: 50, roofHeight: 28 },
  cuboid: { length: 120, width: 80, height: 60, radius: 40, wallHeight: 50, roofHeight: 28 },
  cylinder: { length: 120, width: 80, height: 80, radius: 35, wallHeight: 50, roofHeight: 28 },
  cone: { length: 120, width: 80, height: 90, radius: 35, wallHeight: 50, roofHeight: 28 },
  gable_house: { length: 120, width: 80, height: 80, radius: 35, wallHeight: 55, roofHeight: 35 }
};

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function getParams() {
  const materialThickness = readNumber(els.materialThickness, 3);
  const tabDepthValue = readNumber(els.tabDepth, materialThickness);
  return {
    modelType: els.modelType.value,
    length: readNumber(els.length, 120),
    width: readNumber(els.width, 80),
    height: readNumber(els.height, 60),
    radius: readNumber(els.radius, 35),
    wallHeight: readNumber(els.wallHeight, 55),
    roofHeight: readNumber(els.roofHeight, 35),
    materialThickness,
    kerfWidth: readNumber(els.kerfWidth, 0.15),
    tabWidth: readNumber(els.tabWidth, 10),
    tabDepth: tabDepthValue > 0 ? tabDepthValue : materialThickness,
    tabSpacing: readNumber(els.tabSpacing, 8),
    partGap: readNumber(els.partGap, 8),
    segments: Math.max(8, Math.round(readNumber(els.segments, 48))),
    generateJoinery: els.joineryToggle.checked
  };
}

function buildResult(params) {
  const warnings = validateParams(params);
  const pieces = [];

  if (params.modelType === "cube") {
    const side = params.length;
    pieces.push(...buildBoxPieces(side, side, side, params));
  }

  if (params.modelType === "cuboid") {
    pieces.push(...buildBoxPieces(params.length, params.width, params.height, params));
  }

  if (params.modelType === "cylinder") {
    pieces.push(...buildCylinderPieces(params));
  }

  if (params.modelType === "cone") {
    pieces.push(...buildConePieces(params));
  }

  if (params.modelType === "gable_house") {
    pieces.push(...buildHousePieces(params));
  }

  const laidOut = layoutPieces(pieces, params.partGap);
  const bounds = getBoundsFromPieces(laidOut);
  warnings.push(...modelWarnings(params));

  return { pieces: laidOut, bounds, warnings, params };
}

function validateParams(params) {
  const warnings = [];
  const positives = [
    ["length", params.length],
    ["width", params.width],
    ["height", params.height],
    ["material thickness", params.materialThickness],
    ["tab width", params.tabWidth],
    ["tab depth", params.tabDepth]
  ];

  if (["cylinder", "cone"].includes(params.modelType)) {
    positives.push(["radius", params.radius]);
  }

  if (params.modelType === "gable_house") {
    positives.push(["wall height", params.wallHeight], ["roof height", params.roofHeight]);
  }

  for (const [label, value] of positives) {
    if (!(value > 0)) warnings.push(`${label} must be greater than 0.`);
  }

  if (params.tabDepth < params.materialThickness) {
    warnings.push("卡榫深度小於材料厚度，實際組裝可能偏鬆。");
  }

  return warnings;
}

function modelWarnings(params) {
  const warnings = [];
  if (params.modelType === "cone") {
    warnings.push("圓錐側面以扇形近似輸出，弧線依 segments 分段。");
    if (params.generateJoinery) warnings.push("圓錐目前不套用矩形 f/F 卡榫，需另做弧線插片邏輯。");
  }
  if (params.modelType === "cylinder") {
    warnings.push("圓柱側面寬度等於圓周長，上下圓以 segments 分段。");
    if (params.generateJoinery) warnings.push("圓柱目前不套用矩形 f/F 卡榫，需另做圓周插片與插槽。");
  }
  if (params.modelType === "gable_house") {
    warnings.push("雙斜屋頂第一版採外蓋式屋頂與簡化卡榫定位。");
  }
  return warnings;
}

function buildBoxPieces(length, width, height, params) {
  const topEdges = params.generateJoinery ? "ffff" : "eeee";
  const longWallEdges = params.generateJoinery ? "FFFF" : "eeee";
  const shortWallEdges = params.generateJoinery ? "FfFf" : "eeee";
  return [
    rectPiece("top", length, width, params, topEdges),
    rectPiece("bottom", length, width, params, topEdges),
    rectPiece("front", length, height, params, longWallEdges),
    rectPiece("back", length, height, params, longWallEdges),
    rectPiece("left", width, height, params, shortWallEdges),
    rectPiece("right", width, height, params, shortWallEdges)
  ];
}

function buildCylinderPieces(params) {
  const circumference = TAU * params.radius;
  return [
    rectPiece("side", circumference, params.height, params, "eeee"),
    circlePiece("top", params.radius, params),
    circlePiece("bottom", params.radius, params)
  ];
}

function buildConePieces(params) {
  const slantHeight = Math.hypot(params.radius, params.height);
  const angle = TAU * params.radius / slantHeight;
  return [
    sectorPiece("cone_side", slantHeight, angle, params),
    circlePiece("base", params.radius, params)
  ];
}

function buildHousePieces(params) {
  const roofSlopeLength = Math.hypot(params.width / 2, params.roofHeight);
  const floorEdges = params.generateJoinery ? "ffff" : "eeee";
  const wallEdges = params.generateJoinery ? "Fefe" : "eeee";
  return [
    rectPiece("floor", params.length, params.width, params, floorEdges),
    rectPiece("left_wall", params.length, params.wallHeight, params, wallEdges),
    rectPiece("right_wall", params.length, params.wallHeight, params, wallEdges),
    gablePiece("front_gable", params.width, params.wallHeight, params.roofHeight, params),
    gablePiece("back_gable", params.width, params.wallHeight, params.roofHeight, params),
    rectPiece("roof_left", params.length, roofSlopeLength, params, "eeee"),
    rectPiece("roof_right", params.length, roofSlopeLength, params, "eeee")
  ];
}

function rectPiece(name, width, height, params, edges = "eeee") {
  const hasJoinery = /[fF]/.test(edges);
  const margin = hasJoinery ? params.tabDepth : 0;
  const path = hasJoinery
    ? fingerJointRectPath(margin, margin, width, height, edges, params)
    : rectPath(0, 0, width, height);
  return {
    name,
    layer: "CUT",
    paths: [path],
    width: width + margin * 2,
    height: height + margin * 2
  };
}

function circlePiece(name, radius, params) {
  const points = [];
  for (let i = 0; i < params.segments; i += 1) {
    const angle = -Math.PI / 2 + (i / params.segments) * TAU;
    points.push({
      x: radius + Math.cos(angle) * radius,
      y: radius + Math.sin(angle) * radius
    });
  }
  return {
    name,
    layer: "CUT",
    paths: [points],
    width: radius * 2,
    height: radius * 2
  };
}

function sectorPiece(name, radius, angle, params) {
  const points = [{ x: radius, y: radius }];
  const start = -Math.PI / 2 - angle / 2;
  for (let i = 0; i <= params.segments; i += 1) {
    const theta = start + (i / params.segments) * angle;
    points.push({
      x: radius + Math.cos(theta) * radius,
      y: radius + Math.sin(theta) * radius
    });
  }
  return {
    name,
    layer: "CUT",
    paths: [points],
    width: radius * 2,
    height: radius * 2
  };
}

function gablePiece(name, width, wallHeight, roofHeight, params) {
  const margin = params.generateJoinery ? params.tabDepth : 0;
  const x = margin;
  const y = margin;
  const points = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + wallHeight },
    { x: x + width / 2, y: y + wallHeight + roofHeight },
    { x, y: y + wallHeight }
  ];
  return {
    name,
    layer: "CUT",
    paths: [points],
    width: width + margin * 2,
    height: wallHeight + roofHeight + margin * 2
  };
}

function rectPath(x, y, width, height) {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
}

function fingerJointRectPath(x, y, width, height, edges, params) {
  const points = [];
  const [top = "e", right = "e", bottom = "e", left = "e"] = edges;
  addFingerEdge(points, { x, y }, { x: x + width, y }, { x: 0, y: -1 }, top, params);
  addFingerEdge(points, { x: x + width, y }, { x: x + width, y: y + height }, { x: 1, y: 0 }, right, params);
  addFingerEdge(points, { x: x + width, y: y + height }, { x, y: y + height }, { x: 0, y: 1 }, bottom, params);
  addFingerEdge(points, { x, y: y + height }, { x, y }, { x: -1, y: 0 }, left, params);
  return points;
}

function addFingerEdge(points, start, end, outward, type, params) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const dx = (end.x - start.x) / length;
  const dy = (end.y - start.y) / length;
  const count = calcFingerCount(length, params);
  const occupied = count * params.tabWidth + Math.max(0, count - 1) * params.tabSpacing;
  const inset = Math.max(params.materialThickness, (length - occupied) / 2);
  const direction = type === "f" ? 1 : type === "F" ? -1 : 0;
  const fingerWidth = type === "F" ? params.tabWidth + params.kerfWidth : params.tabWidth;

  pushPoint(points, start);

  if (!direction || count <= 0) {
    pushPoint(points, end);
    return;
  }

  for (let i = 0; i < count; i += 1) {
    const tabStart = inset + i * (params.tabWidth + params.tabSpacing);
    const tabEnd = Math.min(tabStart + fingerWidth, length - params.materialThickness);
    if (tabEnd <= tabStart || tabStart >= length) continue;

    const a = along(start, dx, dy, tabStart);
    const b = along(start, dx, dy, tabEnd);
    const ao = offsetBy(a, outward, params.tabDepth * direction);
    const bo = offsetBy(b, outward, params.tabDepth * direction);
    pushPoint(points, a);
    pushPoint(points, ao);
    pushPoint(points, bo);
    pushPoint(points, b);
  }

  pushPoint(points, end);
}

function calcFingerCount(length, params) {
  const pitch = params.tabWidth + params.tabSpacing;
  if (pitch <= 0 || length < params.tabWidth + params.materialThickness * 2) return 0;
  return Math.max(1, Math.floor((length - params.tabSpacing) / pitch));
}

function along(start, dx, dy, distanceMm) {
  return {
    x: start.x + dx * distanceMm,
    y: start.y + dy * distanceMm
  };
}

function offsetBy(point, direction, distanceMm) {
  return {
    x: point.x + direction.x * distanceMm,
    y: point.y + direction.y * distanceMm
  };
}

function pushPoint(points, point) {
  const last = points[points.length - 1];
  if (last && Math.abs(last.x - point.x) < 0.0001 && Math.abs(last.y - point.y) < 0.0001) return;
  points.push(point);
}

function layoutPieces(pieces, gap) {
  const laidOut = [];
  const maxRowWidth = 520;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const piece of pieces) {
    if (cursorX > 0 && cursorX + piece.width > maxRowWidth) {
      cursorX = 0;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }

    laidOut.push({
      ...piece,
      x: cursorX,
      y: cursorY
    });

    cursorX += piece.width + gap;
    rowHeight = Math.max(rowHeight, piece.height);
  }

  return laidOut;
}

function getBoundsFromPieces(pieces) {
  if (!pieces.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  const maxX = Math.max(...pieces.map(piece => piece.x + piece.width));
  const maxY = Math.max(...pieces.map(piece => piece.y + piece.height));
  return { minX: 0, minY: 0, maxX, maxY, width: maxX, height: maxY };
}

function render(result) {
  clearSvg();
  const padding = 8;
  els.previewSvg.setAttribute("viewBox", [
    -padding,
    -padding,
    Math.max(result.bounds.width + padding * 2, 1),
    Math.max(result.bounds.height + padding * 2, 1)
  ].join(" "));
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  addSvgStyles();
  const cutGroup = createSvgElement("g", { class: "svg-cut" });
  els.previewSvg.appendChild(cutGroup);

  for (const piece of result.pieces) {
    for (const path of piece.paths) {
      cutGroup.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
        "vector-effect": "non-scaling-stroke",
        "stroke-width": result.params.kerfWidth || 0.1
      }));
    }
  }

  els.widthMetric.textContent = formatNumber(result.bounds.width);
  els.heightMetric.textContent = formatNumber(result.bounds.height);
  els.pathMetric.textContent = String(result.pieces.length);
  els.summaryText.textContent = `${modelLabel(result.params.modelType)} · ${result.pieces.length} parts`;
  els.downloadDxf.disabled = false;
  els.downloadSvg.disabled = false;
  renderWarnings(result.warnings);
}

function pathToD(points, offsetX = 0, offsetY = 0) {
  if (!points.length) return "";
  const [first, ...rest] = points;
  const commands = [`M ${svgNum(first.x + offsetX)} ${svgNum(first.y + offsetY)}`];
  for (const point of rest) {
    commands.push(`L ${svgNum(point.x + offsetX)} ${svgNum(point.y + offsetY)}`);
  }
  commands.push("Z");
  return commands.join(" ");
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
    .svg-cut path {
      fill: none;
      stroke: #d42929;
      stroke-linejoin: miter;
      stroke-linecap: square;
    }
  `;
  els.previewSvg.appendChild(style);
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
  clone.setAttribute("width", `${svgNum(result.bounds.width)}mm`);
  clone.setAttribute("height", `${svgNum(result.bounds.height)}mm`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}\n`;
}

function exportDxf(result) {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  for (const piece of result.pieces) {
    for (const path of piece.paths) {
      for (let i = 0; i < path.length; i += 1) {
        const a = path[i];
        const b = path[(i + 1) % path.length];
        lines.push(
          "0", "LINE",
          "8", piece.layer,
          "10", dxfNum(a.x + piece.x),
          "20", dxfNum(-(a.y + piece.y)),
          "30", "0",
          "11", dxfNum(b.x + piece.x),
          "21", dxfNum(-(b.y + piece.y)),
          "31", "0"
        );
      }
    }
  }
  lines.push("0", "ENDSEC", "0", "EOF");
  return `${lines.join("\n")}\n`;
}

function safeBaseName() {
  return (els.projectName.value || "laser_parts")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "laser_parts";
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

function updateFieldVisibility() {
  const type = els.modelType.value;
  const circular = ["cylinder", "cone"].includes(type);
  const house = type === "gable_house";
  els.circularFields.forEach(field => field.hidden = !circular);
  els.houseFields.forEach(field => field.hidden = !house);
}

function updateDefaultsForModel() {
  const modelDefaults = defaults[els.modelType.value];
  for (const [key, value] of Object.entries(modelDefaults)) {
    if (els[key]) els[key].value = String(value);
  }
  updateFieldVisibility();
  runConversion();
}

function resetParams() {
  els.materialThickness.value = "3";
  els.kerfWidth.value = "0.15";
  els.tabWidth.value = "10";
  els.tabDepth.value = "3";
  els.tabSpacing.value = "8";
  els.partGap.value = "8";
  els.segments.value = "48";
  els.joineryToggle.checked = true;
  updateDefaultsForModel();
}

function runConversion() {
  els.statusPill.textContent = "Generating";
  updateFieldVisibility();
  state.result = buildResult(getParams());
  render(state.result);
  els.statusPill.textContent = "Ready";
}

function modelLabel(type) {
  const labels = {
    cube: "正立方體",
    cuboid: "長方體",
    cylinder: "圓柱體",
    cone: "圓錐體",
    gable_house: "雙斜屋頂房子"
  };
  return labels[type] || type;
}

function formatNumber(value) {
  return Number(value).toFixed(value >= 100 ? 0 : 1);
}

function svgNum(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function dxfNum(value) {
  return Number(value).toFixed(4);
}

els.modelType.addEventListener("change", updateDefaultsForModel);
els.resetButton.addEventListener("click", resetParams);

for (const input of document.querySelectorAll("input, select")) {
  if (input.id !== "modelType") {
    input.addEventListener("input", runConversion);
    input.addEventListener("change", runConversion);
  }
}

els.downloadDxf.addEventListener("click", () => {
  if (!state.result) return;
  download(`${safeBaseName()}.dxf`, exportDxf(state.result), "application/dxf");
});

els.downloadSvg.addEventListener("click", () => {
  if (!state.result) return;
  download(`${safeBaseName()}.svg`, exportSvg(state.result), "image/svg+xml");
});

updateFieldVisibility();
runConversion();
