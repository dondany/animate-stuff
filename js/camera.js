// Every frame is saved at this size, cropped from the centre of the camera
// image. The on-screen preview uses object-fit: cover on a 4:3 box, which
// shows exactly the same crop, so what you see is what gets saved.
export const FRAME_W = 1200;
export const FRAME_H = 900;

export async function startCamera(video, facing = 'environment') {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot use the camera here. Open the app over https:// in Safari.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
  });
  // iOS only plays camera video inline when these are set before play().
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) {
    await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  }
  return stream;
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function isLive(stream) {
  return !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live');
}

export function grabFrame(video, mirror = false) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const target = FRAME_W / FRAME_H;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (vw / vh > target) { sw = vh * target; sx = (vw - sw) / 2; }
  else { sh = vw / target; sy = (vh - sh) / 2; }

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (mirror) { ctx.translate(FRAME_W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, FRAME_W, FRAME_H);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the photo'))), 'image/jpeg', 0.88);
  });
}
