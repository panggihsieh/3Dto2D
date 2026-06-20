const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;

const state = {
  result: null,
  stlMesh: null,
  stlError: ""
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
  houseFields: document.querySelectorAll("[data-field='house']"),
  stlPanel: document.querySelector("#stlPanel"),
  stlFile: document.querySelector("#stlFile"),
  stlSummary: document.querySelector("#stlSummary")
};

const defaults = {
  cube: { length: 60, width: 60, height: 60, radius: 30, wallHeight: 50, roofHeight: 28 },
  cuboid: { length: 120, width: 80, height: 60, radius: 40, wallHeight: 50, roofHeight: 28 },
  cylinder: { length: 120, width: 80, height: 80, radius: 35, wallHeight: 50, roofHeight: 28 },
  cone: { length: 120, width: 80, height: 90, radius: 35, wallHeight: 50, roofHeight: 28 },
  flex_box_5: { length: 120, width: 80, height: 45, radius: 18, wallHeight: 50, roofHeight: 28 },
  gable_house: { length: 120, width: 80, height: 80, radius: 35, wallHeight: 55, roofHeight: 35 },
  stl_mesh: { length: 120, width: 80, height: 60, radius: 35, wallHeight: 50, roofHeight: 28 }
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

  if (params.modelType === "stl_mesh") {
    if (state.stlError) warnings.push(state.stlError);
    if (!state.stlMesh) {
      warnings.push("Upload an STL file to generate a 2D unfolded SVG.");
    } else {
      const stlResult = buildStlMeshPieces(state.stlMesh, params);
      pieces.push(...stlResult.pieces);
      warnings.push(...stlResult.warnings);
    }
  }

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

  if (["cylinder", "cone", "flex_box_5"].includes(params.modelType)) {
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
  if (params.modelType === "stl_mesh") {
    warnings.push("STL V2 exports a triangle-net preview: outer/seam edges are CUT, unfolded neighbor edges are SCORE.");
    warnings.push("Organic or curved STL files may need manual seam cleanup before laser cutting.");
  }
  if (params.modelType === "cone") {
    warnings.push("圓錐側面以扇形近似輸出，弧線依 segments 分段。");
    if (params.generateJoinery) warnings.push("圓錐使用扇形外弧放射卡榫，底圓使用圓周插槽。");
  }
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
  const sideEdges = params.generateJoinery ? "fefe" : "eeee";
  return [
    rectPiece("side", circumference, params.height, params, sideEdges),
    circlePiece("top", params.radius, params, params.generateJoinery),
    circlePiece("bottom", params.radius, params, params.generateJoinery)
  ];
}

function buildConePieces(params) {
  const slantHeight = Math.hypot(params.radius, params.height);
  const angle = TAU * params.radius / slantHeight;
  return [
    sectorPiece("cone_side", slantHeight, angle, params, params.generateJoinery),
    circlePiece("base", params.radius, params, params.generateJoinery)
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

function buildStlMeshPieces(mesh, params) {
  const warnings = [];
  const clean = cleanMesh(mesh, 0.001);
  warnings.push(...clean.warnings);
  if (!clean.faces.length) {
    return { pieces: [], warnings: [...warnings, "The STL has no usable triangular faces."] };
  }

  const unfolded = unfoldMesh(clean);
  warnings.push(...unfolded.warnings);
  return {
    pieces: unfolded.islands.map((island, index) => stlIslandPiece(island, index)),
    warnings
  };
}

function stlIslandPiece(island, index) {
  const allPoints = island.cutPaths.concat(island.scorePaths).flat();
  const minX = Math.min(...allPoints.map(point => point.x));
  const minY = Math.min(...allPoints.map(point => point.y));
  const maxX = Math.max(...allPoints.map(point => point.x));
  const maxY = Math.max(...allPoints.map(point => point.y));
  const shiftPath = path => {
    const shifted = path.map(point => ({ x: point.x - minX, y: point.y - minY }));
    shifted.closed = path.closed;
    return shifted;
  };

  return {
    name: `stl_island_${index + 1}`,
    layer: "CUT",
    paths: island.cutPaths.map(shiftPath),
    scorePaths: island.scorePaths.map(shiftPath),
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1)
  };
}

function parseStlBuffer(buffer) {
  const view = new DataView(buffer);
  const header = new TextDecoder("utf-8", { fatal: false }).decode(buffer.slice(0, Math.min(buffer.byteLength, 512)));
  if (/^\s*solid\b/i.test(header) && /\bvertex\b/i.test(header)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return parseAsciiStl(text);
  }

  const expectedBinarySize = view.byteLength >= 84
    ? 84 + view.getUint32(80, true) * 50
    : 0;
  if (expectedBinarySize === view.byteLength && view.getUint32(80, true) < 10000000) {
    return parseBinaryStl(view);
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  return parseAsciiStl(text);
}

function parseBinaryStl(view) {
  const faceCount = view.getUint32(80, true);
  const vertices = [];
  const faces = [];
  let offset = 84;
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
    offset += 12;
    const face = [];
    for (let i = 0; i < 3; i += 1) {
      const point = {
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        z: view.getFloat32(offset + 8, true)
      };
      vertices.push(point);
      face.push(vertices.length - 1);
      offset += 12;
    }
    faces.push(face);
    offset += 2;
  }
  return { vertices, faces };
}

function parseAsciiStl(text) {
  const vertices = [];
  const faces = [];
  const vertexPattern = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  let match;
  let current = [];
  while ((match = vertexPattern.exec(text))) {
    vertices.push({
      x: Number(match[1]),
      y: Number(match[2]),
      z: Number(match[3])
    });
    current.push(vertices.length - 1);
    if (current.length === 3) {
      faces.push(current);
      current = [];
    }
  }
  if (!faces.length) throw new Error("No STL triangles found.");
  return { vertices, faces };
}

function cleanMesh(mesh, tolerance) {
  const warnings = [];
  const vertices = [];
  const remap = new Map();
  const snapKey = point => [
    Math.round(point.x / tolerance),
    Math.round(point.y / tolerance),
    Math.round(point.z / tolerance)
  ].join(",");

  for (let i = 0; i < mesh.vertices.length; i += 1) {
    const key = snapKey(mesh.vertices[i]);
    if (!remap.has(key)) {
      remap.set(key, vertices.length);
      vertices.push(mesh.vertices[i]);
    }
  }

  const faces = [];
  for (const face of mesh.faces) {
    const mapped = face.map(index => remap.get(snapKey(mesh.vertices[index])));
    if (new Set(mapped).size < 3) continue;
    const area = triangleArea3(vertices[mapped[0]], vertices[mapped[1]], vertices[mapped[2]]);
    if (area > 0.000001) faces.push(mapped);
  }

  const edgeUse = new Map();
  for (const face of faces) {
    for (let i = 0; i < 3; i += 1) {
      const key = edgeKey(face[i], face[(i + 1) % 3]);
      edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
    }
  }

  const openEdges = [...edgeUse.values()].filter(count => count === 1).length;
  const nonManifoldEdges = [...edgeUse.values()].filter(count => count > 2).length;
  if (openEdges) warnings.push(`STL has ${openEdges} open boundary edges; those edges will be CUT.`);
  if (nonManifoldEdges) warnings.push(`STL has ${nonManifoldEdges} non-manifold edges; unfolding may need manual cleanup.`);

  return { vertices, faces, warnings, bbox: meshBounds(vertices) };
}

function unfoldMesh(mesh) {
  const warnings = [];
  const adjacency = buildFaceAdjacency(mesh.faces);
  const visited = new Set();
  const islands = [];

  for (let seed = 0; seed < mesh.faces.length; seed += 1) {
    if (visited.has(seed)) continue;

    const placements = new Map();
    const queue = [seed];
    visited.add(seed);
    placements.set(seed, initialTrianglePlacement(mesh, seed));

    while (queue.length) {
      const faceIndex = queue.shift();
      const face = mesh.faces[faceIndex];
      const placed = placements.get(faceIndex);

      const neighbors = [...(adjacency.get(faceIndex) || [])].sort((a, b) => {
        const aCoplanar = areCoplanar(mesh, faceIndex, a.face) ? 0 : 1;
        const bCoplanar = areCoplanar(mesh, faceIndex, b.face) ? 0 : 1;
        return aCoplanar - bCoplanar;
      });
      for (const item of neighbors) {
        if (visited.has(item.face)) continue;
        const nextPlacement = placeNeighborTriangle(mesh, face, placed, item);
        if (!nextPlacement) continue;
        visited.add(item.face);
        placements.set(item.face, nextPlacement);
        queue.push(item.face);
      }
    }

    const island = islandPaths(mesh, adjacency, placements);
    if (island.cutPaths.length || island.scorePaths.length) islands.push(island);
  }

  if (islands.length > 1) {
    warnings.push(`STL unfolded into ${islands.length} islands because the mesh is disconnected.`);
  }
  if (hasLikelyOverlap(islands)) {
    warnings.push("Some unfolded triangles overlap in 2D; add manual seams or simplify the STL before cutting.");
  }

  return { islands, warnings };
}

function buildFaceAdjacency(faces) {
  const edgeMap = new Map();
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const face = faces[faceIndex];
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const a = face[edgeIndex];
      const b = face[(edgeIndex + 1) % 3];
      const key = edgeKey(a, b);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({ face: faceIndex, a, b });
    }
  }

  const adjacency = new Map();
  for (let i = 0; i < faces.length; i += 1) adjacency.set(i, []);
  for (const entries of edgeMap.values()) {
    if (entries.length !== 2) continue;
    const [left, right] = entries;
    adjacency.get(left.face).push({ face: right.face, a: left.a, b: left.b });
    adjacency.get(right.face).push({ face: left.face, a: right.a, b: right.b });
  }
  return adjacency;
}

