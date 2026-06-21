const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;

const state = {
  result: null,
  sourceMode: "parametric",
  importedPieces: null,
  importedPreset: null,
  importedWarnings: [],
  edgeSelectEnabled: false,
  edgeSelection: {
    pending: null,
    pairs: []
  },
  appliedJoinery: false
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
  svgUpload: document.querySelector("#svgUpload"),
  useCubeNet: document.querySelector("#useCubeNet"),
  toggleEdgeSelect: document.querySelector("#toggleEdgeSelect"),
  applyEdgePairs: document.querySelector("#applyEdgePairs"),
  clearEdgePairs: document.querySelector("#clearEdgePairs"),
  pairList: document.querySelector("#pairList"),
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
  flex_box_5: { length: 120, width: 80, height: 45, radius: 18, wallHeight: 50, roofHeight: 28 },
  gable_house: { length: 120, width: 80, height: 80, radius: 35, wallHeight: 55, roofHeight: 35 }
};

const pairColors = Array.from({ length: 48 }, (_, i) => {
  const hue = Math.round((i * 137.508) % 360);
  const sat = i % 2 ? 70 : 82;
  const light = i % 3 === 0 ? 42 : 52;
  return `hsl(${hue} ${sat}% ${light}%)`;
});

let audioContext = null;

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

  if (params.modelType === "flex_box_5") {
    pieces.push(...buildFlexBox5Pieces(params));
  }

  if (params.modelType === "gable_house") {
    pieces.push(...buildHousePieces(params));
  }

  const laidOut = layoutPieces(pieces, params.partGap);
  const bounds = getBoundsFromPieces(laidOut);
  warnings.push(...modelWarnings(params));

  return { pieces: laidOut, bounds, warnings, params };
}

function buildImportedResult(params) {
  const warnings = validateParams(params).concat(state.importedWarnings);

  if (state.appliedJoinery && state.importedPreset === "cube_net") {
    const side = params.length || 60;
    const pieces = layoutPieces(buildBoxPieces(side, side, side, params), params.partGap);
    const bounds = getBoundsFromPieces(pieces);
    warnings.push("正立方體範例使用內建正確接榫拓撲輸出。");
    return { pieces, bounds, warnings, params };
  }

  const sourcePieces = clonePieces(state.importedPieces || []);
  const pieces = state.appliedJoinery
    ? applySelectedJoinery(sourcePieces, params, warnings)
    : sourcePieces;
  const bounds = getBoundsFromPaths(pieces);

  if (!pieces.length) {
    warnings.push("尚未匯入可用的 SVG 多邊形。");
  }

  if (state.edgeSelection.pairs.length > 48) {
    warnings.push("接榫配對已超過 48 組，超出的配對不會使用顏色標示。");
  }

  return { pieces, bounds, warnings, params };
}

function clonePieces(pieces) {
  return pieces.map(piece => ({
    ...piece,
    paths: piece.paths.map(path => {
      const copy = path.map(point => ({ x: point.x, y: point.y }));
      copy.closed = path.closed !== false;
      return copy;
    })
  }));
}

function applySelectedJoinery(pieces, params, warnings) {
  const edgeTypesByPath = new Map();

  for (const [pairIndex, pair] of state.edgeSelection.pairs.entries()) {
    markEdgeType(edgeTypesByPath, pair.first, "f");
    markEdgeType(edgeTypesByPath, pair.second, "F");
    const firstLength = getEdgeLength(pieces, pair.first);
    const secondLength = getEdgeLength(pieces, pair.second);
    if (firstLength && secondLength && Math.abs(firstLength - secondLength) > params.materialThickness) {
      warnings.push(`第 ${pairIndex + 1} 組配對邊長差超過材料厚度，接榫可能無法準確對接。`);
    }
  }

  return pieces.map((piece, pieceIndex) => ({
    ...piece,
    paths: piece.paths.map((path, pathIndex) => {
      if (path.closed === false || path.length < 3) return path;
      const key = edgePathKey(pieceIndex, pathIndex);
      const edgeTypes = edgeTypesByPath.get(key) || Array(path.length).fill("e");
      const joined = fingerJointPolygonPath(path, edgeTypes, params);
      joined.closed = true;
      return joined;
    })
  }));
}

function markEdgeType(edgeTypesByPath, ref, type) {
  const key = edgePathKey(ref.pieceIndex, ref.pathIndex);
  if (!edgeTypesByPath.has(key)) {
    const path = state.importedPieces?.[ref.pieceIndex]?.paths?.[ref.pathIndex];
    edgeTypesByPath.set(key, Array(path ? path.length : 0).fill("e"));
  }
  const edgeTypes = edgeTypesByPath.get(key);
  if (ref.edgeIndex >= 0 && ref.edgeIndex < edgeTypes.length) edgeTypes[ref.edgeIndex] = type;
}

function edgePathKey(pieceIndex, pathIndex) {
  return `${pieceIndex}:${pathIndex}`;
}

