const NS = "http://www.w3.org/2000/svg";
const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

const LAYER_COUNT = 12;
const LAYER_COLORS = [
  "#0072b2",
  "#e69f00",
  "#009e73",
  "#d55e00",
  "#cc79a7",
  "#56b4e9",
  "#f0e442",
  "#6a3d9a",
  "#8c564b",
  "#17becf",
  "#7f7f7f",
  "#000000"
];

const els = {
  imageInput: document.querySelector("#imageInput"),
  loadSample: document.querySelector("#loadSample"),
  sourceCanvas: document.querySelector("#sourceCanvas"),
  machineWatts: document.querySelector("#machineWatts"),
  outputWidthMm: document.querySelector("#outputWidthMm"),
  minPower: document.querySelector("#minPower"),
  maxPower: document.querySelector("#maxPower"),
  sampleWidth: document.querySelector("#sampleWidth"),
  outputMode: document.querySelector("#outputMode"),
  projectName: document.querySelector("#projectName"),
  checkInkscape: document.querySelector("#checkInkscape"),
  inkscapeStatus: document.querySelector("#inkscapeStatus"),
  downloadSvg: document.querySelector("#downloadSvg"),
  downloadCsv: document.querySelector("#downloadCsv"),
  downloadFallback: document.querySelector("#downloadFallback"),
  powerTable: document.querySelector("#powerTable"),
  profileSummary: document.querySelector("#profileSummary"),
  statusText: document.querySelector("#statusText"),
  previewSvg: document.querySelector("#previewSvg"),
  emptyState: document.querySelector("#emptyState"),
  imageMetric: document.querySelector("#imageMetric"),
  svgMetric: document.querySelector("#svgMetric"),
  cellMetric: document.querySelector("#cellMetric"),
  resetView: document.querySelector("#resetView"),
  legend: document.querySelector("#legend")
};

const state = {
  image: null,
  imageName: "",
  sourceWidth: 0,
  sourceHeight: 0,
  sampled: null,
  layerRuns: [],
  tracePaths: [],
  fallbackUrls: {}
};

renderPowerTable();
renderLegend();
checkInkscapeStatus();

els.imageInput.addEventListener("change", async () => {
  const file = els.imageInput.files?.[0];
  if (!file) return;
  await loadImageFile(file);
});

els.loadSample.addEventListener("click", async () => {
  await loadImageUrl("assets/sample.png", "sample.png");
});

els.checkInkscape.addEventListener("click", () => {
  checkInkscapeStatus();
});

[
  els.machineWatts,
  els.outputWidthMm,
  els.minPower,
  els.maxPower,
  els.sampleWidth,
  els.outputMode,
  els.projectName
].forEach((input) => {
  input.addEventListener("input", () => {
    renderPowerTable();
    if (state.image) buildPreview();
  });
});

els.resetView.addEventListener("click", () => {
  if (state.image) buildPreview();
});

els.downloadSvg.addEventListener("click", () => {
  if (!state.sampled) return;
  exposeDownload(`${safeBaseName()}.svg`, buildSvgDocument(), "image/svg+xml", "svg");
});

els.downloadCsv.addEventListener("click", () => {
  exposeDownload(`${safeBaseName()}_beam_studio_power_table.csv`, buildPowerCsv(), "text/csv;charset=utf-8", "csv");
});

async function loadImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  state.image = image;
  state.imageName = file.name;
  state.sourceWidth = image.naturalWidth;
  state.sourceHeight = image.naturalHeight;
  buildPreview();
}

async function loadImageUrl(url, name) {
  const image = await loadImage(url);
  state.image = image;
  state.imageName = name;
  state.sourceWidth = image.naturalWidth;
  state.sourceHeight = image.naturalHeight;
  buildPreview();
}

function buildPreview() {
  const settings = readSettings();
  const sampled = sampleImage(state.image, settings.sampleWidth);
  const layerRuns = buildLayerRuns(sampled);
  const tracePaths = settings.outputMode === "trace" ? buildTracePaths(sampled) : [];
  state.sampled = sampled;
  state.layerRuns = layerRuns;
  state.tracePaths = tracePaths;
  drawPreviewSvg(settings, sampled, layerRuns, tracePaths);
  updateMetrics(settings, sampled, layerRuns, tracePaths);
  els.downloadSvg.disabled = false;
  els.downloadCsv.disabled = false;
  els.emptyState.hidden = true;
  els.statusText.textContent = "已建立";
}

