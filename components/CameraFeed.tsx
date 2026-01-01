import React, { useRef, useEffect, useState } from 'react';
import { Dart } from '../types';

interface CameraFeedProps {
  onFrameCapture: (imageData: string) => void;
  isActive: boolean;
  intervalMs?: number;
  detectedDarts?: Dart[];
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ 
  onFrameCapture, 
  isActive, 
  intervalMs = 4000,
  detectedDarts = []
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isActive && hasPermission) {
      intervalId = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const targetWidth = 1920;
            canvas.width = targetWidth;
            canvas.height = (targetWidth / video.videoWidth) * video.videoHeight;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              onFrameCapture(canvas.toDataURL('image/jpeg', 0.9));
            }
          }
        }
      }, intervalMs);
    }
    return () => clearInterval(intervalId);
  }, [isActive, hasPermission, intervalMs, onFrameCapture]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover transition-opacity duration-1000"
        style={{ opacity: hasPermission ? 0.7 : 0 }}
      />
      
      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[20px] sm:border-[30px] border-black/40">
        <div className="w-full h-full border border-red-600/20 rounded-[40px] flex items-center justify-center relative">
          <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
          
          <div className="w-[85%] aspect-square border border-dashed border-white/20 rounded-full animate-[spin_60s_linear_infinite]" />
        </div>
      </div>

      {/* Rilevamento Freccette con Effetti Pulsanti */}
      {detectedDarts.map((dart, idx) => (
        <div 
          key={`${idx}-${dart.zone}`}
          className="absolute z-40 pointer-events-none transition-all duration-700 ease-out"
          style={{
            left: `${(dart.coordinates?.x || 0) / 10}%`,
            top: `${(dart.coordinates?.y || 0) / 10}%`
          }}
        >
           <div className="flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
              {/* Effetto Onda d'urto (Pulse Rings) */}
              <div className="absolute w-12 h-12 border border-red-500 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" />
              <div className="absolute w-16 h-16 border border-white rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20" style={{ animationDelay: '0.5s' }} />
              
              {/* Marker Centrale */}
              <div className="w-6 h-6 border-2 border-white rounded-full bg-red-600 shadow-[0_0_20px_#dc2626] flex items-center justify-center relative z-10">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
              
              {/* Label Punteggio */}
              <div className="mt-3 bg-black/90 text-white text-[10px] font-black px-2.5 py-1 rounded-md shadow-2xl border border-red-600/50 whitespace-nowrap backdrop-blur-sm transform hover:scale-110 transition-transform">
                <span className="text-red-500 mr-1">►</span>{dart.zone}
              </div>
           </div>
        </div>
      ))}

      {!hasPermission && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
             <p className="text-red-500 font-black text-xs uppercase tracking-widest animate-pulse">Neural Link Inizializzazione...</p>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};