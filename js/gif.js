import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.esm.js';

const nextTick = () => new Promise((r) => setTimeout(r, 0));

async function loadImage(blob) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob); } catch { /* fall back below */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The frame order for playback; boomerang plays forward then back without
// repeating the end frames.
export function playOrder(count, boomerang) {
  const order = Array.from({ length: count }, (_, i) => i);
  if (boomerang && count > 2) for (let i = count - 2; i > 0; i--) order.push(i);
  return order;
}

export async function makeGif(blobs, { fps, boomerang, width = 480, onProgress = () => {} }) {
  const height = Math.round(width * 3 / 4);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const pixels = [];
  for (let i = 0; i < blobs.length; i++) {
    const img = await loadImage(blobs[i]);
    ctx.drawImage(img, 0, 0, width, height);
    img.close?.();
    pixels.push(ctx.getImageData(0, 0, width, height).data);
    onProgress((i + 1) / blobs.length * 0.4);
    await nextTick();
  }

  // One shared palette for all frames, so colours don't flicker between them.
  const step = Math.max(1, Math.floor(pixels.length * width * height / 250_000));
  const sample = new Uint8ClampedArray(Math.ceil(pixels.length * width * height / step) * 4);
  let o = 0;
  for (const data of pixels) {
    for (let p = 0; p < data.length; p += 4 * step) {
      sample[o++] = data[p]; sample[o++] = data[p + 1]; sample[o++] = data[p + 2]; sample[o++] = 255;
    }
  }
  const palette = quantize(sample.subarray(0, o), 256);

  const indexed = [];
  for (let i = 0; i < pixels.length; i++) {
    indexed.push(applyPalette(pixels[i], palette));
    onProgress(0.4 + (i + 1) / pixels.length * 0.4);
    await nextTick();
  }

  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  const order = playOrder(indexed.length, boomerang);
  order.forEach((idx, n) => {
    gif.writeFrame(indexed[idx], width, height, n === 0 ? { palette, delay } : { delay });
  });
  gif.finish();
  onProgress(1);
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