function initialTrianglePlacement(mesh, faceIndex) {
  const face = mesh.faces[faceIndex];
  const a = mesh.vertices[face[0]];
  const b = mesh.vertices[face[1]];
  const c = mesh.vertices[face[2]];
  const ab = dist3(a, b);
  const ac = dist3(a, c);
  const bc = dist3(b, c);
  const x = (ac * ac - bc * bc + ab * ab) / (2 * ab || 1);
  const y = Math.sqrt(Math.max(ac * ac - x * x, 0));
  return new Map([
    [face[0], { x: 0, y: 0 }],
    [face[1], { x: ab, y: 0 }],
    [face[2], { x, y }]
  ]);
}

function placeNeighborTriangle(mesh, currentFace, currentPlacement, item) {
  const nextFace = mesh.faces[item.face];
  const thirdIndex = nextFace.find(index => index !== item.a && index !== item.b);
  const currentThirdIndex = currentFace.find(index => index !== item.a && index !== item.b);
  const pa = currentPlacement.get(item.a);
  const pb = currentPlacement.get(item.b);
  const pc = currentPlacement.get(currentThirdIndex);
  if (!pa || !pb || !pc || thirdIndex === undefined) return null;

  const dA = dist3(mesh.vertices[item.a], mesh.vertices[thirdIndex]);
  const dB = dist3(mesh.vertices[item.b], mesh.vertices[thirdIndex]);
  const candidates = circleIntersections(pa, pb, dA, dB);
  if (!candidates.length) return null;

  const edge = { x: pb.x - pa.x, y: pb.y - pa.y };
  const currentSide = Math.sign(cross2(edge, { x: pc.x - pa.x, y: pc.y - pa.y })) || 1;
  const chosen = candidates.find(point => {
    const side = Math.sign(cross2(edge, { x: point.x - pa.x, y: point.y - pa.y })) || -currentSide;
    return side !== currentSide;
  }) || candidates[0];

  return new Map([
    [item.a, pa],
    [item.b, pb],
    [thirdIndex, chosen]
  ]);
}

