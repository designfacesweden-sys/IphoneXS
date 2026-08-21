import { openCameraStream, attachStreamToContainer, stopStream } from './camera.js';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
const SCAN_INTERVAL_MS = 150;

let stream = null;
let videoEl = null;
let canvasEl = null;
let ctx = null;
let loopTimer = null;

// onStatus(text) gets a live line of diagnostics so the UI can show what's
// actually happening on-device — camera picked, resolution negotiated, and a
// running count of frames checked.
export async function startScanner(elementId, onDetected, onStatus = () => {}) {
  if (typeof BarcodeDetector === 'undefined') {
    throw new Error('Barcode detector failed to load (check your connection and reload).');
  }
  if (stream) return;

  onStatus('Requesting camera…');
  const { stream: s, camera } = await openCameraStream();
  stream = s;
  videoEl = await attachStreamToContainer(elementId, stream);

  canvasEl = document.createElement('canvas');
  ctx = canvasEl.getContext('2d', { willReadFrequently: true });

  const detector = new BarcodeDetector({ formats: FORMATS });

  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings ? track.getSettings() : {};
  onStatus(`Camera: ${camera?.label || track.label || 'unknown'} · ${settings.width || '?'}×${settings.height || '?'}`);

  let frameCount = 0;

  const tick = async () => {
    if (!stream || videoEl.readyState < 2) {
      loopTimer = setTimeout(tick, SCAN_INTERVAL_MS);
      return;
    }

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    ctx.drawImage(videoEl, 0, 0);

    try {
      const results = await detector.detect(canvasEl);
      frameCount += 1;
      if (results.length > 0) {
        onDetected(results[0].rawValue);
        return; // caller calls stopScanner() once it handles the detection
      }
      onStatus(`Scanning… ${frameCount} frames checked, nothing found yet`);
    } catch (err) {
      onStatus(`Detect error: ${err.message || err}`);
    }

    loopTimer = setTimeout(tick, SCAN_INTERVAL_MS);
  };
  tick();
}

export async function stopScanner() {
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = null;
  stopStream(stream);
  stream = null;
  if (videoEl) {
    videoEl.remove();
    videoEl = null;
  }
  canvasEl = null;
  ctx = null;
}
