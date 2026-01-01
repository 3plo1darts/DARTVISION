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
  intervalMs = 2000,
  detectedDarts = []
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Fotocamera posteriore obbligatoria per mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Camera Access Error:", err);
        setError("Accesso fotocamera negato.");
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleMetadataLoaded = () => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth && videoHeight) {
        setAspectRatio(videoWidth / videoHeight);
      }
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (isActive && hasPermission) {
      intervalId = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = canvas.toDataURL('image/jpeg', 0.6); // Ulteriore compressione per mobile
              onFrameCapture(imageData);
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
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
          <div className="w-10 h-10 border-4 border-gray-800 border-t-red-600 rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest">Inizializzazione Fotocamera...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 p-8 text-center bg-gray-950">
          <div className="space-y-4">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
             <p className="text-sm font-bold uppercase">{error}</p>
          </div>
        </div>
      )}
      
      <div 
        className="relative w-full h-full"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <video
          ref={videoRef}
          onLoadedMetadata={handleMetadataLoaded}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover" // Object cover per riempire l'area su mobile
        />
        
        {/* Overlay Markers per Freccette */}
        {detectedDarts.map((dart, idx) => (
          <div 
            key={idx}
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(dart.coordinates?.x || 500) / 10}%`,
              top: `${(dart.coordinates?.y || 500) / 10}%`
            }}
          >
             <div className="w-8 h-8 rounded-full border-2 border-red-500 bg-red-500/20 animate-ping absolute -left-1 -top-1" />
             <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-xl shadow-black relative" />
             
             <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded border border-white whitespace-nowrap shadow-[0_0_15px_rgba(220,38,38,0.8)]">
                {dart.zone}
             </div>
          </div>
        ))}

        {/* Mirino centrale per calibrazione */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
             <div className="w-48 h-48 border border-white/20 rounded-full flex items-center justify-center">
                <div className="w-1 h-10 bg-white/40 absolute" />
                <div className="w-10 h-1 bg-white/40 absolute" />
             </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      
      {/* Effetto Scanning Line */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-[scan_3s_linear_infinite]" />
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
};