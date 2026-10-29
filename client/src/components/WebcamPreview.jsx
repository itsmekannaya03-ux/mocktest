import React, { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, ShieldCheck, Eye } from 'lucide-react';

export default function WebcamPreview() {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [active, setActive] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  const startCamera = async () => {
    setPermissionError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      setActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Webcam permission denied or unavailable:', err.message);
      setPermissionError('Camera access declined or unavailable on this device.');
      setActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setActive(false);
  };

  useEffect(() => {
    // Attempt auto-start if permitted
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span>Local Proctor Feed</span>
        </div>
        <button
          onClick={active ? stopCamera : startCamera}
          className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1"
        >
          {active ? (
            <>
              <CameraOff className="w-2.5 h-2.5 text-rose-400" />
              <span>Disable</span>
            </>
          ) : (
            <>
              <Camera className="w-2.5 h-2.5 text-cyan-400" />
              <span>Enable</span>
            </>
          )}
        </button>
      </div>

      <div className="relative aspect-video rounded-xl bg-black/60 overflow-hidden border border-slate-800 flex items-center justify-center">
        {active ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-mono text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE</span>
            </div>
          </>
        ) : (
          <div className="text-center p-3 text-slate-500">
            <CameraOff className="w-6 h-6 mx-auto mb-1 opacity-40" />
            <p className="text-[11px]">
              {permissionError || 'Camera preview paused'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 text-[10px] text-slate-400/90 leading-tight flex items-start space-x-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          <strong>Privacy Notice:</strong> Video preview operates in browser memory only. No external video recording or unauthorized storage occurs.
        </span>
      </div>
    </div>
  );
}
