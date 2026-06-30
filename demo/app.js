const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;
const SPARSE_FINGER_UNIT = 4;

const state = {
  result: null,
  zoom: 1,
  baseViewBox: null
};

const els = {
  modelType: document.querySelector("#modelType"),
  length: document.querySelector("#length"),
  width: document.querySelector("#width"),
  height: document.querySelector("#height"),
  wallHeight: document.querySelector("#wallHeight"),
  roofHeight: document.querySelector("#roofHeight"),
  materialThickness: document.querySelector("#materialThickness"),
  kerfWidth: document.querySelector("#kerfWidth"),
  tabWidth: document.querySelector("#tabWidth"),
  tabDepth: document.querySelector("#tabDepth"),
  tabSpacing: document.querySelector("#tabSpacing"),
  partGap: document.querySelector("#partGap"),
  segments: document.querySelector("#segments"),
  dimensionMode: document.querySelector("#dimensionMode"),
  innerDimensionButton: document.querySelector("#innerDimensionButton"),
  dimensionModeStatus: document.querySelector("#dimensionModeStatus"),
  outerDimensionStatus: document.querySelector("#outerDimensionStatus"),
  joineryToggle: document.querySelector("#joineryToggle"),
  resetButton: document.querySelector("#resetButton"),
  previewSvg: document.querySelector("#previewSvg"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
  zoomLevel: document.querySelector("#zoomLevel"),
  widthMetric: document.querySelector("#widthMetric"),
  heightMetric: document.querySelector("#heightMetric"),
  pathMetric: document.querySelector("#pathMetric"),
  warningList: document.querySelector("#warningList"),
  statusPill: document.querySelector("#statusPill"),
  joineryModeButton: document.querySelector("#joineryModeButton"),
  joineryModeStatus: document.querySelector("#joineryModeStatus"),
  houseFields: document.querySelectorAll("[data-field='house']")
};

const defaults = {
  cube: { length: 60, width: 60, height: 60, wallHeight: 50, roofHeight: 28 },
  cuboid: { length: 120, width: 80, height: 60, wallHeight: 50, roofHeight: 28 },
  gable_house: { length: 120, width: 80, height: 80, wallHeight: 55, roofHeight: 35 }
};

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function getParams() {
  const materialThickness = readNumber(els.materialThickness, 3);
  const tabDepthValue = readNumber(els.tabDepth, materialThickness);
  const sparseFingerSize = materialThickness * SPARSE_FINGER_UNIT;
  if (els.tabWidth && els.tabWidth.value !== formatInputNumber(sparseFingerSize)) {
    els.tabWidth.value = formatInputNumber(sparseFingerSize);
  }
  if (els.tabSpacing && els.tabSpacing.value !== formatInputNumber(sparseFingerSize)) {
    els.tabSpacing.value = formatInputNumber(sparseFingerSize);
  }
  return {
    modelType: els.modelType.value,
    length: readNumber(els.length, 120),
    width: readNumber(els.width, 80),
    height: readNumber(els.height, 60),
    wallHeight: readNumber(els.wallHeight, 55),
    roofHeight: readNumber(els.roofHeight, 35),
    materialThickness,
    kerfWidth: readNumber(els.kerfWidth, 0.15),
    tabWidth: sparseFingerSize,
    tabDepth: tabDepthValue > 0 ? tabDepthValue : materialThickness,
    tabSpacing: sparseFingerSize,
    play: readNumber(els.kerfWidth, 0.15),
    endMarginMode: "boxes",
    surroundingSpaces: 2,
    partGap: readNumber(els.partGap, 8),
    segments: Math.max(8, Math.round(readNumber(els.segments, 48))),
    dimensionMode: els.dimensionMode?.value || "inner",
    generateJoinery: els.joineryToggle.checked
  };
}

function buildResult(params) {
  const warnings = validateParams(params);
  const pieces = buildBasicInnerDimensionPieces(params, warnings);

  const laidOut = layoutModelPieces(pieces, params);
  const bounds = getBoundsFromPieces(laidOut);
  warnings.push(...modelWarnings(params));
  warnings.push(...joineryValidationMessages(params));
  warnings.push(...offsetReferenceValidationMessages(laidOut, params));

  return { pieces: laidOut, bounds, warnings, params };
}

function buildBasicInnerDimensionPieces(params, warnings) {
  const sourcePieces = buildBasicSourcePieces(params);
  if (params.dimensionMode !== "inner") {
    return sourcePieces;
  }

  const offsetPieces = offsetImportedPiecesForMaterial(sourcePieces, params, warnings);
  const pieces = params.generateJoinery
    ? applyPresetJoinery(offsetPieces, params)
    : offsetPieces;
  return normalizeGeneratedPieces(pieces);
}

function buildBasicSourcePieces(params) {
  if (params.modelType === "cube") {
    const cubeParams = { ...params, width: params.length, height: params.length };
    return buildCuboidSourcePieces(cubeParams);
  }
  if (params.modelType === "cuboid") return buildCuboidSourcePieces(params);
  if (params.modelType === "gable_house") return buildHouseSourcePieces(params);
  return [];
}

function buildCuboidSourcePieces(params) {
  return [
    sampleRectPiece("top", params.length, params.width),
    sampleRectPiece("bottom", params.length, params.width),
    sampleRectPiece("front", params.length, params.height),
    sampleRectPiece("back", params.length, params.height),
    sampleRectPiece("left", params.width, params.height),
    sampleRectPiece("right", params.width, params.height)
  ];
}

function buildHouseSourcePieces(params) {
  const roofSlopeLength = Math.hypot(params.width / 2, params.roofHeight);
  return [
    sampleRectPiece("floor", params.length, params.width),
    sampleRectPiece("left_wall", params.length, params.wallHeight),
    sampleRectPiece("right_wall", params.length, params.wallHeight),
    sampleGablePiece("front_gable", params.width, params.wallHeight, params.roofHeight),
    sampleGablePiece("back_gable", params.width, params.wallHeight, params.roofHeight),
    sampleRectPiece("roof_left", params.length, roofSlopeLength),
    sampleRectPiece("roof_right", params.length, roofSlopeLength)
  ];
}

function sampleRectPiece(name, width, height) {
  const path = rectPath(0, 0, width, height);
  path.closed = true;
  return {
    name,
    layer: "CUT",
    paths: [path],
    width,
    height
  };
}

function sampleGablePiece(name, width, wallHeight, roofHeight) {
  const totalHeight = wallHeight + roofHeight;
  const path = [
    { x: 0, y: totalHeight },
    { x: width, y: totalHeight },
    { x: width, y: roofHeight },
    { x: width / 2, y: 0 },
    { x: 0, y: roofHeight }
  ];
  path.closed = true;
  return {
    name,
    layer: "CUT",
    paths: [path],
    width,
    height: totalHeight
  };
}

function applyPresetJoinery(pieces, params) {
  return pieces.map((piece) => {
    const edgeTypes = presetEdgeTypes(piece.name, params);
    const paths = piece.paths.map((path, index) => {
      const sourcePath = piece.sourcePaths?.[index];
      if (!sourcePath || sourcePath.closed === false || path.closed === false) return clonePath(path);
      const joinedPath = fingerJointPolygonPath(path, edgeTypes, params, sourcePath);
      joinedPath.closed = true;
      return joinedPath;
    });
    return { ...piece, paths };
  });
}

function presetEdgeTypes(name, params) {
  if (["top", "bottom"].includes(name)) return "ffff";
  if (["front", "back"].includes(name)) return "FFFF";
  if (["left", "right"].includes(name)) return "FfFf";
  if (name === "floor") return "ffff";
  if (["left_wall", "right_wall"].includes(name)) return "FfFf";
  if (name === "roof_left") return "ffff";
  if (name === "roof_right") return "Ffff";
  if (["front_gable", "back_gable"].includes(name)) return "FFFFF";
  return "eeee";
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
  if (params.modelType === "gable_house") {
    warnings.push("雙斜屋頂第一版採外蓋式屋頂與簡化卡榫定位。");
  }
  return warnings;
}

function offsetReferenceValidationMessages(pieces, params) {
  if (params.generateJoinery) return [];
  if (params.dimensionMode !== "inner") return [];
  if (!["cube", "cuboid", "gable_house"].includes(params.modelType)) return [];

  const guides = pieces
    .map((piece) => innerGuideForPiece(piece, params))
    .filter(Boolean);
  const innerPathCount = guides.reduce((sum, guide) => sum + guidePathCount(guide), 0);
  const offsetPathCount = guides.reduce((sum, guide) => sum + guidePathCount(guide), 0);
  const thickness = formatGuideNumber(params.materialThickness);
  if (innerPathCount === offsetPathCount) {
    return [`offset 驗算：${innerPathCount} 個內尺寸圖形都有 +${thickness}mm 灰色參考線`];
  }
  return [`offset 驗算：${offsetPathCount}/${innerPathCount} 個灰色參考線，請檢查遺漏`];
}

function joineryValidationMessages(params) {
  if (params.modelType !== "gable_house" || !params.generateJoinery) return [];

  const checks = validateHouseJoinery(params);
  const failures = checks.filter((check) => !check.ok);
  const summary = failures.length
    ? `接榫驗算：${checks.length} 組中有 ${failures.length} 組不通過`
    : `接榫驗算：${checks.length} 組全部通過`;

  return [
    summary,
    ...checks.map((check) => {
      const status = check.ok ? "OK" : "FAIL";
      const reason = check.ok ? "" : `；原因：${check.reason}`;
      return `${status} ${check.name}：類型 ${check.a.type}/${check.b.type}，凹凸數量 ${check.a.count}/${check.b.count}，接合長度 ${formatGuideNumber(check.a.guideLength)}/${formatGuideNumber(check.b.guideLength)}${reason}`;
    })
  ];
}

function validateHouseJoinery(params) {
  const dimensions = houseDimensions(params);
  const roofSlopeLength = Math.hypot(dimensions.width / 2, params.roofHeight);
  const floorEdges = "ffff";
  const wallEdges = "FfFf";
  const roofLeftEdges = "ffff";
  const roofRightEdges = "Ffff";
  const gableEdges = "FFFFF";

  const edge = (piece, edgeName, type, guideLength) => ({
    piece,
    edgeName,
    type,
    guideLength,
    count: countForJoineryGuide(guideLength, type, params)
  });

  const rectEdge = (piece, edgeName, edges, width, height, guideLengths = {}) => {
    const edgeIndex = { top: 0, right: 1, bottom: 2, left: 3 }[edgeName];
    const baseLength = edgeName === "top" || edgeName === "bottom" ? width : height;
    return edge(piece, edgeName, edges[edgeIndex], guideLengths[edgeName] ?? baseLength);
  };

  const floor = (edgeName) => rectEdge("Bottom", edgeName, floorEdges, dimensions.length, dimensions.width, {
    top: params.length,
    right: dimensions.width,
    bottom: params.length,
    left: dimensions.width
  });
  const leftWall = (edgeName) => rectEdge("Left", edgeName, wallEdges, dimensions.length, params.wallHeight, {
    top: params.length,
    bottom: params.length
  });
  const rightWall = (edgeName) => rectEdge("Right", edgeName, wallEdges, dimensions.length, params.wallHeight, {
    top: params.length,
    bottom: params.length
  });
  const roofLeft = (edgeName) => rectEdge("Roof L", edgeName, roofLeftEdges, dimensions.length, roofSlopeLength, {
    top: params.length,
    bottom: params.length
  });
  const roofRight = (edgeName) => rectEdge("Roof R", edgeName, roofRightEdges, dimensions.length, roofSlopeLength, {
    top: params.length,
    bottom: params.length
  });
  const gable = (piece, edgeName, edgeIndex, guideLength) => edge(piece, edgeName, gableEdges[edgeIndex], guideLength);

  const gableBottom = dimensions.width;
  const gableSide = params.wallHeight;
  const gableSlope = roofSlopeLength;
  const pairs = [
    ["Bottom.top <-> Left.bottom", floor("top"), leftWall("bottom")],
    ["Bottom.bottom <-> Right.bottom", floor("bottom"), rightWall("bottom")],
    ["Bottom.left <-> Front.bottom", floor("left"), gable("Front", "bottom", 0, gableBottom)],
    ["Bottom.right <-> Back.bottom", floor("right"), gable("Back", "bottom", 0, gableBottom)],
    ["Left.left <-> Front.left", leftWall("left"), gable("Front", "left wall", 4, gableSide)],
    ["Left.right <-> Back.left", leftWall("right"), gable("Back", "left wall", 4, gableSide)],
    ["Right.left <-> Front.right", rightWall("left"), gable("Front", "right wall", 1, gableSide)],
    ["Right.right <-> Back.right", rightWall("right"), gable("Back", "right wall", 1, gableSide)],
    ["Roof L.top <-> Roof R.top", roofLeft("top"), roofRight("top")],
    ["Roof L.left <-> Front.left roof", roofLeft("left"), gable("Front", "left roof", 3, gableSlope)],
    ["Roof L.right <-> Back.left roof", roofLeft("right"), gable("Back", "left roof", 3, gableSlope)],
    ["Roof R.left <-> Front.right roof", roofRight("left"), gable("Front", "right roof", 2, gableSlope)],
    ["Roof R.right <-> Back.right roof", roofRight("right"), gable("Back", "right roof", 2, gableSlope)]
  ];

  return pairs.map(([name, a, b]) => {
    const complementary = isComplementary(a.type, b.type);
    const sameCount = a.count === b.count;
    const sameLength = Math.abs(a.guideLength - b.guideLength) < 0.001;
    const reasons = [];
    if (!complementary) reasons.push("凹凸方向不是互補");
    if (!sameCount) reasons.push("凹凸數量不同");
    if (!sameLength) reasons.push("接合長度不同");
    return {
      name,
      a,
      b,
      ok: complementary && sameCount && sameLength,
      reason: reasons.join("; ")
    };
  });
}

function countForJoineryGuide(length, type, params) {
  const direction = type === "f" ? 1 : type === "F" ? -1 : 0;
  if (!direction) return 0;
  const cornerClearance = Math.min(length / 3, Math.max(params.materialThickness, params.tabDepth, params.tabWidth));
  return calcFingerCount(Math.max(0, length - cornerClearance * 2), params);
}

function isComplementary(a, b) {
  return (a === "f" && b === "F") || (a === "F" && b === "f");
}

function buildBoxPieces(length, width, height, params, reserveJoineryMargin = false) {
  const topEdges = params.generateJoinery ? "ffff" : "eeee";
  const longWallEdges = params.generateJoinery ? "FFFF" : "eeee";
  const shortWallEdges = params.generateJoinery ? "FfFf" : "eeee";
  return [
    rectPiece("top", length, width, params, topEdges, reserveJoineryMargin),
    rectPiece("bottom", length, width, params, topEdges, reserveJoineryMargin),
    rectPiece("front", length, height, params, longWallEdges, reserveJoineryMargin),
    rectPiece("back", length, height, params, longWallEdges, reserveJoineryMargin),
    rectPiece("left", width, height, params, shortWallEdges, reserveJoineryMargin),
    rectPiece("right", width, height, params, shortWallEdges, reserveJoineryMargin)
  ];
}

function buildInnerBoxPieces(innerLength, innerWidth, innerHeight, params, reserveJoineryMargin = false) {
  const thickness = params.materialThickness;
  const outerLength = innerLength + thickness * 2;
  const outerWidth = innerWidth + thickness * 2;
  const outerHeight = innerHeight + thickness * 2;
  return buildBoxPieces(
    outerLength,
    outerWidth,
    outerHeight,
    params,
    reserveJoineryMargin
  );
}

function buildDimensionedBoxPieces(length, width, height, params, reserveJoineryMargin = false) {
  if (params.dimensionMode === "inner") {
    return buildInnerBoxPieces(length, width, height, params, reserveJoineryMargin);
  }
  return buildBoxPieces(length, width, height, params, reserveJoineryMargin);
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
  if (params.dimensionMode !== "inner") {
    return { radius: params.radius };
  }
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
  const wallEdges = params.generateJoinery ? "FfFf" : "eeee";
  const roofLeftEdges = params.generateJoinery ? "ffff" : "eeee";
  const roofRightEdges = params.generateJoinery ? "Ffff" : "eeee";
  return [
    rectPiece("floor", dimensions.length, dimensions.width, params, floorEdges),
    rectPiece("left_wall", dimensions.length, params.wallHeight, params, wallEdges),
    rectPiece("right_wall", dimensions.length, params.wallHeight, params, wallEdges),
    gablePiece("front_gable", dimensions.width, params.wallHeight, params.roofHeight, params),
    gablePiece("back_gable", dimensions.width, params.wallHeight, params.roofHeight, params),
    rectPiece("roof_left", dimensions.length, roofSlopeLength, params, roofLeftEdges),
    rectPiece("roof_right", dimensions.length, roofSlopeLength, params, roofRightEdges)
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

function rectPiece(name, width, height, params, edges = "eeee", reserveJoineryMargin = false) {
  const hasJoinery = /[fF]/.test(edges);
  const margin = hasJoinery || reserveJoineryMargin ? params.tabDepth : 0;
  const edgeGuides = innerEdgeGuidesForRectPiece(name, width, height, params);
  const path = hasJoinery
    ? fingerJointRectPath(margin, margin, width, height, edges, params, edgeGuides)
    : rectPath(margin, margin, width, height);
  return {
    name,
    layer: "CUT",
    paths: [path],
    width: width + margin * 2,
    height: height + margin * 2
  };
}

function innerEdgeGuidesForRectPiece(name, width, height, params) {
  if (params.dimensionMode !== "inner") return null;

  const thickness = params.materialThickness;
  const full = {
    horizontal: { start: 0, length: width },
    vertical: { start: 0, length: height }
  };

  if (["top", "bottom", "floor"].includes(name)) {
    if (name === "floor" && params.modelType === "gable_house") {
      return {
        horizontal: { start: thickness, length: params.length },
        vertical: { start: 0, length: height }
      };
    }
    return {
      horizontal: { start: thickness, length: params.length },
      vertical: { start: thickness, length: params.width }
    };
  }

  if (["front", "back", "left_wall", "right_wall", "roof_left", "roof_right"].includes(name)) {
    return {
      horizontal: { start: thickness, length: params.length },
      vertical: full.vertical
    };
  }

  if (["left", "right"].includes(name)) {
    return {
      horizontal: { start: thickness, length: params.width },
      vertical: full.vertical
    };
  }

  return full;
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
  const path = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
  path.closed = true;
  return path;
}

function offsetImportedPiecesForMaterial(pieces, params, warnings = []) {
  if (params.dimensionMode !== "inner") return pieces;

  const thickness = params.materialThickness;
  return pieces.map((piece) => {
    const nextPaths = [];
    const sourcePaths = [];
    let usedOffset = false;

    for (const path of piece.paths) {
      const source = clonePath(path);
      sourcePaths.push(source);

      const offsetPath = offsetClosedPath(path, thickness);
      if (offsetPath) {
        nextPaths.push(offsetPath);
        usedOffset = true;
      } else {
        nextPaths.push(clonePath(path));
      }
    }

    if (!usedOffset && piece.paths.some(path => path.closed !== false)) {
      warnings.push(`${piece.name}: imported outline could not be offset automatically.`);
    }

    const bounds = getBoundsFromPaths([{ ...piece, x: 0, y: 0, paths: nextPaths }]);
    return {
      ...piece,
      originalName: piece.originalName || piece.name,
      width: bounds.width,
      height: bounds.height,
      paths: nextPaths,
      offsetReferencePaths: nextPaths.map(clonePath),
      sourcePaths
    };
  });
}

function normalizeGeneratedPieces(pieces) {
  return pieces.map((piece) => {
    const bounds = getBoundsFromPaths([{ ...piece, x: 0, y: 0 }]);
    const paths = piece.paths.map(path => translatePath(path, -bounds.minX, -bounds.minY));
    const sourcePaths = (piece.sourcePaths || piece.paths).map(path => translatePath(path, -bounds.minX, -bounds.minY));
    const offsetReferencePaths = (piece.offsetReferencePaths || piece.paths).map(path => translatePath(path, -bounds.minX, -bounds.minY));
    return {
      ...piece,
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
      paths,
      offsetReferencePaths,
      sourcePaths
    };
  });
}

function translatePath(path, dx, dy) {
  const copy = path.map(point => ({ x: point.x + dx, y: point.y + dy }));
  copy.closed = path.closed !== false;
  return copy;
}

function clonePath(path) {
  const copy = path.map(point => ({ x: point.x, y: point.y }));
  copy.closed = path.closed !== false;
  return copy;
}

function offsetClosedPath(path, amount) {
  if (path.closed === false || path.length < 3) return null;

  if (path.length === 4) {
    const rect = offsetRectangularPath(path, amount);
    if (rect) return rect;
  }

  return offsetPolygonPath(path, amount);
}

function offsetRectangularPath(path, amount) {
  const bounds = getPathBounds(path);
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ];
  const matches = path.every(point => corners.some(corner => samePoint(point, corner)));
  if (!matches) return null;

  const expanded = [
    { x: bounds.minX - amount, y: bounds.minY - amount },
    { x: bounds.maxX + amount, y: bounds.minY - amount },
    { x: bounds.maxX + amount, y: bounds.maxY + amount },
    { x: bounds.minX - amount, y: bounds.maxY + amount }
  ];
  expanded.closed = true;
  return expanded;
}

function offsetPolygonPath(path, amount) {
  const area = signedPolygonArea(path);
  if (Math.abs(area) < 0.0001) return null;

  const offsetEdges = path.map((start, index) => {
    const end = path[(index + 1) % path.length];
    const normal = edgeOutwardNormal(start, end, area);
    return {
      start: offsetBy(start, normal, amount),
      end: offsetBy(end, normal, amount)
    };
  });

  const expanded = path.map((_, index) => {
    const previous = offsetEdges[(index - 1 + offsetEdges.length) % offsetEdges.length];
    const current = offsetEdges[index];
    return lineIntersection(previous.start, previous.end, current.start, current.end);
  });

  if (expanded.some(point => !point)) return null;
  expanded.closed = true;
  return expanded;
}

function lineIntersection(a1, a2, b1, b2) {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const denominator = dax * dby - day * dbx;
  if (Math.abs(denominator) < 0.0001) return null;

  const bax = b1.x - a1.x;
  const bay = b1.y - a1.y;
  const t = (bax * dby - bay * dbx) / denominator;
  return {
    x: a1.x + dax * t,
    y: a1.y + day * t
  };
}

function samePoint(a, b, tolerance = 0.0001) {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

function getPathBounds(path) {
  const xs = path.map(point => point.x);
  const ys = path.map(point => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function getBoundsFromPaths(pieces) {
  const points = [];
  for (const piece of pieces) {
    for (const path of piece.paths || []) {
      for (const point of path) {
        points.push({ x: (piece.x || 0) + point.x, y: (piece.y || 0) + point.y });
      }
    }
  }
  if (!points.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  const bounds = getPathBounds(points);
  return bounds.width || bounds.height ? bounds : { ...bounds, width: 1, height: 1 };
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

function fingerJointRectPath(x, y, width, height, edges, params, edgeGuides = null) {
  const points = [];
  const [top = "e", right = "e", bottom = "e", left = "e"] = edges;
  addFingerEdge(points, { x, y }, { x: x + width, y }, { x: 0, y: -1 }, top, params, edgeGuides?.horizontal);
  addFingerEdge(points, { x: x + width, y }, { x: x + width, y: y + height }, { x: 1, y: 0 }, right, params, edgeGuides?.vertical);
  addFingerEdge(points, { x: x + width, y: y + height }, { x, y: y + height }, { x: 0, y: 1 }, bottom, params, edgeGuides?.horizontal);
  addFingerEdge(points, { x, y: y + height }, { x, y }, { x: -1, y: 0 }, left, params, edgeGuides?.vertical);
  return points;
}

function fingerJointPolygonPath(vertices, edgeTypes, params, innerVertices = null, edgeLayouts = null) {
  const points = [];
  const area = signedPolygonArea(vertices);
  const hasInnerGuide = innerVertices
    && innerVertices.length === vertices.length
    && innerVertices.closed !== false;

  for (let i = 0; i < vertices.length; i += 1) {
    const start = vertices[i];
    const end = vertices[(i + 1) % vertices.length];
    const type = edgeTypes[i] || "e";
    if (hasInnerGuide && (type === "f" || type === "F")) {
      const edgePoints = guidedFingerEdgePoints(
        innerVertices[i],
        innerVertices[(i + 1) % innerVertices.length],
        start,
        end,
        type,
        params,
        edgeLayouts?.[i]
      );
      appendEdgePoints(points, edgePoints, params);
    } else {
      const outward = edgeOutwardNormal(start, end, area);
      const beforeLength = points.length;
      addFingerEdge(points, start, end, outward, type, params);
      if (beforeLength > 0) {
        const added = points.splice(beforeLength);
        appendEdgePoints(points, added, params);
      }
    }
  }

  if (points.length > 1) appendCornerBridge(points, points[0], params);
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) points.pop();
  points.closed = true;
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

function addFingerEdge(points, start, end, outward, type, params, guide = null) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const dx = (end.x - start.x) / length;
  const dy = (end.y - start.y) / length;
  const direction = type === "f" ? 1 : type === "F" ? -1 : 0;
  const fingerWidth = type === "F" ? params.tabWidth + params.kerfWidth : params.tabWidth;
  const baseGuideStart = Math.max(0, Math.min(length, guide?.start ?? 0));
  const baseGuideLength = Math.max(0, Math.min(length - baseGuideStart, guide?.length ?? length));
  const baseGuideEnd = baseGuideStart + baseGuideLength;
  const cornerClearance = direction
    ? Math.min(baseGuideLength / 3, Math.max(params.materialThickness, params.tabDepth, params.tabWidth))
    : 0;
  const guideStart = baseGuideStart + cornerClearance;
  const guideEnd = baseGuideEnd - cornerClearance;
  const guideLength = Math.max(0, guideEnd - guideStart);
  const count = calcFingerCount(guideLength, params);
  const occupiedTabs = count * fingerWidth;
  const fittedSpacing = count > 1
    ? Math.max(0, (guideLength - occupiedTabs) / (count - 1))
    : 0;
  const inset = count > 1
    ? guideStart
    : guideStart + Math.max(0, (guideLength - fingerWidth) / 2);

  pushPoint(points, start);

  if (!direction || count <= 0) {
    pushPoint(points, end);
    return;
  }

  for (let i = 0; i < count; i += 1) {
    const tabStart = inset + i * (fingerWidth + fittedSpacing);
    const tabEnd = Math.min(tabStart + fingerWidth, guideEnd);
    if (tabEnd <= tabStart || tabStart >= guideEnd) continue;

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

function guidedFingerEdgePoints(innerStart, innerEnd, outerStart, outerEnd, type, params, layoutOverride = null) {
  const length = Math.hypot(innerEnd.x - innerStart.x, innerEnd.y - innerStart.y);
  if (!length) return [];

  const dx = (innerEnd.x - innerStart.x) / length;
  const dy = (innerEnd.y - innerStart.y) / length;
  const outward = guidedEdgeOutwardNormal(dx, dy, innerStart, innerEnd, outerStart, outerEnd);
  const offsetDistance = params.materialThickness || Math.hypot(outerStart.x - innerStart.x, outerStart.y - innerStart.y) || 1;
  const grayStart = offsetBy(innerStart, outward, offsetDistance);
  const grayEnd = offsetBy(innerEnd, outward, offsetDistance);
  const baseStart = type === "f" ? innerStart : grayStart;
  const baseEnd = type === "f" ? innerEnd : grayEnd;
  const jointStart = type === "f" ? grayStart : innerStart;
  const edgeStart = type === "f" ? innerStart : grayStart;
  const edgeEnd = type === "f" ? innerEnd : grayEnd;
  const layout = layoutOverride || buildSharedLayoutsForLength(length, params)[type];
  const count = layout.count;
  const firstRun = layout.runs[0];
  const lastRun = layout.runs[layout.runs.length - 1];
  const guideStart = firstRun?.start ?? layout.endMargin;
  const guideEnd = lastRun?.end ?? Math.max(0, length - layout.endMargin);

  const points = [];
  pushPoint(points, edgeStart);
  if (type === "f") pushPoint(points, along(baseStart, dx, dy, guideStart));

  if (count <= 0) {
    if (type === "f") pushPoint(points, along(baseStart, dx, dy, guideEnd));
    pushPoint(points, edgeEnd);
    return points;
  }

  for (const run of layout.runs) {
    const a = along(baseStart, dx, dy, run.start);
    const b = along(baseStart, dx, dy, run.end);
    const aj = along(jointStart, dx, dy, run.start);
    const bj = along(jointStart, dx, dy, run.end);
    pushPoint(points, a);
    pushPoint(points, aj);
    pushPoint(points, bj);
    pushPoint(points, b);
  }

  if (type === "f") {
    pushPoint(points, along(baseStart, dx, dy, guideEnd));
  }
  pushPoint(points, edgeEnd);
  return points;
}

function guidedEdgeOutwardNormal(dx, dy, innerStart, innerEnd, outerStart, outerEnd) {
  const candidateA = { x: dy, y: -dx };
  const candidateB = { x: -dy, y: dx };
  const offsetHint = {
    x: ((outerStart.x - innerStart.x) + (outerEnd.x - innerEnd.x)) / 2,
    y: ((outerStart.y - innerStart.y) + (outerEnd.y - innerEnd.y)) / 2
  };
  const scoreA = candidateA.x * offsetHint.x + candidateA.y * offsetHint.y;
  const scoreB = candidateB.x * offsetHint.x + candidateB.y * offsetHint.y;
  return scoreA >= scoreB ? candidateA : candidateB;
}

function appendEdgePoints(points, edgePoints, params) {
  if (!edgePoints.length) return;
  if (points.length) appendCornerBridge(points, edgePoints[0], params);
  for (const point of edgePoints) pushPoint(points, point);
}

function appendCornerBridge(points, nextPoint, params) {
  const previous = points[points.length - 1];
  if (!previous || !nextPoint || samePoint(previous, nextPoint)) return;
  const dx = Math.abs(previous.x - nextPoint.x);
  const dy = Math.abs(previous.y - nextPoint.y);
  const materialThickness = params.materialThickness || 3;
  const cornerTolerance = materialThickness * 1.5 + 0.01;
  if (dx > 0.0001 && dy > 0.0001 && dx <= cornerTolerance && dy <= cornerTolerance) {
    pushPoint(points, { x: nextPoint.x, y: previous.y });
  }
}

function buildSharedLayoutsForLength(length, params) {
  const base = buildBoxesFingerLayout(length, "f", params);
  return {
    f: {
      ...base,
      runs: base.runs.map(run => ({ ...run }))
    },
    F: {
      ...base,
      runs: base.runs.map(run => expandRunForPlay(run, length, params.play || params.kerfWidth || 0))
    }
  };
}

function expandRunForPlay(run, length, play) {
  const halfPlay = Math.max(0, play) / 2;
  const start = Math.max(0, run.start - halfPlay);
  const end = Math.min(length, run.end + halfPlay);
  return {
    start,
    end,
    center: run.center,
    length: end - start
  };
}

function buildBoxesFingerLayout(length, type, params, fingerWidth = params.tabWidth) {
  const materialThickness = params.materialThickness || 3;
  const finger = Math.max(0, params.tabWidth || materialThickness * 2);
  const space = Math.max(0, params.tabSpacing || finger);
  const play = type === "F" ? (params.play || params.kerfWidth || 0) : 0;
  const effectiveFinger = type === "F" ? fingerWidth + play : fingerWidth;
  const effectiveSpace = Math.max(0, type === "F" ? space - play : space);
  const count = calcFingerCount(length, params);
  const runs = [];

  if (count <= 0 || length <= 0 || effectiveFinger <= 0) {
    return { count: 0, runs, endMargin: length / 2, internalSpace: 0 };
  }

  const nonFingerLength = Math.max(0, length - count * effectiveFinger);
  const mode = params.endMarginMode || "boxes";
  let endMargin = 0;
  let internalSpace = effectiveSpace;

  if (mode === "minimized" && count > 1) {
    endMargin = Math.min(materialThickness, nonFingerLength / 2);
    internalSpace = Math.max(0, (nonFingerLength - endMargin * 2) / (count - 1));
  } else if (mode === "distributed") {
    const gap = nonFingerLength / (count + 1);
    endMargin = gap;
    internalSpace = gap;
  } else {
    endMargin = Math.max(0, (nonFingerLength - Math.max(0, count - 1) * effectiveSpace) / 2);
    internalSpace = effectiveSpace;
  }

  if (count === 1) {
    endMargin = nonFingerLength / 2;
    internalSpace = 0;
  }

  for (let i = 0; i < count; i += 1) {
    const start = endMargin + i * (effectiveFinger + internalSpace);
    const end = Math.min(start + effectiveFinger, length);
    if (end <= start || start >= length) continue;
    runs.push({
      start,
      end,
      center: start + (end - start) / 2,
      length: end - start
    });
  }

  return { count, runs, endMargin, internalSpace };
}

function calcFingerCount(length, params) {
  const tabWidth = params.tabWidth || params.materialThickness * 2 || 0;
  const tabSpacing = params.tabSpacing || tabWidth;
  const surroundingSpaces = params.surroundingSpaces || params.surroundingspaces || 2;
  const pitch = tabWidth + tabSpacing;
  if (pitch <= 0 || tabWidth <= 0) return 0;
  let count = Math.floor((length - (surroundingSpaces - 1) * tabSpacing) / pitch);
  if (count === 0 && length > tabWidth + params.materialThickness) count = 1;
  return Math.max(0, count);
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

function layoutModelPieces(pieces, params) {
  if (["cube", "cuboid"].includes(params.modelType)) {
    return layoutFrontBoxNetPieces(pieces, params.partGap);
  }
  if (params.modelType === "gable_house") {
    return layoutHouseNetPieces(pieces, params.partGap);
  }
  return layoutPieces(pieces, params.partGap);
}

function layoutFrontBoxNetPieces(pieces, gap) {
  const byName = Object.fromEntries(pieces.map(piece => [piece.name, piece]));
  const top = byName.top;
  const bottom = byName.bottom;
  const front = byName.front;
  const back = byName.back;
  const left = byName.left;
  const right = byName.right;

  if (!top || !bottom || !front || !back || !left || !right) {
    return layoutPieces(pieces, gap);
  }

  const frontX = left.width + gap;
  const frontY = top.height + gap;
  const layout = [
    { ...top, x: frontX + (front.width - top.width) / 2, y: 0 },
    { ...left, x: 0, y: frontY + (front.height - left.height) / 2 },
    { ...front, x: frontX, y: frontY },
    { ...right, x: frontX + front.width + gap, y: frontY + (front.height - right.height) / 2 },
    { ...bottom, x: frontX + (front.width - bottom.width) / 2, y: frontY + front.height + gap },
    { ...back, x: frontX + (front.width - back.width) / 2, y: frontY + front.height + gap + bottom.height + gap }
  ];

  return normalizePiecePositions(layout);
}

function layoutCylinderNetPieces(pieces, gap) {
  const byName = Object.fromEntries(pieces.map(piece => [piece.name, piece]));
  const side = byName.side_living_hinge;
  const top = byName.top;
  const bottom = byName.bottom;
  if (!side || !top || !bottom) return layoutPieces(pieces, gap);

  const centerX = Math.max(top.width, side.width, bottom.width) / 2;
  return normalizePiecePositions([
    { ...top, x: centerX - top.width / 2, y: 0 },
    { ...side, x: centerX - side.width / 2, y: top.height + gap },
    { ...bottom, x: centerX - bottom.width / 2, y: top.height + gap + side.height + gap }
  ]);
}

function layoutFlexBoxNetPieces(pieces, gap) {
  const byName = Object.fromEntries(pieces.map(piece => [piece.name, piece]));
  const top = byName.top_rounded_panel;
  const bottom = byName.bottom_rounded_panel;
  const side = byName.flex_living_hinge_side;
  const front = byName.front_latch;
  if (!top || !bottom || !side || !front) return layoutPieces(pieces, gap);

  const centerX = Math.max(top.width, bottom.width, side.width, front.width) / 2;
  return normalizePiecePositions([
    { ...top, x: centerX - top.width / 2, y: 0 },
    { ...side, x: centerX - side.width / 2, y: top.height + gap },
    { ...bottom, x: centerX - bottom.width / 2, y: top.height + gap + side.height + gap },
    { ...front, x: centerX - front.width / 2, y: top.height + gap + side.height + gap + bottom.height + gap }
  ]);
}

function layoutHouseNetPieces(pieces, gap) {
  const byName = Object.fromEntries(pieces.map(piece => [piece.name, piece]));
  const floor = byName.floor;
  const left = byName.left_wall;
  const right = byName.right_wall;
  const front = byName.front_gable;
  const back = byName.back_gable;
  const roofLeft = byName.roof_left;
  const roofRight = byName.roof_right;
  if (!floor || !left || !right || !front || !back || !roofLeft || !roofRight) {
    return layoutPieces(pieces, gap);
  }

  const roofGroupWidth = roofLeft.width + gap + roofRight.width;
  const middleWidth = left.width + gap + front.width + gap + right.width;
  const centerX = Math.max(roofGroupWidth, middleWidth, floor.width, back.width) / 2;
  const roofY = 0;
  const middleY = Math.max(roofLeft.height, roofRight.height) + gap;
  const floorY = middleY + front.height + gap;
  const backY = floorY + floor.height + gap;
  const middleX = centerX - middleWidth / 2;

  return normalizePiecePositions([
    { ...roofLeft, x: centerX - roofGroupWidth / 2, y: roofY },
    { ...roofRight, x: centerX - roofGroupWidth / 2 + roofLeft.width + gap, y: roofY },
    { ...left, x: middleX, y: middleY + (front.height - left.height) / 2 },
    { ...front, x: middleX + left.width + gap, y: middleY },
    { ...right, x: middleX + left.width + gap + front.width + gap, y: middleY + (front.height - right.height) / 2 },
    { ...floor, x: centerX - floor.width / 2, y: floorY },
    { ...back, x: centerX - back.width / 2, y: backY }
  ]);
}

function normalizePiecePositions(pieces) {
  const minX = Math.min(...pieces.map(piece => piece.x));
  const minY = Math.min(...pieces.map(piece => piece.y));
  return pieces.map(piece => ({
    ...piece,
    x: piece.x - minX,
    y: piece.y - minY
  }));
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
  state.baseViewBox = {
    x: -padding,
    y: -padding,
    width: Math.max(result.bounds.width + padding * 2, 1),
    height: Math.max(result.bounds.height + padding * 2, 1)
  };
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  updatePreviewZoom();

  addSvgStyles();
  const canUseInnerGuides = ["cube", "cuboid", "gable_house"].includes(result.params.modelType);
  const showCutPaths = result.params.generateJoinery || result.params.dimensionMode !== "inner" || !canUseInnerGuides;
  const showAsOffsetPreview = result.params.dimensionMode !== "inner" || !canUseInnerGuides;
  setLayerLegendVisibility({
    offset: result.params.dimensionMode === "inner" && canUseInnerGuides,
    cut: result.params.generateJoinery
  });

  renderInnerDimensionGuides(result);
  renderOffsetReferenceGuides(result);

  if (showCutPaths) {
    const cutGroup = createSvgElement("g", {
      class: showAsOffsetPreview ? "offset-reference-preview" : "svg-cut"
    });
    els.previewSvg.appendChild(cutGroup);

    for (const piece of result.pieces) {
      for (const path of piece.paths) {
        cutGroup.appendChild(createSvgElement("path", {
          d: pathToD(path, piece.x, piece.y),
          fill: "none",
          stroke: showAsOffsetPreview ? "#94a3b8" : "#ff0000",
          "stroke-linejoin": "miter",
          "stroke-linecap": "square",
          "vector-effect": "non-scaling-stroke",
          "stroke-width": previewStrokeWidth(result.params)
        }));
      }
    }
  }
  renderPieceLabels(result.pieces);

  els.widthMetric.textContent = formatNumber(result.bounds.width);
  els.heightMetric.textContent = formatNumber(result.bounds.height);
  els.pathMetric.textContent = String(result.pieces.length);
  renderWarnings(result.warnings);
}

function setLayerLegendVisibility({ offset, cut }) {
  const offsetLegend = document.querySelector(".legend .offset");
  const cutLegend = document.querySelector(".legend .cut");
  if (offsetLegend) offsetLegend.hidden = !offset;
  if (cutLegend) cutLegend.hidden = !cut;
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
    .offset-reference-preview path {
      fill: none;
      stroke: #94a3b8;
      stroke-linejoin: miter;
      stroke-linecap: square;
    }
    .piece-label-overlay text {
      fill: #ff0000;
      font-family: Arial, sans-serif;
      font-size: 10px;
      font-weight: 700;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }
    .inner-dimension-guides path,
    .inner-dimension-guides line {
      fill: none;
      stroke: #111827;
      stroke-linejoin: miter;
      stroke-linecap: square;
      vector-effect: non-scaling-stroke;
      stroke-width: 1.2;
      pointer-events: none;
    }
    .offset-dimension-guides path {
      fill: none;
      stroke: #94a3b8;
      stroke-linejoin: miter;
      stroke-linecap: square;
      vector-effect: non-scaling-stroke;
      stroke-width: 1;
      pointer-events: none;
    }
  `;
  els.previewSvg.appendChild(style);
}

function renderOffsetReferenceGuides(result) {
  if (result.params.dimensionMode !== "inner") return;
  if (!["cube", "cuboid", "gable_house"].includes(result.params.modelType)) return;

  const group = createSvgElement("g", { class: "offset-dimension-guides" });
  let guideCount = 0;
  for (const piece of result.pieces) {
    for (const path of piece.offsetReferencePaths || piece.paths || []) {
      group.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y)
      }));
      guideCount += 1;
    }
  }
  if (guideCount) els.previewSvg.appendChild(group);
}

function renderInnerDimensionGuides(result) {
  if (!["cube", "cuboid", "gable_house"].includes(result.params.modelType)) return;

  const group = createSvgElement("g", { class: "inner-dimension-guides" });
  let guideCount = 0;
  for (const piece of result.pieces) {
    if (piece.sourcePaths?.length) {
      for (const path of piece.sourcePaths) {
        group.appendChild(createSvgElement("path", {
          d: pathToD(path, piece.x, piece.y)
        }));
      }
      guideCount += 1;
      continue;
    }

    const guide = innerGuideForPiece(piece, result.params);
    if (!guide) continue;
    for (const pathD of guidePathDs(piece, guide, 0)) {
      group.appendChild(createSvgElement("path", { d: pathD }));
    }
    guideCount += 1;
  }
  if (guideCount) els.previewSvg.appendChild(group);
}

function innerGuideForPiece(piece, params) {
  const depth = params.tabDepth;
  const innerLength = params.length;
  const innerWidth = params.width;
  const innerHeight = ["cube", "cuboid"].includes(params.modelType) ? params.height : params.wallHeight;
  const centerInset = (outerSize, innerSize) => Math.max(0, (outerSize - innerSize) / 2);
  const guideX = centerInset(piece.width, innerLength);
  const guideY = centerInset(piece.height, innerHeight);
  const guideWidthX = centerInset(piece.width, innerWidth);
  const guideWidthY = centerInset(piece.height, innerWidth);

  if (["top", "bottom", "floor"].includes(piece.name)) {
    return {
      x: guideX,
      y: guideWidthY,
      width: innerLength,
      height: innerWidth,
      label: `${formatGuideNumber(innerLength)} x ${formatGuideNumber(innerWidth)}`
    };
  }

  if (["front", "back"].includes(piece.name)) {
    return {
      x: guideX,
      y: guideY,
      width: innerLength,
      height: innerHeight,
      label: `${formatGuideNumber(innerLength)} x ${formatGuideNumber(innerHeight)}`
    };
  }

  if (["left_wall", "right_wall", "roof_left", "roof_right"].includes(piece.name)) {
    return {
      x: guideX,
      y: guideY,
      width: innerLength,
      height: innerHeight,
      label: `${formatGuideNumber(innerLength)} x ${formatGuideNumber(innerHeight)}`
    };
  }

  if (["front_gable", "back_gable"].includes(piece.name)) {
    const y = Math.max(0, piece.height - depth - innerHeight);
    return {
      x: guideWidthX,
      y,
      width: innerWidth,
      height: innerHeight,
      shape: "gable",
      apexY: Math.max(0, y - params.roofHeight + params.materialThickness * 2),
      label: `${formatGuideNumber(innerWidth)} x ${formatGuideNumber(innerHeight)}`
    };
  }

  if (["left", "right"].includes(piece.name)) {
    return {
      x: guideWidthX,
      y: guideY,
      width: innerWidth,
      height: innerHeight,
      label: `${formatGuideNumber(innerWidth)} x ${formatGuideNumber(innerHeight)}`
    };
  }

  return null;
}

function guidePathCount(guide) {
  return guide ? 1 : 0;
}

function guidePathDs(piece, guide, offset = 0) {
  if (guide.shape === "gable") {
    return [gableGuidePathD(piece, guide, offset)];
  }
  return [
    rectPathD(
      piece.x + guide.x - offset,
      piece.y + guide.y - offset,
      guide.width + offset * 2,
      guide.height + offset * 2
    )
  ];
}

function gableGuidePathD(piece, guide, offset = 0) {
  const x = piece.x + guide.x;
  const y = piece.y + guide.y;
  const left = x - offset;
  const right = x + guide.width + offset;
  const bottom = y + guide.height + offset;
  const wallTop = y + offset;
  const apexX = x + guide.width / 2;
  const apexY = piece.y + guide.apexY - offset;
  return [
    `M ${svgNum(left)} ${svgNum(bottom)}`,
    `L ${svgNum(right)} ${svgNum(bottom)}`,
    `L ${svgNum(right)} ${svgNum(wallTop)}`,
    `L ${svgNum(apexX)} ${svgNum(apexY)}`,
    `L ${svgNum(left)} ${svgNum(wallTop)}`,
    "Z"
  ].join(" ");
}

function rectPathD(x, y, width, height) {
  return [
    `M ${svgNum(x)} ${svgNum(y)}`,
    `L ${svgNum(x + width)} ${svgNum(y)}`,
    `L ${svgNum(x + width)} ${svgNum(y + height)}`,
    `L ${svgNum(x)} ${svgNum(y + height)}`,
    "Z"
  ].join(" ");
}

function formatGuideNumber(value) {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function formatVolumeNumber(value) {
  return Math.round(Number(value)).toLocaleString("en-US");
}

function formatInputNumber(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
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

function renderPieceLabels(pieces) {
  const group = createSvgElement("g", { class: "piece-label-overlay" });
  let labelCount = 0;
  for (const piece of pieces) {
    const label = pieceLabel(piece.name);
    if (!label) continue;
    group.appendChild(createSvgElement("text", {
      x: svgNum(piece.x + piece.width / 2),
      y: svgNum(piece.y + piece.height / 2 - labelOffsetForPiece(piece))
    })).textContent = label;
    labelCount += 1;
  }
  if (labelCount) els.previewSvg.appendChild(group);
}

function labelOffsetForPiece(piece) {
  return Math.min(18, Math.max(12, piece.height * 0.24));
}

function pieceLabel(name) {
  const labels = {
    top: "Top",
    bottom: "Bottom",
    front: "Front",
    back: "Back",
    left: "Left",
    right: "Right",
    floor: "Bottom",
    left_wall: "Left",
    right_wall: "Right",
    front_gable: "Front",
    back_gable: "Back",
    roof_left: "Roof L",
    roof_right: "Roof R"
  };
  return labels[name] || "";
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

function updateFieldVisibility() {
  const type = els.modelType.value;
  const house = type === "gable_house";
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
  els.tabWidth.value = "12";
  els.tabDepth.value = "3";
  els.tabSpacing.value = "12";
  els.partGap.value = "8";
  els.segments.value = "48";
  if (els.dimensionMode) els.dimensionMode.value = "inner";
  els.joineryToggle.checked = false;
  updateDimensionModeControls();
  updateJoineryModeControls();
  updateDefaultsForModel();
}

function previewStrokeWidth(params) {
  return Math.max(params.kerfWidth || 0.1, 0.8);
}

function updateJoineryModeControls() {
  if (!els.joineryModeButton || !els.joineryModeStatus) return;
  const enabled = els.joineryToggle.checked;
  els.joineryModeButton.setAttribute("aria-pressed", String(enabled));
  els.joineryModeButton.textContent = enabled ? "顯示沒有接榫" : "顯示接榫後";
  els.joineryModeStatus.textContent = enabled ? "目前：接榫後" : "目前：沒有接榫";
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

function toggleJoineryMode() {
  els.joineryToggle.checked = !els.joineryToggle.checked;
  updateJoineryModeControls();
  runConversion();
}

function runConversion() {
  els.statusPill.textContent = "Generating";
  updateFieldVisibility();
  updateDimensionModeControls();
  updateJoineryModeControls();
  const params = getParams();
  updateOuterDimensionStatus(params);
  state.result = buildResult(params);
  render(state.result);
  els.statusPill.textContent = "Ready";
}

function modelLabel(type) {
  const labels = {
    cube: "正立方體",
    cuboid: "長方體",
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

els.modelType.addEventListener("change", updateDefaultsForModel);
els.resetButton.addEventListener("click", resetParams);
els.joineryModeButton.addEventListener("click", toggleJoineryMode);
els.innerDimensionButton?.addEventListener("click", () => {
  if (els.dimensionMode) els.dimensionMode.value = "inner";
  updateDimensionModeControls();
  runConversion();
});
els.zoomOutButton?.addEventListener("click", () => setPreviewZoom(state.zoom - 0.25));
els.zoomInButton?.addEventListener("click", () => setPreviewZoom(state.zoom + 0.25));
els.zoomResetButton?.addEventListener("click", () => setPreviewZoom(1));

for (const input of document.querySelectorAll("input, select")) {
  if (input.id !== "modelType") {
    input.addEventListener("input", runConversion);
    input.addEventListener("change", runConversion);
  }
}

updateFieldVisibility();
runConversion();