function sampleImage(image, targetWidth) {
  const width = clamp(Math.round(targetWidth), 24, 240);
  const height = Math.max(1, Math.round(width * image.naturalHeight / image.naturalWidth));
  const canvas = els.sourceCanvas;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const layers = new Uint8Array(width * height);
  const visible = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const alpha = imageData.data[offset + 3];
    if (alpha < 16) continue;
    const r = imageData.data[offset];
    const g = imageData.data[offset + 1];
    const b = imageData.data[offset + 2];
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const darkness = 255 - gray;
    const layer = Math.min(LAYER_COUNT - 1, Math.floor(darkness / 256 * LAYER_COUNT));
    layers[i] = layer;
    visible[i] = 1;
  }

  return { width, height, layers, visible };
}

function buildLayerRuns(sampled) {
  const groups = Array.from({ length: LAYER_COUNT }, () => []);
  for (let y = 0; y < sampled.height; y += 1) {
    let x = 0;
    while (x < sampled.width) {
      const index = y * sampled.width + x;
      if (!sampled.visible[index]) {
        x += 1;
        continue;
      }
      const layer = sampled.layers[index];
      let runWidth = 1;
      while (x + runWidth < sampled.width) {
        const next = y * sampled.width + x + runWidth;
        if (!sampled.visible[next] || sampled.layers[next] !== layer) break;
        runWidth += 1;
      }
      groups[layer].push({ x, y, width: runWidth });
      x += runWidth;
    }
  }
  return groups;
}

function drawPreviewSvg(settings, sampled, layerRuns, tracePaths) {
  clearSvg(els.previewSvg);
  const outputHeightMm = settings.outputWidthMm * sampled.height / sampled.width;
  els.previewSvg.setAttribute("viewBox", `0 0 ${svgNum(settings.outputWidthMm)} ${svgNum(outputHeightMm)}`);
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  layerRuns.forEach((runs, layerIndex) => {
    const group = createSvgElement("g", {
      id: layerId(layerIndex, settings),
      "data-layer": `L${pad2(layerIndex + 1)}`,
      "data-power-percent": powerForLayer(layerIndex, settings).toFixed(1),
      "data-estimated-watts": estimatedWatts(layerIndex, settings).toFixed(2),
      fill: LAYER_COLORS[layerIndex],
      stroke: "none"
    });
    if (settings.outputMode === "trace") {
      appendTracePaths(group, tracePaths[layerIndex], sampled, settings.outputWidthMm, outputHeightMm);
    } else {
      appendRuns(group, runs, sampled, settings.outputWidthMm, outputHeightMm);
    }
    els.previewSvg.appendChild(group);
  });
}

