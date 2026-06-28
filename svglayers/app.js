const els = {
  svgInput: document.querySelector("#svgInput"),
  loadSample: document.querySelector("#loadSample"),
  loadFluxSample: document.querySelector("#loadFluxSample"),
  fitView: document.querySelector("#fitView"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomRange: document.querySelector("#zoomRange"),
  zoomText: document.querySelector("#zoomText"),
  fileMeta: document.querySelector("#fileMeta"),
  statusText: document.querySelector("#statusText"),
  viewer: document.querySelector("#viewer"),
  svgStage: document.querySelector("#svgStage"),
  emptyState: document.querySelector("#emptyState"),
  layerList: document.querySelector("#layerList"),
  layerCount: document.querySelector("#layerCount"),
  showAll: document.querySelector("#showAll"),
  hideAll: document.querySelector("#hideAll")
};

const SVG_LAYER_TRANSFER_KEY = "bmptrace.latestSvgForLayerInspector";

const state = {
  svg: null,
  layers: [],
  zoom: 100,
  panX: 0,
  panY: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragPanX: 0,
  dragPanY: 0
};

els.svgInput.addEventListener("change", async () => {
  const file = els.svgInput.files?.[0];
  if (!file) return;
  await loadSvgText(await file.text(), file.name);
});

els.loadSample.addEventListener("click", async () => {
  const response = await fetch("../bmptrace/assets/sample.png", { cache: "no-store" });
  if (!response.ok) return;
  const blob = await response.blob();
  const dataUrl = await readBlobAsDataUrl(blob);
  const sampleSvg = sampleSvgDocument(dataUrl);
  await loadSvgText(sampleSvg, "sample-layer-check.svg");
});

els.loadFluxSample.addEventListener("click", async () => {
  const response = await fetch("samples/flux_gradient.svg", { cache: "no-store" });
  if (!response.ok) return;
  await loadSvgText(await response.text(), "flux_gradient.svg");
});

els.fitView.addEventListener("click", resetView);
els.zoomOut.addEventListener("click", () => setZoom(state.zoom - 25));
els.zoomIn.addEventListener("click", () => setZoom(state.zoom + 25));
els.zoomRange.addEventListener("input", () => setZoom(Number(els.zoomRange.value)));
els.showAll.addEventListener("click", () => setAllLayers(true));
els.hideAll.addEventListener("click", () => setAllLayers(false));

els.viewer.addEventListener("wheel", (event) => {
  event.preventDefault();
  setZoom(state.zoom + (event.deltaY < 0 ? 10 : -10));
}, { passive: false });

els.viewer.addEventListener("pointerdown", (event) => {
  if (!state.svg) return;
  state.dragging = true;
  state.dragStartX = event.clientX;
  state.dragStartY = event.clientY;
  state.dragPanX = state.panX;
  state.dragPanY = state.panY;
  els.viewer.setPointerCapture(event.pointerId);
});

els.viewer.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  state.panX = state.dragPanX + event.clientX - state.dragStartX;
  state.panY = state.dragPanY + event.clientY - state.dragStartY;
  applyTransform();
});

els.viewer.addEventListener("pointerup", () => {
  state.dragging = false;
});

loadTransferredSvg();

function loadSvgText(text, fileName) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  const sourceSvg = doc.querySelector("svg");
  if (parseError || !sourceSvg) {
    setStatus("SVG 解析失敗");
    return;
  }

  const svg = document.importNode(sourceSvg, true);
  sanitizeSvg(svg);
  ensureViewBox(svg);
  state.svg = svg;
  state.layers = findLayers(svg);
  els.svgStage.replaceChildren(svg);
  els.emptyState.hidden = true;
  els.fileMeta.textContent = fileName;
  setStatus("已載入");
  renderLayers();
  resetView();
}

function loadTransferredSvg() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "bmptrace") return;
  try {
    const raw = localStorage.getItem(SVG_LAYER_TRANSFER_KEY);
    if (!raw) return;
    const transfer = JSON.parse(raw);
    if (!transfer?.content) return;
    loadSvgText(transfer.content, transfer.name || "bmptrace-export.svg");
  } catch (error) {
    setStatus("無法載入剛下載的 SVG，請手動上傳");
  }
}

