export type BoothLayout = 'vertical' | 'grid';

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
  /** 自定义边框底图（整张铺满画布，格位照片叠加上去） */
  imageUrl?: string;
}

export const FRAMES: FrameDef[] = [
  { id: 'white', name: '经典白', bgColor: '#FFFFFF', borderColor: '#F0F0F0' },
  { id: 'pink', name: '浅粉格', bgColor: '#FFF5F7', borderColor: '#F5C6D6' },
  { id: 'blue', name: '浅蓝格', bgColor: '#F0F7FB', borderColor: '#C8E0F0' },
  { id: 'cream', name: '奶白格', bgColor: '#FDFBF7', borderColor: '#EDE5DC' },
  { id: 'black', name: '墨黑格', bgColor: '#2E2E32', borderColor: '#1A1A1E' },
  { id: 'mint', name: '浅绿格', bgColor: '#EEF5F0', borderColor: '#B8D9C4' },
  { id: 'butter', name: '奶黄格', bgColor: '#FFF9ED', borderColor: '#F0E0B8' },
  { id: 'lilac', name: '淡紫格', bgColor: '#F3F0FA', borderColor: '#D4C8EA' },
];

function hexLuminance(hex: string): number {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.85;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 底部落款文字颜色（深底相框用浅色字） */
export function frameFooterColors(frame: FrameDef): { main: string; date: string } {
  if (frame.imageUrl) return { main: '#666666', date: '#999999' };
  if (hexLuminance(frame.bgColor) < 0.45) {
    return { main: '#ECECEF', date: '#B8B8C0' };
  }
  return { main: '#777777', date: '#BBBBBB' };
}

export const STICKER_EMOJIS = [
  '🌸', '🎀', '💕', '✨', '🦋', '🍓', '🌈', '💫', '🐰', '⭐', '🍰', '🌷', '💖',
  '🧸', '🎂', '🎉', '🎁', '🌹', '💋', '😎', '🤞', '✌', '😜', '🎨', '💦',
];

export interface PlacedSticker {
  id: string;
  kind: 'emoji' | 'image';
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/** 导出画布尺寸（与布局几何一致） */
// 横排四格整体规格 3:4
export const CANVAS_GRID = { W: 600, H: 800 } as const;
export const CANVAS_VERTICAL = { W: 600, H: 1800 } as const;

export function getStripAspectRatio(layout: BoothLayout): string {
  return layout === 'vertical'
    ? `${CANVAS_VERTICAL.W} / ${CANVAS_VERTICAL.H}`
    : `${CANVAS_GRID.W} / ${CANVAS_GRID.H}`;
}

/** 自定义边框裁剪视窗宽高比（宽/高） */
export function getFrameCropAspect(layout: BoothLayout): number {
  return layout === 'vertical'
    ? CANVAS_VERTICAL.W / CANVAS_VERTICAL.H
    : CANVAS_GRID.W / CANVAS_GRID.H;
}

/** 自定义边框导出像素（2× 画布，供高清合成） */
export function getCustomFrameExportDimensions(layout: BoothLayout): { width: number; height: number } {
  const s = 2;
  return layout === 'vertical'
    ? { width: CANVAS_VERTICAL.W * s, height: CANVAS_VERTICAL.H * s }
    : { width: CANVAS_GRID.W * s, height: CANVAS_GRID.H * s };
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

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
) {
  const iw = (img as HTMLImageElement).width;
  const ih = (img as HTMLImageElement).height;
  const scale = Math.max(dWidth / iw, dHeight / ih);
  const sw = dWidth / scale;
  const sh = dHeight / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
}

export async function generateComposite(options: {
  photos: string[];
  frame: FrameDef;
  layout: BoothLayout;
  globalFilter: string;
  photoFilters: string[];
  stickers: PlacedSticker[];
  text: string;
  showDate: boolean;
  format: 'jpg' | 'png';
}): Promise<string> {
  const { photos, frame, layout, globalFilter, photoFilters, stickers, text, showDate, format } = options;

  const W = layout === 'vertical' ? CANVAS_VERTICAL.W : CANVAS_GRID.W;
  const H = layout === 'vertical' ? CANVAS_VERTICAL.H : CANVAS_GRID.H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  if (frame.imageUrl) {
    try {
      const bgImg = await loadImage(frame.imageUrl);
      drawImageCover(ctx, bgImg, 0, 0, W, H);
    } catch {
      ctx.fillStyle = frame.bgColor;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = frame.bgColor;
    ctx.fillRect(0, 0, W, H);
  }

  if (!frame.imageUrl) {
    ctx.strokeStyle = frame.borderColor;
    ctx.lineWidth = 2;
    roundRect(ctx, 6, 6, W - 12, H - 12, 16);
    ctx.stroke();
  }

  const PAD = layout === 'vertical' ? 22 : 24;
  const GAP = layout === 'vertical' ? 14 : 16;
  const TEXT_H = layout === 'vertical' ? 82 : 76;
  const CORNER = 10;

  const slots: { x: number; y: number; cw: number; ch: number }[] = [];

  if (layout === 'grid') {
    // 横排四格：整体 3:4；单张照片 3:4
    const innerW = W - 2 * PAD;
    const innerH = H - 2 * PAD - TEXT_H;
    const maxCellWByWidth = (innerW - GAP) / 2;
    const maxCellHByHeight = (innerH - GAP) / 2;
    const maxCellWByHeight = maxCellHByHeight * (3 / 4);
    const CELL_W = Math.min(maxCellWByWidth, maxCellWByHeight);
    const CELL_H = CELL_W * (4 / 3);
    const gridW = 2 * CELL_W + GAP;
    const gridH = 2 * CELL_H + GAP;
    const startX = (W - gridW) / 2;
    const startY = PAD + (innerH - gridH) / 2;
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      slots.push({
        x: startX + col * (CELL_W + GAP),
        y: startY + row * (CELL_H + GAP),
        cw: CELL_W,
        ch: CELL_H,
      });
    }
  } else {
    // 竖排四格导出几何与预览保持一致：
    // 预览中使用 p-[4%]、pb-[2%]、gap-[3.5%]（百分比基于宽度）和 max-w-[92%]
    const photoPadTop = W * 0.04;
    const photoPadX = W * 0.04;
    const photoPadBottom = W * 0.02;
    const photoGap = W * 0.035;
    const cellW = (W - 2 * photoPadX) * 0.92;
    const cellH = cellW * (3 / 4);
    const startX = (W - cellW) / 2;
    const startY = photoPadTop;
    for (let i = 0; i < 4; i++) {
      slots.push({
        x: startX,
        y: startY + i * (cellH + photoGap),
        cw: cellW,
        ch: cellH,
      });
    }
  }

  for (let i = 0; i < 4; i++) {
    const { x, y, cw, ch } = slots[i];
    ctx.save();
    roundRect(ctx, x, y, cw, ch, CORNER);
    ctx.clip();

    if (photos[i]) {
      const img = await loadImage(photos[i]);
      const filterStr = photoFilters[i] !== 'none' ? photoFilters[i] :
                         globalFilter !== 'none' ? globalFilter : 'none';
      if (filterStr !== 'none') {
        ctx.filter = filterStr;
      }
      const scale = Math.max(cw / img.width, ch / img.height);
      const sw = cw / scale;
      const sh = ch / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, cw, ch);
    } else {
      ctx.filter = 'none';
      ctx.fillStyle = '#F4F4F4';
      ctx.fillRect(x, y, cw, ch);
    }
    ctx.restore();
  }

  ctx.filter = 'none';
  for (const sticker of stickers) {
    const sx = (sticker.x / 100) * W;
    const sy = (sticker.y / 100) * H;
    const rot = (sticker.rotation * Math.PI) / 180;
    const sc = sticker.scale ?? 1;
    if (sticker.kind === 'emoji') {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sticker.content, 0, 0);
      ctx.restore();
    } else {
      try {
        const stickerImg = await loadImage(sticker.content);
        const size = 44;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.scale(sc, sc);
        ctx.drawImage(stickerImg, -size / 2, -size / 2, size, size);
        ctx.restore();
      } catch {
        // ignore broken custom sticker image
      }
    }
  }

  let textBaseY: number;
  if (layout === 'grid') {
    const gridBottom = Math.max(...slots.map(s => s.y + s.ch));
    textBaseY = gridBottom + 30;
  } else {
    const photosBottom = Math.max(...slots.map(s => s.y + s.ch));
    const footerZoneH = H - photosBottom;
    textBaseY = photosBottom + footerZoneH * 0.45;
  }

  const footer = frameFooterColors(frame);
  ctx.textAlign = 'center';

  if (text) {
    ctx.font = '500 16px "Noto Sans SC", sans-serif';
    ctx.fillStyle = footer.main;
    ctx.fillText(text, W / 2, textBaseY);
  }

  if (showDate) {
    const dateStr = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    ctx.font = '300 13px "Noto Sans SC", sans-serif';
    ctx.fillStyle = footer.date;
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
const STORAGE_SESSION = 'photobooth_session';

export interface BoothSessionPersist {
  layout: BoothLayout;
  frame: FrameDef;
  countdownSec: number;
  captureMode: 'camera' | 'upload';
}

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

export function saveSessionToStorage(session: BoothSessionPersist) {
  try {
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  } catch {
    console.warn('session save failed');
  }
}

export function loadSessionFromStorage(): BoothSessionPersist | null {
  try {
    const data = localStorage.getItem(STORAGE_SESSION);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearSessionFromStorage() {
  localStorage.removeItem(STORAGE_SESSION);
}
