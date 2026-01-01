import React, { useState, useCallback, useRef } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { analyzeCalibration, analyzeScore } from './services/geminiService';
import { AppPhase, LogEntry, Dart } from './types';
import { playSuccessChime } from './utils/sound';

const MAX_FAILURES = 3;

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.SETUP);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [flashActive, setFlashActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Game State
  const [currentDarts, setCurrentDarts] = useState<Dart[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [calibrationStatus, setCalibrationStatus] = useState<string>("Inizializza...");

  const failureCountRef = useRef(0);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 5));
  };

  const triggerFeedback = () => {
    setFlashActive(true);
    playSuccessChime();
    setTimeout(() => setFlashActive(false), 500);
  };

  const handleFrameCapture = useCallback(async (imageData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (phase === AppPhase.CALIBRATION) {
        const result = await analyzeCalibration(imageData);
        if (result.detected && result.sectorsIdentified) {
          setCalibrationStatus("Bersaglio OK!");
          addLog("Calibrazione riuscita", 'success');
          triggerFeedback();
          failureCountRef.current = 0;
          setTimeout(() => setPhase(AppPhase.GAME), 1200);
        } else {
          setCalibrationStatus(result.message || "Centra il bersaglio...");
        }
      } 
      else if (phase === AppPhase.GAME) {
        const result = await analyzeScore(imageData);
        if (result.detected) {
          failureCountRef.current = 0;
          if (result.darts) {
            const newScore = result.totalScore || 0;
            if (newScore !== totalScore || result.darts.length !== currentDarts.length) {
               setCurrentDarts(result.darts);
               setTotalScore(newScore);
               addLog(`Colpito: ${result.darts[result.darts.length - 1]?.zone || '?'}`);
               triggerFeedback();
            } else {
              setCurrentDarts(result.darts);
            }
          }
        } else {
          failureCountRef.current += 1;
          if (failureCountRef.current >= MAX_FAILURES) {
             addLog("Bersaglio perso", 'error');
             setPhase(AppPhase.CALIBRATION);
             failureCountRef.current = 0;
          }
        }
      }
    } catch (err) {
      addLog("Errore analisi", 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [phase, isProcessing, totalScore, currentDarts.length]);

  return (
    <div className="h-screen w-screen bg-black text-gray-100 flex flex-col overflow-hidden fixed inset-0 font-sans select-none">
      
      {/* Overlay Flash Feedback */}
      <div className={`fixed inset-0 bg-white pointer-events-none z-[100] transition-opacity duration-300 ${flashActive ? 'opacity-25' : 'opacity-0'}`} />

      {/* Header Mobile UI */}
      <header className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-gradient-to-tr from-red-600 to-red-400 rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg">D</div>
           <h1 className="text-xl font-black italic tracking-tighter text-white">DARTVISION</h1>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{phase}</span>
        </div>
      </header>

      {/* Main App Canvas */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        
        {/* Top Section: Camera / Visuals */}
        <div className="flex-[3] bg-gray-950 relative overflow-hidden">
          {phase === AppPhase.SETUP ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center z-10">
                <div className="relative mb-8">
                   <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                   </div>
                </div>
                <h2 className="text-2xl font-black mb-3 text-white uppercase tracking-tight">Pronto al gioco?</h2>
                <p className="text-gray-500 text-sm mb-8 leading-snug max-w-[240px]">
                  Posiziona il telefono stabilmente puntando il centro del bersaglio.
                </p>
                <button 
                  onClick={() => setPhase(AppPhase.CALIBRATION)}
                  className="w-full h-16 bg-white text-black font-black rounded-2xl shadow-2xl active:scale-95 transition-transform uppercase text-lg"
                >
                  AVVIA SETUP
                </button>
             </div>
          ) : (
             <CameraFeed 
                isActive={true} 
                onFrameCapture={handleFrameCapture} 
                intervalMs={2000}
                detectedDarts={currentDarts}
             />
          )}

          {/* Floating Status Badge */}
          {phase === AppPhase.CALIBRATION && (
            <div className="absolute top-4 inset-x-4 flex justify-center z-50">
               <div className="bg-red-600 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg animate-bounce uppercase tracking-wider">
                  {calibrationStatus}
               </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Scoreboard & Controls */}
        <div className="flex-[2] bg-gray-900 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-6 z-50">
           
           <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-extrabold uppercase tracking-widest mb-1">Punteggio</span>
                <div className="text-7xl font-black text-white font-mono leading-none tracking-tighter">
                  {totalScore}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                 <span className="text-[11px] text-gray-500 font-extrabold uppercase tracking-widest">Ultimi Tiri</span>
                 <div className="flex gap-2">
                    {currentDarts.slice(-3).reverse().map((dart, i) => (
                       <div key={i} className={`flex items-center justify-center bg-gray-800 border-2 border-gray-700 rounded-xl w-14 h-14 shadow-inner ${i === 0 ? 'border-red-600/50' : ''}`}>
                          <span className="text-sm font-black text-white">{dart.score}</span>
                       </div>
                    ))}
                    {currentDarts.length === 0 && (
                       <div className="w-14 h-14 bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center opacity-30">
                          <span className="text-xs font-bold text-gray-500">?</span>
                       </div>
                    )}
                 </div>
              </div>
           </div>

           {/* Dashboard Actions */}
           <div className="flex gap-3">
              {phase === AppPhase.CALIBRATION ? (
                <button 
                  onClick={() => setPhase(AppPhase.GAME)}
                  className="flex-1 h-14 bg-blue-600 text-white rounded-2xl font-black active:scale-95 transition-all shadow-lg shadow-blue-900/20 uppercase text-sm"
                >
                  Salta Calibrazione
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => { setTotalScore(0); setCurrentDarts([]); addLog("Score resettato"); }}
                    className="flex-1 h-14 bg-gray-800 text-white rounded-2xl font-bold active:scale-95 transition-all border border-gray-700 uppercase text-xs"
                  >
                    Resetta
                  </button>
                  <button 
                    onClick={() => { setPhase(AppPhase.CALIBRATION); setTotalScore(0); setCurrentDarts([]); }}
                    className="flex-1 h-14 bg-gray-800 text-white rounded-2xl font-bold active:scale-95 transition-all border border-gray-700 uppercase text-xs"
                  >
                    Ricalibra
                  </button>
                </>
              )}
           </div>

           {/* Mobile mini log area */}
           <div className="flex-1 bg-black/40 rounded-2xl p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-gray-600 uppercase">Log di Sistema</span>
                <span className="text-[9px] text-gray-700 font-mono">v1.2 Mobile-React</span>
              </div>
              <div className="space-y-1.5 h-full">
                 {logs.length > 0 ? logs.map((log, i) => (
                    <div key={i} className={`text-[11px] font-bold flex items-center gap-2 truncate ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-gray-400'}`}>
                       <span className="opacity-20 shrink-0">•</span>
                       <span className="truncate">{log.message}</span>
                    </div>
                 )) : (
                    <div className="text-[11px] text-gray-800 italic">In attesa di eventi...</div>
                 )}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;