function buildSvgDocument() {
  const settings = readSettings();
  const sampled = state.sampled;
  const outputHeightMm = settings.outputWidthMm * sampled.height / sampled.width;
  const svg = createSvgElement("svg", {
    xmlns: NS,
    "xmlns:inkscape": INKSCAPE_NS,
    width: `${svgNum(settings.outputWidthMm)}mm`,
    height: `${svgNum(outputHeightMm)}mm`,
    viewBox: `0 0 ${svgNum(settings.outputWidthMm)} ${svgNum(outputHeightMm)}`,
    version: "1.1"
  });

  const metadata = createSvgElement("metadata", {});
  metadata.textContent = JSON.stringify({
    generator: "3Dto2D v4 FLUX gradient layer test",
    source: state.imageName,
    machineProfile: `FLUX ${settings.machineWatts}W`,
    layerCount: LAYER_COUNT,
    outputMode: settings.outputMode,
    powerRangePercent: [settings.minPower, settings.maxPower],
    note: "Suggested settings only. Calibrate in Beam Studio with real material before production.",
    layers: layerSettings(settings)
  }, null, 2);
  svg.appendChild(metadata);

  const desc = createSvgElement("desc", {});
  desc.textContent = `Beam Studio friendly SVG: import by Color when possible. Profile FLUX ${settings.machineWatts}W, ${LAYER_COUNT} layers, ${settings.minPower}% to ${settings.maxPower}%.`;
  svg.appendChild(desc);

  state.layerRuns.forEach((runs, layerIndex) => {
    const group = createSvgElement("g", {
      id: layerId(layerIndex, settings),
      "inkscape:groupmode": "layer",
      "inkscape:label": layerLabel(layerIndex, settings),
      "data-layer": `L${pad2(layerIndex + 1)}`,
      "data-tone": layerTone(layerIndex),
      "data-color": LAYER_COLORS[layerIndex],
      "data-power-percent": powerForLayer(layerIndex, settings).toFixed(1),
      "data-estimated-watts": estimatedWatts(layerIndex, settings).toFixed(2),
      fill: LAYER_COLORS[layerIndex],
      stroke: "none"
    });
    if (settings.outputMode === "trace") {
      appendTracePaths(group, state.tracePaths[layerIndex], sampled, settings.outputWidthMm, outputHeightMm);
    } else {
      appendRuns(group, runs, sampled, settings.outputWidthMm, outputHeightMm);
    }
    svg.appendChild(group);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}\n`;
}

function appendRuns(group, runs, sampled, outputWidthMm, outputHeightMm) {
  const cellWidth = outputWidthMm / sampled.width;
  const cellHeight = outputHeightMm / sampled.height;
  runs.forEach((run) => {
    group.appendChild(createSvgElement("rect", {
      x: svgNum(run.x * cellWidth),
      y: svgNum(run.y * cellHeight),
      width: svgNum(run.width * cellWidth),
      height: svgNum(cellHeight)
    }));
  });
}

function buildTracePaths(sampled) {
  const tracer = getImageTracer();
  if (!tracer) return Array.from({ length: LAYER_COUNT }, () => []);
  const options = {
    ltres: 0.6,
    qtres: 0.6,
    pathomit: 4,
    rightangleenhance: false,
    colorsampling: 0,
    colorquantcycles: 1,
    numberofcolors: 2,
    strokewidth: 0,
    scale: 1,
    viewbox: true,
    pal: [
      { r: 255, g: 255, b: 255, a: 255 },
      { r: 0, g: 0, b: 0, a: 255 }
    ]
  };

  return Array.from({ length: LAYER_COUNT }, (_, layerIndex) => {
    const imageData = maskImageDataForLayer(sampled, layerIndex);
    const traced = tracer.imagedataToTracedata(imageData, options);
    const blackLayerIndex = findPaletteIndex(traced.palette, 0, 0, 0);
    const paths = traced.layers[blackLayerIndex] || [];
    return paths
      .filter((path) => !path.isholepath)
      .map((path) => ({
        segments: path.segments,
        holes: path.holechildren.map((childIndex) => paths[childIndex]).filter(Boolean)
      }));
  });
}

function getImageTracer() {
  return globalThis.ImageTracer || globalThis.self?.ImageTracer || globalThis.window?.ImageTracer || null;
}

function maskImageDataForLayer(sampled, layerIndex) {
  const data = new Uint8ClampedArray(sampled.width * sampled.height * 4);
  for (let i = 0; i < sampled.width * sampled.height; i += 1) {
    const offset = i * 4;
    const isLayerPixel = sampled.visible[i] && sampled.layers[i] === layerIndex;
    const value = isLayerPixel ? 0 : 255;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return { width: sampled.width, height: sampled.height, data };
}

function findPaletteIndex(palette, r, g, b) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  palette.forEach((color, index) => {
    const distance = Math.abs(color.r - r) + Math.abs(color.g - g) + Math.abs(color.b - b);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function appendTracePaths(group, paths, sampled, outputWidthMm, outputHeightMm) {
  const scaleX = outputWidthMm / sampled.width;
  const scaleY = outputHeightMm / sampled.height;
  (paths || []).forEach((path) => {
    const d = tracePathData(path, scaleX, scaleY);
    if (!d) return;
    group.appendChild(createSvgElement("path", { d, "fill-rule": "evenodd" }));
  });
}

function tracePathData(path, scaleX, scaleY) {
  if (!path?.segments?.length) return "";
  const segments = path.segments;
  const first = segments[0];
  const commands = [`M ${svgNum(first.x1 * scaleX)} ${svgNum(first.y1 * scaleY)}`];
  segments.forEach((segment) => {
    if (segment.type === "Q") {
      commands.push(`Q ${svgNum(segment.x2 * scaleX)} ${svgNum(segment.y2 * scaleY)} ${svgNum(segment.x3 * scaleX)} ${svgNum(segment.y3 * scaleY)}`);
    } else {
      commands.push(`L ${svgNum(segment.x2 * scaleX)} ${svgNum(segment.y2 * scaleY)}`);
    }
  });
  commands.push("Z");
  (path.holes || []).forEach((hole) => {
    const holeCommands = traceHolePathData(hole, scaleX, scaleY);
    if (holeCommands) commands.push(holeCommands);
  });
  return commands.join(" ");
}

function traceHolePathData(path, scaleX, scaleY) {
  if (!path?.segments?.length) return "";
  const segments = path.segments;
  const last = segments[segments.length - 1];
  const startX = last.x3 ?? last.x2;
  const startY = last.y3 ?? last.y2;
  const commands = [`M ${svgNum(startX * scaleX)} ${svgNum(startY * scaleY)}`];
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment.type === "Q") {
      commands.push(`Q ${svgNum(segment.x2 * scaleX)} ${svgNum(segment.y2 * scaleY)} ${svgNum(segment.x1 * scaleX)} ${svgNum(segment.y1 * scaleY)}`);
    } else {
      commands.push(`L ${svgNum(segment.x1 * scaleX)} ${svgNum(segment.y1 * scaleY)}`);
    }
  }
  commands.push("Z");
  return commands.join(" ");
}

function renderPowerTable() {
  const settings = readSettings();
  els.profileSummary.textContent = `FLUX ${settings.machineWatts}W`;
  els.powerTable.replaceChildren(...layerSettings(settings).map((layer) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${layer.layer}</td>
      <td><span class="swatch" style="background:${layer.color}"></span>${layer.color}</td>
      <td>${layer.powerPercent.toFixed(1)}%</td>
      <td>${layer.estimatedWatts.toFixed(2)}W</td>
    `;
    return tr;
  }));
}

