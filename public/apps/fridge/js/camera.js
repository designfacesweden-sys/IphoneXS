// The iPhone XS's rear camera was dead, so this was forced to the front
// camera as a stopgap. Now on a Samsung tablet with a working rear camera —
// flip back to true if this ever needs to run on the XS again.
export const USE_FRONT_CAMERA_STOPGAP = false;

// Labels are blank until permission is granted at least once — do a throwaway
// probe request first so we can enumerate real camera names afterward.
async function listCamerasWithLabels() {
  const probe = await navigator.mediaDevices.getUserMedia({ video: true });
  probe.getTracks().forEach((t) => t.stop());
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

function pickCamera(devices) {
  if (!devices || devices.length === 0) return null;

  if (USE_FRONT_CAMERA_STOPGAP) {
    return devices.find((d) => /front/i.test(d.label)) || devices[0];
  }

  return (
    devices.find((d) => /^back camera$/i.test(d.label.trim())) ||
    devices.find((d) => /back|rear/i.test(d.label)) ||
    devices[devices.length - 1]
  );
}

// Opens a getUserMedia stream on the best available camera (front, until the
// rear one's repaired) and returns it plus the picked device's info.
export async function openCameraStream({ width = 1920, height = 1080 } = {}) {
  const devices = await listCamerasWithLabels();
  const camera = pickCamera(devices);

  const videoConstraints = camera
    ? { deviceId: { exact: camera.deviceId }, width: { ideal: width }, height: { ideal: height } }
    : { facingMode: USE_FRONT_CAMERA_STOPGAP ? 'user' : 'environment' };

  const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
  return { stream, camera };
}

// Attaches a stream to a fresh <video> element inside the given container.
export async function attachStreamToContainer(elementId, stream) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';
  const videoEl = document.createElement('video');
  videoEl.setAttribute('playsinline', 'true');
  videoEl.muted = true;
  videoEl.autoplay = true;
  videoEl.srcObject = stream;
  container.appendChild(videoEl);
  await videoEl.play().catch(() => {});
  return videoEl;
}

export function stopStream(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}
