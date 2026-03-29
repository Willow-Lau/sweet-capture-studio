import { useState, useEffect, useRef, useCallback } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function enumerate() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(t => t.stop());

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices
          .filter(d => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `摄像头 ${i + 1}`,
          }));

        if (cancelled) return;

        if (videoDevices.length === 0) {
          setError('未检测到摄像头设备，请连接摄像头后重试');
          return;
        }

        setDevices(videoDevices);
        setSelectedDevice(videoDevices[0].deviceId);
      } catch (err: unknown) {
        if (cancelled) return;
        const e = err as { name?: string; message?: string };
        if (e.name === 'NotAllowedError') {
          setError('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头');
        } else if (e.name === 'NotFoundError') {
          setError('未找到摄像头设备，请连接摄像头后刷新页面');
        } else {
          setError(`摄像头初始化失败：${e.message || '未知错误'}`);
        }
      }
    }

    enumerate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
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
            deviceId: { exact: selectedDevice },
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
          const e = err as { message?: string };
          setError(`无法启动摄像头：${e.message || '未知错误'}`);
        }
      }
    }

    startStream();
    return () => { cancelled = true; };
  }, [selectedDevice]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    // Mirror the capture to match the mirrored preview
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
    capturePhoto,
  };
}
