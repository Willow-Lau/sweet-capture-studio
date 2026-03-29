export interface FilterDef {
  id: string;
  name: string;
  filter: string;
}

export const FILTERS: FilterDef[] = [
  { id: 'none', name: '原图', filter: 'none' },
  { id: 'warm', name: '暖调', filter: 'sepia(0.15) saturate(1.3) brightness(1.05)' },
  { id: 'cool', name: '冷调', filter: 'hue-rotate(15deg) saturate(0.85) brightness(1.05)' },
  { id: 'vintage', name: '复古', filter: 'sepia(0.35) contrast(1.1) brightness(0.95)' },
  { id: 'bw', name: '黑白', filter: 'grayscale(1) contrast(1.1)' },
  { id: 'soft', name: '柔光', filter: 'brightness(1.1) contrast(0.9) saturate(0.85)' },
  { id: 'pink', name: '粉嫩', filter: 'saturate(1.2) hue-rotate(-10deg) brightness(1.05)' },
];

export interface FrameDef {
  id: string;
  name: string;
  bgColor: string;
  borderColor: string;
}

export const FRAMES: FrameDef[] = [
  { id: 'white', name: '经典白', bgColor: '#FFFFFF', borderColor: '#F0F0F0' },
  { id: 'pink', name: '少女粉', bgColor: '#FFF0F3', borderColor: '#FFD6E0' },
  { id: 'blue', name: '清新蓝', bgColor: '#F0F7FF', borderColor: '#D6EAFF' },
  { id: 'cream', name: '奶油', bgColor: '#FDFBF7', borderColor: '#F0EBE0' },
  { id: 'lavender', name: '薰衣草', bgColor: '#F8F0FF', borderColor: '#E8D6FF' },
];

export const STICKER_EMOJIS = ['🌸', '🎀', '💕', '✨', '🦋', '🍓', '🌈', '💫', '🐰', '⭐', '🍰', '🌷', '💖', '🧸', '🎂'];

export interface PlacedSticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

export function playShutterSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio not supported
  }
}

export async function generateComposite(options: {
  photos: string[];
  frame: FrameDef;
  globalFilter: string;
  photoFilters: string[];
  stickers: PlacedSticker[];
  text: string;
  showDate: boolean;
  format: 'jpg' | 'png';
}): Promise<string> {
  const { photos, frame, globalFilter, photoFilters, stickers, text, showDate, format } = options;

  const W = 600;
  const H = 940;
  const PAD = 24;
  const GAP = 12;
  const CELL_W = (W - 2 * PAD - GAP) / 2;
  const CELL_H = CELL_W;
  const CORNER = 10;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = frame.bgColor;
  ctx.fillRect(0, 0, W, H);

  // Decorative border
  ctx.strokeStyle = frame.borderColor;
  ctx.lineWidth = 2;
  roundRect(ctx, 6, 6, W - 12, H - 12, 16);
  ctx.stroke();

  // Load and draw photos
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAD + col * (CELL_W + GAP);
    const y = PAD + row * (CELL_H + GAP);

    ctx.save();
    roundRect(ctx, x, y, CELL_W, CELL_H, CORNER);
    ctx.clip();

    if (photos[i]) {
      const img = await loadImage(photos[i]);
      const filterStr = photoFilters[i] !== 'none' ? photoFilters[i] :
                         globalFilter !== 'none' ? globalFilter : 'none';
      if (filterStr !== 'none') {
        ctx.filter = filterStr;
      }

      // Cover fit
      const scale = Math.max(CELL_W / img.width, CELL_H / img.height);
      const sw = CELL_W / scale;
      const sh = CELL_H / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, CELL_W, CELL_H);
    } else {
      ctx.fillStyle = '#F8F8F8';
      ctx.fillRect(x, y, CELL_W, CELL_H);
    }

    ctx.restore();
  }

  // Draw stickers
  ctx.filter = 'none';
  for (const sticker of stickers) {
    const sx = (sticker.x / 100) * W;
    const sy = (sticker.y / 100) * H;
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sticker.emoji, sx, sy);
  }

  // Draw text area
  const textBaseY = PAD + 2 * (CELL_H + GAP) + 30;
  ctx.filter = 'none';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';

  if (text) {
    ctx.font = '500 16px "Noto Sans SC", sans-serif';
    ctx.fillText(text, W / 2, textBaseY);
  }

  if (showDate) {
    const dateStr = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    ctx.font = '300 13px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#AAA';
    ctx.fillText(dateStr, W / 2, textBaseY + (text ? 28 : 0));
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  return canvas.toDataURL(mimeType, 0.95);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const STORAGE_KEY = 'photobooth_photos';

export function savePhotosToStorage(photos: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch {
    console.warn('localStorage save failed');
  }
}

export function loadPhotosFromStorage(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function clearPhotosFromStorage() {
  localStorage.removeItem(STORAGE_KEY);
}
