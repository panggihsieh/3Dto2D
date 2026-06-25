const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;
const OUTPUT_MARGIN_MM = 10;

const state = {
  result: null,
  zoom: 1,
  baseViewBox: null,
  celebrationTimer: null,
  sourceMode: "parametric",
  importedPieces: null,
  importedPreset: null,
  importedWarnings: [],
  uiWarnings: [],
  edgeSelectEnabled: false,
  edgeSelection: {
    pending: null,
    pairs: []
  },
  appliedJoinery: false,
  three: null
};

const els = {
  modelType: document.querySelector("#modelType"),
  dimensionMode: document.querySelector("#dimensionMode"),
  innerDimensionButton: document.querySelector("#innerDimensionButton"),
  dimensionModeStatus: document.querySelector("#dimensionModeStatus"),
  outerDimensionStatus: document.querySelector("#outerDimensionStatus"),
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
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
  zoomLevel: document.querySelector("#zoomLevel"),
  svgUpload: document.querySelector("#svgUpload"),
  downloadCuboidSample: document.querySelector("#downloadCuboidSample"),
  downloadHouseSample: document.querySelector("#downloadHouseSample"),
  toggleEdgeSelect: document.querySelector("#toggleEdgeSelect"),
  applyEdgePairs: document.querySelector("#applyEdgePairs"),
  clearEdgePairs: document.querySelector("#clearEdgePairs"),
  pairList: document.querySelector("#pairList"),
  widthMetric: document.querySelector("#widthMetric"),
  heightMetric: document.querySelector("#heightMetric"),
  pathMetric: document.querySelector("#pathMetric"),
  warningList: document.querySelector("#warningList"),
  exportStatus: document.querySelector("#exportStatus"),
  exportLinks: document.querySelector("#exportLinks"),
  statusPill: document.querySelector("#statusPill"),
  circularFields: document.querySelectorAll("[data-field='circular']"),
  houseFields: document.querySelectorAll("[data-field='house']"),
  preview3dCanvas: null,
  preview3dMode: null
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
const exportUrls = [];

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

document.querySelector(".legend .source")?.replaceChildren("原始SVG展開圖");

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
    dimensionMode: els.dimensionMode?.value || "inner",
    generateJoinery: els.joineryToggle.checked
  };
}

