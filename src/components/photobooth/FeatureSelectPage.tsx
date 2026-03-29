import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, ImagePlus, Loader2, Upload } from 'lucide-react';
import BorderCropModal from '@/components/photobooth/BorderCropModal';
import {
  FRAMES,
  FrameDef,
  BoothLayout,
  BoothSessionPersist,
  getStripAspectRatio,
} from '@/lib/photobooth-utils';

interface FeatureSelectPageProps {
  onBack: () => void;
  onStart: (config: BoothSessionPersist) => void;
}

const COUNTDOWN_OPTIONS = [5, 10, 15] as const;

function LayoutPreviewA({ active }: { active: boolean }) {
  return (
    <div
      className={`w-full h-full p-[12%] flex flex-col gap-[6%] rounded-xl transition-all duration-200 bg-[#FFFCFA] ${
        active ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-[#FDFBF7]' : 'ring-1 ring-border/50'
      }`}
    >
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex-1 rounded-md bg-secondary/50 min-h-0" />
      ))}
    </div>
  );
}

function LayoutPreviewB({ active }: { active: boolean }) {
  return (
    <div
      className={`w-full aspect-[3/4] p-[8%] rounded-xl transition-all duration-200 bg-[#FFFCFA] ${
        active ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-[#FDFBF7]' : 'ring-1 ring-border/50'
      }`}
    >
      <div className="w-full h-full grid grid-cols-2 gap-[10%]">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-md bg-secondary/50 min-h-0" />
        ))}
      </div>
    </div>
  );
}