function sanitizeSvg(svg) {
  svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
  svg.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
      if ((attr.name === "href" || attr.name.endsWith(":href")) && /^\s*javascript:/i.test(attr.value)) {
        node.removeAttribute(attr.name);
      }
    });
  });
}

function ensureViewBox(svg) {
  if (svg.getAttribute("viewBox")) return;
  const width = parseSvgLength(svg.getAttribute("width")) || 100;
  const height = parseSvgLength(svg.getAttribute("height")) || 100;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
}

function findLayers(svg) {
  const explicitLayers = [...svg.querySelectorAll("g")].filter((group) => {
    const mode = group.getAttribute("inkscape:groupmode") || group.getAttribute("groupmode");
    return mode === "layer" || group.hasAttribute("inkscape:label");
  });
  const groups = explicitLayers.length ? explicitLayers : [...svg.children].filter((node) => node.tagName.toLowerCase() === "g");
  return groups.map((group, index) => ({
    element: group,
    name: layerName(group, index),
    visible: group.style.display !== "none" && group.getAttribute("display") !== "none"
  }));
}

function layerName(group, index) {
  return group.getAttribute("inkscape:label")
    || group.getAttribute("label")
    || group.getAttribute("data-layer")
    || group.id
    || `Layer ${index + 1}`;
}

function renderLayers() {
  els.layerList.replaceChildren();
  els.layerCount.textContent = `${state.layers.length} layers`;
  if (!state.layers.length) {
    const item = document.createElement("li");
    item.className = "layer-empty";
    item.textContent = "此 SVG 沒有可辨識的群組圖層。";
    els.layerList.appendChild(item);
    return;
  }

  state.layers.forEach((layer, index) => {
    const item = document.createElement("li");
    item.className = "layer-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = layer.visible;
    checkbox.addEventListener("change", () => {
      layer.visible = checkbox.checked;
      applyLayerVisibility(layer);
    });

    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "layer-name";
    name.textContent = layer.name;
    const meta = document.createElement("div");
    meta.className = "layer-meta";
    meta.textContent = `#${index + 1}${layer.element.id ? ` / ${layer.element.id}` : ""}`;
    text.append(name, meta);
    item.append(checkbox, text);
    els.layerList.appendChild(item);
  });
}

function setAllLayers(visible) {
  state.layers.forEach((layer) => {
    layer.visible = visible;
    applyLayerVisibility(layer);
  });
  renderLayers();
}

function applyLayerVisibility(layer) {
  layer.element.style.display = layer.visible ? "" : "none";
}

function resetView() {
  state.zoom = 100;
  state.panX = 0;
  state.panY = 0;
  els.zoomRange.value = "100";
  applyTransform();
}

function setZoom(value) {
  state.zoom = clamp(value, 25, 400);
  els.zoomRange.value = String(state.zoom);
  applyTransform();
}

function applyTransform() {
  els.zoomText.textContent = `${state.zoom}%`;
  els.svgStage.style.transform = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px)) scale(${state.zoom / 100})`;
}

function setStatus(text) {
  els.statusText.textContent = text;
  setTimeout(() => window.applyCurrentLanguage?.(), 0);
}

function parseSvgLength(value) {
  if (!value) return 0;
  const number = Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : 0;
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function sampleSvgDocument(imageUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="120mm" height="80mm" viewBox="0 0 120 80">
  <g id="L01_lightest_gray_8_w_100mm_s" inkscape:groupmode="layer" inkscape:label="L01_lightest_gray_8%w_100mm/s">
    <rect x="6" y="6" width="108" height="68" rx="4" fill="#b3b3b3"/>
  </g>
  <g id="L03_tone_03_gray_24_w_100mm_s" inkscape:groupmode="layer" inkscape:label="L03_tone_03_gray_24%w_100mm/s">
    <image href="${imageUrl}" x="22" y="12" width="76" height="42" preserveAspectRatio="xMidYMid meet"/>
  </g>
  <g id="L05_darkest_gray_40_w_100mm_s" inkscape:groupmode="layer" inkscape:label="L05_darkest_gray_40%w_100mm/s">
    <rect x="22" y="60" width="76" height="6" rx="2" fill="#1d1d1d"/>
  </g>
</svg>`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

applyTransform();