function buildResult(params) {
  const warnings = validateParams(params);
  const pieces = [];

  if (params.modelType === "cube") {
    const side = params.length;
    pieces.push(...buildDimensionedBoxPieces(side, side, side, params));
  }

  if (params.modelType === "cuboid") {
    pieces.push(...buildDimensionedBoxPieces(params.length, params.width, params.height, params));
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
  const warnings = validateParams(params).concat(state.importedWarnings, state.uiWarnings);

  if (state.appliedJoinery && state.importedPreset === "cube_net" && state.edgeSelection.pairs.length === 0) {
    const side = params.length || 60;
    const pieces = layoutPieces(buildDimensionedBoxPieces(side, side, side, params), params.partGap);
    const bounds = getBoundsFromPieces(pieces);
    warnings.push("正立方體範例使用內建正確接榫拓撲輸出。");
    return { pieces, bounds, warnings, params };
  }

  const sourcePieces = clonePieces(state.importedPieces || []);
  const pieces = applySelectedJoinery(sourcePieces, params, warnings);
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
    const validation = validateEdgePair(pair.first, pair.second, params, pairIndex);
    pair.validation = validation;
    warnings.push(...validation.messages);
    if (validation.status === "fail") continue;
    markEdgeType(edgeTypesByPath, pair.first, "f");
    markEdgeType(edgeTypesByPath, pair.second, "F");
  }

  if (state.edgeSelection.pending) {
    const validation = validatePreviewEdge(state.edgeSelection.pending, params);
    warnings.push(...validation.messages);
    if (validation.status !== "fail") {
      markEdgeType(edgeTypesByPath, state.edgeSelection.pending, "f");
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

function findPairIndexForEdge(ref) {
  return state.edgeSelection.pairs.findIndex(pair => sameEdge(pair.first, ref) || sameEdge(pair.second, ref));
}

function fingerLayoutForEdge(ref, params) {
  const length = getEdgeLength(state.importedPieces || [], ref);
  const runLayout = fingerRunLayoutForLength(length, params);
  return { length, count: runLayout.count, endMargin: runLayout.endMargin };
}

function fingerRunLayoutForLength(length, params, fingerWidth = params.tabWidth) {
  const baseCount = calcFingerCount(length, params);
  const occupied = baseCount * params.tabWidth + Math.max(0, baseCount - 1) * params.tabSpacing;
  const inset = baseCount > 0 ? Math.max(params.materialThickness, (length - occupied) / 2) : 0;
  let count = 0;
  let firstStart = 0;
  let lastEnd = 0;

  for (let i = 0; i < baseCount; i += 1) {
    const start = inset + i * (params.tabWidth + params.tabSpacing);
    const end = Math.min(start + fingerWidth, length - params.materialThickness);
    if (end <= start || start >= length) continue;
    if (count === 0) firstStart = start;
    lastEnd = end;
    count += 1;
  }

  const endMargin = count > 0 ? Math.min(firstStart, Math.max(0, length - lastEnd)) : 0;
  return { count, endMargin };
}

function validateJoineryParams(params, label = "接榫參數") {
  const messages = [];
  let status = "ok";
  const pitch = params.tabWidth + params.tabSpacing;

  if (pitch <= 0) {
    status = "fail";
    messages.push(`${label} 失敗：接榫寬度 + 間距必須大於 0。`);
  }

  if (params.tabDepth <= 0) {
    status = "fail";
    messages.push(`${label} 失敗：接榫深度必須大於 0。`);
  } else if (params.tabDepth < params.materialThickness) {
    status = "warning";
    messages.push(`${label} 警告：接榫深度 ${formatNumber(params.tabDepth)} mm 小於材料厚度 ${formatNumber(params.materialThickness)} mm。`);
  }

  return { status, messages };
}

function mergeValidationStatus(a, b) {
  if (a === "fail" || b === "fail") return "fail";
  if (a === "warning" || b === "warning") return "warning";
  return "ok";
}

function validatePreviewEdge(ref, params) {
  const paramCheck = validateJoineryParams(params, `邊 ${edgeLabel(ref)}`);
  const layout = fingerLayoutForEdge(ref, params);
  const messages = [...paramCheck.messages];
  let status = paramCheck.status;

  if (layout.count <= 0) {
    status = "fail";
    messages.push(`邊 ${edgeLabel(ref)} 失敗：長度 ${formatNumber(layout.length)} mm 不足以產生 1 個接榫。`);
  }

  return { status, messages, fingerCount: layout.count, length: layout.length, endMargin: layout.endMargin };
}

function validateEdgePair(first, second, params, pairIndex = -1) {
  const title = pairIndex >= 0 ? `第 ${pairIndex + 1} 組` : "新配對";
  const paramCheck = validateJoineryParams(params, title);
  const firstLayout = fingerLayoutForEdge(first, params);
  const secondLayout = fingerLayoutForEdge(second, params);
  const messages = [...paramCheck.messages];
  let status = paramCheck.status;

  if (sameEdge(first, second)) {
    status = "fail";
    messages.push(`${title} 失敗：同一條邊不能配對自己。`);
  }

  const duplicate = state.edgeSelection.pairs.find((pair, index) => (
    index !== pairIndex
    && [pair.first, pair.second].some(edge => sameEdge(edge, first) || sameEdge(edge, second))
  ));
  if (duplicate) {
    status = "fail";
    messages.push(`${title} 失敗：${edgeLabel(first)} 或 ${edgeLabel(second)} 已經在其他配對中。`);
  }

  if (firstLayout.count <= 0 || secondLayout.count <= 0) {
    status = "fail";
    messages.push(`${title} 失敗：至少有一條邊太短，無法產生 1 個接榫。`);
  }

  const lengthTolerance = Math.max(params.materialThickness, 0.5);
  const lengthDiff = Math.abs(firstLayout.length - secondLayout.length);
  if (lengthDiff > lengthTolerance) {
    status = mergeValidationStatus(status, "warning");
    messages.push(`${title} 警告：兩邊長度差 ${formatNumber(lengthDiff)} mm，大於容許值 ${formatNumber(lengthTolerance)} mm。`);
  }

  if (firstLayout.count > 0 && secondLayout.count > 0 && firstLayout.count !== secondLayout.count) {
    status = mergeValidationStatus(status, "warning");
    messages.push(`${title} 警告：兩邊接榫數不同（${firstLayout.count} / ${secondLayout.count}），請目視確認。`);
  }

  return {
    status,
    messages,
    fingerCount: Math.min(firstLayout.count, secondLayout.count),
    firstLength: firstLayout.length,
    secondLength: secondLayout.length,
    endMargin: Math.min(firstLayout.endMargin, secondLayout.endMargin),
    firstCount: firstLayout.count,
    secondCount: secondLayout.count,
    suggestion: buildPairSuggestion(firstLayout, secondLayout, params)
  };
}

function validateEdgePair(first, second, params, pairIndex = -1) {
  const title = pairIndex >= 0 ? `Pair ${pairIndex + 1}` : "Pair";
  const paramCheck = validateJoineryParams(params, title);
  const firstLayout = fingerLayoutForEdge(first, params);
  const secondLayout = fingerLayoutForEdge(second, params);
  const messages = [...paramCheck.messages];
  let status = paramCheck.status;

  if (sameEdge(first, second)) {
    status = "fail";
    messages.push(`${title}: choose two different edges.`);
  }

  const duplicate = state.edgeSelection.pairs.find((pair, index) => (
    index !== pairIndex
    && [pair.first, pair.second].some(edge => sameEdge(edge, first) || sameEdge(edge, second))
  ));
  if (duplicate) {
    status = "fail";
    messages.push(`${title}: one of these edges is already paired.`);
  }

  if (firstLayout.count <= 0 || secondLayout.count <= 0) {
    status = "fail";
    messages.push(`${title}: at least one edge is too short for a finger joint.`);
  }

  const lengthTolerance = Math.max(params.materialThickness, 0.5);
  const lengthDiff = Math.abs(firstLayout.length - secondLayout.length);
  if (lengthDiff > lengthTolerance) {
    status = "fail";
    messages.push(`${title}: edge length mismatch ${formatNumber(lengthDiff)} mm exceeds tolerance ${formatNumber(lengthTolerance)} mm.`);
  }

  if (status !== "fail" && firstLayout.count > 0 && secondLayout.count > 0 && firstLayout.count !== secondLayout.count) {
    status = mergeValidationStatus(status, "warning");
    messages.push(`${title}: finger counts differ (${firstLayout.count} / ${secondLayout.count}).`);
  }

  const suggestion = status === "fail" && lengthDiff > lengthTolerance
    ? null
    : buildPairSuggestion(firstLayout, secondLayout, params);

  return {
    status,
    messages,
    fingerCount: Math.min(firstLayout.count, secondLayout.count),
    firstLength: firstLayout.length,
    secondLength: secondLayout.length,
    endMargin: Math.min(firstLayout.endMargin, secondLayout.endMargin),
    firstCount: firstLayout.count,
    secondCount: secondLayout.count,
    suggestion
  };
}

function buildPairSuggestion(firstLayout, secondLayout, params) {
  if (firstLayout.count <= 0 || secondLayout.count <= 0) {
    const longest = Math.max(firstLayout.length, secondLayout.length);
    const suggestedTabWidth = Math.max(1, Math.min(params.tabWidth, longest / 4));
    return {
      type: "params",
      label: `邊長不足，建議接榫寬度改為 ${formatNumber(suggestedTabWidth)} mm 並重新檢查。`,
      params: { tabWidth: suggestedTabWidth }
    };
  }

  if (firstLayout.count !== secondLayout.count) {
    const shorter = Math.min(firstLayout.length, secondLayout.length);
    const targetCount = Math.max(1, Math.min(firstLayout.count, secondLayout.count));
    const safety = Math.max(params.materialThickness, params.tabDepth);
    const available = Math.max(1, shorter - safety * 2 - Math.max(0, targetCount - 1) * params.tabSpacing);
    const suggestedTabWidth = Math.max(1, available / targetCount);
    return {
      type: "params",
      label: `兩邊榫數不同，建議以較短邊為準：接榫寬度 ${formatNumber(suggestedTabWidth)} mm，榫數 ${targetCount}。`,
      params: { tabWidth: suggestedTabWidth }
    };
  }

  const lengthTolerance = Math.max(params.materialThickness, 0.5);
  const lengthDiff = Math.abs(firstLayout.length - secondLayout.length);
  if (lengthDiff > lengthTolerance) {
    const shorter = Math.min(firstLayout.length, secondLayout.length);
    const targetCount = Math.max(1, Math.min(firstLayout.count, secondLayout.count));
    const safety = Math.max(params.materialThickness, params.tabDepth);
    const available = Math.max(1, shorter - safety * 2 - Math.max(0, targetCount - 1) * params.tabSpacing);
    const suggestedTabWidth = Math.max(1, available / targetCount);
    return {
      type: "params",
      label: `兩邊長度差 ${formatNumber(lengthDiff)} mm，建議以較短邊重算：接榫寬度 ${formatNumber(suggestedTabWidth)} mm。`,
      params: { tabWidth: suggestedTabWidth }
    };
  }

  const minCornerClearance = Math.max(params.materialThickness, params.tabDepth);
  const endMargin = Math.min(firstLayout.endMargin, secondLayout.endMargin);
  if (endMargin < minCornerClearance) {
    const suggestedSpacing = Math.max(params.tabSpacing, minCornerClearance);
    return {
      type: "params",
      label: `角落安全距離偏小，建議接榫間距改為 ${formatNumber(suggestedSpacing)} mm。`,
      params: { tabSpacing: suggestedSpacing }
    };
  }

  return null;
}

function buildPairSuggestion(firstLayout, secondLayout, params) {
  const matchingSuggestion = () => suggestMatchingTabWidth(firstLayout, secondLayout, params);

  if (firstLayout.count <= 0 || secondLayout.count <= 0) {
    const suggested = matchingSuggestion();
    const suggestedTabWidth = suggested?.tabWidth ?? Math.max(1, Math.min(params.tabWidth, Math.max(firstLayout.length, secondLayout.length) / 4));
    return {
      type: "params",
      label: `Edge is too short. Set tab width to ${formatNumber(suggestedTabWidth)} mm and regenerate.`,
      params: { tabWidth: suggestedTabWidth }
    };
  }

  const shorter = Math.min(firstLayout.length, secondLayout.length);
  const targetCount = Math.max(1, Math.min(firstLayout.count, secondLayout.count));
  const lengthTolerance = Math.max(params.materialThickness, 0.5);
  const lengthDiff = Math.abs(firstLayout.length - secondLayout.length);

  if (firstLayout.count !== secondLayout.count) {
    const suggested = matchingSuggestion();
    const suggestedTabWidth = suggested?.tabWidth ?? params.tabWidth;
    const suggestedCount = suggested?.count ?? targetCount;
    return {
      type: "params",
      label: `Finger counts differ. Use shorter edge: tab width ${formatNumber(suggestedTabWidth)} mm, ${suggestedCount} fingers.`,
      params: { tabWidth: suggestedTabWidth }
    };
  }

  if (lengthDiff > lengthTolerance) {
    const suggested = matchingSuggestion();
    const suggestedTabWidth = suggested?.tabWidth ?? params.tabWidth;
    return {
      type: "params",
      label: `Edge length mismatch ${formatNumber(lengthDiff)} mm. Recalculate from shorter edge: tab width ${formatNumber(suggestedTabWidth)} mm.`,
      params: { tabWidth: suggestedTabWidth }
    };
  }

  const minCornerClearance = Math.max(params.materialThickness, params.tabDepth);
  const endMargin = Math.min(firstLayout.endMargin, secondLayout.endMargin);
  if (endMargin < minCornerClearance) {
    const suggestedSpacing = Math.max(params.tabSpacing, minCornerClearance);
    return {
      type: "params",
      label: `Corner clearance is small. Set tab spacing to ${formatNumber(suggestedSpacing)} mm.`,
      params: { tabSpacing: suggestedSpacing }
    };
  }

  return null;
}

function suggestMatchingTabWidth(firstLayout, secondLayout, params) {
  const shorter = Math.min(firstLayout.length, secondLayout.length);
  const longer = Math.max(firstLayout.length, secondLayout.length);
  const maxTarget = Math.max(1, Math.min(
    firstLayout.count > 0 ? firstLayout.count : Infinity,
    secondLayout.count > 0 ? secondLayout.count : Infinity,
    calcFingerCount(shorter, params) || 1
  ));

  for (let target = maxTarget; target >= 1; target -= 1) {
    const tabWidth = tabWidthForFingerCount(shorter, target, params);
    if (!Number.isFinite(tabWidth)) continue;
    const nextParams = { ...params, tabWidth };
    const shorterCount = fingerRunLayoutForLength(shorter, nextParams).count;
    const longerCount = fingerRunLayoutForLength(longer, nextParams).count;
    if (shorterCount === target && longerCount === target) {
      return { tabWidth, count: target };
    }
  }

  return null;
}

function tabWidthForFingerCount(length, targetCount, params) {
  if (targetCount <= 0) return NaN;
  const spacing = params.tabSpacing;
  const safety = Math.max(params.materialThickness, params.tabDepth);
  const upperByCount = ((length - spacing) / targetCount) - spacing;
  const upperByFit = (length - safety * 2 - Math.max(0, targetCount - 1) * spacing) / targetCount;
  const lowerByNextCount = targetCount > 0 ? ((length - spacing) / (targetCount + 1)) - spacing : 1;
  const lower = Math.max(1, lowerByNextCount + 0.05);
  const upper = Math.min(upperByCount, upperByFit);
  if (!(upper >= lower)) return NaN;
  return Math.max(1, upper * 0.98);
}

function applyPairSuggestion(suggestion) {
  if (!suggestion?.params) return;
  if (Number.isFinite(suggestion.params.tabWidth)) {
    els.tabWidth.value = formatInputNumber(suggestion.params.tabWidth);
  }
  if (Number.isFinite(suggestion.params.tabSpacing)) {
    els.tabSpacing.value = formatInputNumber(suggestion.params.tabSpacing);
  }
  if (Number.isFinite(suggestion.params.tabDepth)) {
    els.tabDepth.value = formatInputNumber(suggestion.params.tabDepth);
  }
  state.uiWarnings = [`已套用建議：${suggestion.label}`];
  runConversion();
}

function showJoinerySuccessIfAllPairsOk() {
  if (!state.edgeSelection.pairs.length) return;
  const params = getParams();
  const validations = state.edgeSelection.pairs.map((pair, index) => validateEdgePair(pair.first, pair.second, params, index));
  if (validations.every(validation => validation.status === "ok")) {
    showJoinerySuccessPopup(params, validations[validations.length - 1]);
  }
}

function validateAllPairsForFinalApply() {
  const params = getParams();
  const messages = [];
  if (state.edgeSelection.pending) {
    messages.push("There is an unfinished first edge. Select the second edge or cancel it before applying.");
  }
  if (!state.edgeSelection.pairs.length) {
    messages.push("No joinery pairs have been created.");
  }

  const validations = state.edgeSelection.pairs.map((pair, index) => validateEdgePair(pair.first, pair.second, params, index));
  validations.forEach((validation, index) => {
    pairValidationLabel(validation, index).forEach(message => messages.push(message));
  });

  return {
    ok: messages.length === 0 && validations.every(validation => validation.status === "ok"),
    params,
    validations,
    messages
  };
}

function pairValidationLabel(validation, index) {
  if (validation.status === "ok") return [];
  const label = `Pair ${index + 1}`;
  if (validation.messages?.length) {
    return validation.messages.map(message => `${label}: ${message}`);
  }
  return [`${label}: validation failed.`];
}

function innerDimensionSummary(params) {
  const length = params.length;
  const width = params.width;
  const height = params.modelType === "gable_house"
    ? params.wallHeight + params.roofHeight
    : params.height;
  return {
    length,
    width,
    height,
    volume: length * width * height
  };
}

function showJoinerySuccessPopup(params = getParams(), validation = null) {
  const existing = document.querySelector(".success-modal-overlay");
  if (existing) existing.remove();
  if (state.celebrationTimer) {
    clearTimeout(state.celebrationTimer);
    state.celebrationTimer = null;
  }

  const dims = innerDimensionSummary(params);
  const overlay = document.createElement("div");
  overlay.className = "success-modal-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");

  const fireworks = document.createElement("div");
  fireworks.className = "success-fireworks";
  for (let i = 0; i < 22; i += 1) {
    const spark = document.createElement("span");
    spark.style.setProperty("--x", `${Math.cos((i / 22) * TAU) * (45 + (i % 5) * 11)}px`);
    spark.style.setProperty("--y", `${Math.sin((i / 22) * TAU) * (35 + (i % 4) * 12)}px`);
    spark.style.setProperty("--delay", `${(i % 6) * 0.035}s`);
    fireworks.appendChild(spark);
  }

  const modal = document.createElement("div");
  modal.className = "success-modal";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "success-close";
  closeButton.setAttribute("aria-label", "Close success popup");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => overlay.remove());

  const title = document.createElement("strong");
  title.textContent = "\u63a5\u69ab\u914d\u5c0d\u6b63\u78ba\uff01";

  const detail = document.createElement("p");
  detail.textContent = `\u5167\u5c3a\u5bf8\u9762\u7a4d\u70ba ${formatGuideNumber(dims.length)} × ${formatGuideNumber(dims.width)} × ${formatGuideNumber(dims.height)} = ${formatVolumeNumber(dims.volume)} mm³`;

  const pairInfo = document.createElement("p");
  pairInfo.className = "success-pair-info";
  pairInfo.textContent = validation ? `OK: ${validation.firstCount} / ${validation.secondCount} fingers` : "OK";

  modal.append(closeButton, title, detail, pairInfo);
  overlay.append(fireworks, modal);
  document.body.appendChild(overlay);

  state.celebrationTimer = setTimeout(() => {
    overlay.remove();
    state.celebrationTimer = null;
  }, 5200);
}

function loadImportedPieces(pieces, warnings = [], options = {}) {
  const params = getParams();
  state.sourceMode = "svg";
  state.importedPieces = prepareImportedPiecesForSelection(pieces, params.partGap);
  state.importedPreset = options.preset || null;
  state.importedWarnings = warnings;
  state.uiWarnings = [];
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
      name: shapeName(shape, index),
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

function shapeName(shape, index) {
  return (shape.getAttribute("id") || shape.getAttribute("data-name") || `svg_${index + 1}`)
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "") || `svg_${index + 1}`;
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

function buildInnerBoxPieces(innerLength, innerWidth, innerHeight, params) {
  const thickness = params.materialThickness;
  return buildBoxPieces(
    innerLength + thickness * 2,
    innerWidth + thickness * 2,
    innerHeight,
    params
  );
}

function buildDimensionedBoxPieces(length, width, height, params) {
  if (params.dimensionMode === "inner") {
    return buildInnerBoxPieces(length, width, height, params);
  }
  return buildBoxPieces(length, width, height, params);
}

function buildCylinderPieces(params) {
  const dimensions = cylinderDimensions(params);
  const circumference = TAU * dimensions.radius;
  return [
    circularFlexSidePiece("side_living_hinge", circumference, params.height, params),
    circlePiece("top", dimensions.radius, params, params.generateJoinery),
    circlePiece("bottom", dimensions.radius, params, params.generateJoinery)
  ];
}

function cylinderDimensions(params) {
  if (params.dimensionMode !== "inner") return { radius: params.radius };
  return { radius: params.radius + params.materialThickness };
}

function buildFlexBox5Pieces(params) {
  const dimensions = flexBoxDimensions(params);
  const radius = Math.max(
    params.materialThickness * 2,
    Math.min(dimensions.radius, dimensions.length / 2, dimensions.width / 2)
  );
  const perimeter = 2 * (dimensions.length + dimensions.width - 4 * radius) + TAU * radius;
  return [
    roundedRectPiece("top_rounded_panel", dimensions.length, dimensions.width, radius, params),
    roundedRectPiece("bottom_rounded_panel", dimensions.length, dimensions.width, radius, params),
    flexSidePiece("flex_living_hinge_side", perimeter, params.height, radius, params),
    latchPiece("front_latch", params)
  ];
}

function flexBoxDimensions(params) {
  if (params.dimensionMode !== "inner") {
    return {
      length: params.length,
      width: params.width,
      radius: params.radius
    };
  }

  const thickness = params.materialThickness;
  return {
    length: params.length + thickness * 2,
    width: params.width + thickness * 2,
    radius: params.radius + thickness
  };
}

function buildHousePieces(params) {
  const dimensions = houseDimensions(params);
  const roofSlopeLength = Math.hypot(dimensions.width / 2, params.roofHeight);
  const floorEdges = params.generateJoinery ? "ffff" : "eeee";
  const wallEdges = params.generateJoinery ? "FFFF" : "eeee";
  const roofEdges = params.generateJoinery ? "ffff" : "eeee";
  return [
    rectPiece("floor", dimensions.length, dimensions.width, params, floorEdges),
    rectPiece("left_wall", dimensions.length, params.wallHeight, params, wallEdges),
    rectPiece("right_wall", dimensions.length, params.wallHeight, params, wallEdges),
    gablePiece("front_gable", dimensions.width, params.wallHeight, params.roofHeight, params),
    gablePiece("back_gable", dimensions.width, params.wallHeight, params.roofHeight, params),
    rectPiece("roof_left", dimensions.length, roofSlopeLength, params, roofEdges),
    rectPiece("roof_right", dimensions.length, roofSlopeLength, params, roofEdges)
  ];
}

function houseDimensions(params) {
  if (params.dimensionMode !== "inner") {
    return {
      length: params.length,
      width: params.width
    };
  }

  const thickness = params.materialThickness;
  return {
    length: params.length + thickness * 2,
    width: params.width + thickness * 2
  };
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
  const showSourceOnly = shouldShowImportedSourceOnly();
  const showJoinerySegmentsOnly = shouldShowJoinerySegmentsOnly();
  const previewBounds = stablePreviewBounds(result);
  state.baseViewBox = {
    x: previewBounds.minX - padding,
    y: previewBounds.minY - padding,
    width: Math.max(previewBounds.width + padding * 2, 1),
    height: Math.max(previewBounds.height + padding * 2, 1)
  };
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  updatePreviewZoom();

  addSvgStyles();
  renderSourceOverlay();
  const cutGroup = createSvgElement("g", { class: "svg-cut" });
  els.previewSvg.appendChild(cutGroup);

  const visiblePieces = showSourceOnly
    ? []
    : showJoinerySegmentsOnly
      ? buildSelectedJoineryPieces(result.params)
      : result.pieces;
  for (const piece of visiblePieces) {
    for (const path of piece.paths) {
      cutGroup.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
        fill: "none",
        stroke: "#ff0000",
        "stroke-linejoin": "miter",
        "stroke-linecap": "square",
        "vector-effect": "non-scaling-stroke",
        "stroke-width": previewStrokeWidth(result.params)
      }));
    }
  }

  renderPieceLabels(result);
  renderEdgeOverlay(result);

  els.widthMetric.textContent = formatNumber(result.bounds.width);
  els.heightMetric.textContent = formatNumber(result.bounds.height);
  els.pathMetric.textContent = String(result.pieces.length);
  els.summaryText.textContent = `${modelLabel(result.params.modelType)} · ${result.pieces.length} parts`;
  els.downloadDxf.disabled = false;
  els.downloadSvg.disabled = false;
  renderWarnings(result.warnings);
  render3dPreview(result);
}