function islandPaths(mesh, adjacency, placements) {
  const cutPaths = [];
  const scorePaths = [];
  const panelTreeEdges = buildPanelTreeEdges(mesh, adjacency, placements);
  for (const [faceIndex, placement] of placements) {
    const face = mesh.faces[faceIndex];
    for (let i = 0; i < 3; i += 1) {
      const a = face[i];
      const b = face[(i + 1) % 3];
      const neighbor = (adjacency.get(faceIndex) || []).find(item => edgeKey(item.a, item.b) === edgeKey(a, b));
      const line = openPath([placement.get(a), placement.get(b)]);
      if (!neighbor) {
        cutPaths.push(line);
        continue;
      }
      if (!placements.has(neighbor.face)) continue;
      if (faceIndex > neighbor.face) continue;
      if (areCoplanar(mesh, faceIndex, neighbor.face)) continue;
      if (panelTreeEdges.has(adjacencyKey(faceIndex, neighbor.face))) {
        scorePaths.push(line);
      } else {
        cutPaths.push(line);
      }
    }
  }
  return { cutPaths, scorePaths };
}

function buildPanelTreeEdges(mesh, adjacency, placements) {
  const dsu = makeDisjointSet(mesh.faces.length);
  for (const [faceIndex] of placements) {
    for (const item of adjacency.get(faceIndex) || []) {
      if (!placements.has(item.face)) continue;
      if (areCoplanar(mesh, faceIndex, item.face)) dsu.union(faceIndex, item.face);
    }
  }

  const panelEdges = [];
  const seenEdges = new Set();
  for (const [faceIndex] of placements) {
    for (const item of adjacency.get(faceIndex) || []) {
      if (!placements.has(item.face) || faceIndex > item.face) continue;
      const panelA = dsu.find(faceIndex);
      const panelB = dsu.find(item.face);
      if (panelA === panelB) continue;
      const key = adjacencyKey(faceIndex, item.face);
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      panelEdges.push({ faceA: faceIndex, faceB: item.face, panelA, panelB });
    }
  }

  const panelDsu = makeDisjointSet(mesh.faces.length);
  const scoreEdges = new Set();
  for (const edge of panelEdges) {
    if (panelDsu.find(edge.panelA) === panelDsu.find(edge.panelB)) continue;
    panelDsu.union(edge.panelA, edge.panelB);
    scoreEdges.add(adjacencyKey(edge.faceA, edge.faceB));
  }
  return scoreEdges;
}

