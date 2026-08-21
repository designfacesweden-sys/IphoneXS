import { openCameraStream, attachStreamToContainer, stopStream } from './camera.js';
import { readDateFromCanvas } from './dateOcr.js';

let stream = null;
let videoEl = null;

export async function openDateCapture(elementId) {
  const { stream: s, camera } = await openCameraStream();
  stream = s;
  videoEl = await attachStreamToContainer(elementId, stream);
  return camera;
}

export async function captureAndReadDate() {
  if (!videoEl) throw new Error('Camera not open.');
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return readDateFromCanvas(canvas);
}

export function closeDateCapture() {
  stopStream(stream);
  stream = null;
  if (videoEl) {
    videoEl.remove();
    videoEl = null;
  }
}