function stablePreviewBounds(result) {
  if (state.sourceMode !== "svg" || !state.importedPieces?.length) return result.bounds;
  const sourceBounds = getBoundsFromPaths(state.importedPieces);
  const guard = Math.max(result.params.tabDepth || 0, result.params.materialThickness || 0, 0);
  return {
    minX: sourceBounds.minX - guard,
    minY: sourceBounds.minY - guard,
    maxX: sourceBounds.maxX + guard,
    maxY: sourceBounds.maxY + guard,
    width: sourceBounds.width + guard * 2,
    height: sourceBounds.height + guard * 2
  };
}

function shouldShowImportedSourceOnly() {
  return state.sourceMode === "svg"
    && Boolean(state.importedPieces?.length)
    && !state.appliedJoinery
    && !state.edgeSelection.pending
    && state.edgeSelection.pairs.length === 0;
}

function shouldShowJoinerySegmentsOnly() {
  return state.sourceMode === "svg"
    && Boolean(state.importedPieces?.length)
    && !(state.importedPreset === "cube_net" && state.appliedJoinery && state.edgeSelection.pairs.length === 0 && !state.edgeSelection.pending)
    && (state.appliedJoinery || Boolean(state.edgeSelection.pending) || state.edgeSelection.pairs.length > 0);
}

