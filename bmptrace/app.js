const NS = "http://www.w3.org/2000/svg";
const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

const DEFAULT_LAYER_COUNT = 5;
const LAYER_PRESETS = [5, 7, 12, 24];
const FIVE_LAYER_COLORS = [
  "#b3b3b3",
  "#939393",
  "#6e6e6e",
  "#4e4e4e",
  "#1d1d1d"
];

const WINDOWS_INSTALL_SCRIPT_URL = "install/bmptrace-install-potrace.ps1";
const SVG_LAYER_TRANSFER_KEY = "bmptrace.latestSvgForLayerInspector";
const DEFAULT_PREVIEW_SCALE = 1;
const PREVIEW_SCALE_STEP = 0.1;
const MIN_PREVIEW_SCALE = 0.2;
const MAX_PREVIEW_SCALE = 4;

const els = {
  imageInput: document.querySelector("#imageInput"),
  loadSample: document.querySelector("#loadSample"),
  sourceCanvas: document.querySelector("#sourceCanvas"),
  machineWatts: document.querySelector("#machineWatts"),
  outputWidthMm: document.querySelector("#outputWidthMm"),
  minPower: document.querySelector("#minPower"),
  maxPower: document.querySelector("#maxPower"),
  engraveSpeed: document.querySelector("#engraveSpeed"),
  outputMode: document.querySelector("#outputMode"),
  projectName: document.querySelector("#projectName"),
  traceScans: document.querySelector("#traceScans"),
  checkTools: document.querySelector("#checkTools"),
  potraceStatus: document.querySelector("#potraceStatus"),
  potraceInstallBadge: document.querySelector("#potraceInstallBadge"),
  topPotraceBadge: document.querySelector("#topPotraceBadge"),
  installModal: document.querySelector("#installModal"),
  closeInstallModal: document.querySelector("#closeInstallModal"),
  layerInspectorModal: document.querySelector("#layerInspectorModal"),
  closeLayerInspectorModal: document.querySelector("#closeLayerInspectorModal"),
  layerInspectorFrame: document.querySelector("#layerInspectorFrame"),
  downloadSvg: document.querySelector("#downloadSvg"),
  openLayerInspector: document.querySelector("#openLayerInspector"),
  downloadCsv: document.querySelector("#downloadCsv"),
  downloadFallback: document.querySelector("#downloadFallback"),
  powerTable: document.querySelector("#powerTable"),
  profileSummary: document.querySelector("#profileSummary"),
  layerSummary: document.querySelector("#layerSummary"),
  statusText: document.querySelector("#statusText"),
  previewSvg: document.querySelector("#previewSvg"),
  sourceInset: document.querySelector("#sourceInset"),
  sourcePreview: document.querySelector("#sourcePreview"),
  emptyState: document.querySelector("#emptyState"),
  imageMetric: document.querySelector("#imageMetric"),
  svgMetric: document.querySelector("#svgMetric"),
  cellMetric: document.querySelector("#cellMetric"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomMetric: document.querySelector("#zoomMetric"),
  resetView: document.querySelector("#resetView"),
  legend: document.querySelector("#legend"),
  copyStatus: document.querySelector("#copyStatus")
};

const state = {
  image: null,
  imageName: "",
  imageUrl: "",
  sourceWidth: 0,
  sourceHeight: 0,
  sampled: null,
  layerRuns: [],
  tracePaths: [],
  previewScale: DEFAULT_PREVIEW_SCALE,
  fallbackUrls: {}
};

renderPowerTable();
renderLegend();
applyPreviewScale();
checkToolStatus();

els.imageInput.addEventListener("change", async () => {
  const file = els.imageInput.files?.[0];
  if (!file) return;
  await loadImageFile(file);
});

els.loadSample.addEventListener("click", async () => {
  await loadImageUrl("assets/sample.png", "sample.png");
});

els.checkTools.addEventListener("click", () => {
  checkToolStatus();
});

els.closeInstallModal.addEventListener("click", () => {
  closeInstallModal();
});

els.installModal.addEventListener("click", (event) => {
  if (event.target === els.installModal) closeInstallModal();
});

els.closeLayerInspectorModal.addEventListener("click", () => {
  closeLayerInspectorModal();
});

els.layerInspectorModal.addEventListener("click", (event) => {
  if (event.target === els.layerInspectorModal) closeLayerInspectorModal();
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

document.querySelectorAll(".copy-command").forEach((button) => {
  button.addEventListener("click", async () => {
    await copyInstallCommand(button.dataset.copyCommand || "");
  });
});

document.querySelectorAll(".open-powershell").forEach((button) => {
  button.addEventListener("click", async () => {
    await openPowerShell();
  });
});

document.querySelectorAll(".download-script").forEach((button) => {
  button.addEventListener("click", () => {
    downloadWindowsInstallScript();
  });
});

document.querySelectorAll(".recheck-tools").forEach((button) => {
  button.addEventListener("click", () => {
    checkToolStatus();
  });
});

[
  els.machineWatts,
  els.outputWidthMm,
  els.minPower,
  els.maxPower,
  els.engraveSpeed,
  els.outputMode,
  els.projectName,
  els.traceScans
].forEach((input) => {
  const onSettingsChange = () => {
    renderPowerTable();
    renderLegend();
    if (state.image) buildPreview();
  };
  input.addEventListener("input", onSettingsChange);
  input.addEventListener("change", onSettingsChange);
});

els.zoomOut.addEventListener("click", () => {
  setPreviewScale(state.previewScale - PREVIEW_SCALE_STEP);
});

els.zoomIn.addEventListener("click", () => {
  setPreviewScale(state.previewScale + PREVIEW_SCALE_STEP);
});

els.resetView.addEventListener("click", () => {
  setPreviewScale(DEFAULT_PREVIEW_SCALE);
});

els.downloadSvg.addEventListener("click", () => {
  if (!state.sampled) return;
  exposeDownload(`${safeBaseName()}.svg`, buildSvgDocument(), "image/svg+xml", "svg");
});

els.openLayerInspector.addEventListener("click", () => {
  if (!state.sampled) return;
  openLayerInspector(`${safeBaseName()}.svg`, buildSvgDocument());
});

els.downloadCsv.addEventListener("click", () => {
  exposeDownload(`${safeBaseName()}_beam_studio_power_table.csv`, buildPowerCsv(), "text/csv;charset=utf-8", "csv");
});

async function loadImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  state.image = image;
  state.imageName = file.name;
  state.imageUrl = dataUrl;
  state.sourceWidth = image.naturalWidth;
  state.sourceHeight = image.naturalHeight;
  buildPreview({ resetZoom: true });
}

async function loadImageUrl(url, name) {
  const image = await loadImage(url);
  state.image = image;
  state.imageName = name;
  state.imageUrl = url;
  state.sourceWidth = image.naturalWidth;
  state.sourceHeight = image.naturalHeight;
  buildPreview({ resetZoom: true });
}

function buildPreview({ resetZoom = false } = {}) {
  const settings = readSettings();
  const sampled = sampleImage(state.image, settings.sampleWidth, settings);
  const layerRuns = buildLayerRuns(sampled, settings.traceScans);
  const tracePaths = settings.outputMode === "trace" ? buildTracePaths(sampled, settings) : [];
  state.sampled = sampled;
  state.layerRuns = layerRuns;
  state.tracePaths = tracePaths;
  drawPreviewSvg(settings, sampled, layerRuns, tracePaths);
  if (resetZoom) setPreviewScale(DEFAULT_PREVIEW_SCALE);
  updateMetrics(settings, sampled, layerRuns, tracePaths);
  els.downloadSvg.disabled = false;
  els.openLayerInspector.disabled = false;
  els.downloadCsv.disabled = false;
  els.sourcePreview.src = state.imageUrl;
  els.sourceInset.hidden = false;
  els.emptyState.hidden = true;
  els.statusText.textContent = "已建立";
}

function setPreviewScale(scale) {
  state.previewScale = clamp(scale, MIN_PREVIEW_SCALE, MAX_PREVIEW_SCALE);
  applyPreviewScale();
}

function applyPreviewScale() {
  els.previewSvg.style.setProperty("--preview-scale", state.previewScale.toFixed(2));
  els.zoomMetric.textContent = `${Math.round(state.previewScale * 100)}%`;
  els.zoomOut.disabled = state.previewScale <= MIN_PREVIEW_SCALE;
  els.zoomIn.disabled = state.previewScale >= MAX_PREVIEW_SCALE;
}

function sampleImage(image, targetWidth, settings) {
  const maxUsefulWidth = Math.min(image.naturalWidth || targetWidth, 1200);
  const width = clamp(Math.round(targetWidth), 24, maxUsefulWidth);
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
    if (settings.traceRemoveBackground && gray >= 248) continue;
    const darkness = 255 - gray;
    const layer = Math.min(settings.traceScans - 1, Math.floor(darkness / 256 * settings.traceScans));
    layers[i] = layer;
    visible[i] = 1;
  }

  return { width, height, layers, visible };
}

function buildLayerRuns(sampled, layerCount) {
  const groups = Array.from({ length: layerCount }, () => []);
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
  const colors = layerColors(settings.traceScans);
  const outputHeightMm = settings.outputWidthMm * sampled.height / sampled.width;
  els.previewSvg.setAttribute("viewBox", `0 0 ${svgNum(settings.outputWidthMm)} ${svgNum(outputHeightMm)}`);
  els.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  layerRuns.forEach((runs, layerIndex) => {
    const group = createSvgElement("g", {
      id: layerId(layerIndex, settings),
      "data-layer": `L${pad2(layerIndex + 1)}`,
      "data-power-percent": powerForLayer(layerIndex, settings).toFixed(1),
      "data-speed-mm-sec": speedForLayer(layerIndex, settings).toFixed(0),
      "data-estimated-watts": estimatedWatts(layerIndex, settings).toFixed(2),
      fill: colors[layerIndex],
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
  const colors = layerColors(settings.traceScans);
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
    generator: "3Dto2D BMPTrace FLUX gradient layer test",
    source: state.imageName,
    machineProfile: `FLUX ${settings.machineWatts}W`,
    layerCount: settings.traceScans,
    outputMode: settings.outputMode,
    traceSettings: traceSettingsForExport(settings),
    speedMmPerSec: settings.engraveSpeed,
    powerRangePercent: [settings.minPower, settings.maxPower],
    note: "Suggested settings only. Calibrate in Beam Studio with real material before production.",
    layers: layerSettings(settings)
  }, null, 2);
  svg.appendChild(metadata);

  const desc = createSvgElement("desc", {});
  desc.textContent = `Beam Studio friendly grayscale SVG: ${settings.traceScans} grayscale trace layers, profile FLUX ${settings.machineWatts}W, ${settings.minPower}% to ${settings.maxPower}%.`;
  svg.appendChild(desc);

  state.layerRuns.forEach((runs, layerIndex) => {
    const group = createSvgElement("g", {
      id: layerId(layerIndex, settings),
      "inkscape:groupmode": "layer",
      "inkscape:label": layerLabel(layerIndex, settings),
      "data-layer": `L${pad2(layerIndex + 1)}`,
      "data-tone": layerTone(layerIndex, settings.traceScans),
      "data-color": colors[layerIndex],
      "data-power-percent": powerForLayer(layerIndex, settings).toFixed(1),
      "data-speed-mm-sec": speedForLayer(layerIndex, settings).toFixed(0),
      "data-estimated-watts": estimatedWatts(layerIndex, settings).toFixed(2),
      fill: colors[layerIndex],
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

function buildTracePaths(sampled, settings) {
  const tracer = getImageTracer();
  if (!tracer) return Array.from({ length: settings.traceScans }, () => []);
  const options = {
    ltres: settings.traceOptimize,
    qtres: settings.traceSmoothCorners,
    pathomit: settings.traceSpeckles,
    rightangleenhance: !settings.traceSmooth,
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

  return Array.from({ length: settings.traceScans }, (_, layerIndex) => {
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
  els.layerSummary.textContent = `${settings.traceScans} 灰階 / ${settings.traceScans} 層`;
  els.powerTable.replaceChildren(...layerSettings(settings).map((layer) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${layer.layer}</td>
      <td><span class="swatch" style="background:${layer.color}"></span>${layer.color}</td>
      <td>${layer.powerPercent.toFixed(1)}%</td>
      <td>${layer.speedMmPerSec.toFixed(0)} mm/s</td>
      <td>${layer.estimatedWatts.toFixed(2)}W</td>
    `;
    return tr;
  }));
}

async function checkToolStatus() {
  setToolStatus(els.potraceStatus, "正在檢查 Potrace...", "warn");
  setInstallBadge("檢查中", "warn");
  setTopPotraceBadge("檢查中", "warn", true);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch("http://127.0.0.1:4175/status", {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error("helper unavailable");
    const result = await response.json();
    const potrace = result.potrace || { found: false };
    if (potrace.found) {
      setToolStatus(els.potraceStatus, `已找到 Potrace：${potrace.path}`, "ok");
      setInstallBadge("已安裝", "ok");
      setTopPotraceBadge("已安裝", "ok", true);
    } else {
      setToolStatus(els.potraceStatus, "尚未偵測到 Potrace。", "error");
      setInstallBadge("未安裝", "error");
      setTopPotraceBadge("未安裝", "error", true);
      openInstallModal();
    }
  } catch (error) {
    setToolStatus(els.potraceStatus, "尚未連上本機 helper。請用 PowerShell 執行 potrace --version 手動驗證。", "warn");
    setInstallBadge("手動驗證", "warn");
    setTopPotraceBadge("", "warn", false);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function setToolStatus(element, message, level) {
  element.textContent = message;
  element.className = `tool-status ${level}`;
}

function setInstallBadge(message, level) {
  els.potraceInstallBadge.textContent = message;
  els.potraceInstallBadge.className = `install-badge ${level}`;
}

function setTopPotraceBadge(message, level, visible) {
  els.topPotraceBadge.hidden = !visible;
  els.topPotraceBadge.className = `floating-tool-status ${level}`;
  if (visible) {
    els.topPotraceBadge.querySelector("span:last-child").textContent = `Potrace：${message}`;
  }
}

function openInstallModal() {
  els.installModal.hidden = false;
}

function closeInstallModal() {
  els.installModal.hidden = true;
}

function openLayerInspectorModal() {
  els.layerInspectorFrame.src = `../svglayers/?from=bmptrace&embed=1&v=${Date.now()}`;
  els.layerInspectorModal.hidden = false;
}

function closeLayerInspectorModal() {
  els.layerInspectorModal.hidden = true;
  els.layerInspectorFrame.removeAttribute("src");
}

function activateTab(tabId) {
  if (!tabId) return;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

async function copyInstallCommand(command) {
  if (!command.trim()) return;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(command);
      copied = true;
    } else {
      copied = fallbackCopyText(command);
    }
  } catch (error) {
    copied = fallbackCopyText(command);
  }
  if (copied) {
    setCopyStatus("已複製指令，請貼到 PowerShell / Terminal 執行。", "ok");
  } else {
    setCopyStatus("已選取備用複製內容，請手動複製後貼到終端機執行。", "warn");
  }
}

async function openPowerShell() {
  try {
    const response = await fetch("http://127.0.0.1:4175/open-powershell", {
      method: "POST",
      cache: "no-store"
    });
    if (!response.ok) throw new Error("open failed");
    setCopyStatus("已送出開啟 PowerShell 命令；若沒有彈出新視窗，請手動開啟 PowerShell 後貼上剛複製的安裝命令。", "warn");
  } catch (error) {
    setCopyStatus("無法由網頁直接開啟 PowerShell，請手動開啟 PowerShell 後貼上命令。", "warn");
  }
}

function downloadWindowsInstallScript() {
  const link = document.createElement("a");
  link.href = WINDOWS_INSTALL_SCRIPT_URL;
  link.download = "bmptrace-install-potrace.ps1";
  document.body.appendChild(link);
  link.click();
  link.remove();
  showScriptDownloadStatus();
}

function showScriptDownloadStatus() {
  els.copyStatus.className = "copy-status ok";
  els.copyStatus.replaceChildren(
    document.createTextNode("已送出下載。若沒有看到下載項目，請點這裡：")
  );
  const link = document.createElement("a");
  link.href = WINDOWS_INSTALL_SCRIPT_URL;
  link.download = "bmptrace-install-potrace.ps1";
  link.textContent = "重新下載 / 另存 bmptrace-install-potrace.ps1";
  els.copyStatus.appendChild(link);
  els.copyStatus.appendChild(document.createTextNode("，再用 PowerShell 執行。"));
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function setCopyStatus(message, level) {
  if (!els.copyStatus) return;
  els.copyStatus.textContent = message;
  els.copyStatus.className = `copy-status ${level}`;
}

function renderLegend() {
  const settings = readSettings();
  els.legend.replaceChildren(...layerSettings(settings).map((layer) => {
    const item = document.createElement("span");
    item.innerHTML = `
      <strong><span class="swatch" style="background:${layer.color}"></span>${layer.layer}</strong>
      <small>${layer.powerPercent.toFixed(1)}% / ${layer.speedMmPerSec.toFixed(0)} mm/s</small>
    `;
    return item;
  }));
}

function buildPowerCsv() {
  const settings = readSettings();
  const rows = [
    ["Layer", "Tone", "GrayFill", "MachineProfile", "OutputMode", "TraceMode", "Scans", "Smooth", "RemoveBackground", "Speckles", "SmoothCorners", "Optimize", "SuggestedPowerPercent", "SpeedMmPerSec", "EstimatedWatts", "BeamStudioNote"],
    ...layerSettings(settings).map((layer) => [
      layer.layer,
      layer.tone,
      layer.color,
      `FLUX ${settings.machineWatts}W`,
      settings.outputMode,
      settings.traceMode,
      settings.traceScans,
      settings.traceSmooth ? "yes" : "no",
      settings.traceRemoveBackground ? "yes" : "no",
      settings.traceSpeckles,
      settings.traceSmoothCorners.toFixed(2),
      settings.traceOptimize.toFixed(3),
      layer.powerPercent.toFixed(1),
      layer.speedMmPerSec.toFixed(0),
      layer.estimatedWatts.toFixed(2),
      "Import SVG by Color/gray fill, then set this grayscale layer power in Beam Studio."
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function layerColors(layerCount) {
  if (layerCount === 5) return [...FIVE_LAYER_COLORS];
  const light = 0xb3;
  const dark = 0x1d;
  return Array.from({ length: layerCount }, (_, index) => {
    const ratio = layerCount === 1 ? 1 : index / (layerCount - 1);
    const value = Math.round(light + (dark - light) * ratio);
    const hex = value.toString(16).padStart(2, "0");
    return `#${hex}${hex}${hex}`;
  });
}

function layerSettings(settings) {
  const colors = layerColors(settings.traceScans);
  return Array.from({ length: settings.traceScans }, (_, index) => ({
    layer: `L${pad2(index + 1)}`,
    tone: layerTone(index, settings.traceScans),
    color: colors[index],
    powerPercent: powerForLayer(index, settings),
    speedMmPerSec: speedForLayer(index, settings),
    estimatedWatts: estimatedWatts(index, settings)
  }));
}

function readSettings() {
  const minPower = clamp(Number(els.minPower.value) || 0, 0, 100);
  const maxPower = clamp(Number(els.maxPower.value) || minPower, minPower, 100);
  const requestedScans = Number(els.traceScans.value) || DEFAULT_LAYER_COUNT;
  const traceScans = LAYER_PRESETS.includes(requestedScans) ? requestedScans : DEFAULT_LAYER_COUNT;
  return {
    machineWatts: Number(els.machineWatts.value) || 30,
    outputWidthMm: clamp(Number(els.outputWidthMm.value) || 100, 10, 600),
    minPower,
    maxPower,
    engraveSpeed: clamp(Number(els.engraveSpeed.value) || 100, 1, 1000),
    sampleWidth: clamp(state.sourceWidth || 381, 24, 1200),
    outputMode: els.outputMode.value === "trace" ? "trace" : "rect",
    traceMode: "grayscale",
    traceScans,
    traceSmooth: true,
    traceRemoveBackground: true,
    traceSpeckles: 2,
    traceSmoothCorners: 1,
    traceOptimize: 0.2
  };
}

function traceSettingsForExport(settings) {
  return {
    workflow: "bitmap-trace-multiple-scan-grayscale",
    traceMode: settings.traceMode,
    scans: settings.traceScans,
    smooth: settings.traceSmooth,
    removeBackground: settings.traceRemoveBackground,
    speckles: settings.traceSpeckles,
    smoothCorners: settings.traceSmoothCorners,
    optimize: settings.traceOptimize
  };
}

function powerForLayer(layerIndex, settings) {
  if (settings.traceScans === 1) return settings.maxPower;
  return settings.minPower + (settings.maxPower - settings.minPower) * layerIndex / (settings.traceScans - 1);
}

function estimatedWatts(layerIndex, settings) {
  return settings.machineWatts * powerForLayer(layerIndex, settings) / 100;
}

function speedForLayer(layerIndex, settings) {
  return settings.engraveSpeed;
}

function layerTone(layerIndex, layerCount) {
  if (layerIndex === 0) return "lightest";
  if (layerIndex === layerCount - 1) return "darkest";
  return `tone_${pad2(layerIndex + 1)}`;
}

function layerLabel(layerIndex, settings) {
  const layer = `L${pad2(layerIndex + 1)}`;
  const power = formatLayerNumber(powerForLayer(layerIndex, settings));
  const speed = formatLayerNumber(speedForLayer(layerIndex, settings));
  return `${layer}_${layerTone(layerIndex, settings.traceScans)}_gray_${power}%w_${speed}mm/s`;
}

function layerId(layerIndex, settings) {
  return layerLabel(layerIndex, settings)
    .replace("#", "color_")
    .replace(/[^A-Za-z0-9_:-]/g, "_");
}

function formatLayerNumber(value) {
  return Number(value).toFixed(1).replace(/\.0$/, "");
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
  if (key === "svg") openLayerInspector(name, content);
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

function openLayerInspector(name, content) {
  try {
    localStorage.setItem(SVG_LAYER_TRANSFER_KEY, JSON.stringify({
      name,
      content,
      savedAt: Date.now()
    }));
  } catch (error) {
    setCopyStatus("SVG 已下載，但檔案太大無法自動送到圖層檢視器。請在圖層檢視器手動上傳 SVG。", "warn");
    return;
  }
  openLayerInspectorModal();
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
