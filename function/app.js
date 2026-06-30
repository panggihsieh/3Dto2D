const CHECK_SAMPLES = [
  "basic_cube.svg",
  "basic_cuboid.svg",
  "basic_gable_house.svg"
];

const DRAW_SAMPLES = [
  "cuboid_practice.svg",
  "gable_house_practice.svg"
];

const state = {
  mode: "check",
  zoom: 1,
  baseViewBox: null,
  redOnly: false,
  lastResults: [],
  loadedSample: "",
  hasDrawn: false,
  hasChecked: false
};

const els = {
  checkMode: document.querySelector("#checkMode"),
  drawMode: document.querySelector("#drawMode"),
  sampleSelect: document.querySelector("#sampleSelect"),
  runButton: document.querySelector("#runButton"),
  drawButton: document.querySelector("#drawButton"),
  checkButton: document.querySelector("#checkButton"),
  materialThickness: document.querySelector("#materialThickness"),
  tabDepth: document.querySelector("#tabDepth"),
  tabWidth: document.querySelector("#tabWidth"),
  tabSpacing: document.querySelector("#tabSpacing"),
  kerfWidth: document.querySelector("#kerfWidth"),
  modeTitle: document.querySelector("#modeTitle"),
  sampleTitle: document.querySelector("#sampleTitle"),
  pathCount: document.querySelector("#pathCount"),
  okCount: document.querySelector("#okCount"),
  failCount: document.querySelector("#failCount"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
  zoomLevel: document.querySelector("#zoomLevel"),
  redOnlyButton: document.querySelector("#redOnlyButton"),
  previewSvg: document.querySelector("#previewSvg"),
  resultList: document.querySelector("#resultList")
};

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function params() {
  const materialThickness = readNumber(els.materialThickness, 3);
  const tabDepth = readNumber(els.tabDepth, materialThickness);
  return {
    materialThickness,
    tabDepth,
    tabWidth: readNumber(els.tabWidth, 10),
    tabSpacing: readNumber(els.tabSpacing, 8),
    kerfWidth: readNumber(els.kerfWidth, 0.15)
  };
}

function setMode(mode) {
  state.mode = mode;
  state.redOnly = false;
  els.checkMode.classList.toggle("active", mode === "check");
  els.drawMode.classList.toggle("active", mode === "draw");
  els.checkMode.setAttribute("aria-pressed", String(mode === "check"));
  els.drawMode.setAttribute("aria-pressed", String(mode === "draw"));
  els.modeTitle.textContent = mode === "check" ? "Check" : "Draw";
  updateRedOnlyButton();
  populateSamples();
  run();
}

function populateSamples() {
  const samples = state.mode === "check" ? CHECK_SAMPLES : DRAW_SAMPLES;
  els.sampleSelect.replaceChildren(...samples.map((sample) => {
    const option = document.createElement("option");
    option.value = sample;
    option.textContent = sample;
    return option;
  }));
}

async function loadSample(fileName) {
  const response = await fetch(`samples/${fileName}`);
  if (!response.ok) throw new Error(`Cannot load ${fileName}`);
  return parseSvgPaths(await response.text());
}

function parseSvgPaths(svg) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  return [...doc.querySelectorAll("path")].map((path, index) => ({
    id: path.getAttribute("id") || `path_${index + 1}`,
    points: parseSimplePathD(path.getAttribute("d") || "")
  })).filter((item) => item.points.length >= 3);
}

function parseSimplePathD(d) {
  const tokens = d.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
  const points = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index++];
    if (token === "M" || token === "L") {
      points.push({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
    } else if (token === "Z") {
      points.closed = true;
    }
  }
  if (points.length && points.closed !== true) points.closed = false;
  return points;
}

function sampleEdgeTypes(pointCount) {
  return Array.from({ length: pointCount }, (_, index) => {
    if (index === 0) return "f";
    if (index === 2) return "F";
    return "e";
  });
}

function runPath(item, options) {
  const inner = item.points;
  const offset = AutoJoinery.offsetClosedPath(inner, options.materialThickness);
  if (!offset) {
    return {
      id: item.id,
      status: "fail",
      inner,
      offset: [],
      cut: [],
      messages: ["offset failed"]
    };
  }

  return {
    id: item.id,
    status: "ready",
    inner,
    offset,
    cut: [],
    messages: ["黑線與灰線已產生，下一步 Draw。"]
  };
}

async function run() {
  const fileName = els.sampleSelect.value;
  els.sampleTitle.textContent = fileName;

  try {
    const samplePaths = await loadSample(fileName);
    const results = samplePaths.map((item) => runPath(item, params()));
    state.loadedSample = fileName;
    state.lastResults = results;
    state.hasDrawn = false;
    state.hasChecked = false;
    state.redOnly = false;
    renderPreview(results);
    renderResults(results);
  } catch (error) {
    els.resultList.textContent = error.message;
  }
}

async function draw() {
  if (!state.lastResults.length || state.loadedSample !== els.sampleSelect.value) await run();

  const options = params();
  state.lastResults = state.lastResults.map((result) => {
    if (!result.offset.length) return result;
    const cut = AutoJoinery.drawJoineryPath(result.inner, result.offset, sampleEdgeTypes(result.inner.length), options);
    return {
      ...result,
      status: "drawn",
      cut,
      messages: ["紅線已產生，下一步 Check。"]
    };
  });
  state.hasDrawn = true;
  state.hasChecked = false;
  renderPreview(state.lastResults);
  renderResults(state.lastResults);
}

