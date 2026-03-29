import { useState, useEffect, useRef, useCallback } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

function dedupeVideoInputs(devices: MediaDeviceInfo[]): CameraDevice[] {
  const seen = new Set<string>();
  const out: CameraDevice[] = [];
  for (const d of devices) {
    if (d.kind !== 'videoinput' || !d.deviceId) continue;
    if (seen.has(d.deviceId)) continue;
    seen.add(d.deviceId);
    out.push({
      deviceId: d.deviceId,
      label: d.label || `摄像头 ${out.length + 1}`,
    });
  }
  return out;
}

export function useCamera(enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const permissionGrantedRef = useRef(false);

  const enumerateCameras = useCallback(async (withPermissionPrompt: boolean) => {
    try {
      if (withPermissionPrompt && !permissionGrantedRef.current) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(t => t.stop());
        permissionGrantedRef.current = true;
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = dedupeVideoInputs(allDevices);

      if (videoDevices.length === 0) {
        setError('未检测到摄像头设备，请连接摄像头后重试');
        setDevices([]);
        setSelectedDevice('');
        return;
      }

      setDevices(videoDevices);
      setSelectedDevice(prev => {
        if (prev && videoDevices.some(d => d.deviceId === prev)) return prev;
        return videoDevices[0].deviceId;
      });
      setError('');
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'NotAllowedError') {
        setError('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头');
      } else if (e.name === 'NotFoundError') {
        setError('未找到摄像头设备，请连接摄像头后刷新页面');
      } else {
        setError(`摄像头初始化失败：${e.message || '未知错误'}`);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDevices([]);
      setSelectedDevice('');
      setError('');
      setIsReady(false);
      return;
    }
    enumerateCameras(true);
  }, [enabled, enumerateCameras]);

  useEffect(() => {
    if (!enabled) return;

    const onDeviceChange = () => {
      enumerateCameras(false);
    };

    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
  }, [enabled, enumerateCameras]);

  useEffect(() => {
    if (!enabled) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsReady(false);
      return;
    }
    if (!selectedDevice) return;

    let cancelled = false;

    async function startStream() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setIsReady(false);

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { ideal: selectedDevice },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (cancelled) {
          newStream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = newStream;
        setError('');

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) setIsReady(true);
          };
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as { name?: string; message?: string };
          let msg = e.message || '未知错误';
          if (e.name === 'OverconstrainedError') {
            msg = '当前摄像头不可用，请在下拉列表中换一台设备或重新插拔外接摄像头';
          }
          setError(`无法启动摄像头：${msg}`);
        }
      }
    }

    startStream();
    return () => { cancelled = true; };
  }, [enabled, selectedDevice]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const refreshDevices = useCallback(() => {
    enumerateCameras(!permissionGrantedRef.current);
  }, [enumerateCameras]);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/png');
  }, []);

  return {
    videoRef,
    devices,
    selectedDevice,
    setSelectedDevice,
    error,
    isReady,
    refreshDevices,
    capturePhoto,
  };
}
