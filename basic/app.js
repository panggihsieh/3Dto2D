const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;

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
  projectName: document.querySelector("#projectName"),
  dimensionMode: document.querySelector("#dimensionMode"),
  innerDimensionButton: document.querySelector("#innerDimensionButton"),
  dimensionModeStatus: document.querySelector("#dimensionModeStatus"),
  outerDimensionStatus: document.querySelector("#outerDimensionStatus"),
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
  return {
    modelType: els.modelType.value,
    length: readNumber(els.length, 120),
    width: readNumber(els.width, 80),
    height: readNumber(els.height, 60),
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
    pieces.push(...buildDimensionedBoxPieces(side, side, side, params, true));
  }

  if (params.modelType === "cuboid") {
    pieces.push(...buildDimensionedBoxPieces(params.length, params.width, params.height, params, true));
  }

  if (params.modelType === "gable_house") {
    pieces.push(...buildHousePieces(params));
  }

  const laidOut = layoutModelPieces(pieces, params);
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
        horizontal: { start: Math.max(0, (width - params.width - thickness * 2) / 2), length: params.width + thickness * 2 },
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

function fingerJointRectPath(x, y, width, height, edges, params, edgeGuides = null) {
  const points = [];
  const [top = "e", right = "e", bottom = "e", left = "e"] = edges;
  addFingerEdge(points, { x, y }, { x: x + width, y }, { x: 0, y: -1 }, top, params, edgeGuides?.horizontal);
  addFingerEdge(points, { x: x + width, y }, { x: x + width, y: y + height }, { x: 1, y: 0 }, right, params, edgeGuides?.vertical);
  addFingerEdge(points, { x: x + width, y: y + height }, { x, y: y + height }, { x: 0, y: 1 }, bottom, params, edgeGuides?.horizontal);
  addFingerEdge(points, { x, y: y + height }, { x, y }, { x: -1, y: 0 }, left, params, edgeGuides?.vertical);
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
  const cutGroup = createSvgElement("g", {
    class: result.params.generateJoinery ? "svg-cut" : "offset-reference-preview"
  });
  els.previewSvg.appendChild(cutGroup);

  for (const piece of result.pieces) {
    for (const path of piece.paths) {
      cutGroup.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
        fill: "none",
        stroke: result.params.generateJoinery ? "#ff0000" : "#94a3b8",
        "stroke-linejoin": "miter",
        "stroke-linecap": "square",
        "vector-effect": "non-scaling-stroke",
        "stroke-width": previewStrokeWidth(result.params)
      }));
    }
  }
  renderPieceLabels(result.pieces);
  renderInnerDimensionGuides(result);

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
    .inner-dimension-guides text {
      fill: #111827;
      font-family: Arial, sans-serif;
      font-size: 8px;
      font-weight: 700;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }
  `;
  els.previewSvg.appendChild(style);
}

function renderInnerDimensionGuides(result) {
  if (!["cube", "cuboid", "gable_house"].includes(result.params.modelType)) return;

  const group = createSvgElement("g", { class: "inner-dimension-guides" });
  let guideCount = 0;
  for (const piece of result.pieces) {
    const guide = innerGuideForPiece(piece, result.params);
    if (!guide) continue;
    group.appendChild(createSvgElement("path", {
      d: rectPathD(piece.x + guide.x, piece.y + guide.y, guide.width, guide.height)
    }));
    group.appendChild(createSvgElement("text", {
      x: svgNum(piece.x + guide.x + guide.width / 2),
      y: svgNum(piece.y + guide.y + guide.height / 2 + dimensionTextOffset(guide))
    })).textContent = guide.label;
    guideCount += 1;
  }
  if (guideCount) els.previewSvg.appendChild(group);
}

function dimensionTextOffset(guide) {
  return Math.min(18, Math.max(12, guide.height * 0.24));
}

function innerGuideForPiece(piece, params) {
  const thickness = params.materialThickness;
  const depth = params.tabDepth;
  const innerLength = params.length;
  const innerWidth = params.width;
  const innerHeight = ["cube", "cuboid"].includes(params.modelType) ? params.height : params.wallHeight;
  const guideX = depth + thickness;
  const guideY = depth + thickness;

  if (["top", "bottom", "floor"].includes(piece.name)) {
    return {
      x: guideX,
      y: guideY,
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
      y: depth,
      width: innerLength,
      height: innerHeight,
      label: `${formatGuideNumber(innerLength)} x ${formatGuideNumber(innerHeight)}`
    };
  }

  if (["front_gable", "back_gable"].includes(piece.name)) {
    return {
      x: Math.max(0, (piece.width - innerWidth) / 2),
      y: Math.max(0, piece.height - depth - innerHeight),
      width: innerWidth,
      height: innerHeight,
      label: `${formatGuideNumber(innerWidth)} x ${formatGuideNumber(innerHeight)}`
    };
  }

  if (["left", "right"].includes(piece.name)) {
    return {
      x: guideX,
      y: guideY,
      width: innerWidth,
      height: innerHeight,
      label: `${formatGuideNumber(innerWidth)} x ${formatGuideNumber(innerHeight)}`
    };
  }

  return null;
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

function exportSvg(result) {
  const svg = buildCutOnlySvg(result);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}\n`;
}

function buildCutOnlySvg(result) {
  const svg = createSvgElement("svg", {
    xmlns: NS,
    width: `${svgNum(result.bounds.width)}mm`,
    height: `${svgNum(result.bounds.height)}mm`,
    viewBox: `0 0 ${svgNum(Math.max(result.bounds.width, 1))} ${svgNum(Math.max(result.bounds.height, 1))}`
  });
  const group = createSvgElement("g", { class: "svg-cut" });
  svg.appendChild(group);
  for (const piece of result.pieces) {
    if (piece.layer !== "CUT") continue;
    for (const path of piece.paths) {
      group.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
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

function exportDxf(result) {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  for (const piece of result.pieces) {
    if (piece.layer !== "CUT") continue;
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
  els.tabWidth.value = "10";
  els.tabDepth.value = "3";
  els.tabSpacing.value = "8";
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

function dxfNum(value) {
  return Number(value).toFixed(4);
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
