import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Download, RotateCcw, Volume2, VolumeX,
  ChevronDown, Sparkles, Image, Type, Smile, X, Check
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import {
  FILTERS, FRAMES, STICKER_EMOJIS, FilterDef, FrameDef,
  PlacedSticker, playShutterSound,
  generateComposite, savePhotosToStorage, loadPhotosFromStorage, clearPhotosFromStorage
} from '@/lib/photobooth-utils';

type Phase = 'setup' | 'countdown' | 'preview' | 'editing';

export default function PhotoBooth() {
  const { videoRef, devices, selectedDevice, setSelectedDevice, error, isReady, capturePhoto } = useCamera();

  const [phase, setPhase] = useState<Phase>('setup');
  const [photos, setPhotos] = useState<string[]>(() => loadPhotosFromStorage());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [countdownDuration, setCountdownDuration] = useState<number>(5);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [globalFilter, setGlobalFilter] = useState('none');
  const [photoFilters, setPhotoFilters] = useState(['none', 'none', 'none', 'none']);
  const [selectedFrame, setSelectedFrame] = useState<FrameDef>(FRAMES[0]);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [showDate, setShowDate] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState<'jpg' | 'png'>('png');
  const [editTab, setEditTab] = useState<'filter' | 'frame' | 'sticker' | 'text'>('filter');
  const [editingPhotoIdx, setEditingPhotoIdx] = useState<number | null>(null);

  const [flashVisible, setFlashVisible] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);

  const stripRef = useRef<HTMLDivElement>(null);

  // Restore from localStorage
  useEffect(() => {
    if (photos.length === 4 && phase === 'setup') {
      setPhase('editing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => { savePhotosToStorage(photos); }, [photos]);

  // Countdown
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
    setPhotos(newPhotos);
    setPreviewPhoto(null);
    if (currentIndex < 3) {
      setCurrentIndex(currentIndex + 1);
      setPhase('setup');
    } else {
      setPhase('editing');
    }
  }, [previewPhoto, photos, currentIndex]);

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
    clearPhotosFromStorage();
  }, []);

  // Composite generation
  const handleGenerate = useCallback(async () => {
    if (photos.length < 4) return;
    const resolvedFilters = photoFilters.map(f =>
      f !== 'none' ? f : globalFilter
    );
    const url = await generateComposite({
      photos, frame: selectedFrame, globalFilter,
      photoFilters: resolvedFilters, stickers,
      text: customText, showDate, format: downloadFormat,
    });
    setCompositeUrl(url);
  }, [photos, selectedFrame, globalFilter, photoFilters, stickers, customText, showDate, downloadFormat]);

  useEffect(() => {
    if (phase === 'editing' && photos.length === 4) {
      handleGenerate();
    }
  }, [phase, handleGenerate, photos.length]);

  const handleDownload = useCallback(() => {
    if (!compositeUrl) return;
    const a = document.createElement('a');
    a.href = compositeUrl;
    a.download = `photobooth_${Date.now()}.${downloadFormat}`;
    a.click();
  }, [compositeUrl, downloadFormat]);

  // Sticker placement
  const handleStripClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSticker || !stripRef.current) return;
    const rect = stripRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setStickers(prev => [...prev, {
      id: Date.now().toString(), emoji: selectedSticker, x, y
    }]);
  }, [selectedSticker]);

  const handleStickerMouseDown = useCallback((e: React.MouseEvent, stickerId: string) => {
    e.stopPropagation();
    e.preventDefault();
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
  }, []);

  const getPhotoFilter = (idx: number) => {
    const pf = photoFilters[idx];
    return pf !== 'none' ? pf : globalFilter !== 'none' ? globalFilter : 'none';
  };

  // ─── RENDER ───

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="text-center py-5 px-4">
        <h1 className="text-xl font-semibold tracking-wide text-foreground">
          <Camera className="inline-block w-5 h-5 mr-2 text-primary -mt-0.5" />
          四格大头贴
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Korean Style Photo Booth ✿</p>
      </header>

      <main className="flex flex-col lg:flex-row gap-5 px-4 pb-8 max-w-6xl mx-auto">
        {/* ─── LEFT: Camera ─── */}
        <div className="flex-1 min-w-0">
          {error ? (
            <div className="glass-panel p-8 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-booth-pink flex items-center justify-center mx-auto mb-4">
                <Camera className="w-7 h-7 text-primary" />
              </div>
              <p className="text-foreground font-medium mb-2">摄像头异常</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden animate-fade-in">
              {/* Video container */}
              <div className="relative aspect-[4/3] bg-muted/30 overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Countdown overlay */}
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

                {/* Flash */}
                {flashVisible && (
                  <div className="absolute inset-0 bg-card animate-flash pointer-events-none" />
                )}

                {/* Preview overlay */}
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
                        <button onClick={retakePhoto} className="booth-btn flex items-center gap-1.5">
                          <RotateCcw className="w-4 h-4" /> 重拍
                        </button>
                        <button onClick={confirmPhoto} className="booth-btn-primary flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> 确认
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Photo counter badge */}
                {phase !== 'editing' && (
                  <div className="absolute top-3 right-3 bg-card/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-foreground">
                    {Math.min(currentIndex + 1, 4)} / 4
                  </div>
                )}
              </div>

              {/* Controls below video */}
              <div className="p-4 space-y-3">
                {/* Camera selector */}
                {devices.length > 1 && (
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
                )}

                {/* Settings row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Countdown selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">倒计时</span>
                    {[5, 10, 15].map(s => (
                      <button
                        key={s}
                        onClick={() => setCountdownDuration(s)}
                        className={`booth-chip ${countdownDuration === s ? 'booth-chip-active' : 'booth-chip-inactive'}`}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>

                  {/* Sound toggle */}
                  <button onClick={() => setSoundEnabled(!soundEnabled)} className="booth-btn-ghost p-2 ml-auto">
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {phase === 'setup' && (
                    <button
                      onClick={startCountdown}
                      disabled={!isReady}
                      className="booth-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Camera className="w-4 h-4" />
                      {photos.length > 0 ? `拍摄第 ${currentIndex + 1} 张` : '开始拍摄'}
                    </button>
                  )}
                  {photos.length > 0 && phase === 'setup' && (
                    <button onClick={resetAll} className="booth-btn flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4" /> 重来
                    </button>
                  )}
                </div>

                {/* Progress dots */}
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
            </div>
          )}
        </div>

        {/* ─── RIGHT: Preview / Editing ─── */}
        <div className="flex-1 min-w-0 space-y-4">
          {phase === 'editing' && photos.length === 4 ? (
            <>
              {/* Photo strip preview */}
              <div className="glass-panel p-4 animate-fade-in">
                <div
                  ref={stripRef}
                  className="relative mx-auto photo-strip-shadow rounded-2xl overflow-hidden cursor-crosshair"
                  style={{
                    backgroundColor: selectedFrame.bgColor,
                    border: `2px solid ${selectedFrame.borderColor}`,
                    maxWidth: 360,
                    aspectRatio: '600 / 940',
                  }}
                  onClick={handleStripClick}
                >
                  {/* 2×2 grid */}
                  <div className="grid grid-cols-2 gap-[2%] p-[4%] pb-[2%]">
                    {photos.map((photo, i) => (
                      <div
                        key={i}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer ring-2 transition-all ${
                          editingPhotoIdx === i ? 'ring-primary' : 'ring-transparent'
                        }`}
                        onClick={(e) => { e.stopPropagation(); setEditingPhotoIdx(editingPhotoIdx === i ? null : i); }}
                      >
                        <img
                          src={photo}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover"
                          style={{ filter: getPhotoFilter(i) }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Text area */}
                  <div className="text-center px-4 py-2" style={{ color: '#999' }}>
                    {customText && <p className="text-xs font-medium" style={{ color: '#777' }}>{customText}</p>}
                    {showDate && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#BBB' }}>
                        {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {/* Stickers */}
                  {stickers.map(s => (
                    <div
                      key={s.id}
                      className="absolute select-none cursor-grab active:cursor-grabbing group"
                      style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}
                      onMouseDown={e => handleStickerMouseDown(e, s.id)}
                      onTouchStart={e => handleStickerTouchStart(e, s.id)}
                    >
                      <span className="text-2xl animate-bounce-in">{s.emoji}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSticker(s.id); }}
                        className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit tabs */}
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

                {/* Filter tab */}
                {editTab === 'filter' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {editingPhotoIdx !== null ? `第 ${editingPhotoIdx + 1} 张独立滤镜` : '全局滤镜'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {FILTERS.map(f => {
                        const isActive = editingPhotoIdx !== null
                          ? photoFilters[editingPhotoIdx] === f.filter || (photoFilters[editingPhotoIdx] === 'none' && f.id === 'none')
                          : globalFilter === f.filter || (globalFilter === 'none' && f.id === 'none');
                        return (
                          <button
                            key={f.id}
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
                      <button
                        onClick={() => setEditingPhotoIdx(null)}
                        className="text-xs text-primary hover:underline"
                      >
                        ← 返回全局滤镜
                      </button>
                    )}
                  </div>
                )}

                {/* Frame tab */}
                {editTab === 'frame' && (
                  <div className="flex flex-wrap gap-2">
                    {FRAMES.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFrame(f)}
                        className={`booth-chip flex items-center gap-1.5 ${
                          selectedFrame.id === f.id ? 'booth-chip-active' : 'booth-chip-inactive'
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
                )}

                {/* Sticker tab */}
                {editTab === 'sticker' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">选择贴纸后点击照片放置，拖拽移动</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STICKER_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setSelectedSticker(selectedSticker === emoji ? null : emoji)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                            selectedSticker === emoji
                              ? 'bg-primary/15 ring-2 ring-primary/30 scale-110'
                              : 'hover:bg-muted/60'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    {stickers.length > 0 && (
                      <button
                        onClick={() => setStickers([])}
                        className="text-xs text-destructive hover:underline"
                      >
                        清除所有贴纸
                      </button>
                    )}
                  </div>
                )}

                {/* Text tab */}
                {editTab === 'text' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">自定义文字</label>
                      <input
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

              {/* Download */}
              <div className="glass-panel p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">格式</span>
                  {(['png', 'jpg'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setDownloadFormat(fmt)}
                      className={`booth-chip uppercase ${
                        downloadFormat === fmt ? 'booth-chip-active' : 'booth-chip-inactive'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDownload} disabled={!compositeUrl} className="booth-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                    <Download className="w-4 h-4" /> 下载高清图片
                  </button>
                  <button onClick={resetAll} className="booth-btn flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" /> 重新拍摄
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Mini preview of captured photos */
            <div className="glass-panel p-4 animate-fade-in">
              <p className="text-xs text-muted-foreground mb-3 text-center">已拍摄</p>
              <div className="grid grid-cols-2 gap-2 max-w-[240px] mx-auto">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted/30">
                    {photos[i] ? (
                      <img src={photos[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-2xl">
                        {i + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
