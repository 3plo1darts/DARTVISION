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
  intervalMs = 2000, // Bilanciamento ottimale tra velocità AI e carico rete
  detectedDarts = []
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        setError("Permessi fotocamera necessari.");
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
            // Inviamo a 1024px di larghezza per un dettaglio superiore senza saturare la banda
            canvas.width = 1024;
            canvas.height = (1024 / video.videoWidth) * video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // Qualità 0.8 per preservare le linee sottili del bersaglio
              onFrameCapture(canvas.toDataURL('image/jpeg', 0.8));
            }
          }
        }
      }, intervalMs);
    }
    return () => clearInterval(intervalId);
  }, [isActive, hasPermission, intervalMs, onFrameCapture]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
      {!hasPermission && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-600 gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Inizializzazione Ottica...</p>
        </div>
      )}
      
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover opacity-60 grayscale-[40%]" 
      />
      
      {/* Visualizzazione Punti Rilevati con stile futuristico */}
      {detectedDarts.map((dart, idx) => (
        <div 
          key={idx}
          className="absolute z-20 pointer-events-none transition-all duration-700 ease-out"
          style={{
            left: `${(dart.coordinates?.x || 0) / 10}%`,
            top: `${(dart.coordinates?.y || 0) / 10}%`
          }}
        >
           <div className="w-10 h-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-red-500 rounded-full animate-[ping_2s_infinite] opacity-50" />
              <div className="absolute inset-2 border border-white rounded-full opacity-30" />
              <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff]" />
              
              {/* Badge info */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-xl border border-white/20 flex flex-col items-center min-w-[40px]">
                <span className="leading-none">{dart.zone}</span>
                <span className="text-[7px] opacity-70 tracking-tighter">CONFIRMED</span>
              </div>
           </div>
        </div>
      ))}

      {/* Overlay di puntamento */}
      <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20">
         <div className="w-full h-full border border-white/10 rounded-3xl flex items-center justify-center">
            <div className="w-8 h-8 border-t-2 border-l-2 border-red-600 absolute top-4 left-4" />
            <div className="w-8 h-8 border-t-2 border-r-2 border-red-600 absolute top-4 right-4" />
            <div className="w-8 h-8 border-b-2 border-l-2 border-red-600 absolute bottom-4 left-4" />
            <div className="w-8 h-8 border-b-2 border-r-2 border-red-600 absolute bottom-4 right-4" />
         </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};