function makeDisjointSet(size) {
  const parent = Array.from({ length: size }, (_, index) => index);
  return {
    find(value) {
      while (parent[value] !== value) {
        parent[value] = parent[parent[value]];
        value = parent[value];
      }
      return value;
    },
    union(a, b) {
      const rootA = this.find(a);
      const rootB = this.find(b);
      if (rootA !== rootB) parent[rootB] = rootA;
    }
  };
}

function openPath(points) {
  const path = points.map(point => ({ x: point.x, y: point.y }));
  path.closed = false;
  return path;
}

function areCoplanar(mesh, faceA, faceB) {
  const normalA = faceNormal(mesh, faceA);
  const normalB = faceNormal(mesh, faceB);
  return Math.abs(dot3(normalA, normalB)) > 0.999;
}

function circleIntersections(a, b, ra, rb) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.000001) return [];
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(ra * ra - x * x, 0));
  const ux = dx / d;
  const uy = dy / d;
  const base = { x: a.x + ux * x, y: a.y + uy * x };
  return [
    { x: base.x - uy * h, y: base.y + ux * h },
    { x: base.x + uy * h, y: base.y - ux * h }
  ];
}

function hasLikelyOverlap(islands) {
  const boxes = [];
  for (const island of islands) {
    for (const path of island.cutPaths) {
      boxes.push(pathBounds(path));
    }
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (boxesOverlap(boxes[i], boxes[j], 0.01)) return true;
    }
  }
  return false;
}

