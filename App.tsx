import React, { useState, useCallback, useRef } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { analyzeCalibration, analyzeScore } from './services/geminiService';
import { AppPhase, LogEntry, Dart } from './types';
import { playSuccessChime, playBeep } from './utils/sound';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.SETUP);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentDarts, setCurrentDarts] = useState<Dart[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");

  // Buffer per la validazione del punteggio
  const lastScoreBuffer = useRef<number[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 5));
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
          addLog("Bersaglio agganciato!", 'success');
        }
      } 
      else if (phase === AppPhase.GAME) {
        setStatusMsg("AI: Scansione millimetrica...");
        const result = await analyzeScore(imageData);
        
        if (result.detected && result.darts) {
          // AGGIORNAMENTO IMMEDIATO: Mostriamo subito le freccette rilevate sulla telecamera
          setCurrentDarts(result.darts);
          
          const currentReading = result.totalScore || 0;
          
          // Logica di stabilità per il punteggio numerico
          lastScoreBuffer.current.push(currentReading);
          if (lastScoreBuffer.current.length > 2) lastScoreBuffer.current.shift();

          const isStable = lastScoreBuffer.current.length === 1 || lastScoreBuffer.current.every(v => v === currentReading);

          if (isStable && currentReading !== totalScore) {
            setTotalScore(currentReading);
            playBeep(80, 1100);
            addLog(`Tiro confermato: ${currentReading} pt`, 'success');
          }
        }
        setStatusMsg("");
      }
    } catch (err) {
      addLog("Errore di rete AI", 'error');
    } finally {
      setIsProcessing(false);
      setStatusMsg("");
    }
  }, [phase, isProcessing, totalScore]);

  const resetGame = () => {
    setTotalScore(0);
    setCurrentDarts([]);
    lastScoreBuffer.current = [];
    addLog("Nuova partita avviata", 'info');
  };

  return (
    <div className="h-[100dvh] w-screen bg-black text-white flex flex-col fixed inset-0 font-sans overflow-hidden select-none">
      
      {/* Header Futuristico */}
      <header className="px-6 pt-safe pb-4 bg-gray-900/90 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center font-black shadow-[0_0_20px_rgba(220,38,38,0.4)] rotate-3">DV</div>
          <div className="flex flex-col">
            <span className="font-black italic text-xl tracking-tighter leading-none">DART<span className="text-red-600">VISION</span></span>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.4em]">Pro AI Neural Scanner</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 transition-colors ${isProcessing ? 'bg-red-600/20' : 'bg-black/50'}`}>
              <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-red-600 animate-pulse shadow-[0_0_10px_#dc2626]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">{isProcessing ? 'Thinking' : 'Ready'}</span>
           </div>
           {statusMsg && <span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">{statusMsg}</span>}
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-[2.8] bg-black relative">
          {phase === AppPhase.SETUP ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-32 h-32 mb-10 relative">
                 <div className="absolute inset-0 border-2 border-red-600 rounded-full animate-ping opacity-20" />
                 <div className="absolute inset-4 border border-red-600 rounded-full animate-pulse opacity-40" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-16 h-16 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                 </div>
              </div>
              <h2 className="text-4xl font-black italic mb-4 tracking-tighter">AI REFEREE</h2>
              <p className="text-gray-400 text-xs mb-12 uppercase tracking-[0.3em] leading-relaxed">Posiziona il telefono a circa 2m dal bersaglio per la calibrazione neurale.</p>
              <button 
                onClick={() => setPhase(AppPhase.CALIBRATION)}
                className="w-full max-w-xs h-16 bg-red-600 text-white font-black rounded-3xl text-sm uppercase tracking-widest shadow-[0_15px_45px_rgba(220,38,38,0.5)] active:scale-95 transition-all"
              >
                Configura Ottica
              </button>
            </div>
          ) : (
            <CameraFeed isActive={true} onFrameCapture={handleFrameCapture} detectedDarts={currentDarts} />
          )}
        </div>

        {/* Dashboard di Controllo */}
        <div className="flex-[1.5] bg-gray-900 p-8 flex flex-col justify-between rounded-t-[50px] shadow-[0_-30px_60px_rgba(0,0,0,1)] z-50 border-t border-white/5">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-red-600 tracking-widest mb-1">Punteggio Totale</span>
              <div className="text-[100px] font-black font-mono leading-none tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                {totalScore}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-4">
              <div className="flex gap-2 flex-wrap justify-end max-w-[200px]">
                {currentDarts.length > 0 ? currentDarts.slice(-3).map((d, i) => (
                  <div key={`${i}-${d.zone}`} className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-sm font-black text-red-600 shadow-xl flex flex-col items-center animate-[bounceIn_0.5s_ease-out]">
                    <span className="text-[8px] text-gray-500 mb-0.5">DART {i+1}</span>
                    {d.zone}
                  </div>
                )) : (
                  <div className="text-[10px] text-gray-700 font-bold uppercase tracking-widest italic animate-pulse">In attesa di tiri...</div>
                )}
              </div>
              <div className="flex gap-2">
                 <button 
                  onClick={resetGame}
                  className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center active:scale-90 active:bg-red-600/20 transition-all group"
                >
                  <svg className="w-7 h-7 text-gray-400 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>
          </div>

          <div className="h-10 bg-black/40 rounded-2xl flex items-center px-6 overflow-hidden border border-white/5 mt-4">
             <div className="flex gap-6 animate-[scroll_20s_linear_infinite] whitespace-nowrap">
                {logs.length > 0 ? logs.map((l, i) => (
                  <div key={i} className={`text-[9px] font-black uppercase flex items-center gap-2 ${l.type === 'success' ? 'text-green-500' : l.type === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_5px_currentColor]" />
                    {l.message}
                  </div>
                )) : (
                  <span className="text-[9px] font-black uppercase text-gray-700 tracking-[0.5em]">System Status: Nominal | AI: Connected</span>
                )}
             </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 0.9; transform: scale(1.1); }
          80% { opacity: 1; transform: scale(0.89); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default App;