function getEdgeLength(pieces, ref) {
  const path = pieces[ref.pieceIndex]?.paths?.[ref.pathIndex];
  if (!path?.length) return 0;
  const a = path[ref.edgeIndex];
  const b = path[(ref.edgeIndex + 1) % path.length];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
}

function loadImportedPieces(pieces, warnings = [], options = {}) {
  const params = getParams();
  state.sourceMode = "svg";
  state.importedPieces = prepareImportedPiecesForSelection(pieces, params.partGap);
  state.importedPreset = options.preset || null;
  state.importedWarnings = warnings;
  state.edgeSelection.pending = null;
  state.edgeSelection.pairs = [];
  state.appliedJoinery = false;
  state.edgeSelectEnabled = true;
  els.toggleEdgeSelect.setAttribute("aria-pressed", "true");
  els.toggleEdgeSelect.textContent = "結束選邊";
  runConversion();
}

function buildCubeNetPieces(params) {
  const side = params.length || 60;
  const faces = [
    { name: "bottom_3d", origin: [side, side] },
    { name: "back", origin: [side, 0] },
    { name: "left", origin: [0, side] },
    { name: "right", origin: [side * 2, side] },
    { name: "front", origin: [side, side * 2] },
    { name: "top", origin: [side * 3, side] }
  ];
  return faces.map((face) => {
    const [x, y] = face.origin;
    const path = [
      { x, y },
      { x: x + side, y },
      { x: x + side, y: y + side },
      { x, y: y + side }
    ];
    path.closed = true;
    return {
      name: face.name,
      width: side,
      height: side,
      x: 0,
      y: 0,
      layer: "CUT",
      paths: [path]
    };
  });
}

function prepareImportedPiecesForSelection(pieces, gap) {
  const safeGap = Math.max(gap, 1);
  const pieceBounds = pieces.map(piece => getBoundsFromPaths([{ ...piece, x: 0, y: 0 }]));
  const xBands = axisBands(pieceBounds.map(bounds => bounds.minX));
  const yBands = axisBands(pieceBounds.map(bounds => bounds.minY));

  return pieces.map((piece, index) => {
    const bounds = pieceBounds[index];
    const xShift = axisBandIndex(bounds.minX, xBands) * safeGap;
    const yShift = axisBandIndex(bounds.minY, yBands) * safeGap;
    const paths = piece.paths.map(path => {
      const copy = path.map(point => ({
        x: point.x - bounds.minX,
        y: point.y - bounds.minY
      }));
      copy.closed = path.closed !== false;
      return copy;
    });
    return {
      ...piece,
      x: bounds.minX + xShift,
      y: bounds.minY + yShift,
      width: bounds.width,
      height: bounds.height,
      paths
    };
  });
}

function axisBands(values) {
  const tolerance = 0.01;
  return values
    .slice()
    .sort((a, b) => a - b)
    .reduce((bands, value) => {
      const last = bands[bands.length - 1];
      if (last === undefined || Math.abs(value - last) > tolerance) bands.push(value);
      return bands;
    }, []);
}

function axisBandIndex(value, bands) {
  let closestIndex = 0;
  let closestDistance = Infinity;
  for (let i = 0; i < bands.length; i += 1) {
    const distance = Math.abs(value - bands[i]);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }
  return closestIndex;
}

function parseImportedSvg(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    return { pieces: [], warnings: ["SVG 解析失敗，請確認檔案格式。"] };
  }

  const warnings = [];
  const pieces = [];
  const shapes = [...doc.querySelectorAll("polygon, polyline, path")];

  for (const [index, shape] of shapes.entries()) {
    let path = null;
    if (shape.tagName.toLowerCase() === "polygon") {
      path = parsePointsAttribute(shape.getAttribute("points"), true);
    } else if (shape.tagName.toLowerCase() === "polyline") {
      path = parsePointsAttribute(shape.getAttribute("points"), false);
      if (path.length > 2 && samePoint(path[0], path[path.length - 1])) {
        path.pop();
        path.closed = true;
      }
    } else {
      path = parseSimplePath(shape.getAttribute("d"), warnings);
    }

    if (!path || path.length < 2) continue;
    if (shape.getAttribute("transform")) {
      warnings.push("此版本先忽略 SVG transform；若尺寸不對，請先在向量軟體中展開 transform 後再匯入。");
    }

    const bounds = getPathBounds(path);
    pieces.push({
      name: `svg_${index + 1}`,
      width: bounds.width,
      height: bounds.height,
      x: 0,
      y: 0,
      layer: "CUT",
      paths: [path]
    });
  }

  if (!pieces.length) {
    warnings.push("目前只支援 polygon、polyline，以及只含 M/L/H/V/Z 的簡單 path。");
  }

  return { pieces, warnings: uniqueWarnings(warnings) };
}