function pathBounds(path) {
  return {
    minX: Math.min(...path.map(point => point.x)),
    minY: Math.min(...path.map(point => point.y)),
    maxX: Math.max(...path.map(point => point.x)),
    maxY: Math.max(...path.map(point => point.y))
  };
}

function boxesOverlap(a, b, tolerance) {
  return a.minX < b.maxX - tolerance
    && a.maxX > b.minX + tolerance
    && a.minY < b.maxY - tolerance
    && a.maxY > b.minY + tolerance;
}

function meshBounds(vertices) {
  return {
    minX: Math.min(...vertices.map(point => point.x)),
    minY: Math.min(...vertices.map(point => point.y)),
    minZ: Math.min(...vertices.map(point => point.z)),
    maxX: Math.max(...vertices.map(point => point.x)),
    maxY: Math.max(...vertices.map(point => point.y)),
    maxZ: Math.max(...vertices.map(point => point.z))
  };
}

function faceNormal(mesh, faceIndex) {
  const [ia, ib, ic] = mesh.faces[faceIndex];
  const a = mesh.vertices[ia];
  const b = mesh.vertices[ib];
  const c = mesh.vertices[ic];
  const normal = cross3(sub3(b, a), sub3(c, a));
  const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
  return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
}

function triangleArea3(a, b, c) {
  const normal = cross3(sub3(b, a), sub3(c, a));
  return Math.hypot(normal.x, normal.y, normal.z) / 2;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function adjacencyKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function sub3(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
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

function sectorPiece(name, radius, angle, params, withTabs = false) {
  const points = withTabs
    ? sectorArcTabPath(radius, angle, params)
    : [{ x: radius, y: radius }];
  const start = -Math.PI / 2 - angle / 2;
  if (!withTabs) {
    for (let i = 0; i <= params.segments; i += 1) {
      const theta = start + (i / params.segments) * angle;
      points.push({
        x: radius + Math.cos(theta) * radius,
        y: radius + Math.sin(theta) * radius
      });
    }
  }
  const margin = withTabs ? params.tabDepth : 0;
  return {
    name,
    layer: "CUT",
    paths: [points],
    width: radius * 2 + margin * 2,
    height: radius * 2 + margin * 2
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

function sectorArcTabPath(radius, angle, params) {
  const margin = params.tabDepth;
  const center = { x: radius + margin, y: radius + margin };
  const startAngle = -Math.PI / 2 - angle / 2;
  const arcLength = radius * angle;
  const runs = fingerRuns(arcLength, params, params.tabWidth);
  const points = [center];
  let cursor = 0;

  for (const run of runs) {
    appendArc(points, center, radius, startAngle + cursor / radius, startAngle + run.start / radius, params);
    appendArcTab(points, center, radius, startAngle + run.start / radius, startAngle + run.end / radius, params);
    cursor = run.end;
  }

  appendArc(points, center, radius, startAngle + cursor / radius, startAngle + angle, params);
  return points;
}

function appendArc(points, center, radius, startAngle, endAngle, params) {
  const delta = endAngle - startAngle;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / TAU * params.segments));
  for (let i = 0; i <= steps; i += 1) {
    const theta = startAngle + (i / steps) * delta;
    pushPoint(points, {
      x: center.x + Math.cos(theta) * radius,
      y: center.y + Math.sin(theta) * radius
    });
  }
}

function appendArcTab(points, center, radius, startAngle, endAngle, params) {
  const outerRadius = radius + params.tabDepth;
  const steps = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / TAU * params.segments));
  const startInner = polarPoint(center, radius, startAngle);
  const startOuter = polarPoint(center, outerRadius, startAngle);
  const endOuter = polarPoint(center, outerRadius, endAngle);
  const endInner = polarPoint(center, radius, endAngle);

  pushPoint(points, startInner);
  pushPoint(points, startOuter);
  for (let i = 1; i < steps; i += 1) {
    const theta = startAngle + (i / steps) * (endAngle - startAngle);
    pushPoint(points, polarPoint(center, outerRadius, theta));
  }
  pushPoint(points, endOuter);
  pushPoint(points, endInner);
}