function buildSelectedJoineryPieces(params) {
  const pieces = [];
  const addEdge = (ref, type) => {
    const piece = state.importedPieces?.[ref.pieceIndex];
    const sourcePath = piece?.paths?.[ref.pathIndex];
    if (!piece || !sourcePath || sourcePath.closed === false || sourcePath.length < 3) return;
    const path = fingerJointEdgePath(sourcePath, ref.edgeIndex, type, params);
    if (path.length < 2) return;
    pieces.push({
      name: `${piece.name || `piece_${ref.pieceIndex + 1}`}_edge_${ref.edgeIndex + 1}_${type}`,
      layer: "CUT",
      x: piece.x,
      y: piece.y,
      width: piece.width,
      height: piece.height,
      paths: [path]
    });
  };

  for (const pair of state.edgeSelection.pairs) {
    addEdge(pair.first, "f");
    addEdge(pair.second, "F");
  }

  if (state.edgeSelection.pending) addEdge(state.edgeSelection.pending, "f");
  return pieces;
}

function ensure3dPreviewElements() {
  if (els.preview3dCanvas) return true;

  const frame = document.createElement("div");
  frame.className = "preview-3d-frame";
  frame.hidden = true;
  frame.setAttribute("aria-label", "3D preview");

  const badge = document.createElement("div");
  badge.id = "preview3dMode";
  badge.className = "preview-3d-badge";
  badge.textContent = "3D preview";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "preview-3d-close";
  closeButton.setAttribute("aria-label", "Close 3D preview");
  closeButton.textContent = "\u00d7";
  closeButton.addEventListener("click", () => set3dPreviewVisible(false));

  const canvas = document.createElement("canvas");
  canvas.id = "preview3dCanvas";

  frame.append(badge, closeButton, canvas);
  document.body.appendChild(frame);
  els.preview3dCanvas = canvas;
  els.preview3dMode = badge;
  return true;
}

function ensure3dPreview() {
  if (!ensure3dPreviewElements()) return null;
  if (!window.THREE) {
    els.preview3dMode.textContent = "3D unavailable";
    return null;
  }
  if (state.three) return state.three;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fafc);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 10000);
  const renderer = new THREE.WebGLRenderer({
    canvas: els.preview3dCanvas,
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const group = new THREE.Group();
  group.rotation.x = -0.42;
  group.rotation.y = 0.62;
  scene.add(group);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(140, 220, 180);
  scene.add(key);
  const grid = new THREE.GridHelper(360, 18, 0xcbd5e1, 0xe2e8f0);
  grid.position.y = -0.2;
  scene.add(grid);

  const ctx = { scene, camera, renderer, group, isDragging: false, lastX: 0, lastY: 0, needsResize: true };
  state.three = ctx;

  els.preview3dCanvas.addEventListener("pointerdown", (event) => {
    ctx.isDragging = true;
    ctx.lastX = event.clientX;
    ctx.lastY = event.clientY;
    els.preview3dCanvas.setPointerCapture(event.pointerId);
  });
  els.preview3dCanvas.addEventListener("pointermove", (event) => {
    if (!ctx.isDragging) return;
    const dx = event.clientX - ctx.lastX;
    const dy = event.clientY - ctx.lastY;
    ctx.lastX = event.clientX;
    ctx.lastY = event.clientY;
    group.rotation.y += dx * 0.008;
    group.rotation.x = Math.max(-1.25, Math.min(0.35, group.rotation.x + dy * 0.008));
  });
  els.preview3dCanvas.addEventListener("pointerup", (event) => {
    ctx.isDragging = false;
    try {
      els.preview3dCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released by the browser.
    }
  });
  window.addEventListener("resize", () => {
    ctx.needsResize = true;
  });

  const animate = () => {
    if (!ctx.isDragging) group.rotation.y += 0.0022;
    resize3dRenderer(ctx);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  return ctx;
}

function resize3dRenderer(ctx) {
  const canvas = els.preview3dCanvas;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const ratio = ctx.renderer.getPixelRatio ? ctx.renderer.getPixelRatio() : 1;
  if (!ctx.needsResize && canvas.width === Math.round(width * ratio) && canvas.height === Math.round(height * ratio)) return;
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();
  ctx.needsResize = false;
}

function render3dPreview(result) {
  if (!shouldShow3dPreviewAfterConfirm()) {
    set3dPreviewVisible(false);
    return;
  }
  const ctx = ensure3dPreview();
  if (!ctx || !result) return;
  set3dPreviewVisible(true);
  clear3dGroup(ctx.group);

  const importedAssemblyMode = buildKnownImportedAssembly3d(ctx.group, result);
  const mode = importedAssemblyMode
    || (shouldRenderAssembledBox(result)
      ? buildAssembledBox3d(ctx.group, result.params)
      : buildPlatePreview3d(ctx.group, result));
  els.preview3dMode.textContent = mode;
  fit3dCamera(ctx, get3dBox(ctx.group));
}

function shouldShow3dPreviewAfterConfirm() {
  return state.sourceMode !== "svg" || state.appliedJoinery;
}

function set3dPreviewVisible(isVisible) {
  const frame = els.preview3dCanvas?.closest(".preview-3d-frame") || document.querySelector(".preview-3d-frame");
  if (!frame) return;
  frame.hidden = !isVisible;
}

function shouldRenderAssembledBox(result) {
  return state.importedPreset === "cube_net"
    || (state.sourceMode !== "svg" && ["cube", "cuboid"].includes(result.params.modelType));
}

function buildKnownImportedAssembly3d(group, result) {
  if (state.sourceMode !== "svg" || !state.importedPieces?.length) return null;
  const pieces = importedPieceMap();

  if (hasImportedPieceNames(pieces, ["top", "bottom", "front", "back", "left", "right"])) {
    return buildImportedCuboidAssembly3d(group, pieces, result.params);
  }

  if (hasImportedPieceNames(pieces, ["floor", "left_wall", "right_wall", "front_gable", "back_gable", "roof_left", "roof_right"])) {
    return buildImportedGableHouseAssembly3d(group, pieces, result.params);
  }

  return null;
}

function importedPieceMap() {
  return new Map((state.importedPieces || []).map(piece => [piece.name, piece]));
}

function hasImportedPieceNames(pieceMap, names) {
  return names.every(name => pieceMap.has(name));
}

function boardMaterial3d(color = 0xf7fafc, opacity = 0.92) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.02,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide
  });
}