function parsePointsAttribute(pointsText, closed) {
  if (!pointsText) return null;
  const nums = pointsText.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const points = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }
  points.closed = closed;
  return points;
}

function parseSimplePath(d, warnings) {
  if (!d) return null;
  const tokens = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return null;
  const points = [];
  let cursor = { x: 0, y: 0 };
  let command = "";
  let i = 0;
  let closed = false;

  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) command = tokens[i++];
    if (!command) break;

    if (command === "Z" || command === "z") {
      closed = true;
      command = "";
      continue;
    }

    if (!"MmLlHhVv".includes(command)) {
      warnings.push("已略過含曲線或複雜指令的 path；請先轉成直線多邊形。");
      return null;
    }

    if ((command === "H" || command === "h") && i < tokens.length) {
      const x = Number(tokens[i++]);
      cursor = { x: command === "h" ? cursor.x + x : x, y: cursor.y };
      points.push({ ...cursor });
      continue;
    }

    if ((command === "V" || command === "v") && i < tokens.length) {
      const y = Number(tokens[i++]);
      cursor = { x: cursor.x, y: command === "v" ? cursor.y + y : y };
      points.push({ ...cursor });
      continue;
    }

    while (i + 1 < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) break;
      cursor = command === command.toLowerCase()
        ? { x: cursor.x + x, y: cursor.y + y }
        : { x, y };
      points.push({ ...cursor });
      if (command === "M") command = "L";
      if (command === "m") command = "l";
    }
  }

  if (points.length > 2 && samePoint(points[0], points[points.length - 1])) {
    points.pop();
    closed = true;
  }
  points.closed = closed;
  return points;
}

