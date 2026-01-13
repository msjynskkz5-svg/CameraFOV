const $ = (id) => document.getElementById(id);

const formatSelect = $("formatSelect");
const focalInput = $("focalInput");
const iphoneEqSelect = $("iphoneEqSelect");
const startBtn = $("startBtn");
const video = $("video");
const viewport = $("viewport");
const readout = $("readout");
const status = $("status");
const overlayText = $("overlayText");

const diagFF = Math.hypot(36, 24);

// Start with sensor formats (you can swap to make/model later)
const formats = [
  { id: "ff",   name: "Full Frame (36×24mm)", w: 36.0,  h: 24.0 },
  { id: "apsc", name: "APS-C (1.5×, ~23.6×15.7mm)", w: 23.6, h: 15.7 },
  { id: "apscC",name: "APS-C Canon (1.6×, ~22.3×14.9mm)", w: 22.3, h: 14.9 },
  { id: "mft",  name: "Micro Four Thirds (17.3×13.0mm)", w: 17.3, h: 13.0 },
  { id: "1in",  name: "1-inch type (~13.2×8.8mm)", w: 13.2, h: 8.8 },
];

function populateFormats() {
  for (const f of formats) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    formatSelect.appendChild(opt);
  }
  formatSelect.value = "ff";
}

function getSelectedFormat() {
  return formats.find(f => f.id === formatSelect.value) ?? formats[0];
}

function toDeg(rad) { return rad * (180 / Math.PI); }

function compute(format, focalMm) {
  const diag = Math.hypot(format.w, format.h);
  const crop = diagFF / diag;
  const eq35 = focalMm * crop;

  const fovH = 2 * Math.atan(format.w / (2 * focalMm));
  const fovV = 2 * Math.atan(format.h / (2 * focalMm));
  const fovD = 2 * Math.atan(diag / (2 * focalMm));

  return { crop, eq35, fovH, fovV, fovD, aspect: format.w / format.h };
}

/**
 * PoC mapping:
 * Treat the iPhone feed as coming from a base 35mm-equivalent lens (default 26mm).
 * To simulate a narrower FoV, scale the video by zoomFactor = targetEq / baseEq.
 * If target is wider than base (zoomFactor < 1), clamp at 1 (can’t “zoom out” by scaling).
 */
function chooseBestBaseEq(targetEq35, candidates) {
  // pick the largest candidate that is <= target (minimizes digital zoom)
  const sorted = [...candidates].sort((a,b) => a - b);
  let best = sorted[0];
  for (const c of sorted) {
    if (c <= targetEq35) best = c;
  }
  return best;
}

function computeZoomFactor(targetEq35, baseEq35) {
  // zoom in only; if target is wider than base, we can't zoom out -> clamp
  const z = targetEq35 / baseEq35;
  return Math.max(1, z);
}

function layoutViewport(aspect) {
  // Fit a rectangle of given aspect into the current viewport element’s max bounds
  // (keeps it responsive and avoids tall overflow on phones)
  const maxW = Math.min(window.innerWidth * 0.92, 900);
  const maxH = Math.min(window.innerHeight * 0.78, 600);

  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }

  viewport.style.width = `${Math.round(w)}px`;
  viewport.style.height = `${Math.round(h)}px`;
}

function render() {
  const format = getSelectedFormat();
  const focal = Number(focalInput.value);
const baseEqCandidates = [13, 26, 52, 77, 120];
const selectedCandidate = Number(iphoneEqSelect.value);

// For PoC: treat the dropdown as "max lens available" or just ignore it.
// Option A (recommended): auto-pick best from all candidates:
const baseEq = chooseBestBaseEq(res.eq35, baseEqCandidates);

// Option B: use user-selected candidate as the base lens:
// const baseEq = selectedCandidate;

const zoomFactor = computeZoomFactor(res.eq35, baseEq);

  // Apply zoom as a CSS scale (center crop)
  video.style.transform = `translate(-50%, -50%) scale(${zoomFactor.toFixed(4)})`;

  layoutViewport(res.aspect);

const tooWide = (res.eq35 < baseEq);
const msg = tooWide
  ? `Target is wider than chosen lens (${baseEq}mm eq). Showing widest possible.`
  : `Using ~${baseEq}mm eq lens + ${zoomFactor.toFixed(2)}× digital zoom.`;

  overlayText.textContent = msg;

  readout.textContent =
`Selected: ${format.name}
Focal: ${focal.toFixed(1)} mm
Crop factor: ${res.crop.toFixed(3)}×
35mm equivalent: ${res.eq35.toFixed(1)} mm

FoV (deg)
  Horizontal: ${toDeg(res.fovH).toFixed(1)}°
  Vertical:   ${toDeg(res.fovV).toFixed(1)}°
  Diagonal:   ${toDeg(res.fovD).toFixed(1)}°`;
}

async function startCamera() {
  status.textContent = "Requesting camera permission…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    video.srcObject = stream;
    await video.play();

    status.textContent = "Camera running.";
  } catch (err) {
    console.error(err);
    status.textContent =
      "Camera failed. Make sure you're on HTTPS and allowed camera access in Safari settings.";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./sw.js").then(() => {
    // Optional: you can show “Offline ready” after activation, but keep PoC simple.
  }).catch((e) => {
    console.warn("SW registration failed", e);
  });
}

// Wire up events
populateFormats();
render();
registerServiceWorker();

formatSelect.addEventListener("change", render);
focalInput.addEventListener("input", render);
iphoneEqSelect.addEventListener("change", render);
window.addEventListener("resize", render);

startBtn.addEventListener("click", async () => {
  await startCamera();
  render();
});
