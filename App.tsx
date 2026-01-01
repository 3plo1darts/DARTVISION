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
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 3));
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
          addLog("Setup completato", 'success');
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
               addLog(`Punti: ${newScore}`);
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
      addLog("Errore connessione", 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [phase, isProcessing, totalScore, currentDarts.length]);

  return (
    <div className="h-[100dvh] w-screen bg-black text-gray-100 flex flex-col overflow-hidden fixed inset-0 font-sans select-none touch-none">
      
      {/* Feedback Visuale */}
      <div className={`fixed inset-0 bg-white pointer-events-none z-[100] transition-opacity duration-300 ${flashActive ? 'opacity-20' : 'opacity-0'}`} />

      {/* Header con Safe Area Top */}
      <header className="px-4 pt-safe pb-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black text-white text-lg">D</div>
           <h1 className="text-xl font-black tracking-tighter text-white">DARTVISION</h1>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{phase}</span>
        </div>
      </header>

      {/* Area Principale */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        
        {/* Sezione Camera - Prende lo spazio necessario ma lascia spazio ai controlli */}
        <div className="flex-[2.5] bg-black relative overflow-hidden">
          {phase === AppPhase.SETUP ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center z-10">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                   </svg>
                </div>
                <h2 className="text-2xl font-black mb-2 uppercase italic text-white">Ready?</h2>
                <p className="text-gray-500 text-sm mb-8 max-w-[200px]">Punta il cellulare verso il bersaglio per iniziare.</p>
                <button 
                  onClick={() => setPhase(AppPhase.CALIBRATION)}
                  className="w-full h-14 bg-red-600 text-white font-black rounded-2xl active:scale-95 transition-transform uppercase"
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

          {/* Badge Calibrazione */}
          {phase === AppPhase.CALIBRATION && (
            <div className="absolute top-4 inset-x-4 flex justify-center z-50">
               <div className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg animate-pulse uppercase">
                  {calibrationStatus}
               </div>
            </div>
          )}
        </div>

        {/* Dashboard Inferiore con Safe Area Bottom */}
        <div className="flex-[1.8] bg-gray-900 rounded-t-[2.5rem] p-6 pb-safe flex flex-col justify-between shadow-[0_-20px_50px_rgba(0,0,0,0.6)] z-50">
           
           <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Score Totale</span>
                <div className="text-6xl font-black text-white font-mono leading-none tracking-tighter">
                  {totalScore}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1.5">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Ultimi tiri</span>
                 <div className="flex gap-1.5">
                    {currentDarts.slice(-3).reverse().map((dart, i) => (
                       <div key={i} className={`flex items-center justify-center bg-gray-800 border border-gray-700 rounded-xl w-11 h-11 ${i === 0 ? 'border-red-500 bg-gray-800/80' : 'opacity-60'}`}>
                          <span className="text-xs font-black text-white">{dart.score}</span>
                       </div>
                    ))}
                    {currentDarts.length === 0 && Array(3).fill(0).map((_, i) => (
                      <div key={i} className="w-11 h-11 bg-gray-800/30 border border-dashed border-gray-700 rounded-xl flex items-center justify-center opacity-20">
                        <span className="text-[10px] font-bold">-</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Pulsanti di Controllo */}
           <div className="flex gap-3">
              {phase === AppPhase.CALIBRATION ? (
                <button 
                  onClick={() => setPhase(AppPhase.GAME)}
                  className="flex-1 h-14 bg-white text-black rounded-2xl font-black active:scale-95 transition-all text-sm uppercase"
                >
                  Salta Setup
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => { setTotalScore(0); setCurrentDarts([]); addLog("Score resettato"); }}
                    className="flex-1 h-14 bg-gray-800 text-white rounded-2xl font-bold active:scale-95 transition-all border border-gray-700 text-xs uppercase"
                  >
                    Reset
                  </button>
                  <button 
                    onClick={() => { setPhase(AppPhase.CALIBRATION); setTotalScore(0); setCurrentDarts([]); }}
                    className="flex-1 h-14 bg-gray-800 text-white rounded-2xl font-bold active:scale-95 transition-all border border-gray-700 text-xs uppercase"
                  >
                    Ricalibra
                  </button>
                </>
              )}
           </div>

           {/* Log compatto per iPhone */}
           <div className="bg-black/30 rounded-xl p-3 h-14 overflow-hidden">
              <div className="space-y-1">
                 {logs.length > 0 ? logs.map((log, i) => (
                    <div key={i} className={`text-[11px] font-bold flex items-center gap-2 truncate ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-gray-500'}`}>
                       <span className="opacity-20 shrink-0">●</span>
                       <span className="truncate uppercase">{log.message}</span>
                    </div>
                 )) : (
                    <div className="text-[10px] text-gray-700 italic uppercase tracking-wider">Sistema attivo</div>
                 )}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;