function getPathBounds(path) {
  const minX = Math.min(...path.map(point => point.x));
  const minY = Math.min(...path.map(point => point.y));
  const maxX = Math.max(...path.map(point => point.x));
  const maxY = Math.max(...path.map(point => point.y));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001;
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

  if (["cylinder", "flex_box_5"].includes(params.modelType)) {
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
  if (params.modelType === "cylinder") {
    warnings.push("圓柱側面寬度等於圓周長，上下圓以 segments 分段。");
    if (params.generateJoinery) warnings.push("圓柱使用展開側板直線卡榫，頂/底圓使用圓周插槽。");
  }
  if (params.modelType === "flex_box_5") {
    warnings.push("柔性盒子5為 Boxes.py FlexBox5-inspired 範例：圓角盒、活動鉸鏈切縫與簡化直線卡榫。");
    if (params.radius > Math.min(params.length, params.width) / 2) {
      warnings.push("圓角半徑已在輸出時限制為長寬的一半以內。");
    }
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
    circularFlexSidePiece("side_living_hinge", circumference, params.height, params),
    circlePiece("top", params.radius, params, params.generateJoinery),
    circlePiece("bottom", params.radius, params, params.generateJoinery)
  ];
}

function buildFlexBox5Pieces(params) {
  const radius = Math.max(
    params.materialThickness * 2,
    Math.min(params.radius, params.length / 2, params.width / 2)
  );
  const perimeter = 2 * (params.length + params.width - 4 * radius) + TAU * radius;
  return [
    roundedRectPiece("top_rounded_panel", params.length, params.width, radius, params),
    roundedRectPiece("bottom_rounded_panel", params.length, params.width, radius, params),
    flexSidePiece("flex_living_hinge_side", perimeter, params.height, radius, params),
    latchPiece("front_latch", params)
  ];
}

function buildHousePieces(params) {
  const roofSlopeLength = Math.hypot(params.width / 2, params.roofHeight);
  const floorEdges = params.generateJoinery ? "ffff" : "eeee";
  const wallEdges = params.generateJoinery ? "FFFF" : "eeee";
  const roofEdges = params.generateJoinery ? "ffff" : "eeee";
  return [
    rectPiece("floor", params.length, params.width, params, floorEdges),
    rectPiece("left_wall", params.length, params.wallHeight, params, wallEdges),
    rectPiece("right_wall", params.length, params.wallHeight, params, wallEdges),
    gablePiece("front_gable", params.width, params.wallHeight, params.roofHeight, params),
    gablePiece("back_gable", params.width, params.wallHeight, params.roofHeight, params),
    rectPiece("roof_left", params.length, roofSlopeLength, params, roofEdges),
    rectPiece("roof_right", params.length, roofSlopeLength, params, roofEdges)
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

function circlePiece(name, radius, params, withSlots = false) {
  const points = [];
  for (let i = 0; i < params.segments; i += 1) {
    const angle = -Math.PI / 2 + (i / params.segments) * TAU;
    points.push({
      x: radius + Math.cos(angle) * radius,
      y: radius + Math.sin(angle) * radius
    });
  }
  const slots = withSlots ? circularSlotPaths(radius, params) : [];
  return {
    name,
    layer: "CUT",
    paths: [points, ...slots],
    width: radius * 2,
    height: radius * 2
  };
}

function circularFlexSidePiece(name, width, height, params) {
  const margin = params.generateJoinery ? params.tabDepth : 0;
  const outline = params.generateJoinery
    ? fingerJointRectPath(margin, margin, width, height, "fefe", params)
    : rectPath(0, 0, width, height);
  const hingeSlots = flexCutPatternPaths(margin, margin, width, height, params);
  return {
    name,
    layer: "CUT",
    paths: [outline, ...hingeSlots],
    width: width + margin * 2,
    height: height + margin * 2
  };
}

function roundedRectPiece(name, width, height, radius, params) {
  const outline = roundedRectPath(0, 0, width, height, radius, params.segments);
  const slots = params.generateJoinery
    ? roundedPanelSlotPaths(width, height, radius, params)
    : [];
  return {
    name,
    layer: "CUT",
    paths: [outline, ...slots],
    width,
    height
  };
}

function flexSidePiece(name, width, height, cornerRadius, params) {
  const margin = params.generateJoinery ? params.tabDepth : 0;
  const outline = params.generateJoinery
    ? fingerJointRectPath(margin, margin, width, height, "fefe", params)
    : rectPath(0, 0, width, height);
  const hingeSlots = livingHingeSlots(margin, margin, width, height, cornerRadius, params);
  return {
    name,
    layer: "CUT",
    paths: [outline, ...hingeSlots],
    width: width + margin * 2,
    height: height + margin * 2
  };
}

function latchPiece(name, params) {
  const width = Math.max(params.tabWidth * 2.5, params.materialThickness * 8);
  const height = Math.max(params.materialThickness * 4, params.tabDepth * 3);
  const notchWidth = Math.min(width * 0.36, params.tabWidth);
  const points = [
    { x: 0, y: height },
    { x: 0, y: params.materialThickness },
    { x: width / 2 - notchWidth / 2, y: params.materialThickness },
    { x: width / 2 - notchWidth / 2, y: 0 },
    { x: width / 2 + notchWidth / 2, y: 0 },
    { x: width / 2 + notchWidth / 2, y: params.materialThickness },
    { x: width, y: params.materialThickness },
    { x: width, y: height }
  ];
  return {
    name,
    layer: "CUT",
    paths: [points],
    width,
    height
  };
}

function gablePiece(name, width, wallHeight, roofHeight, params) {
  const margin = params.generateJoinery ? params.tabDepth : 0;
  const x = margin;
  const y = margin;
  const totalHeight = wallHeight + roofHeight;
  const points = [
    { x, y: y + totalHeight },
    { x: x + width, y: y + totalHeight },
    { x: x + width, y: y + roofHeight },
    { x: x + width / 2, y },
    { x, y: y + roofHeight }
  ];
  const path = params.generateJoinery
    ? fingerJointPolygonPath(points, "FFFFF", params)
    : points;
  return {
    name,
    layer: "CUT",
    paths: [path],
    width: width + margin * 2,
    height: totalHeight + margin * 2
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

function circularSlotPaths(radius, params) {
  const runs = fingerRuns(TAU * radius, params, params.tabWidth + params.kerfWidth);
  const slotLength = params.tabWidth + params.kerfWidth;
  const slotDepth = params.tabDepth + params.kerfWidth;
  return runs.map(run => {
    const centerDistance = (run.start + run.end) / 2;
    const theta = -Math.PI / 2 + (centerDistance / (TAU * radius)) * TAU;
    return orientedSlotPath(radius, radius, radius - slotDepth / 2, theta, slotLength, slotDepth);
  });
}

function orientedSlotPath(cx, cy, centerRadius, theta, tangentLength, radialDepth) {
  const radial = { x: Math.cos(theta), y: Math.sin(theta) };
  const tangent = { x: -Math.sin(theta), y: Math.cos(theta) };
  const center = {
    x: cx + radial.x * centerRadius,
    y: cy + radial.y * centerRadius
  };
  const halfTangent = tangentLength / 2;
  const halfRadial = radialDepth / 2;
  return [
    offset2(center, tangent, -halfTangent, radial, -halfRadial),
    offset2(center, tangent, halfTangent, radial, -halfRadial),
    offset2(center, tangent, halfTangent, radial, halfRadial),
    offset2(center, tangent, -halfTangent, radial, halfRadial)
  ];
}

function offset2(center, axisA, distanceA, axisB, distanceB) {
  return {
    x: center.x + axisA.x * distanceA + axisB.x * distanceB,
    y: center.y + axisA.y * distanceA + axisB.y * distanceB
  };
}

function fingerRuns(length, params, fingerWidth) {
  const count = calcFingerCount(length, params);
  const occupied = count * params.tabWidth + Math.max(0, count - 1) * params.tabSpacing;
  const inset = Math.max(params.materialThickness, (length - occupied) / 2);
  const runs = [];
  for (let i = 0; i < count; i += 1) {
    const start = inset + i * (params.tabWidth + params.tabSpacing);
    const end = Math.min(start + fingerWidth, length - params.materialThickness);
    if (end > start && start < length) runs.push({ start, end });
  }
  return runs;
}

function roundedRectPath(x, y, width, height, radius, segments) {
  const r = Math.min(radius, width / 2, height / 2);
  const cornerSteps = Math.max(4, Math.ceil(segments / 12));
  const points = [];
  addArcPoints(points, x + width - r, y + r, r, -Math.PI / 2, 0, cornerSteps);
  addArcPoints(points, x + width - r, y + height - r, r, 0, Math.PI / 2, cornerSteps);
  addArcPoints(points, x + r, y + height - r, r, Math.PI / 2, Math.PI, cornerSteps);
  addArcPoints(points, x + r, y + r, r, Math.PI, Math.PI * 1.5, cornerSteps);
  return points;
}

function addArcPoints(points, cx, cy, radius, start, end, steps) {
  for (let i = 0; i <= steps; i += 1) {
    if (points.length && i === 0) continue;
    const theta = start + (i / steps) * (end - start);
    points.push({
      x: cx + Math.cos(theta) * radius,
      y: cy + Math.sin(theta) * radius
    });
  }
}

function roundedPanelSlotPaths(width, height, radius, params) {
  const slotLength = params.tabWidth + params.kerfWidth;
  const slotDepth = params.materialThickness + params.kerfWidth;
  const inset = params.materialThickness * 1.5;
  const slots = [];
  addStraightSlots(slots, radius, width - radius, inset, slotLength, slotDepth, "horizontal", params);
  addStraightSlots(slots, radius, width - radius, height - inset, slotLength, slotDepth, "horizontal", params);
  addStraightSlots(slots, radius, height - radius, inset, slotLength, slotDepth, "vertical", params);
  addStraightSlots(slots, radius, height - radius, width - inset, slotLength, slotDepth, "vertical", params);
  return slots;
}

function addStraightSlots(slots, start, end, fixed, slotLength, slotDepth, orientation, params) {
  const usable = end - start;
  const count = calcFingerCount(usable, params);
  if (count <= 0) return;
  const pitch = params.tabWidth + params.tabSpacing;
  const occupied = count * params.tabWidth + Math.max(0, count - 1) * params.tabSpacing;
  const cursor = start + Math.max(params.materialThickness, (usable - occupied) / 2);

  for (let i = 0; i < count; i += 1) {
    const center = cursor + i * pitch + params.tabWidth / 2;
    if (orientation === "horizontal") {
      slots.push(rectPath(center - slotLength / 2, fixed - slotDepth / 2, slotLength, slotDepth));
    } else {
      slots.push(rectPath(fixed - slotDepth / 2, center - slotLength / 2, slotDepth, slotLength));
    }
  }
}

function livingHingeSlots(x, y, width, height, cornerRadius, params) {
  const flexLength = Math.PI * cornerRadius;
  const straightLength = Math.max(0, (width - flexLength * 2) / 2);
  const zones = [
    { start: straightLength, length: flexLength },
    { start: straightLength * 2 + flexLength, length: flexLength }
  ];

  const slots = [];
  for (const zone of zones) {
    slots.push(...flexCutPatternPaths(x + zone.start, y, zone.length, height, params));
  }
  return slots;
}

function flexCutPatternPaths(x, y, length, height, params) {
  const distance = Math.max(0.01, params.materialThickness * 0.5);
  const connection = Math.max(0.01, params.materialThickness);
  const patternWidth = Math.max(0.1, params.materialThickness * 5);
  const lines = Math.floor(length / distance);
  const leftover = length - lines * distance;
  const sections = Math.max(Math.floor((height - connection) / patternWidth), 1);
  const sectionHeight = ((height - connection) / sections) - connection;
  const paths = [];

  for (let i = 1; i < lines; i += 1) {
    const px = x + i * distance + leftover / 2;
    if (i % 2) {
      addFlexCutSegment(paths, px, y, y + connection + sectionHeight);
      for (let j = 0; j < Math.floor((sections - 1) / 2); j += 1) {
        addFlexCutSegment(
          paths,
          px,
          y + (2 * j + 1) * sectionHeight + (2 * j + 2) * connection,
          y + (2 * j + 3) * (sectionHeight + connection)
        );
      }
      if (sections % 2 === 0) {
        addFlexCutSegment(paths, px, y + height - sectionHeight - connection, y + height);
      }
    } else if (sections % 2) {
      addFlexCutSegment(paths, px, y + height, y + height - connection - sectionHeight);
      for (let j = 0; j < Math.floor((sections - 1) / 2); j += 1) {
        addFlexCutSegment(
          paths,
          px,
          y + height - ((2 * j + 1) * sectionHeight + (2 * j + 2) * connection),
          y + height - (2 * j + 3) * (sectionHeight + connection)
        );
      }
    } else {
      for (let j = 0; j < sections / 2; j += 1) {
        addFlexCutSegment(
          paths,
          px,
          y + height - connection - 2 * j * (sectionHeight + connection),
          y + height - 2 * (j + 1) * (sectionHeight + connection)
        );
      }
    }
  }

  return paths;
}

function addFlexCutSegment(paths, x, y1, y2) {
  if (Math.abs(y2 - y1) < 0.0001) return;
  const path = [
    { x, y: y1 },
    { x, y: y2 }
  ];
  path.closed = false;
  paths.push(path);
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

function fingerJointPolygonPath(vertices, edgeTypes, params) {
  const points = [];
  const area = signedPolygonArea(vertices);

  for (let i = 0; i < vertices.length; i += 1) {
    const start = vertices[i];
    const end = vertices[(i + 1) % vertices.length];
    const outward = edgeOutwardNormal(start, end, area);
    addFingerEdge(points, start, end, outward, edgeTypes[i] || "e", params);
  }

  return points;
}

function signedPolygonArea(vertices) {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function edgeOutwardNormal(start, end, polygonArea) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = polygonArea >= 0
    ? { x: dy / length, y: -dx / length }
    : { x: -dy / length, y: dx / length };
  return normal;
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

function getBoundsFromPaths(pieces) {
  const points = [];
  for (const piece of pieces) {
    for (const path of piece.paths) {
      for (const point of path) points.push({ x: point.x + piece.x, y: point.y + piece.y });
    }
  }
  if (!points.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x));
  const maxY = Math.max(...points.map(point => point.y));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function render(result) {
  clearSvg();
  const padding = 8;
  els.previewSvg.setAttribute("viewBox", [
    result.bounds.minX - padding,
    result.bounds.minY - padding,
    Math.max(result.bounds.width + padding * 2, 1),
    Math.max(result.bounds.height + padding * 2, 1)
  ].join(" "));
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  addSvgStyles();
  renderSourceOverlay();
  const cutGroup = createSvgElement("g", { class: "svg-cut" });
  els.previewSvg.appendChild(cutGroup);

  for (const piece of result.pieces) {
    for (const path of piece.paths) {
      cutGroup.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
        fill: "none",
        stroke: "#ff0000",
        "stroke-linejoin": "miter",
        "stroke-linecap": "square",
        "vector-effect": "non-scaling-stroke",
        "stroke-width": result.params.kerfWidth || 0.1
      }));
    }
  }

  renderEdgeOverlay(result);

  els.widthMetric.textContent = formatNumber(result.bounds.width);
  els.heightMetric.textContent = formatNumber(result.bounds.height);
  els.pathMetric.textContent = String(result.pieces.length);
  els.summaryText.textContent = `${modelLabel(result.params.modelType)} · ${result.pieces.length} parts`;
  els.downloadDxf.disabled = false;
  els.downloadSvg.disabled = false;
  renderWarnings(result.warnings);
}

function renderEdgeOverlay(result) {
  if (state.sourceMode !== "svg" || !state.edgeSelectEnabled || !state.importedPieces?.length) return;
  if (state.appliedJoinery && state.importedPreset === "cube_net") return;

  const group = createSvgElement("g", { class: "edge-overlay" });
  els.previewSvg.appendChild(group);

  for (const edge of listSelectableEdges()) {
    const color = colorForEdge(edge) || "#2468d8";
    const className = [
      "edge-visible",
      isPendingEdge(edge) ? "edge-pending-first" : "",
      state.edgeSelection.pending && !isPendingEdge(edge) && !colorForEdge(edge) ? "edge-second-candidate" : "",
      colorForEdge(edge) && !isPendingEdge(edge) ? "edge-paired" : ""
    ].filter(Boolean).join(" ");
    const a = edge.start;
    const b = edge.end;
    const visible = createSvgElement("line", {
      x1: svgNum(a.x),
      y1: svgNum(a.y),
      x2: svgNum(b.x),
      y2: svgNum(b.y),
      stroke: color,
      "stroke-width": isPendingEdge(edge) || colorForEdge(edge) ? 1.8 : 0.6,
      "vector-effect": "non-scaling-stroke",
      class: className
    });
    const hit = createSvgElement("line", {
      x1: svgNum(a.x),
      y1: svgNum(a.y),
      x2: svgNum(b.x),
      y2: svgNum(b.y),
      stroke: "transparent",
      "stroke-width": 10,
      "vector-effect": "non-scaling-stroke",
      class: "edge-hit",
      "data-piece": edge.pieceIndex,
      "data-path": edge.pathIndex,
      "data-edge": edge.edgeIndex
    });
    hit.addEventListener("click", handleEdgeClick);
    group.appendChild(visible);
    group.appendChild(hit);

    if (isPendingEdge(edge)) {
      group.appendChild(createEdgeBadge(edge, "1 凸 f", "#111827"));
    }
  }
}

function renderSourceOverlay() {
  if (
    state.sourceMode !== "svg"
    || !state.appliedJoinery
    || state.importedPreset === "cube_net"
    || !state.importedPieces?.length
  ) return;

  const group = createSvgElement("g", { class: "source-overlay" });
  els.previewSvg.appendChild(group);

  for (const piece of state.importedPieces) {
    for (const path of piece.paths) {
      group.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
        fill: "none",
        stroke: "#0b6bcb",
        "stroke-width": 0.45,
        "stroke-dasharray": "3 2",
        "vector-effect": "non-scaling-stroke"
      }));
    }
  }
}

function createEdgeBadge(edge, label, color) {
  const mid = {
    x: (edge.start.x + edge.end.x) / 2,
    y: (edge.start.y + edge.end.y) / 2
  };
  const text = createSvgElement("text", {
    x: svgNum(mid.x),
    y: svgNum(mid.y - 3),
    fill: color,
    class: "edge-badge",
    "text-anchor": "middle",
    "paint-order": "stroke",
    stroke: "#ffffff",
    "stroke-width": 3,
    "vector-effect": "non-scaling-stroke"
  });
  text.textContent = label;
  return text;
}

function listSelectableEdges() {
  const edges = [];
  for (const [pieceIndex, piece] of (state.importedPieces || []).entries()) {
    for (const [pathIndex, path] of piece.paths.entries()) {
      if (path.closed === false || path.length < 3) continue;
      for (let edgeIndex = 0; edgeIndex < path.length; edgeIndex += 1) {
        const start = offsetBy(path[edgeIndex], { x: piece.x, y: piece.y }, 1);
        const end = offsetBy(path[(edgeIndex + 1) % path.length], { x: piece.x, y: piece.y }, 1);
        edges.push({ pieceIndex, pathIndex, edgeIndex, start, end });
      }
    }
  }
  return edges;
}

function handleEdgeClick(event) {
  const ref = {
    pieceIndex: Number(event.target.dataset.piece),
    pathIndex: Number(event.target.dataset.path),
    edgeIndex: Number(event.target.dataset.edge)
  };

  if (!state.edgeSelection.pending) {
    state.edgeSelection.pending = ref;
    playJoineryTone("convex");
    render(state.result);
    renderPairList();
    return;
  }

  if (sameEdge(state.edgeSelection.pending, ref)) {
    state.edgeSelection.pending = null;
    render(state.result);
    renderPairList();
    return;
  }

  if (state.edgeSelection.pairs.length >= 48) {
    state.importedWarnings = uniqueWarnings(state.importedWarnings.concat("最多只能建立 48 組接榫配對。"));
    state.edgeSelection.pending = null;
    runConversion();
    return;
  }

  state.edgeSelection.pairs.push({
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    color: pairColors[state.edgeSelection.pairs.length],
    first: state.edgeSelection.pending,
    second: ref
  });
  playJoineryTone("concave");
  state.edgeSelection.pending = null;
  state.appliedJoinery = false;
  runConversion();
}

function playJoineryTone(type) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  audioContext ||= new AudioCtor();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const startFreq = type === "convex" ? 660 : 360;
  const endFreq = type === "convex" ? 880 : 260;

  osc.type = type === "convex" ? "triangle" : "sine";
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.11);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

