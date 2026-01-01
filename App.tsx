import React, { useState, useCallback, useRef } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { analyzeCalibration, analyzeScore } from './services/geminiService';
import { AppPhase, LogEntry, Dart } from './types';
import { playSuccessChime, playBeep } from './utils/sound';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.SETUP);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [flashActive, setFlashActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [currentDarts, setCurrentDarts] = useState<Dart[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Ref per evitare aggiornamenti continui se il punteggio non cambia o peggiora (rumore)
  const lastValidScoreRef = useRef(0);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 3));
  };

  const handleFrameCapture = useCallback(async (imageData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (phase === AppPhase.CALIBRATION) {
        const result = await analyzeCalibration(imageData);
        setStatusMsg(result.message || "Centra il bersaglio...");
        if (result.detected && result.sectorsIdentified) {
          playSuccessChime();
          setPhase(AppPhase.GAME);
          addLog("Bersaglio pronto!", 'success');
        }
      } 
      else if (phase === AppPhase.GAME) {
        const result = await analyzeScore(imageData);
        if (result.detected && result.darts) {
          const newScore = result.totalScore || 0;
          
          // Aggiorna solo se c'è un cambiamento significativo (nuova freccetta o correzione)
          if (newScore !== lastValidScoreRef.current) {
            setTotalScore(newScore);
            setCurrentDarts(result.darts);
            lastValidScoreRef.current = newScore;
            
            setFlashActive(true);
            playBeep(40, 1200);
            setTimeout(() => setFlashActive(false), 200);
            addLog(`Update: ${newScore} pt`);
          } else {
            // Se il punteggio è uguale, aggiorniamo solo le coordinate per i marker visivi
            setCurrentDarts(result.darts);
          }
        }
      }
    } catch (err) {
      addLog("Connessione instabile", 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [phase, isProcessing]);

  const resetGame = () => {
    setTotalScore(0);
    setCurrentDarts([]);
    lastValidScoreRef.current = 0;
    addLog("Partita resettata", 'info');
  };

  return (
    <div className="h-[100dvh] w-screen bg-black text-gray-100 flex flex-col overflow-hidden fixed inset-0 font-sans select-none">
      {/* Flash visivo al riconoscimento */}
      <div className={`fixed inset-0 bg-white pointer-events-none z-[100] transition-opacity duration-200 ${flashActive ? 'opacity-30' : 'opacity-0'}`} />

      {/* Header compatto */}
      <header className="px-4 pt-safe pb-2 bg-gray-900 border-b border-white/5 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-2">
           <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center font-black text-white text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)]">D</div>
           <h1 className="text-sm font-black tracking-widest text-white uppercase italic">DartVision <span className="text-red-500">Pro</span></h1>
        </div>
        <div className="flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'}`} />
           <span className="text-[10px] font-bold text-gray-500 uppercase bg-black/50 px-2 py-0.5 rounded-md">{phase}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-[3] bg-black relative">
          {phase === AppPhase.SETUP ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center z-10 bg-gradient-to-b from-transparent to-black/80">
                <div className="w-24 h-24 bg-red-600/10 border-2 border-red-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
                   <svg className="w-12 h-12 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>
                </div>
                <h2 className="text-3xl font-black mb-3 italic text-white uppercase tracking-tighter">AI Referee</h2>
                <p className="text-gray-400 text-[11px] mb-8 uppercase tracking-[0.2em] leading-relaxed">Posiziona il telefono su un treppiede di fronte al bersaglio</p>
                <button 
                  onClick={() => setPhase(AppPhase.CALIBRATION)}
                  className="w-full max-w-[240px] h-16 bg-red-600 text-white font-black rounded-2xl active:scale-95 transition-all uppercase text-sm shadow-[0_10px_40px_rgba(220,38,38,0.4)]"
                >
                  Inizia Calibrazione
                </button>
             </div>
          ) : (
             <CameraFeed 
                isActive={true} 
                onFrameCapture={handleFrameCapture} 
                detectedDarts={currentDarts}
             />
          )}

          {phase === AppPhase.CALIBRATION && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/20 rounded-full border-dashed animate-[spin_10s_linear_infinite]" />
          )}
        </div>

        {/* Dashboard punteggio */}
        <div className="flex-[1.6] bg-gray-900 border-t border-white/10 p-6 pb-safe flex flex-col justify-between shadow-[0_-15px_40px_rgba(0,0,0,0.8)] z-50 rounded-t-3xl">
           <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-red-500 font-black uppercase tracking-widest block mb-2">Punteggio Totale</span>
                <div className="text-8xl font-black text-white font-mono tracking-tighter tabular-nums leading-none">
                  {totalScore}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                 <div className="flex flex-wrap justify-end gap-1.5 max-w-[150px]">
                    {currentDarts.length > 0 ? currentDarts.map((d, i) => (
                      <div key={i} className="px-2 py-1.5 bg-gray-800 border border-white/5 rounded-lg text-[10px] font-black text-red-500 flex items-center gap-1 shadow-lg">
                        <span className="text-gray-500">#</span>{d.zone}
                      </div>
                    )) : (
                      <div className="text-[10px] text-gray-700 font-bold uppercase italic">Nessun tiro...</div>
                    )}
                 </div>
                 <button 
                    onClick={resetGame}
                    className="w-12 h-12 bg-gray-800 border border-white/10 text-white rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </button>
              </div>
           </div>

           <div className="h-8 bg-black/40 rounded-lg flex items-center px-4 overflow-hidden border border-white/5">
              <div className="flex gap-4">
                 {logs.map((log, i) => (
                    <div key={i} className={`text-[10px] font-black uppercase whitespace-nowrap flex items-center gap-2 ${log.type === 'success' ? 'text-green-500' : log.type === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                       <span className="w-1 h-1 rounded-full bg-current" />
                       {log.message}
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;