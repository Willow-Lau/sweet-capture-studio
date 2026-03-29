import type { Area } from 'react-easy-crop';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 按裁剪区域缩放到目标尺寸，输出 JPG data URL */
export async function getCroppedImageDataUrl(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number,
  outputHeight: number,
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    image,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    Math.round(pixelCrop.width),
    Math.round(pixelCrop.height),
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return canvas.toDataURL('image/jpeg', 0.92);
}
