const fs = require("fs");
const path = require("path");
const AutoJoinery = require("./auto-joinery.js");

const checkSamples = [
  "basic_cube.svg",
  "basic_cuboid.svg",
  "basic_gable_house.svg"
];

const drawSamples = [
  "cuboid_practice.svg",
  "gable_house_practice.svg"
];

const defaultParams = {
  materialThickness: 3,
  tabDepth: 3,
  tabWidth: 10,
  tabSpacing: 8,
  kerfWidth: 0.15
};

function parseSvgPaths(svg) {
  const paths = [];
  const pathPattern = /<path\b([^>]*)>/g;
  let match;
  while ((match = pathPattern.exec(svg))) {
    const attrs = match[1];
    const id = attr(attrs, "id") || `path_${paths.length + 1}`;
    const d = attr(attrs, "d");
    if (!d) continue;
    paths.push({ id, points: parseSimplePathD(d) });
  }
  return paths;
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match ? match[1] : "";
}

function parseSimplePathD(d) {
  const tokens = d.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
  const points = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index++];
    if (token === "M" || token === "L") {
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);
      points.push({ x, y });
    } else if (token === "Z") {
      points.closed = true;
    }
  }
  if (points.length && points.closed !== true) points.closed = false;
  return points;
}

function pathToD(points) {
  if (!points.length) return "";
  const [first, ...rest] = points;
  const commands = [`M ${num(first.x)} ${num(first.y)}`];
  for (const point of rest) commands.push(`L ${num(point.x)} ${num(point.y)}`);
  if (points.closed !== false) commands.push("Z");
  return commands.join(" ");
}

function num(value) {
  return Number(value.toFixed(3)).toString();
}

function sampleEdgeTypes(pointCount) {
  return Array.from({ length: pointCount }, (_, index) => {
    if (index === 0) return "f";
    if (index === 2) return "F";
    return "e";
  });
}

function signedPolygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function outwardNormal(start, end, polygonArea) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return { x: 0, y: 0 };
  return polygonArea >= 0
    ? { x: dy / length, y: -dx / length }
    : { x: -dy / length, y: dx / length };
}

