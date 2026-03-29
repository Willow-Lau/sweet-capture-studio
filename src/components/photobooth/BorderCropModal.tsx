import { useState, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { BoothLayout, getFrameCropAspect, getCustomFrameExportDimensions } from '@/lib/photobooth-utils';
import { getCroppedImageDataUrl } from '@/lib/border-crop';

interface BorderCropModalProps {
  imageSrc: string;
  layout: BoothLayout;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

export default function BorderCropModal({ imageSrc, layout, onCancel, onApply }: BorderCropModalProps) {
  const aspect = getFrameCropAspect(layout);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const croppedPixelsRef = useRef<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    croppedPixelsRef.current = pixels;
  }, []);

  const handleApply = async () => {
    const pixels = croppedPixelsRef.current;
    if (!pixels) return;
    setBusy(true);
    try {
      const { width, height } = getCustomFrameExportDimensions(layout);
      const url = await getCroppedImageDataUrl(imageSrc, pixels, width, height);
      onApply(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/25 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-2xl shadow-xl border border-border/50 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div>
            <p className="text-sm font-medium text-foreground">裁剪边框图</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">拖动对齐 · 双指或滑块缩放 · 框内为成品比例</p>
          </div>
          <button type="button" onClick={onCancel} className="booth-btn-ghost p-2 rounded-full" aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative w-full aspect-[4/5] max-h-[min(56vh,420px)] bg-muted/40">
          <Cropper
            key={layout}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            minZoom={1}
            maxZoom={4}
            cropShape="rect"
            showGrid
            zoomWithScroll
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{ containerStyle: { width: '100%', height: '100%' } }}
          />
        </div>

        <div className="px-4 py-3 space-y-3 border-t border-border/40">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">缩放</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary h-1.5"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="booth-btn flex-1">
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={busy}
              className="booth-btn-primary flex-1 disabled:opacity-50"
            >
              {busy ? '处理中…' : '使用此区域'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