async function check() {
  if (!state.hasDrawn) await draw();

  state.lastResults = state.lastResults.map((result) => {
    if (!result.cut.length) {
      return {
        ...result,
        status: "fail",
        messages: ["尚未產生紅線。"]
      };
    }
    const checked = AutoJoinery.checkJoineryPath(result.inner, result.offset, result.cut);
    return {
      ...result,
      status: checked.status,
      messages: checked.messages
    };
  });
  state.hasChecked = true;
  renderPreview(state.lastResults);
  renderResults(state.lastResults);
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

function renderPreview(results) {
  els.previewSvg.replaceChildren();
  const points = results.flatMap((result) => [...result.inner, ...result.offset, ...result.cut]);
  if (!points.length) return;

  const minX = Math.min(...points.map((point) => point.x)) - 8;
  const minY = Math.min(...points.map((point) => point.y)) - 8;
  const maxX = Math.max(...points.map((point) => point.x)) + 8;
  const maxY = Math.max(...points.map((point) => point.y)) + 8;
  state.baseViewBox = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
  state.zoom = 1;
  updatePreviewZoom();
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const hasRedLines = results.some((result) => result.cut.length);
  if (!(hasRedLines && state.redOnly)) {
    appendLayer("black-inner-lines", "#000000", results.map((result) => [result.id, result.inner]), 0.35);
    appendLayer("gray-offset-lines", "#9ca3af", results.map((result) => [result.id, result.offset]), 0.35);
  }
  if (hasRedLines) {
    appendLayer("red-cut-lines", "#ff0000", results.map((result) => [result.id, result.cut]), 0.2);
  }
  updateRedOnlyButton();
}

function updatePreviewZoom() {
  if (!state.baseViewBox) return;
  const centerX = state.baseViewBox.x + state.baseViewBox.width / 2;
  const centerY = state.baseViewBox.y + state.baseViewBox.height / 2;
  const width = state.baseViewBox.width / state.zoom;
  const height = state.baseViewBox.height / state.zoom;
  els.previewSvg.setAttribute(
    "viewBox",
    `${num(centerX - width / 2)} ${num(centerY - height / 2)} ${num(width)} ${num(height)}`
  );
  els.zoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function zoomPreview(factor) {
  state.zoom = Math.min(8, Math.max(0.25, state.zoom * factor));
  updatePreviewZoom();
}

function resetPreviewZoom() {
  state.zoom = 1;
  updatePreviewZoom();
}

function toggleRedOnly() {
  if (!state.lastResults.some((result) => result.cut.length)) return;
  state.redOnly = !state.redOnly;
  updateRedOnlyButton();
  renderPreview(state.lastResults);
}

function updateRedOnlyButton() {
  const enabled = state.lastResults.some((result) => result.cut.length);
  els.redOnlyButton.disabled = !enabled;
  els.redOnlyButton.classList.toggle("active", enabled && state.redOnly);
  els.redOnlyButton.setAttribute("aria-pressed", String(enabled && state.redOnly));
}

function appendLayer(id, stroke, paths, strokeWidth) {
  const group = svgElement("g", { id, fill: "none", stroke, "stroke-width": strokeWidth, "vector-effect": "non-scaling-stroke" });
  for (const [pathId, points] of paths) {
    if (!points.length) continue;
    group.appendChild(svgElement("path", {
      id: `${pathId}_${id}`,
      d: pathToD(points),
      "stroke-linejoin": "miter",
      "stroke-linecap": "square"
    }));
  }
  els.previewSvg.appendChild(group);
}

function svgElement(name, attrs) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

function renderResults(results) {
  const ok = results.filter((result) => result.status === "ok").length;
  const fail = results.filter((result) => result.status === "fail").length;
  els.pathCount.textContent = String(results.length);
  els.okCount.textContent = String(ok);
  els.failCount.textContent = String(fail);
  updateRedOnlyButton();

  els.resultList.replaceChildren(...results.map((result) => {
    const row = document.createElement("div");
    row.className = "result-row";

    const name = document.createElement("strong");
    name.textContent = result.id;

    const status = document.createElement("span");
    status.className = `status ${result.status}`;
    status.textContent = result.status.toUpperCase();

    const messages = document.createElement("span");
    messages.className = "messages";
    messages.textContent = result.messages.length
      ? result.messages.join(" / ")
      : `black ${result.inner.length}, gray ${result.offset.length}, red ${result.cut.length}`;

    row.append(name, status, messages);
    return row;
  }));
}

els.checkMode.addEventListener("click", () => setMode("check"));
els.drawMode.addEventListener("click", () => setMode("draw"));
els.sampleSelect.addEventListener("change", run);
els.runButton.addEventListener("click", run);
els.drawButton.addEventListener("click", draw);
els.checkButton.addEventListener("click", check);
els.zoomOutButton.addEventListener("click", () => zoomPreview(1 / 1.25));
els.zoomInButton.addEventListener("click", () => zoomPreview(1.25));
els.zoomResetButton.addEventListener("click", resetPreviewZoom);
els.redOnlyButton.addEventListener("click", toggleRedOnly);
for (const input of [els.materialThickness, els.tabDepth, els.tabWidth, els.tabSpacing, els.kerfWidth]) {
  input.addEventListener("input", run);
}

populateSamples();
updateRedOnlyButton();
run();