function redMaterial3d() {
  return new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.45 });
}

function clear3dGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(material => material.dispose());
      }
    });
  }
}

function buildAssembledBox3d(group, params) {
  const t = Math.max(params.materialThickness || 3, 0.2);
  const innerLength = Math.max(params.length, 1);
  const innerWidth = Math.max(params.modelType === "cube" ? params.length : params.width, 1);
  const innerHeight = Math.max(params.modelType === "cube" ? params.length : params.height, 1);
  const outerLength = innerLength + t * 2;
  const outerWidth = innerWidth + t * 2;
  const boardMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7fafc,
    roughness: 0.72,
    metalness: 0.02,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.45 });

  addBoard3d(group, outerLength, t, outerWidth, 0, -t / 2, 0, boardMaterial);
  addBoard3d(group, outerLength, t, outerWidth, 0, innerHeight + t / 2, 0, boardMaterial);
  addBoard3d(group, outerLength, innerHeight, t, 0, innerHeight / 2, -innerWidth / 2 - t / 2, boardMaterial);
  addBoard3d(group, outerLength, innerHeight, t, 0, innerHeight / 2, innerWidth / 2 + t / 2, boardMaterial);
  addBoard3d(group, t, innerHeight, innerWidth, -innerLength / 2 - t / 2, innerHeight / 2, 0, boardMaterial);
  addBoard3d(group, t, innerHeight, innerWidth, innerLength / 2 + t / 2, innerHeight / 2, 0, boardMaterial);

  addEdgeStrip3d(group, outerLength, t * 0.42, 0, 0.25, -innerWidth / 2 - t - 0.2, 0, edgeMaterial);
  addEdgeStrip3d(group, outerLength, t * 0.42, 0, 0.25, innerWidth / 2 + t + 0.2, 0, edgeMaterial);
  addEdgeStrip3d(group, innerWidth, t * 0.42, -innerLength / 2 - t - 0.2, 0.25, 0, Math.PI / 2, edgeMaterial);
  addEdgeStrip3d(group, innerWidth, t * 0.42, innerLength / 2 + t + 0.2, 0.25, 0, Math.PI / 2, edgeMaterial);

  return "3D 組裝預覽";
}

function buildImportedCuboidAssembly3d(group, pieces, params) {
  const t = Math.max(params.materialThickness || 3, 0.2);
  const top = pieces.get("top");
  const front = pieces.get("front");
  const left = pieces.get("left");
  const length = Math.max(top.width, front.width, 1);
  const width = Math.max(top.height, left.width, 1);
  const height = Math.max(front.height, left.height, 1);
  const boardMaterial = boardMaterial3d(0xf7fafc, 0.92);
  const edgeMaterial = redMaterial3d();

  addBoard3d(group, length, t, width, 0, -t / 2, 0, boardMaterial);
  addBoard3d(group, length, t, width, 0, height + t / 2, 0, boardMaterial);
  addBoard3d(group, length, height, t, 0, height / 2, -width / 2 - t / 2, boardMaterial);
  addBoard3d(group, length, height, t, 0, height / 2, width / 2 + t / 2, boardMaterial);
  addBoard3d(group, t, height, width, -length / 2 - t / 2, height / 2, 0, boardMaterial);
  addBoard3d(group, t, height, width, length / 2 + t / 2, height / 2, 0, boardMaterial);
  addCuboidEdgeHighlights(group, length, width, height, t, edgeMaterial);
  return "3D 組裝預覽";
}

function addCuboidEdgeHighlights(group, length, width, height, t, material) {
  const d = Math.max(t * 0.42, 0.8);
  addEdgeStrip3d(group, length, d, 0, 0.25, -width / 2 - t - 0.2, 0, material);
  addEdgeStrip3d(group, length, d, 0, 0.25, width / 2 + t + 0.2, 0, material);
  addEdgeStrip3d(group, width, d, -length / 2 - t - 0.2, 0.25, 0, Math.PI / 2, material);
  addEdgeStrip3d(group, width, d, length / 2 + t + 0.2, 0.25, 0, Math.PI / 2, material);
  addEdgeStrip3d(group, length, d, 0, height + t + 0.2, -width / 2 - t - 0.2, 0, material);
  addEdgeStrip3d(group, length, d, 0, height + t + 0.2, width / 2 + t + 0.2, 0, material);
}

function buildImportedGableHouseAssembly3d(group, pieces, params) {
  const t = Math.max(params.materialThickness || 3, 0.2);
  const floor = pieces.get("floor");
  const leftWall = pieces.get("left_wall");
  const frontGable = pieces.get("front_gable");
  const roofLeft = pieces.get("roof_left");
  const length = Math.max(floor.width, leftWall.width, roofLeft.width, 1);
  const width = Math.max(floor.height, frontGable.width, 1);
  const wallHeight = Math.max(leftWall.height, 1);
  const totalGableHeight = Math.max(frontGable.height, wallHeight + 1);
  const roofHeight = Math.max(totalGableHeight - wallHeight, 1);
  const roofSlope = Math.max(roofLeft.height, Math.hypot(width / 2, roofHeight));
  const roofAngle = Math.atan2(roofHeight, width / 2);
  const boardMaterial = boardMaterial3d(0xf7fafc, 0.92);
  const roofMaterial = boardMaterial3d(0xe8edf4, 0.94);
  const gableMaterial = boardMaterial3d(0xffffff, 0.94);
  const edgeMaterial = redMaterial3d();

  addBoard3d(group, length, t, width, 0, -t / 2, 0, boardMaterial);
  addBoard3d(group, length, wallHeight, t, 0, wallHeight / 2, -width / 2 - t / 2, boardMaterial);
  addBoard3d(group, length, wallHeight, t, 0, wallHeight / 2, width / 2 + t / 2, boardMaterial);
  addGableWall3d(group, width, wallHeight, roofHeight, t, -length / 2 - t / 2, gableMaterial);
  addGableWall3d(group, width, wallHeight, roofHeight, t, length / 2 + t / 2, gableMaterial);

  const leftRoof = addBoard3d(group, length, t, roofSlope, 0, wallHeight + roofHeight / 2 + t * 0.15, -width / 4, roofMaterial);
  leftRoof.rotation.x = -roofAngle;
  const rightRoof = addBoard3d(group, length, t, roofSlope, 0, wallHeight + roofHeight / 2 + t * 0.15, width / 4, roofMaterial);
  rightRoof.rotation.x = roofAngle;
  addHouseEdgeHighlights(group, length, width, wallHeight, roofHeight, t, roofAngle, edgeMaterial);
  return "3D 組裝預覽";
}

function addGableWall3d(group, width, wallHeight, roofHeight, thickness, x, material) {
  const totalHeight = wallHeight + roofHeight;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, wallHeight);
  shape.lineTo(0, totalHeight);
  shape.lineTo(-width / 2, wallHeight);
  shape.lineTo(-width / 2, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  const mesh = new THREE.Mesh(geometry, material.clone());
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(x - thickness / 2, 0, 0);
  group.add(mesh);
  addMeshOutline3d(mesh);
  return mesh;
}

function addHouseEdgeHighlights(group, length, width, wallHeight, roofHeight, thickness, roofAngle, material) {
  const d = Math.max(thickness * 0.42, 0.8);
  addEdgeStrip3d(group, length, d, 0, 0.25, -width / 2 - thickness - 0.2, 0, material);
  addEdgeStrip3d(group, length, d, 0, 0.25, width / 2 + thickness + 0.2, 0, material);
  addEdgeStrip3d(group, length, d, 0, wallHeight + thickness * 0.3, -width / 2 - thickness - 0.2, 0, material);
  addEdgeStrip3d(group, length, d, 0, wallHeight + thickness * 0.3, width / 2 + thickness + 0.2, 0, material);
  const leftEave = addEdgeStrip3d(group, length, d, 0, wallHeight + thickness, -width / 2, 0, material);
  leftEave.rotation.x = -roofAngle;
  const rightEave = addEdgeStrip3d(group, length, d, 0, wallHeight + thickness, width / 2, 0, material);
  rightEave.rotation.x = roofAngle;
  addEdgeStrip3d(group, length, d, 0, wallHeight + roofHeight + thickness * 0.6, 0, 0, material);
}

