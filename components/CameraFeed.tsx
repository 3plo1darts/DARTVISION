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
  intervalMs = 3500, // Intervallo aumentato per permettere a Gemini Pro di "pensare"
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
            width: { ideal: 3840 }, // Richiediamo 4K se disponibile per avere più dettaglio possibile
            height: { ideal: 2160 }
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
            // Aumentiamo a 1600px: è il "sweet spot" per Gemini Pro per vedere le punte senza eccessivo lag
            const targetWidth = 1600;
            canvas.width = targetWidth;
            canvas.height = (targetWidth / video.videoWidth) * video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Applichiamo un leggero sharpening via canvas se possibile (opzionale)
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              onFrameCapture(canvas.toDataURL('image/jpeg', 0.85));
            }
          }
        }
      }, intervalMs);
    }
    return () => clearInterval(intervalId);
  }, [isActive, hasPermission, intervalMs, onFrameCapture]);

  return (
    <div className="relative w-full h-full bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      
      {/* Markers ad alta visibilità */}
      {detectedDarts.map((dart, idx) => (
        <div 
          key={idx}
          className="absolute z-30 pointer-events-none"
          style={{
            left: `${(dart.coordinates?.x || 0) / 10}%`,
            top: `${(dart.coordinates?.y || 0) / 10}%`
          }}
        >
           <div className="flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-white rounded-full bg-red-600 shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
              <div className="mt-1 bg-black/90 text-white text-[12px] font-black px-2 py-0.5 rounded border border-red-600">
                {dart.zone}
              </div>
           </div>
        </div>
      ))}

      {/* Guida per l'utente */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[80%] aspect-square border-2 border-white/20 rounded-full border-dashed" />
        <div className="absolute top-10 text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">
          Allinea il bersaglio al cerchio
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};