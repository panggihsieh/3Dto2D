(function (root) {
  const EPSILON = 0.0001;

  function clonePoint(point) {
    return { x: point.x, y: point.y };
  }

  function clonePath(path) {
    const copy = path.map(clonePoint);
    copy.closed = path.closed !== false;
    return copy;
  }

  function samePoint(a, b, tolerance = EPSILON) {
    return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
  }

  function pushPoint(points, point, tolerance = EPSILON) {
    const last = points[points.length - 1];
    if (last && samePoint(last, point, tolerance)) return;
    points.push(clonePoint(point));
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

  function offsetBy(point, direction, distanceMm) {
    return {
      x: point.x + direction.x * distanceMm,
      y: point.y + direction.y * distanceMm
    };
  }

  function along(start, direction, distanceMm) {
    return {
      x: start.x + direction.x * distanceMm,
      y: start.y + direction.y * distanceMm
    };
  }

  function normalizeVector(vector) {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= EPSILON) return { x: 0, y: 0, length: 0 };
    return { x: vector.x / length, y: vector.y / length, length };
  }

  function edgeVector(start, end) {
    return normalizeVector({ x: end.x - start.x, y: end.y - start.y });
  }

  function edgeOutwardNormal(start, end, polygonArea) {
    const edge = edgeVector(start, end);
    if (!edge.length) return { x: 0, y: 0 };
    return polygonArea >= 0
      ? { x: edge.y, y: -edge.x }
      : { x: -edge.y, y: edge.x };
  }

  function lineIntersection(a1, a2, b1, b2) {
    const dax = a2.x - a1.x;
    const day = a2.y - a1.y;
    const dbx = b2.x - b1.x;
    const dby = b2.y - b1.y;
    const denominator = dax * dby - day * dbx;
    if (Math.abs(denominator) < EPSILON) return null;

    const bax = b1.x - a1.x;
    const bay = b1.y - a1.y;
    const t = (bax * dby - bay * dbx) / denominator;
    return {
      x: a1.x + dax * t,
      y: a1.y + day * t
    };
  }

  function offsetRectangularPath(path, amount) {
    const xs = path.map(point => point.x);
    const ys = path.map(point => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];
    if (!path.every(point => corners.some(corner => samePoint(point, corner)))) return null;

    const expanded = [
      { x: minX - amount, y: minY - amount },
      { x: maxX + amount, y: minY - amount },
      { x: maxX + amount, y: maxY + amount },
      { x: minX - amount, y: maxY + amount }
    ];
    expanded.closed = true;
    return expanded;
  }

  function offsetPolygonPath(path, amount) {
    const area = signedPolygonArea(path);
    if (Math.abs(area) < EPSILON) return null;

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

  function offsetClosedPath(path, amount) {
    if (path.closed === false || path.length < 3) return null;

    if (path.length === 4) {
      const rect = offsetRectangularPath(path, amount);
      if (rect) return rect;
    }

    return offsetPolygonPath(path, amount);
  }

  function normalizeInnerGeometry(paths) {
    return paths
      .filter(path => path && path.length >= 2)
      .map((path, pathIndex) => {
        const normalized = [];
        for (const point of path) {
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
          pushPoint(normalized, point);
        }
        normalized.closed = path.closed !== false;
        normalized.id = `black-${pathIndex}`;
        return normalized;
      })
      .filter(path => path.length >= 2);
  }

  function buildOffsetReferenceLines(innerPaths, materialThicknessMm) {
    return innerPaths.map(path => {
      const offset = offsetClosedPath(path, materialThicknessMm);
      return offset ? offset : clonePath(path);
    });
  }

  function calcFingerCount(length, params) {
    const tabWidth = params.tabWidth || params.fingerWidthMm || params.materialThickness || 3;
    const tabSpacing = params.tabSpacing || tabWidth;
    const materialThickness = params.materialThickness || params.materialThicknessMm || 3;
    const pitch = tabWidth + tabSpacing;
    if (pitch <= 0 || length < tabWidth + materialThickness * 2) return 0;
    return Math.max(1, Math.floor((length - tabSpacing) / pitch));
  }

  function buildEdgeFrame(innerStart, innerEnd, offsetStart, offsetEnd, role) {
    const baseStart = role === "convex" ? innerStart : offsetStart;
    const baseEnd = role === "convex" ? innerEnd : offsetEnd;
    const targetStart = role === "convex" ? offsetStart : innerStart;
    const targetEnd = role === "convex" ? offsetEnd : innerEnd;
    const base = edgeVector(baseStart, baseEnd);
    const baseMid = { x: (baseStart.x + baseEnd.x) / 2, y: (baseStart.y + baseEnd.y) / 2 };
    const targetMid = { x: (targetStart.x + targetEnd.x) / 2, y: (targetStart.y + targetEnd.y) / 2 };
    const depth = normalizeVector({ x: targetMid.x - baseMid.x, y: targetMid.y - baseMid.y });

    return {
      baseStart,
      baseEnd,
      baseDirection: { x: base.x, y: base.y },
      depthDirection: { x: depth.x, y: depth.y },
      length: base.length,
      maxDepth: depth.length
    };
  }

  function generateJoineryEdgePoints(innerStart, innerEnd, offsetStart, offsetEnd, type, params, guide = null) {
    if (type !== "f" && type !== "F") return [clonePoint(offsetStart), clonePoint(offsetEnd)];

    const role = type === "f" ? "convex" : "concave";
    const frame = buildEdgeFrame(innerStart, innerEnd, offsetStart, offsetEnd, role);
    if (!frame.length || !frame.maxDepth) return [clonePoint(offsetStart), clonePoint(offsetEnd)];

    const materialThickness = params.materialThickness || params.materialThicknessMm || frame.maxDepth;
    const requestedDepth = params.tabDepth || materialThickness;
    const depth = Math.min(Math.max(requestedDepth, 0), frame.maxDepth || materialThickness);
    const fingerWidth = type === "F"
      ? (params.tabWidth || materialThickness * 2) + (params.kerfWidth || 0)
      : (params.tabWidth || materialThickness * 2);

    const baseGuideStart = Math.max(0, Math.min(frame.length, guide?.start ?? 0));
    const baseGuideLength = Math.max(0, Math.min(frame.length - baseGuideStart, guide?.length ?? frame.length));
    const baseGuideEnd = baseGuideStart + baseGuideLength;
    const cornerClearance = Math.min(
      baseGuideLength / 3,
      Math.max(materialThickness, depth, params.tabWidth || materialThickness * 2)
    );
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
    const points = [];

    pushPoint(points, frame.baseStart);
    if (count <= 0) {
      pushPoint(points, frame.baseEnd);
      return points;
    }

    for (let i = 0; i < count; i += 1) {
      const tabStart = inset + i * (fingerWidth + fittedSpacing);
      const tabEnd = Math.min(tabStart + fingerWidth, guideEnd);
      if (tabEnd <= tabStart || tabStart >= guideEnd) continue;

      const a = along(frame.baseStart, frame.baseDirection, tabStart);
      const b = along(frame.baseStart, frame.baseDirection, tabEnd);
      const ao = offsetBy(a, frame.depthDirection, depth);
      const bo = offsetBy(b, frame.depthDirection, depth);
      pushPoint(points, a);
      pushPoint(points, ao);
      pushPoint(points, bo);
      pushPoint(points, b);
    }

    pushPoint(points, frame.baseEnd);
    return points;
  }

  function generateJoineryCutPath(innerPath, offsetPath, edgeTypes, params, guides = null) {
    if (!innerPath || !offsetPath || innerPath.length !== offsetPath.length) return clonePath(offsetPath || innerPath || []);

    const points = [];
    for (let i = 0; i < offsetPath.length; i += 1) {
      const edgePoints = generateJoineryEdgePoints(
        innerPath[i],
        innerPath[(i + 1) % innerPath.length],
        offsetPath[i],
        offsetPath[(i + 1) % offsetPath.length],
        edgeTypes[i] || "e",
        params,
        guides?.[i] || null
      );
      for (const point of edgePoints) pushPoint(points, point);
    }
    points.closed = true;
    return points;
  }

  function pointSideOfLine(point, lineStart, lineEnd) {
    return (lineEnd.x - lineStart.x) * (point.y - lineStart.y)
      - (lineEnd.y - lineStart.y) * (point.x - lineStart.x);
  }

  function pointOnSegment(point, start, end, tolerance = EPSILON) {
    if (Math.abs(pointSideOfLine(point, start, end)) > tolerance) return false;
    return point.x >= Math.min(start.x, end.x) - tolerance
      && point.x <= Math.max(start.x, end.x) + tolerance
      && point.y >= Math.min(start.y, end.y) - tolerance
      && point.y <= Math.max(start.y, end.y) + tolerance;
  }

  function pointOnPolygonBoundary(point, polygon, tolerance = EPSILON) {
    for (let i = 0; i < polygon.length; i += 1) {
      if (pointOnSegment(point, polygon[i], polygon[(i + 1) % polygon.length], tolerance)) return true;
    }
    return false;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      const intersects = ((a.y > point.y) !== (b.y > point.y))
        && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || EPSILON) + a.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function validateInnerDimensionPreserved(innerPath, offsetPath, cutPath, tolerance = EPSILON) {
    const messages = [];
    if (!innerPath || !offsetPath || !cutPath || innerPath.length !== offsetPath.length) {
      return { status: "warning", messages: ["內尺寸檢驗略過：黑線與灰線點數不一致。"] };
    }

    for (const point of cutPath) {
      if (pointOnPolygonBoundary(point, innerPath, tolerance)) continue;
      if (pointInPolygon(point, innerPath)) {
        messages.push("紅線疑似侵入黑線內尺寸區域。");
        return { status: "fail", messages };
      }
    }

    return { status: "ok", messages };
  }

  function validateCutPathContinuity(cutPath, tolerance = EPSILON) {
    const messages = [];
    for (let i = 0; i < cutPath.length; i += 1) {
      const point = cutPath[i];
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        messages.push("紅線含有無效座標。");
        return { status: "fail", messages };
      }
      const next = cutPath[(i + 1) % cutPath.length];
      if (samePoint(point, next, tolerance)) {
        messages.push("紅線含有零長度線段，已由輸出流程盡量合併。");
        return { status: "warning", messages };
      }
    }
    return { status: "ok", messages };
  }

  function drawJoineryPath(innerPath, offsetPath, edgeTypes, params, guides = null) {
    return generateJoineryCutPath(innerPath, offsetPath, edgeTypes, params, guides);
  }

  function checkJoineryPath(innerPath, offsetPath, cutPath) {
    const innerCheck = validateInnerDimensionPreserved(innerPath, offsetPath, cutPath);
    const pathCheck = validateCutPathContinuity(cutPath);
    const status = innerCheck.status === "fail" || pathCheck.status === "fail"
      ? "fail"
      : innerCheck.status === "warning" || pathCheck.status === "warning"
        ? "warning"
        : "ok";

    return {
      status,
      messages: [...innerCheck.messages, ...pathCheck.messages]
    };
  }

  const api = {
    normalizeInnerGeometry,
    buildOffsetReferenceLines,
    offsetClosedPath,
    generateJoineryEdgePoints,
    generateJoineryCutPath,
    drawJoineryPath,
    checkJoineryPath,
    validateInnerDimensionPreserved,
    validateCutPathContinuity,
    calcFingerCount
  };

  root.AutoJoinery = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof globalThis !== "undefined" ? globalThis : window));
