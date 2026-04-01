import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Download, RotateCcw, Volume2, VolumeX,
  ChevronDown, Sparkles, Image, Type, Smile, X, Check, ArrowLeft, Loader2, Upload, RefreshCw,
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import {
  FILTERS, FRAMES, STICKER_EMOJIS, FilterDef, FrameDef,
  PlacedSticker, BoothSessionPersist,
  playShutterSound,
  generateComposite, savePhotosToStorage, loadPhotosFromStorage, clearPhotosFromStorage,
  saveSessionToStorage, getStripAspectRatio, frameFooterColors,
} from '@/lib/photobooth-utils';

type Phase = 'setup' | 'countdown' | 'preview' | 'editing';

interface PhotoBoothProps {
  session: BoothSessionPersist;
  onExit: () => void;
}

export default function PhotoBooth({ session, onExit }: PhotoBoothProps) {
  type SelectedStickerDef = { kind: 'emoji' | 'image'; content: string } | null;
  const layout = session.layout;
  const captureMode = session.captureMode;
  const cameraOn = captureMode === 'camera';

  const { videoRef, devices, selectedDevice, setSelectedDevice, error, isReady, refreshDevices, capturePhoto } =
    useCamera(cameraOn);

  const [phase, setPhase] = useState<Phase>('setup');
  const [photos, setPhotos] = useState<string[]>(() => loadPhotosFromStorage());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [countdownDuration] = useState(session.countdownSec);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [globalFilter, setGlobalFilter] = useState('none');
  const [photoFilters, setPhotoFilters] = useState(['none', 'none', 'none', 'none']);
  const [selectedFrame, setSelectedFrame] = useState<FrameDef>(session.frame);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<SelectedStickerDef>(null);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [showDate, setShowDate] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState<'jpg' | 'png'>('png');
  const [editTab, setEditTab] = useState<'filter' | 'frame' | 'sticker' | 'text'>('filter');
  const [editingPhotoIdx, setEditingPhotoIdx] = useState<number | null>(null);

  const [flashVisible, setFlashVisible] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const stripRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const stickerUploadInputRef = useRef<HTMLInputElement>(null);

  const shootingActive =
    phase === 'countdown' || phase === 'preview' ||
    (phase === 'setup' && photos.length > 0 && photos.length < 4);

  useEffect(() => {
    saveSessionToStorage(session);
  }, [session]);

  useEffect(() => {
    setSelectedFrame(session.frame);
  }, [session.frame.id, session.frame.imageUrl, session.frame.bgColor]);

  useEffect(() => {
    if (photos.length === 4 && phase === 'setup') {
      setPhase('editing');
    }
  }, [photos.length, phase]);

  useEffect(() => { savePhotosToStorage(photos); }, [photos]);

  useEffect(() => {
    if (phase !== 'countdown' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase === 'countdown' && countdown === 0) {
      doCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, phase]);

  const startCountdown = useCallback(() => {
    setCountdown(countdownDuration);
    setPhase('countdown');
  }, [countdownDuration]);

  const doCapture = useCallback(() => {
    if (soundEnabled) playShutterSound();
    setFlashVisible(true);
    setTimeout(() => setFlashVisible(false), 250);
    const photo = capturePhoto();
    if (photo) {
      setPreviewPhoto(photo);
      setPhase('preview');
    }
  }, [capturePhoto, soundEnabled]);

  const confirmPhoto = useCallback(() => {
    if (!previewPhoto) return;
    const newPhotos = [...photos];
    newPhotos[currentIndex] = previewPhoto;
    const nextIdx = currentIndex + 1;
    const hasMore = currentIndex < 3;
    setPhotos(newPhotos);
    setPreviewPhoto(null);
    if (hasMore) {
      setCurrentIndex(nextIdx);
      setPhase('setup');
      queueMicrotask(() => startCountdown());
    } else {
      setPhase('editing');
    }
  }, [previewPhoto, photos, currentIndex, startCountdown]);

  const retakePhoto = useCallback(() => {
    setPreviewPhoto(null);
    setPhase('setup');
  }, []);

  const resetAll = useCallback(() => {
    setPhotos([]);
    setCurrentIndex(0);
    setPhase('setup');
    setPreviewPhoto(null);
    setStickers([]);
    setGlobalFilter('none');
    setPhotoFilters(['none', 'none', 'none', 'none']);
    setCompositeUrl(null);
    setEditingPhotoIdx(null);
    setSelectedSticker(null);
    setActiveStickerId(null);
    setSelectedFrame(session.frame);
    clearPhotosFromStorage();
  }, [session.frame]);

  const handleExitRequest = useCallback(() => {
    if (shootingActive || (photos.length > 0 && photos.length < 4)) {
      if (!window.confirm('返回将丢失当前拍摄进度，确定吗？')) return;
    }
    resetAll();
    onExit();
  }, [shootingActive, photos.length, onExit, resetAll]);

  const handleGenerate = useCallback(async () => {
    if (photos.length < 4) return;
    const resolvedFilters = photoFilters.map(f =>
      f !== 'none' ? f : globalFilter
    );
    const url = await generateComposite({
      photos,
      frame: selectedFrame,
      layout,
      globalFilter,
      photoFilters: resolvedFilters,
      stickers,
      text: customText,
      showDate,
      format: downloadFormat,
    });
    setCompositeUrl(url);
  }, [photos, selectedFrame, layout, globalFilter, photoFilters, stickers, customText, showDate, downloadFormat]);

  useEffect(() => {
    if (phase === 'editing' && photos.length === 4) {
      handleGenerate();
    }
  }, [phase, handleGenerate, photos.length, selectedFrame, layout, photoFilters, globalFilter, stickers, customText, showDate, downloadFormat]);

  const handleDownload = useCallback(() => {
    if (!compositeUrl) return;
    const a = document.createElement('a');
    a.href = compositeUrl;
    a.download = `photobooth_${Date.now()}.${downloadFormat}`;
    a.click();
  }, [compositeUrl, downloadFormat]);

  const handleStripClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSticker || !stripRef.current) return;
    const rect = stripRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = Date.now().toString();
    setStickers(prev => [...prev, {
      id,
      kind: selectedSticker.kind,
      content: selectedSticker.content,
      x,
      y,
      scale: 1,
      rotation: 0,
    }]);
    setActiveStickerId(id);
  }, [selectedSticker]);
  const handleCustomStickerUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      alert('仅支持 JPG / PNG / WEBP 格式');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSelectedSticker({ kind: 'image', content: dataUrl });
    };
    reader.onerror = () => alert('读取贴纸失败');
    reader.readAsDataURL(file);
  }, []);


  const handleStickerMouseDown = useCallback((e: React.MouseEvent, stickerId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveStickerId(stickerId);
    if (!stripRef.current) return;

    const onMove = (me: MouseEvent) => {
      if (!stripRef.current) return;
      const rect = stripRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100));
      setStickers(prev => prev.map(s => s.id === stickerId ? { ...s, x, y } : s));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleStickerTouchStart = useCallback((e: React.TouchEvent, stickerId: string) => {
    e.stopPropagation();
    setActiveStickerId(stickerId);
    if (!stripRef.current) return;

    const onMove = (te: TouchEvent) => {
      te.preventDefault();
      if (!stripRef.current) return;
      const touch = te.touches[0];
      const rect = stripRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
      setStickers(prev => prev.map(s => s.id === stickerId ? { ...s, x, y } : s));
    };
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }, []);

  const removeSticker = useCallback((id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
    setActiveStickerId(prev => (prev === id ? null : prev));
  }, []);

  const updateSticker = useCallback((id: string, patch: Partial<PlacedSticker>) => {
    setStickers(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const getPhotoFilter = (idx: number) => {
    const pf = photoFilters[idx];
    return pf !== 'none' ? pf : globalFilter !== 'none' ? globalFilter : 'none';
  };

  const processUploadedFiles = useCallback((files: FileList | null): void => {
    if (!files || files.length !== 4) {
      alert('请一次选择 4 张 JPG 或 PNG 图片');
      return;
    }
    const arr = Array.from(files);
    if (!arr.every(f => /^image\/(jpeg|png)$/i.test(f.type))) {
      alert('仅支持 JPG / PNG 格式');
      return;
    }
    setBusy('处理图片中…');
    const readers = arr.map(file => new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    }));
    Promise.all(readers)
      .then(urls => {
        setPhotos(urls);
        setCurrentIndex(0);
        setPhase('editing');
        setBusy(null);
      })
      .catch(() => {
        setBusy(null);
        alert('读取图片失败');
      });
  }, []);

  const footerStyle = frameFooterColors(selectedFrame);

  const renderStripInner = () => (
    <>
      {layout === 'vertical' ? (
        <div className="flex flex-col gap-[3.5%] p-[4%] pb-[2%] flex-1 min-h-0">
          {photos.map((photo, i) => (
            <div
              key={i}
              className={`relative w-full max-w-[92%] mx-auto aspect-[4/3] rounded-xl overflow-hidden ring-2 transition-all ${
                editTab === 'sticker' ? 'cursor-default' : 'cursor-pointer'
              } ${
                editingPhotoIdx === i ? 'ring-primary' : 'ring-transparent'
              }`}
              onClick={(e) => {
                if (editTab === 'sticker') return;
                e.stopPropagation();
                setEditingPhotoIdx(editingPhotoIdx === i ? null : i);
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={`${i + 1}`}
                  className="w-full h-full object-cover"
                  style={{ filter: getPhotoFilter(i) }}
                />
              ) : (
                <div className="w-full h-full bg-muted/30" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-[5%] p-[5%] pb-[3%] flex-1 content-start">
          {photos.map((photo, i) => (
            <div
              key={i}
              className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer ring-2 transition-all ${
                editTab === 'sticker' ? 'cursor-default' : 'cursor-pointer'
              } ${
                editingPhotoIdx === i ? 'ring-primary' : 'ring-transparent'
              }`}
              onClick={(e) => {
                if (editTab === 'sticker') return;
                e.stopPropagation();
                setEditingPhotoIdx(editingPhotoIdx === i ? null : i);
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={`${i + 1}`}
                  className="w-full h-full object-cover"
                  style={{ filter: getPhotoFilter(i) }}
                />
              ) : (
                <div className="w-full h-full bg-muted/30" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-center px-4 py-2 shrink-0">
        {customText && <p className="text-xs font-medium" style={{ color: footerStyle.main }}>{customText}</p>}
        {showDate && (
          <p className="text-[10px] mt-0.5" style={{ color: footerStyle.date }}>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
          </p>
        )}
      </div>

      {stickers.map(s => (
        <div
          key={s.id}
          className={`absolute z-[5] select-none cursor-grab active:cursor-grabbing group ${
            activeStickerId === s.id ? 'ring-2 ring-primary/35 rounded-lg' : ''
          }`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})`,
            transformOrigin: 'center',
          }}
          onMouseDown={e => handleStickerMouseDown(e, s.id)}
          onTouchStart={e => handleStickerTouchStart(e, s.id)}
          onClick={(e) => { e.stopPropagation(); setActiveStickerId(s.id); }}
        >
          {s.kind === 'emoji' ? (
            <span className="text-2xl animate-bounce-in">{s.content}</span>
          ) : (
            <img src={s.content} alt="custom sticker" className="w-11 h-11 object-contain animate-bounce-in pointer-events-none" />
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeSticker(s.id); }}
            className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}
    </>
  );

  const miniPreview = (
    <div className={`glass-panel p-4 animate-fade-in ${layout === 'vertical' ? 'max-w-[200px] mx-auto' : ''}`}>
      <p className="text-xs text-muted-foreground mb-3 text-center">已拍摄</p>
      {layout === 'vertical' ? (
        <div className="flex flex-col gap-2 mx-auto w-[120px]">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-muted/30">
              {photos[i] ? (
                <img src={photos[i]} alt={`${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-sm">{i + 1}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-w-[240px] mx-auto">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden bg-muted/30">
              {photos[i] ? (
                <img src={photos[i]} alt={`${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-2xl">{i + 1}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const editingContent = (
    <>
      <div className="glass-panel p-4 animate-fade-in">
        <div
          ref={stripRef}
          className="relative mx-auto photo-strip-shadow rounded-2xl overflow-hidden cursor-crosshair flex flex-col"
          style={{
            backgroundColor: selectedFrame.imageUrl ? 'transparent' : selectedFrame.bgColor,
            border: selectedFrame.imageUrl ? 'none' : `2px solid ${selectedFrame.borderColor}`,
            maxWidth: layout === 'vertical' ? 320 : 360,
            aspectRatio: getStripAspectRatio(layout),
            backgroundImage: selectedFrame.imageUrl ? `url(${selectedFrame.imageUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={handleStripClick}
        >
          <div className="relative z-[1] flex flex-col flex-1 min-h-0 w-full h-full">
            {renderStripInner()}
          </div>
        </div>
      </div>

      <div className="glass-panel p-4 animate-fade-in">
        <div className="flex gap-1 mb-4 bg-muted/40 rounded-xl p-1">
          {([
            { key: 'filter' as const, icon: Sparkles, label: '滤镜' },
            { key: 'frame' as const, icon: Image, label: '边框' },
            { key: 'sticker' as const, icon: Smile, label: '贴纸' },
            { key: 'text' as const, icon: Type, label: '文字' },
          ]).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setEditTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                editTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {editTab === 'filter' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {editingPhotoIdx !== null ? `第 ${editingPhotoIdx + 1} 张独立滤镜` : '全局滤镜'}
            </p>
            <p className="text-xs text-primary/90">可以单张各自选取滤镜哦~</p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f: FilterDef) => {
                const isActive = editingPhotoIdx !== null
                  ? photoFilters[editingPhotoIdx] === f.filter || (photoFilters[editingPhotoIdx] === 'none' && f.id === 'none')
                  : globalFilter === f.filter || (globalFilter === 'none' && f.id === 'none');
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (editingPhotoIdx !== null) {
                        setPhotoFilters(prev => {
                          const next = [...prev];
                          next[editingPhotoIdx] = f.filter;
                          return next;
                        });
                      } else {
                        setGlobalFilter(f.filter);
                      }
                    }}
                    className={`booth-chip ${isActive ? 'booth-chip-active' : 'booth-chip-inactive'}`}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
            {editingPhotoIdx !== null && (
              <button type="button" onClick={() => setEditingPhotoIdx(null)} className="text-xs text-primary hover:underline">
                ← 返回全局滤镜
              </button>
            )}
          </div>
        )}

        {editTab === 'frame' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">完成后可更换边框；需更换自定义底图请返回设置页</p>
            <div className="flex flex-wrap gap-2">
              {FRAMES.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFrame({ ...f, imageUrl: undefined })}
                  className={`booth-chip flex items-center gap-1.5 ${
                    selectedFrame.id === f.id && !selectedFrame.imageUrl ? 'booth-chip-active' : 'booth-chip-inactive'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border"
                    style={{ backgroundColor: f.bgColor, borderColor: f.borderColor }}
                  />
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {editTab === 'sticker' && (
          <div className="space-y-2">
            <input
              ref={stickerUploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleCustomStickerUpload}
            />
            <p className="text-xs text-muted-foreground">先选贴纸，再点击整张相纸放置；拖拽即可移动</p>
            <div className="flex flex-wrap gap-1.5">
              {STICKER_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedSticker(
                    selectedSticker?.kind === 'emoji' && selectedSticker.content === emoji
                      ? null
                      : { kind: 'emoji', content: emoji },
                  )}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                    selectedSticker?.kind === 'emoji' && selectedSticker.content === emoji
                      ? 'bg-primary/15 ring-2 ring-primary/30 scale-110'
                      : 'hover:bg-muted/60'
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => stickerUploadInputRef.current?.click()}
                className={`h-9 px-2 rounded-lg text-xs border transition-all ${
                  selectedSticker?.kind === 'image'
                    ? 'bg-primary/10 border-primary/40 text-foreground'
                    : 'bg-card/60 border-border/60 hover:bg-muted/40'
                }`}
              >
                自定义贴纸
              </button>
            </div>
            {activeStickerId && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">大小</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    value={stickers.find(s => s.id === activeStickerId)?.scale ?? 1}
                    onChange={(e) => updateSticker(activeStickerId, { scale: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">旋转</span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={stickers.find(s => s.id === activeStickerId)?.rotation ?? 0}
                    onChange={(e) => updateSticker(activeStickerId, { rotation: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateSticker(activeStickerId, { scale: 1, rotation: 0 })}
                  className="text-xs text-primary hover:underline"
                >
                  重置当前贴纸
                </button>
              </div>
            )}
            {stickers.length > 0 && (
              <button
                type="button"
                onClick={() => { setStickers([]); setActiveStickerId(null); }}
                className="text-xs text-destructive hover:underline"
              >
                清除所有贴纸
              </button>
            )}
          </div>
        )}

        {editTab === 'text' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="custom-text" className="text-xs text-muted-foreground block mb-1">自定义文字</label>
              <input
                id="custom-text"
                type="text"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="输入落款 / slogan..."
                className="booth-input w-full"
                maxLength={30}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDate}
                onChange={e => setShowDate(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm">显示日期</span>
            </label>
          </div>
        )}
      </div>

      <div className="glass-panel p-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">格式</span>
          {(['png', 'jpg'] as const).map(fmt => (
            <button
              key={fmt}
              type="button"
              onClick={() => setDownloadFormat(fmt)}
              className={`booth-chip uppercase ${
                downloadFormat === fmt ? 'booth-chip-active' : 'booth-chip-inactive'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={handleDownload} disabled={!compositeUrl} className="booth-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40 min-w-[140px]">
            <Download className="w-4 h-4" /> 下载高清图片
          </button>
          <button type="button" onClick={resetAll} className="booth-btn flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4" /> 重新拍摄
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFBF7' }}>
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

      <header className="text-center py-4 px-4 border-b border-border/30 bg-[#FDFBF7]/95 backdrop-blur-sm sticky top-0 z-10">
        <button
          type="button"
          onClick={handleExitRequest}
          className="absolute left-3 top-1/2 -translate-y-1/2 booth-btn-ghost flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          设置
        </button>
        <h1 className="text-lg font-semibold tracking-wide text-foreground">
          <Camera className="inline-block w-5 h-5 mr-2 text-primary -mt-0.5" />
          四格大头贴
        </h1>
      </header>

      {phase === 'editing' && photos.length === 4 ? (
        <main className="px-4 pb-8 max-w-3xl mx-auto pt-5 space-y-4">
          {editingContent}
        </main>
      ) : (
      <main className="flex flex-col lg:flex-row gap-5 px-4 pb-8 max-w-6xl mx-auto pt-5">
        <div className="flex-1 min-w-0">
          {!cameraOn && phase !== 'editing' ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-8 text-center animate-fade-in"
            >
              <Upload className="w-10 h-10 mx-auto text-primary mb-4 opacity-80" />
              <p className="text-foreground font-medium mb-1">上传四格素材</p>
              <p className="text-sm text-muted-foreground mb-6">一次选择 4 张 JPG 或 PNG</p>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={e => {
                  processUploadedFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="booth-btn-primary"
              >
                选择图片
              </button>
            </motion.div>
          ) : cameraOn && error ? (
            <div className="glass-panel p-8 text-center animate-fade-in space-y-4">
              <div className="w-16 h-16 rounded-full bg-booth-pink flex items-center justify-center mx-auto">
                <Camera className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium mb-2">摄像头异常</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              {devices.length >= 1 && (
                <div className="text-left max-w-sm mx-auto">
                  <label htmlFor="cam-fix" className="text-xs text-muted-foreground block mb-1">切换摄像头</label>
                  <div className="relative">
                    <select
                      id="cam-fix"
                      value={selectedDevice}
                      onChange={e => setSelectedDevice(e.target.value)}
                      className="booth-select w-full pr-8"
                    >
                      {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">可在此选择电脑自带或外接 USB 摄像头</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => refreshDevices()}
                className="booth-btn inline-flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                刷新设备列表
              </button>
            </div>
          ) : cameraOn ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel overflow-hidden animate-fade-in"
            >
              <div className="relative aspect-[4/3] bg-muted/30 overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  disablePictureInPicture
                  disableRemotePlayback
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                <AnimatePresence>
                  {phase === 'countdown' && countdown > 0 && (
                    <motion.div
                      key={countdown}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-foreground/10 backdrop-blur-sm"
                    >
                      <span className="text-7xl font-light text-card">{countdown}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {flashVisible && (
                  <div className="absolute inset-0 bg-card animate-flash pointer-events-none" />
                )}

                <AnimatePresence>
                  {phase === 'preview' && previewPhoto && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/5 backdrop-blur-sm p-4"
                    >
                      <motion.img
                        initial={{ scale: 0.85 }}
                        animate={{ scale: 1 }}
                        src={previewPhoto}
                        className="max-w-[80%] max-h-[60%] rounded-xl shadow-lg object-cover"
                        alt="preview"
                      />
                      <div className="flex gap-3 mt-4">
                        <button type="button" onClick={retakePhoto} className="booth-btn flex items-center gap-1.5">
                          <RotateCcw className="w-4 h-4" /> 重拍
                        </button>
                        <button type="button" onClick={confirmPhoto} className="booth-btn-primary flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> 确认
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {phase !== 'editing' && (
                  <div className="absolute top-3 right-3 bg-card/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-foreground">
                    {Math.min(currentIndex + 1, 4)} / 4
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3">
                {devices.length >= 1 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">摄像头</span>
                      <button
                        type="button"
                        onClick={() => refreshDevices()}
                        className="booth-btn-ghost text-[11px] py-1 px-2 inline-flex items-center gap-1"
                        title="重新检测摄像头（如已插入外接摄像头）"
                      >
                        <RefreshCw className="w-3 h-3" />
                        刷新列表
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={selectedDevice}
                        onChange={e => setSelectedDevice(e.target.value)}
                        className="booth-select w-full pr-8"
                      >
                        {devices.map(d => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">可在内置与外接摄像头之间切换</p>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    倒计时 {countdownDuration}s
                  </span>
                  <button type="button" onClick={() => setSoundEnabled(!soundEnabled)} className="booth-btn-ghost p-2 ml-auto">
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  {phase === 'setup' && (
                    <button
                      type="button"
                      onClick={startCountdown}
                      disabled={!isReady}
                      className="booth-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Camera className="w-4 h-4" />
                      {photos.length > 0 ? `拍摄第 ${currentIndex + 1} 张` : '开始拍摄'}
                    </button>
                  )}
                  {photos.length > 0 && phase === 'setup' && (
                    <button type="button" onClick={resetAll} className="booth-btn flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4" /> 重来
                    </button>
                  )}
                </div>

                {phase !== 'editing' && (
                  <div className="flex justify-center gap-2 pt-1">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          i < photos.length ? 'bg-primary scale-110' :
                          i === currentIndex ? 'bg-primary/40 animate-pulse-soft' :
                          'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          {cameraOn ? (
            miniPreview
          ) : !cameraOn && phase === 'editing' ? (
            <div className="glass-panel p-8 text-center text-sm text-muted-foreground animate-fade-in">
              四格已就绪，请在右侧编辑、下载或重新拍摄
            </div>
          ) : null}
        </div>
      </main>
      )}
    </div>
  );
}
