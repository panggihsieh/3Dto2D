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
  joineryModeButton: document.querySelector("#joineryModeButton"),
  joineryModeStatus: document.querySelector("#joineryModeStatus"),
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
    pieces.push(...buildBoxPieces(params.length, params.width, params.height, params, true));
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

function rectPiece(name, width, height, params, edges = "eeee", reserveJoineryMargin = false) {
  const hasJoinery = /[fF]/.test(edges);
  const margin = hasJoinery || reserveJoineryMargin ? params.tabDepth : 0;
  const path = hasJoinery
    ? fingerJointRectPath(margin, margin, width, height, edges, params)
    : rectPath(margin, margin, width, height);
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
        fill: "none",
        stroke: "#ff0000",
        "stroke-linejoin": "miter",
        "stroke-linecap": "square",
        "vector-effect": "non-scaling-stroke",
        "stroke-width": previewStrokeWidth(result.params)
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
  els.joineryToggle.checked = false;
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

function toggleJoineryMode() {
  els.joineryToggle.checked = !els.joineryToggle.checked;
  updateJoineryModeControls();
  runConversion();
}

function runConversion() {
  els.statusPill.textContent = "Generating";
  updateFieldVisibility();
  updateJoineryModeControls();
  state.result = buildResult(getParams());
  render(state.result);
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
els.joineryModeButton.addEventListener("click", toggleJoineryMode);

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