function addBoard3d(group, width, height, depth, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material.clone());
  mesh.position.set(x, y, z);
  group.add(mesh);
  addMeshOutline3d(mesh);
  return mesh;
}

function addMeshOutline3d(mesh) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.42 })
  );
  mesh.add(edges);
}

function addEdgeStrip3d(group, length, depth, x, y, z, rotationY, material) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(length, Math.max(depth, 0.8), Math.max(depth, 0.8)), material.clone());
  strip.position.set(x, y, z);
  strip.rotation.y = rotationY;
  group.add(strip);
  return strip;
}

function buildPlatePreview3d(group, result) {
  const t = Math.max(result.params.materialThickness || 3, 0.2);
  const bounds = getBoundsFromPaths(result.pieces);
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  const boardMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.7,
    metalness: 0.01,
    transparent: true,
    opacity: 0.82
  });
  const redMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.45 });

  for (const piece of result.pieces) {
    const width = Math.max(piece.width || 1, 1);
    const height = Math.max(piece.height || 1, 1);
    addBoard3d(group, width, t, height, piece.x + width / 2 - centerX, 0, piece.y + height / 2 - centerY, boardMaterial);
  }

  const refs = [];
  for (const pair of state.edgeSelection.pairs) refs.push(pair.first, pair.second);
  if (state.edgeSelection.pending) refs.push(state.edgeSelection.pending);
  for (const ref of refs) addPlateEdgeMarker3d(group, ref, result.params, centerX, centerY, redMaterial);

  return "2.5D 板件預覽";
}

function addPlateEdgeMarker3d(group, ref, params, centerX, centerY, material) {
  const piece = state.importedPieces?.[ref.pieceIndex];
  const path = piece?.paths?.[ref.pathIndex];
  if (!piece || !path || !path.length) return;
  const a = path[ref.edgeIndex];
  const b = path[(ref.edgeIndex + 1) % path.length];
  if (!a || !b) return;
  const ax = piece.x + a.x;
  const ay = piece.y + a.y;
  const bx = piece.x + b.x;
  const by = piece.y + b.y;
  const length = Math.hypot(bx - ax, by - ay);
  if (length < 0.01) return;
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(length, Math.max(params.materialThickness * 0.32, 0.7), Math.max(params.materialThickness * 0.7, 1.2)),
    material.clone()
  );
  strip.position.set((ax + bx) / 2 - centerX, params.materialThickness + 0.35, (ay + by) / 2 - centerY);
  strip.rotation.y = -Math.atan2(by - ay, bx - ax);
  group.add(strip);
}

function get3dBox(group) {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) {
    box.min.set(-50, -50, -50);
    box.max.set(50, 50, 50);
  }
  return box;
}

function fit3dCamera(ctx, box) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxSize = Math.max(size.x, size.y, size.z, 20);
  const distance = maxSize * 2.05;
  ctx.camera.position.set(center.x + distance, center.y + distance * 0.72, center.z + distance);
  ctx.camera.lookAt(center.x, center.y, center.z);
  ctx.camera.near = Math.max(distance / 100, 0.1);
  ctx.camera.far = distance * 8;
  ctx.camera.updateProjectionMatrix();
  ctx.needsResize = true;
}

function fingerJointEdgePath(vertices, edgeIndex, type, params) {
  const start = vertices[edgeIndex];
  const end = vertices[(edgeIndex + 1) % vertices.length];
  if (!start || !end) return [];
  const points = [];
  const outward = edgeOutwardNormal(start, end, signedPolygonArea(vertices));
  addFingerEdge(points, start, end, outward, type, params);
  points.closed = false;
  return points;
}

function renderPieceLabels(result) {
  if (state.sourceMode !== "svg") return;

  const group = createSvgElement("g", { class: "piece-label-overlay" });
  let labelCount = 0;
  const labelColor = "#111827";

  for (const piece of result.pieces) {
    const label = pieceLabel(piece.name);
    if (!label) continue;
    group.appendChild(createSvgElement("text", {
      x: svgNum(piece.x + piece.width / 2),
      y: svgNum(piece.y + piece.height / 2),
      fill: labelColor,
      "font-family": "Arial, sans-serif",
      "font-size": "6",
      "font-weight": "700",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "paint-order": "stroke",
      stroke: "#ffffff",
      "stroke-width": "1.2",
      "vector-effect": "non-scaling-stroke"
    })).textContent = label;
    labelCount += 1;
  }

  if (labelCount) els.previewSvg.appendChild(group);
}

function previewStrokeWidth(params) {
  return Math.max(params.kerfWidth || 0.1, 0.8);
}

function updatePreviewZoom() {
  const zoom = Math.max(0.5, Math.min(3, state.zoom));
  state.zoom = zoom;
  if (state.baseViewBox) {
    const centerX = state.baseViewBox.x + state.baseViewBox.width / 2;
    const centerY = state.baseViewBox.y + state.baseViewBox.height / 2;
    const width = state.baseViewBox.width / zoom;
    const height = state.baseViewBox.height / zoom;
    els.previewSvg.setAttribute("viewBox", [
      svgNum(centerX - width / 2),
      svgNum(centerY - height / 2),
      svgNum(width),
      svgNum(height)
    ].join(" "));
  }
  els.previewSvg.style.width = "";
  els.previewSvg.style.height = "";
  els.previewSvg.style.minWidth = "";
  els.previewSvg.style.minHeight = "";
  if (els.zoomLevel) els.zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  if (els.zoomOutButton) els.zoomOutButton.disabled = zoom <= 0.5;
  if (els.zoomInButton) els.zoomInButton.disabled = zoom >= 3;
}

function setPreviewZoom(nextZoom) {
  state.zoom = Math.max(0.5, Math.min(3, nextZoom));
  updatePreviewZoom();
}

function pieceLabel(name) {
  const labels = {
    floor: "bottom",
    bottom: "bottom",
    bottom_3d: "bottom",
    left_wall: "left",
    left: "left",
    right_wall: "right",
    right: "right",
    front_gable: "front",
    front: "front",
    back_gable: "back",
    back: "back",
    roof_left: "roof left",
    roof_right: "roof right",
    top: "top"
  };
  return labels[name] || "";
}