function offsetPoint(point, normal, amount) {
  return {
    x: point.x + normal.x * amount,
    y: point.y + normal.y * amount
  };
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

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function validateWholePolygonOffset(inner, offset, amount) {
  if (inner.length !== offset.length) {
    return ["整體 polygon offset 失敗：灰線點數必須與黑線角點數一致。"];
  }

  const area = signedPolygonArea(inner);
  const offsetEdges = inner.map((start, index) => {
    const end = inner[(index + 1) % inner.length];
    const normal = outwardNormal(start, end, area);
    return {
      start: offsetPoint(start, normal, amount),
      end: offsetPoint(end, normal, amount)
    };
  });

  const messages = [];
  for (let i = 0; i < inner.length; i += 1) {
    const previous = offsetEdges[(i - 1 + offsetEdges.length) % offsetEdges.length];
    const current = offsetEdges[i];
    const expected = lineIntersection(previous.start, previous.end, current.start, current.end);
    if (!expected || distance(expected, offset[i]) > 0.001) {
      messages.push(`整體 polygon offset 失敗：第 ${i + 1} 個灰線角點不是相鄰 offset 邊交點。`);
      break;
    }
  }
  return messages;
}

function readSample(fileName) {
  const fullPath = path.join(__dirname, "samples", fileName);
  return parseSvgPaths(fs.readFileSync(fullPath, "utf8"));
}

function checkSample(fileName) {
  const paths = readSample(fileName);
  const results = [];

  for (const item of paths) {
    const inner = item.points;
    if (inner.closed === false || inner.length < 3) continue;

    const offset = AutoJoinery.offsetClosedPath(inner, defaultParams.materialThickness);
    if (!offset) {
      results.push({ id: item.id, status: "fail", checkFunction: "offsetClosedPath", messages: ["offset failed"] });
      continue;
    }

    const cut = AutoJoinery.drawJoineryPath(inner, offset, sampleEdgeTypes(inner.length), defaultParams);
    const check = AutoJoinery.checkJoineryPath(inner, offset, cut);
    const wholeOffsetMessages = inner.length > 4
      ? validateWholePolygonOffset(inner, offset, defaultParams.materialThickness)
      : [];
    const status = check.status === "fail" || wholeOffsetMessages.length ? "fail" : check.status;

    results.push({
      id: item.id,
      status,
      checkFunction: "checkJoineryPath",
      blackPoints: inner.length,
      grayPoints: offset.length,
      redPoints: cut.length,
      offsetMode: inner.length > 4 ? "whole-polygon" : "rectangle-or-polygon",
      messages: [...check.messages, ...wholeOffsetMessages]
    });
  }

  return { fileName, role: "check", paths: results };
}

function drawSample(fileName) {
  const paths = readSample(fileName);
  const drawn = [];
  const results = [];

  for (const item of paths) {
    const inner = item.points;
    if (inner.closed === false || inner.length < 3) continue;

    const offset = AutoJoinery.offsetClosedPath(inner, defaultParams.materialThickness);
    if (!offset) {
      results.push({ id: item.id, status: "fail", drawFunction: "offsetClosedPath", messages: ["offset failed"] });
      continue;
    }

    const cut = AutoJoinery.drawJoineryPath(inner, offset, sampleEdgeTypes(inner.length), defaultParams);
    const check = AutoJoinery.checkJoineryPath(inner, offset, cut);
    drawn.push({ id: item.id, inner, offset, cut });
    results.push({
      id: item.id,
      status: check.status,
      drawFunction: "drawJoineryPath",
      blackPoints: inner.length,
      grayPoints: offset.length,
      redPoints: cut.length,
      messages: check.messages
    });
  }

  const outputName = fileName.replace(/\.svg$/i, "_draw.svg");
  const outputPath = path.join(__dirname, "output", outputName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderDrawSvg(drawn, outputName), "utf8");

  return { fileName, role: "draw", output: `function/output/${outputName}`, paths: results };
}

function renderDrawSvg(items, title) {
  const allPoints = [];
  for (const item of items) allPoints.push(...item.inner, ...item.offset, ...item.cut);
  const minX = Math.min(...allPoints.map(point => point.x)) - 8;
  const minY = Math.min(...allPoints.map(point => point.y)) - 8;
  const maxX = Math.max(...allPoints.map(point => point.x)) + 8;
  const maxY = Math.max(...allPoints.map(point => point.y)) + 8;
  const width = maxX - minX;
  const height = maxY - minY;
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}mm" height="${num(height)}mm" viewBox="${num(minX)} ${num(minY)} ${num(width)} ${num(height)}">`,
    `  <title>${title}</title>`,
    `  <g id="black-inner-lines" fill="none" stroke="#000000" stroke-width="0.35">`
  ];
  for (const item of items) lines.push(`    <path id="${item.id}_black" d="${pathToD(item.inner)}"/>`);
  lines.push(`  </g>`, `  <g id="gray-offset-lines" fill="none" stroke="#9ca3af" stroke-width="0.35">`);
  for (const item of items) lines.push(`    <path id="${item.id}_gray" d="${pathToD(item.offset)}"/>`);
  lines.push(`  </g>`, `  <g id="red-cut-lines" fill="none" stroke="#ff0000" stroke-width="0.2" stroke-linejoin="miter" stroke-linecap="square">`);
  for (const item of items) lines.push(`    <path id="${item.id}_red" d="${pathToD(item.cut)}"/>`);
  lines.push(`  </g>`, `</svg>`, ``);
  return lines.join("\n");
}

const report = {
  checkSuite: checkSamples.map(checkSample),
  drawSuite: drawSamples.map(drawSample)
};
const failures = [
  ...report.checkSuite.flatMap(sample => sample.paths.filter(item => item.status === "fail")),
  ...report.drawSuite.flatMap(sample => sample.paths.filter(item => item.status === "fail"))
];

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