function sameEdge(a, b) {
  return a && b
    && a.pieceIndex === b.pieceIndex
    && a.pathIndex === b.pathIndex
    && a.edgeIndex === b.edgeIndex;
}

function colorForEdge(edge) {
  if (isPendingEdge(edge)) return "#111827";
  const pair = state.edgeSelection.pairs.find(item => sameEdge(item.first, edge) || sameEdge(item.second, edge));
  return pair?.color || "";
}

function isPendingEdge(edge) {
  return sameEdge(state.edgeSelection.pending, edge);
}

function uniqueWarnings(warnings) {
  return Array.from(new Set(warnings));
}

function pathToD(points, offsetX = 0, offsetY = 0) {
  if (!points.length) return "";
  const [first, ...rest] = points;
  const commands = [`M ${svgNum(first.x + offsetX)} ${svgNum(first.y + offsetY)}`];
  for (const point of rest) {
    commands.push(`L ${svgNum(point.x + offsetX)} ${svgNum(point.y + offsetY)}`);
  }
  if (points.closed !== false) commands.push("Z");
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
      stroke: #ff0000;
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

function renderPairList() {
  if (!els.pairList) return;
  els.pairList.innerHTML = "";

  if (state.edgeSelection.pending) {
    const li = document.createElement("li");
    li.className = "selection-hint";
    li.textContent = `已選凸榫 f：${edgeLabel(state.edgeSelection.pending)}，請再點選凹槽 F。`;
    els.pairList.appendChild(li);
  }

  if (!state.edgeSelection.pairs.length) {
    const li = document.createElement("li");
    li.textContent = state.edgeSelection.pending ? "尚未完成配對。" : "尚未建立接榫配對。";
    els.pairList.appendChild(li);
    return;
  }

  state.edgeSelection.pairs.forEach((pair, index) => {
    const li = document.createElement("li");
    li.style.borderColor = pair.color;
    li.innerHTML = `<span style="background:${pair.color}"></span>第 ${index + 1} 組：凸 f ${edgeLabel(pair.first)} → 凹 F ${edgeLabel(pair.second)}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "刪除";
    button.addEventListener("click", () => {
      state.edgeSelection.pairs.splice(index, 1);
      state.appliedJoinery = false;
      runConversion();
    });
    li.appendChild(button);
    els.pairList.appendChild(li);
  });
}

function edgeLabel(ref) {
  const pieceName = state.importedPieces?.[ref.pieceIndex]?.name || `P${ref.pieceIndex + 1}`;
  return `${pieceName}-E${ref.edgeIndex + 1}`;
}

function exportSvg(result) {
  const clone = els.previewSvg.cloneNode(true);
  clone.querySelectorAll(".edge-overlay").forEach(node => node.remove());
  clone.querySelectorAll(".source-overlay").forEach(node => node.remove());
  clone.setAttribute("xmlns", NS);
  clone.setAttribute("width", `${svgNum(result.bounds.width)}mm`);
  clone.setAttribute("height", `${svgNum(result.bounds.height)}mm`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}\n`;
}

function exportDxf(result) {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  for (const piece of result.pieces) {
    for (const path of piece.paths) {
      const segmentCount = path.closed === false ? path.length - 1 : path.length;
      for (let i = 0; i < segmentCount; i += 1) {
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
  const circular = ["cylinder", "flex_box_5"].includes(type);
  const house = type === "gable_house";
  els.circularFields.forEach(field => field.hidden = !circular);
  els.houseFields.forEach(field => field.hidden = !house);
}

function updateDefaultsForModel() {
  state.sourceMode = "parametric";
  state.importedPreset = null;
  state.edgeSelectEnabled = false;
  state.appliedJoinery = false;
  state.edgeSelection.pending = null;
  els.toggleEdgeSelect.setAttribute("aria-pressed", "false");
  els.toggleEdgeSelect.textContent = "選取接榫邊";
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
  const params = getParams();
  state.result = state.sourceMode === "svg"
    ? buildImportedResult(params)
    : buildResult(params);
  render(state.result);
  renderPairList();
  els.statusPill.textContent = "Ready";
}

function modelLabel(type) {
  const labels = {
    cube: "正立方體",
    cuboid: "長方體",
    cylinder: "圓柱體",
    flex_box_5: "柔性盒子5",
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
  if (!["modelType", "svgUpload"].includes(input.id)) {
    input.addEventListener("input", runConversion);
    input.addEventListener("change", runConversion);
  }
}

els.svgUpload.addEventListener("change", async () => {
  const file = els.svgUpload.files?.[0];
  if (!file) return;
  const text = await file.text();
  const parsed = parseImportedSvg(text);
  loadImportedPieces(parsed.pieces, parsed.warnings);
});

els.useCubeNet.addEventListener("click", () => {
  els.modelType.value = "cube";
  const cubeDefaults = defaults.cube;
  for (const [key, value] of Object.entries(cubeDefaults)) {
    if (els[key]) els[key].value = String(value);
  }
  els.materialThickness.value = "3";
  els.tabDepth.value = "3";
  loadImportedPieces(
    buildCubeNetPieces(getParams()),
    ["已載入正立方體展開圖；確認後會使用內建正確接榫拓撲輸出。"],
    { preset: "cube_net" }
  );
});

els.toggleEdgeSelect.addEventListener("click", () => {
  if (state.sourceMode !== "svg") {
    loadImportedPieces(
      buildCubeNetPieces(getParams()),
      ["已載入正立方體展開圖；確認後會使用內建正確接榫拓撲輸出。"],
      { preset: "cube_net" }
    );
    return;
  }
  state.edgeSelectEnabled = !state.edgeSelectEnabled;
  state.edgeSelection.pending = null;
  els.toggleEdgeSelect.setAttribute("aria-pressed", String(state.edgeSelectEnabled));
  els.toggleEdgeSelect.textContent = state.edgeSelectEnabled ? "結束選邊" : "選取接榫邊";
  runConversion();
});

els.applyEdgePairs.addEventListener("click", () => {
  if (state.sourceMode !== "svg") return;
  state.appliedJoinery = true;
  state.edgeSelectEnabled = false;
  state.edgeSelection.pending = null;
  els.toggleEdgeSelect.setAttribute("aria-pressed", "false");
  els.toggleEdgeSelect.textContent = "選取接榫邊";
  runConversion();
});

els.clearEdgePairs.addEventListener("click", () => {
  state.edgeSelection.pending = null;
  state.edgeSelection.pairs = [];
  state.appliedJoinery = false;
  runConversion();
});

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