async function checkInkscapeStatus() {
  setInkscapeStatus("正在檢查本機 Inkscape helper...", "warn");
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch("http://127.0.0.1:4175/status", {
      cache: "no-store",
      signal: controller.signal
    });
    const result = await response.json();
    if (result.found) {
      setInkscapeStatus(`已找到 Inkscape：${result.path}`, "ok");
      return;
    }
    setInkscapeStatus("本機 helper 已啟動，但找不到 Inkscape。請先安裝 Inkscape，或把 inkscape.exe 加到 PATH。", "error");
  } catch (error) {
    setInkscapeStatus("尚未連上本機 helper，無法自動確認 Inkscape 安裝位置。請執行 `node v4/helper/inkscape-helper.js`，或手動確認已安裝 Inkscape。", "warn");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function setInkscapeStatus(message, level) {
  els.inkscapeStatus.textContent = message;
  els.inkscapeStatus.className = `inkscape-status ${level}`;
}

function renderLegend() {
  els.legend.replaceChildren(...LAYER_COLORS.map((color, index) => {
    const item = document.createElement("span");
    item.innerHTML = `<span class="swatch" style="background:${color}"></span>L${pad2(index + 1)}`;
    return item;
  }));
}

function buildPowerCsv() {
  const settings = readSettings();
  const rows = [
    ["Layer", "Tone", "Color", "MachineProfile", "OutputMode", "SuggestedPowerPercent", "EstimatedWatts", "BeamStudioNote"],
    ...layerSettings(settings).map((layer) => [
      layer.layer,
      layer.tone,
      layer.color,
      `FLUX ${settings.machineWatts}W`,
      settings.outputMode,
      layer.powerPercent.toFixed(1),
      layer.estimatedWatts.toFixed(2),
      "Import SVG by Color, then set this color layer power in Beam Studio."
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function layerSettings(settings) {
  return Array.from({ length: LAYER_COUNT }, (_, index) => ({
    layer: `L${pad2(index + 1)}`,
    tone: layerTone(index),
    color: LAYER_COLORS[index],
    powerPercent: powerForLayer(index, settings),
    estimatedWatts: estimatedWatts(index, settings)
  }));
}

function readSettings() {
  const minPower = clamp(Number(els.minPower.value) || 0, 0, 100);
  const maxPower = clamp(Number(els.maxPower.value) || minPower, minPower, 100);
  return {
    machineWatts: Number(els.machineWatts.value) || 30,
    outputWidthMm: clamp(Number(els.outputWidthMm.value) || 100, 10, 600),
    minPower,
    maxPower,
    sampleWidth: clamp(Number(els.sampleWidth.value) || 140, 24, 240),
    outputMode: els.outputMode.value === "trace" ? "trace" : "rect"
  };
}

function powerForLayer(layerIndex, settings) {
  if (LAYER_COUNT === 1) return settings.maxPower;
  return settings.minPower + (settings.maxPower - settings.minPower) * layerIndex / (LAYER_COUNT - 1);
}

function estimatedWatts(layerIndex, settings) {
  return settings.machineWatts * powerForLayer(layerIndex, settings) / 100;
}

function layerTone(layerIndex) {
  if (layerIndex === 0) return "lightest";
  if (layerIndex === LAYER_COUNT - 1) return "darkest";
  return `tone_${pad2(layerIndex + 1)}`;
}

function layerLabel(layerIndex, settings) {
  const layer = `L${pad2(layerIndex + 1)}`;
  const power = powerForLayer(layerIndex, settings).toFixed(1).replace(".", "p");
  return `${layer}_${layerTone(layerIndex)}_${LAYER_COLORS[layerIndex]}_${power}pct_FLUX_${settings.machineWatts}W`;
}

function layerId(layerIndex, settings) {
  return layerLabel(layerIndex, settings)
    .replace("#", "color_")
    .replace(/[^A-Za-z0-9_:-]/g, "_");
}

function updateMetrics(settings, sampled, layerRuns, tracePaths) {
  const rectCount = layerRuns.reduce((sum, runs) => sum + runs.length, 0);
  const traceCount = tracePaths.reduce((sum, paths) => sum + paths.length, 0);
  const outputHeightMm = settings.outputWidthMm * sampled.height / sampled.width;
  els.imageMetric.textContent = `${state.sourceWidth} x ${state.sourceHeight}px -> ${sampled.width} x ${sampled.height}px`;
  els.svgMetric.textContent = `${svgNum(settings.outputWidthMm)} x ${svgNum(outputHeightMm)} mm`;
  els.cellMetric.textContent = settings.outputMode === "trace" ? `${traceCount} trace paths` : `${rectCount} rect runs`;
}

function createSvgElement(name, attributes) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function exposeDownload(name, content, type, key) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  if (state.fallbackUrls[key]) URL.revokeObjectURL(state.fallbackUrls[key]);
  state.fallbackUrls[key] = url;

  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  renderDownloadFallback();
}

function renderDownloadFallback() {
  const links = Object.entries(state.fallbackUrls);
  if (!links.length) return;
  els.downloadFallback.hidden = false;
  els.downloadFallback.replaceChildren();
  const note = document.createElement("p");
  note.textContent = "若瀏覽器沒有自動下載，請用下方連結開啟後另存。";
  els.downloadFallback.appendChild(note);
  links.forEach(([key, url]) => {
    const link = document.createElement("a");
    const isSvg = key === "svg";
    const name = isSvg ? `${safeBaseName()}.svg` : `${safeBaseName()}_beam_studio_power_table.csv`;
    link.href = url;
    link.download = name;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = isSvg ? "開啟 / 另存 SVG" : "開啟 / 另存功率表 CSV";
    els.downloadFallback.appendChild(link);
  });
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function safeBaseName() {
  return (els.projectName.value || "flux_gradient_test")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "flux_gradient_test";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function svgNum(value) {
  return Number.parseFloat(value.toFixed(4)).toString();
}