function renderEdgeOverlay(result) {
  if (state.sourceMode !== "svg" || !state.edgeSelectEnabled || !state.importedPieces?.length) return;
  if (state.appliedJoinery && state.importedPreset === "cube_net" && state.edgeSelection.pairs.length === 0) return;

  const group = createSvgElement("g", { class: "edge-overlay" });
  els.previewSvg.appendChild(group);

  for (const edge of listSelectableEdges()) {
    const sourceOnlyMode = shouldShowImportedSourceOnly();
    const joinerySegmentMode = shouldShowJoinerySegmentsOnly();
    const sourcePreviewMode = sourceOnlyMode || joinerySegmentMode;
    const edgeColor = colorForEdge(edge);
    const color = sourceOnlyMode || joinerySegmentMode ? (edgeColor ? "#ff0000" : "#111827") : (edgeColor || "#ff0000");
    const edgeRole = roleForEdge(edge);
    const className = [
      "edge-visible",
      isPendingEdge(edge) ? "edge-pending-first" : "",
      !sourcePreviewMode && state.edgeSelection.pending && !isPendingEdge(edge) && !colorForEdge(edge) ? "edge-second-candidate" : "",
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

    if (!isPendingEdge(edge) && edgeRole === "convex") {
      group.appendChild(createEdgeBadge(edge, "凸 f", color));
    }
    if (!isPendingEdge(edge) && edgeRole === "concave") {
      group.appendChild(createEdgeBadge(edge, "凹 F", color));
    }

    if (isPendingEdge(edge)) {
      group.appendChild(createEdgeBadge(edge, "1 凸 f", "#111827"));
    }
  }
}

function renderSourceOverlay() {
  if (
    state.sourceMode !== "svg"
    || (!shouldShowJoinerySegmentsOnly() && !shouldShowImportedSourceOnly())
    || !state.importedPieces?.length
  ) return;

  const group = createSvgElement("g", { class: "source-overlay" });
  els.previewSvg.appendChild(group);

  for (const piece of state.importedPieces) {
    for (const path of piece.paths) {
      group.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
        fill: "none",
        stroke: "#111827",
        "stroke-width": 0.55,
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

  state.uiWarnings = [];

  const existingPairIndex = findPairIndexForEdge(ref);
  if (existingPairIndex >= 0) {
    state.edgeSelection.pairs.splice(existingPairIndex, 1);
    state.edgeSelection.pending = null;
    state.appliedJoinery = false;
    runConversion();
    return;
  }

  if (!state.edgeSelection.pending) {
    const validation = validatePreviewEdge(ref, getParams());
    if (validation.status === "fail") {
      state.uiWarnings = validation.messages;
      runConversion();
      renderPairList();
      return;
    }
    state.edgeSelection.pending = ref;
    state.appliedJoinery = false;
    playJoineryTone("convex");
    runConversion();
    renderPairList();
    return;
  }

  if (sameEdge(state.edgeSelection.pending, ref)) {
    state.edgeSelection.pending = null;
    state.appliedJoinery = false;
    runConversion();
    renderPairList();
    return;
  }

  if (state.edgeSelection.pairs.length >= 48) {
    state.uiWarnings = ["最多只能建立 48 組接榫配對。"];
    state.edgeSelection.pending = null;
    runConversion();
    return;
  }

  const validation = validateEdgePair(state.edgeSelection.pending, ref, getParams(), -1);
  if (validation.status === "fail") {
    state.uiWarnings = validation.messages;
    runConversion();
    renderPairList();
    return;
  }

  state.edgeSelection.pairs.push({
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    color: pairColors[state.edgeSelection.pairs.length],
    first: state.edgeSelection.pending,
    second: ref,
    validation
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

function roleForEdge(edge) {
  if (isPendingEdge(edge)) return "pending";
  const pair = state.edgeSelection.pairs.find(item => sameEdge(item.first, edge) || sameEdge(item.second, edge));
  if (!pair) return "";
  return sameEdge(pair.first, edge) ? "convex" : "concave";
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
    .source-overlay path {
      fill: none;
      stroke: #111827;
      stroke-linejoin: miter;
      stroke-linecap: square;
    }
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

  const params = getParams();

  if (state.edgeSelection.pending) {
    const validation = validatePreviewEdge(state.edgeSelection.pending, params);
    const li = document.createElement("li");
    li.className = `selection-hint pair-${validation.status}`;
    li.innerHTML = `<span style="background:#111827"></span><div>已選凸榫 f：${edgeLabel(state.edgeSelection.pending)}｜榫數 ${validation.fingerCount}</div>`;
    els.pairList.appendChild(li);
  }

  if (!state.edgeSelection.pairs.length) {
    const li = document.createElement("li");
    li.className = "pair-empty";
    li.textContent = state.edgeSelection.pending ? "請再點選第二條邊建立凹槽 F。" : "尚未建立接榫配對。";
    els.pairList.appendChild(li);
    return;
  }

  state.edgeSelection.pairs.forEach((pair, index) => {
    const validation = validateEdgePair(pair.first, pair.second, params, index);
    pair.validation = validation;
    const li = document.createElement("li");
    li.className = `pair-${validation.status}`;
    li.style.borderColor = pair.color;
    const statusLabel = validation.status === "ok" ? "OK" : validation.status === "warning" ? "警告" : "失敗";
    li.innerHTML = `<span style="background:${pair.color}"></span><div><strong class="pair-status">${statusLabel}</strong>｜第 ${index + 1} 組：凸 f ${edgeLabel(pair.first)} → 凹 F ${edgeLabel(pair.second)}｜榫數 ${validation.fingerCount}</div>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "刪除";
    button.addEventListener("click", () => {
      state.edgeSelection.pairs.splice(index, 1);
      state.uiWarnings = [];
      state.appliedJoinery = state.edgeSelection.pairs.length > 0;
      runConversion();
    });
    li.appendChild(button);
    els.pairList.appendChild(li);
  });
  return;

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

function renderPairList() {
  if (!els.pairList) return;
  els.pairList.innerHTML = "";

  const params = getParams();

  if (state.edgeSelection.pending) {
    const validation = validatePreviewEdge(state.edgeSelection.pending, params);
    const li = document.createElement("li");
    li.className = `selection-hint pair-${validation.status}`;
    const marker = document.createElement("span");
    marker.style.background = "#111827";
    const content = document.createElement("div");
    content.textContent = `已選凸榫 f：${edgeLabel(state.edgeSelection.pending)}，榫數 ${validation.fingerCount}`;
    li.append(marker, content);
    els.pairList.appendChild(li);
  }

  if (!state.edgeSelection.pairs.length) {
    const li = document.createElement("li");
    li.className = "pair-empty";
    li.textContent = state.edgeSelection.pending ? "請再點選第二條邊建立凹槽 F。" : "尚未建立接榫配對。";
    els.pairList.appendChild(li);
    return;
  }

  state.edgeSelection.pairs.forEach((pair, index) => {
    const validation = validateEdgePair(pair.first, pair.second, params, index);
    pair.validation = validation;

    const li = document.createElement("li");
    li.className = `pair-${validation.status}`;
    li.style.borderColor = pair.color;

    const marker = document.createElement("span");
    marker.style.background = pair.color;
    li.appendChild(marker);

    const content = document.createElement("div");
    const statusLabel = validation.status === "ok" ? "OK" : validation.status === "warning" ? "警告" : "錯誤";
    const title = document.createElement("div");
    title.innerHTML = `<strong class="pair-status">${statusLabel}</strong>｜第 ${index + 1} 組：凸 f ${edgeLabel(pair.first)} → 凹 F ${edgeLabel(pair.second)}`;

    const detail = document.createElement("div");
    detail.className = "pair-detail";
    detail.textContent = `長度 ${formatNumber(validation.firstLength)} / ${formatNumber(validation.secondLength)} mm，榫數 ${validation.firstCount} / ${validation.secondCount}`;
    content.append(title, detail);

    if (validation.suggestion) {
      const suggestion = document.createElement("div");
      suggestion.className = "pair-suggestion";
      suggestion.textContent = validation.suggestion.label;
      content.appendChild(suggestion);
    }

    li.appendChild(content);

    const actions = document.createElement("div");
    actions.className = "pair-actions";
    if (validation.suggestion) {
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.textContent = "套用建議";
      applyButton.addEventListener("click", () => applyPairSuggestion(validation.suggestion));
      actions.appendChild(applyButton);
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "移除";
    removeButton.addEventListener("click", () => {
      state.edgeSelection.pairs.splice(index, 1);
      state.uiWarnings = [];
      state.appliedJoinery = state.edgeSelection.pairs.length > 0;
      runConversion();
    });
    actions.appendChild(removeButton);
    li.appendChild(actions);
    els.pairList.appendChild(li);
  });
}

function edgeLabel(ref) {
  const pieceName = state.importedPieces?.[ref.pieceIndex]?.name || `P${ref.pieceIndex + 1}`;
  return `${pieceName}-E${ref.edgeIndex + 1}`;
}

function exportSvg(result) {
  if (shouldShowJoinerySegmentsOnly()) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${buildRedOnlySvg(result, buildSelectedJoineryPieces(result.params)).outerHTML}\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${buildRedOnlySvg(result, result.pieces).outerHTML}\n`;
}

function buildRedOnlySvg(result, pieces) {
  const exportBounds = getBoundsFromPaths(pieces);
  const width = Math.max(exportBounds.width + OUTPUT_MARGIN_MM, 1);
  const height = Math.max(exportBounds.height + OUTPUT_MARGIN_MM, 1);
  const svg = createSvgElement("svg", {
    xmlns: NS,
    width: `${svgNum(width)}mm`,
    height: `${svgNum(height)}mm`,
    viewBox: `0 0 ${svgNum(width)} ${svgNum(height)}`
  });
  const group = createSvgElement("g", { class: "svg-cut" });
  svg.appendChild(group);

  for (const piece of pieces) {
    for (const path of piece.paths) {
      group.appendChild(createSvgElement("path", {
        d: pathToD(
          path,
          piece.x - exportBounds.minX + OUTPUT_MARGIN_MM,
          piece.y - exportBounds.minY + OUTPUT_MARGIN_MM
        ),
        fill: "none",
        stroke: "#ff0000",
        "stroke-linejoin": "miter",
        "stroke-linecap": "square",
        "vector-effect": "non-scaling-stroke",
        "stroke-width": svgNum(previewStrokeWidth(result.params))
      }));
    }
  }

  return svg;
}

function exportSampleSvg(pieces, name, labels = {}) {
  const bounds = getBoundsFromPieces(pieces);
  const paths = [];
  const textNodes = [];
  for (const piece of pieces) {
    for (const path of piece.paths) {
      paths.push(`  <path id="${escapeXml(piece.name)}" d="${pathToD(path, piece.x, piece.y)}" fill="none" stroke="#ff0000" stroke-width="0.1" stroke-linejoin="miter" stroke-linecap="square"/>`);
    }
    const label = labels[piece.name];
    if (label) {
      textNodes.push(`  <text x="${svgNum(piece.x + piece.width / 2)}" y="${svgNum(piece.y + piece.height / 2)}" font-family="Arial, sans-serif" font-size="6" text-anchor="middle" dominant-baseline="middle" fill="#111827">${escapeXml(label)}</text>`);
    }
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="${NS}" width="${svgNum(bounds.width)}mm" height="${svgNum(bounds.height)}mm" viewBox="0 0 ${svgNum(bounds.width)} ${svgNum(bounds.height)}">`,
    `  <title>${escapeXml(name)}</title>`,
    `  <g id="CUT">`,
    ...paths,
    `  </g>`,
    ...(textNodes.length ? [`  <g id="LABELS">`, ...textNodes, `  </g>`] : []),
    `</svg>`,
    ``
  ].join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sampleParams(overrides = {}) {
  return {
    ...getParams(),
    generateJoinery: false,
    ...overrides
  };
}

async function downloadPracticeSample(type) {
  if (type === "cuboid") {
    const params = sampleParams({ length: 120, width: 80, height: 60, partGap: 12 });
    const pieces = layoutPieces(buildBoxPieces(params.length, params.width, params.height, params), params.partGap);
    await download("cuboid_practice.svg", exportSampleSvg(pieces, "Cuboid practice SVG"), "image/svg+xml");
    return;
  }

  const params = sampleParams({ length: 120, width: 80, wallHeight: 55, roofHeight: 35, partGap: 12 });
  const pieces = layoutPieces(buildHousePieces(params), params.partGap);
  await download("gable_house_practice.svg", exportSampleSvg(pieces, "Gable house practice SVG", {
    floor: "bottom",
    left_wall: "left",
    right_wall: "right",
    front_gable: "front",
    back_gable: "back",
    roof_left: "roof left",
    roof_right: "roof right"
  }), "image/svg+xml");
}

function exportDxf(result) {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  const exportPieces = shouldShowJoinerySegmentsOnly() ? buildSelectedJoineryPieces(result.params) : result.pieces;
  const exportBounds = getBoundsFromPaths(exportPieces);
  for (const piece of exportPieces) {
    for (const path of piece.paths) {
      const segmentCount = path.closed === false ? path.length - 1 : path.length;
      for (let i = 0; i < segmentCount; i += 1) {
        const a = path[i];
        const b = path[(i + 1) % path.length];
        const ax = a.x + piece.x - exportBounds.minX + OUTPUT_MARGIN_MM;
        const ay = a.y + piece.y - exportBounds.minY + OUTPUT_MARGIN_MM;
        const bx = b.x + piece.x - exportBounds.minX + OUTPUT_MARGIN_MM;
        const by = b.y + piece.y - exportBounds.minY + OUTPUT_MARGIN_MM;
        lines.push(
          "0", "LINE",
          "8", piece.layer,
          "10", dxfNum(ax),
          "20", dxfNum(-ay),
          "30", "0",
          "11", dxfNum(bx),
          "21", dxfNum(-by),
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

async function download(name, content, type) {
  const blob = new Blob([content], { type });
  if (await saveWithFilePicker(name, blob, type)) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.textContent = name;
  a.className = "export-link";
  document.body.appendChild(a);
  a.click();
  a.remove();

  exportUrls.push(url);
  while (exportUrls.length > 6) URL.revokeObjectURL(exportUrls.shift());

  if (els.exportStatus) {
    els.exportStatus.textContent = `已產生 ${name}。若瀏覽器未自動下載，請點下方連結。`;
  }

  if (els.exportLinks) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `下載 ${name}`;
    link.className = "export-link";
    els.exportLinks.prepend(link);
    while (els.exportLinks.children.length > 4) {
      els.exportLinks.lastChild.remove();
    }
  }
}

async function saveWithFilePicker(name, blob, type) {
  if (!window.showSaveFilePicker) return false;

  try {
    const extension = name.endsWith(".dxf") ? ".dxf" : ".svg";
    const handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [
        {
          description: extension === ".dxf" ? "DXF file" : "SVG file",
          accept: { [type]: [extension] }
        }
      ]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    if (els.exportStatus) els.exportStatus.textContent = `已儲存 ${name}。`;
    return true;
  } catch (error) {
    if (error?.name === "AbortError") {
      if (els.exportStatus) els.exportStatus.textContent = "已取消儲存。";
      return true;
    }
    console.warn("File picker save failed; falling back to download link.", error);
    return false;
  }
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
  if (els.dimensionMode) els.dimensionMode.value = "inner";
  updateDimensionModeControls();
  updateDefaultsForModel();
}

function updateDimensionModeControls() {
  const mode = els.dimensionMode?.value || "inner";
  if (els.innerDimensionButton) {
    els.innerDimensionButton.setAttribute("aria-pressed", String(mode === "inner"));
  }
  if (els.dimensionModeStatus) {
    els.dimensionModeStatus.textContent = mode === "inner" ? "目前：內尺寸(長寬高為內部尺寸)" : "目前：外尺寸";
  }
}

function updateOuterDimensionStatus(params = getParams()) {
  if (!els.outerDimensionStatus) return;
  const outer = outerDimensionsFromInner(params);
  const volume = outer.length * outer.width * outer.height;
  els.outerDimensionStatus.textContent = `外尺寸：長 × 寬 × 高 = ${formatGuideNumber(outer.length)} × ${formatGuideNumber(outer.width)} × ${formatGuideNumber(outer.height)} = ${formatVolumeNumber(volume)} mm³`;
}

function outerDimensionsFromInner(params) {
  const thickness = params.materialThickness;
  const innerHeight = params.modelType === "gable_house"
    ? params.wallHeight + params.roofHeight
    : params.height;
  return {
    length: params.length + thickness * 2,
    width: params.width + thickness * 2,
    height: innerHeight + thickness * 2
  };
}

function runConversion() {
  els.statusPill.textContent = "Generating";
  updateFieldVisibility();
  updateDimensionModeControls();
  const params = getParams();
  updateOuterDimensionStatus(params);
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

function formatGuideNumber(value) {
  return Number(value).toFixed(Number.isInteger(value) ? 0 : 1);
}

function formatVolumeNumber(value) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatInputNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function svgNum(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function dxfNum(value) {
  return Number(value).toFixed(4);
}

els.modelType.addEventListener("change", updateDefaultsForModel);
els.resetButton.addEventListener("click", resetParams);
els.innerDimensionButton?.addEventListener("click", () => {
  if (els.dimensionMode) els.dimensionMode.value = "inner";
  updateDimensionModeControls();
  runConversion();
});
els.zoomOutButton?.addEventListener("click", () => setPreviewZoom(state.zoom - 0.25));
els.zoomInButton?.addEventListener("click", () => setPreviewZoom(state.zoom + 0.25));
els.zoomResetButton?.addEventListener("click", () => setPreviewZoom(1));

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

function loadCubeNetPractice() {
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
}

els.downloadCuboidSample?.addEventListener("click", async () => {
  await downloadPracticeSample("cuboid");
});

els.downloadHouseSample?.addEventListener("click", async () => {
  await downloadPracticeSample("house");
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
  const finalCheck = validateAllPairsForFinalApply();
  if (!finalCheck.ok) {
    state.uiWarnings = finalCheck.messages;
    runConversion();
    renderPairList();
    return;
  }
  state.appliedJoinery = true;
  state.edgeSelectEnabled = false;
  state.edgeSelection.pending = null;
  els.toggleEdgeSelect.setAttribute("aria-pressed", "false");
  els.toggleEdgeSelect.textContent = "選取接榫邊";
  runConversion();
  showJoinerySuccessPopup(finalCheck.params, finalCheck.validations[finalCheck.validations.length - 1]);
});

els.clearEdgePairs.addEventListener("click", () => {
  state.edgeSelection.pending = null;
  state.edgeSelection.pairs = [];
  state.appliedJoinery = false;
  runConversion();
});

els.downloadDxf.addEventListener("click", async () => {
  if (!state.result) return;
  await download(`${safeBaseName()}.dxf`, exportDxf(state.result), "application/dxf");
});

els.downloadSvg.addEventListener("click", async () => {
  if (!state.result) return;
  await download(`${safeBaseName()}.svg`, exportSvg(state.result), "image/svg+xml");
});

updateFieldVisibility();
loadCubeNetPractice();