function polarPoint(center, radius, theta) {
  return {
    x: center.x + Math.cos(theta) * radius,
    y: center.y + Math.sin(theta) * radius
  };
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
  paths.push([
    { x, y: y1 },
    { x, y: y2 }
  ]);
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
  const scoreGroup = createSvgElement("g", { class: "svg-score" });
  els.previewSvg.appendChild(cutGroup);
  els.previewSvg.appendChild(scoreGroup);

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
    for (const path of piece.scorePaths || []) {
      scoreGroup.appendChild(createSvgElement("path", {
        d: pathToD(path, piece.x, piece.y),
        fill: "none",
        stroke: "#2468d8",
        "stroke-dasharray": "3 2",
        "stroke-linecap": "round",
        "vector-effect": "non-scaling-stroke",
        "stroke-width": Math.max((result.params.kerfWidth || 0.1) / 2, 0.05)
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
    .svg-score path {
      fill: none;
      stroke: #2468d8;
      stroke-dasharray: 3 2;
      stroke-linecap: round;
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
    appendDxfPaths(lines, piece.paths, piece.layer, piece.x, piece.y);
    appendDxfPaths(lines, piece.scorePaths || [], "SCORE", piece.x, piece.y);
  }
  lines.push("0", "ENDSEC", "0", "EOF");
  return `${lines.join("\n")}\n`;
}

function appendDxfPaths(lines, paths, layer, offsetX, offsetY) {
  for (const path of paths) {
    const segmentCount = path.closed === false ? path.length - 1 : path.length;
    for (let i = 0; i < segmentCount; i += 1) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      lines.push(
        "0", "LINE",
        "8", layer,
        "10", dxfNum(a.x + offsetX),
        "20", dxfNum(-(a.y + offsetY)),
        "30", "0",
        "11", dxfNum(b.x + offsetX),
        "21", dxfNum(-(b.y + offsetY)),
        "31", "0"
      );
    }
  }
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
  const circular = ["cylinder", "cone", "flex_box_5"].includes(type);
  const house = type === "gable_house";
  els.circularFields.forEach(field => field.hidden = !circular);
  els.houseFields.forEach(field => field.hidden = !house);
  els.stlPanel.hidden = type !== "stl_mesh";
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
    flex_box_5: "柔性盒子5",
    gable_house: "雙斜屋頂房子",
    stl_mesh: "STL mesh"
  };
  return labels[type] || type;
}

async function handleStlUpload(event) {
  const file = event.target.files && event.target.files[0];
  state.stlMesh = null;
  state.stlError = "";
  if (!file) {
    els.stlSummary.textContent = "No file";
    runConversion();
    return;
  }

  els.statusPill.textContent = "Reading STL";
  els.stlSummary.textContent = file.name;
  try {
    const buffer = await file.arrayBuffer();
    const parsed = parseStlBuffer(buffer);
    const clean = cleanMesh(parsed, 0.001);
    state.stlMesh = parsed;
    const box = clean.bbox;
    const size = {
      x: box.maxX - box.minX,
      y: box.maxY - box.minY,
      z: box.maxZ - box.minZ
    };
    els.stlSummary.textContent = `${file.name} · ${clean.faces.length} faces · ${formatNumber(size.x)} x ${formatNumber(size.y)} x ${formatNumber(size.z)} mm`;
  } catch (error) {
    state.stlError = `Could not read STL: ${error.message}`;
    els.stlSummary.textContent = "Read failed";
  }
  runConversion();
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
  if (!["modelType", "stlFile"].includes(input.id)) {
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

els.stlFile.addEventListener("change", handleStlUpload);

updateFieldVisibility();
runConversion();