/** 相框 + 当前版式的小预览（示意格位） */
function FrameStripPreview({ layout, frame }: { layout: BoothLayout; frame: FrameDef }) {
  const ar = getStripAspectRatio(layout);
  const hasImg = Boolean(frame.imageUrl);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-3 mb-4">
      <p className="text-[11px] text-muted-foreground mb-2 text-center tracking-wide">相框预览（随版式变化）</p>
      <div
        className="mx-auto rounded-xl overflow-hidden flex flex-col shadow-sm max-w-[240px]"
        style={{
          aspectRatio: ar,
          backgroundColor: hasImg ? undefined : frame.bgColor,
          border: hasImg ? undefined : `2px solid ${frame.borderColor}`,
          backgroundImage: hasImg ? `url(${frame.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-[1] flex flex-col flex-1 min-h-0 w-full">
          {layout === 'vertical' ? (
            <div className="flex flex-col gap-[3.5%] p-[4%] pb-[2%] flex-1 min-h-0">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="flex-1 min-h-[6px] rounded-lg bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-[5%] p-[5%] pb-[3%] flex-1 content-start">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="aspect-square rounded-lg bg-white min-h-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
              ))}
            </div>
          )}
          <div className="text-center px-2 py-1.5 shrink-0 border-t border-foreground/5">
            <span className="text-[8px] text-foreground/45">落款区</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeatureSelectPage({ onBack, onStart }: FeatureSelectPageProps) {
  const [layout, setLayout] = useState<BoothLayout>('vertical');
  const [frame, setFrame] = useState<FrameDef>(FRAMES[0]);
  const [countdownSec, setCountdownSec] = useState<5 | 10 | 15>(5);
  const [captureMode, setCaptureMode] = useState<'camera' | 'upload'>('camera');
  const [busy, setBusy] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const borderInputRef = useRef<HTMLInputElement>(null);

  const setLoading = useCallback((label: string | null) => {
    setBusy(label);
  }, []);

  const onCustomBorder = useCallback(() => {
    borderInputRef.current?.click();
  }, []);

  const handleBorderFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !/^image\/(jpeg|png)$/i.test(file.type)) {
        return;
      }
      setLoading('读取边框中…');
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setLoading(null);
        setCropImageSrc(url);
      };
      reader.onerror = () => setLoading(null);
      reader.readAsDataURL(file);
    },
    [setLoading],
  );

  const finishCrop = useCallback((dataUrl: string) => {
    setFrame({
      id: 'custom',
      name: '自定义',
      bgColor: '#FDFBF7',
      borderColor: '#E8D4DC',
      imageUrl: dataUrl,
    });
    setCropImageSrc(null);
  }, []);

  const handleStart = () => {
    onStart({
      layout,
      frame,
      countdownSec,
      captureMode,
    });
  };

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#FDFBF7' }}>
      <input
        ref={borderInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleBorderFile}
      />

      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/15 backdrop-blur-[2px]"
          >
            <div className="bg-card/95 rounded-2xl px-8 py-6 shadow-lg border border-border/50 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-foreground">{busy}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {cropImageSrc ? (
          <BorderCropModal
            key={cropImageSrc.slice(0, 48)}
            imageSrc={cropImageSrc}
            layout={layout}
            onCancel={() => setCropImageSrc(null)}
            onApply={finishCrop}
          />
        ) : null}
      </AnimatePresence>

      <header className="sticky top-0 z-10 backdrop-blur-md border-b border-border/40 px-4 py-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(253, 251, 247, 0.92)' }}>
        <button
          type="button"
          onClick={onBack}
          className="booth-btn-ghost flex items-center gap-1.5 -ml-1"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <h1 className="text-base font-semibold text-foreground flex-1 text-center pr-16">
          拍摄设置
        </h1>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-lg mx-auto px-4 pt-6 space-y-6"
      >
        <section>
          <h2 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide">版式</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading('切换版式…');
                window.setTimeout(() => setLoading(null), 220);
                setLayout('vertical');
              }}
              className={`text-left rounded-2xl p-2 transition-all ${
                layout === 'vertical' ? 'bg-primary/12 shadow-sm' : 'bg-card/70 hover:bg-card'
              } border ${layout === 'vertical' ? 'border-primary/35' : 'border-border/50'}`}
            >
              <div className="aspect-[3/5] max-h-[140px] w-full mx-auto">
                <LayoutPreviewA active={layout === 'vertical'} />
              </div>
              <p className={`text-center text-xs mt-2 font-medium ${layout === 'vertical' ? 'text-foreground' : 'text-muted-foreground'}`}>
                A · 竖排四格
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoading('切换版式…');
                window.setTimeout(() => setLoading(null), 220);
                setLayout('grid');
              }}
              className={`text-left rounded-2xl p-2 transition-all ${
                layout === 'grid' ? 'bg-primary/12 shadow-sm' : 'bg-card/70 hover:bg-card'
              } border ${layout === 'grid' ? 'border-primary/35' : 'border-border/50'}`}
            >
              <div className="w-full flex justify-center">
                <div className="w-[78%]">
                  <LayoutPreviewB active={layout === 'grid'} />
                </div>
              </div>
              <p className={`text-center text-xs mt-2 font-medium ${layout === 'grid' ? 'text-foreground' : 'text-muted-foreground'}`}>
                B · 四宫格 3:4
              </p>
            </button>
          </div>
        </section>

        <section className="glass-panel p-4 rounded-2xl">
          <h2 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide">边框</h2>
          <FrameStripPreview layout={layout} frame={frame} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FRAMES.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrame({ ...f, imageUrl: undefined })}
                className={`booth-chip flex items-center gap-1.5 justify-center ${
                  frame.id === f.id && !frame.imageUrl ? 'booth-chip-active ring-2 ring-primary/25' : 'booth-chip-inactive'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border shrink-0"
                  style={{ backgroundColor: f.bgColor, borderColor: f.borderColor }}
                />
                {f.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={onCustomBorder} className="mt-3 text-sm text-primary font-medium hover:underline">
            <ImagePlus className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            自定义边框
          </button>
          {frame.imageUrl && (
            <p className="text-[11px] text-muted-foreground mt-2">
              已选自定义底图；裁切区域随当前版式比例。换版式后可再点「自定义边框」重新选图裁剪。
            </p>
          )}
        </section>

        <section className="glass-panel p-4 rounded-2xl">
          <h2 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide">拍摄倒计时</h2>
          <div className="flex gap-2">
            {COUNTDOWN_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setCountdownSec(s)}
                className={`booth-chip flex-1 justify-center ${
                  countdownSec === s ? 'booth-chip-active' : 'booth-chip-inactive'
                }`}
              >
                {s} 秒
              </button>
            ))}
          </div>
        </section>

        <section className="glass-panel p-4 rounded-2xl">
          <h2 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide">拍摄方式</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCaptureMode('camera')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                captureMode === 'camera'
                  ? 'bg-primary/12 border-primary/35 text-foreground ring-2 ring-primary/15'
                  : 'bg-card/50 border-border/50 text-muted-foreground hover:bg-card'
              }`}
            >
              <Camera className="w-4 h-4" />
              摄像头拍摄
            </button>
            <button
              type="button"
              onClick={() => setCaptureMode('upload')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                captureMode === 'upload'
                  ? 'bg-secondary/40 border-secondary text-secondary-foreground ring-2 ring-secondary/30'
                  : 'bg-card/50 border-border/50 text-muted-foreground hover:bg-card'
              }`}
            >
              <Upload className="w-4 h-4" />
              上传本地图片
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={handleStart}
          className="w-full py-3.5 rounded-2xl text-[15px] font-medium text-white shadow-md transition-opacity hover:opacity-95"
          style={{ backgroundColor: '#E8A8BC', boxShadow: '0 8px 24px -6px rgba(232, 168, 188, 0.4)' }}
        >
          进入拍摄
        </button>
      </motion.main>
    </div>
  );
}
