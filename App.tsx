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

  const scoreBuffer = useRef<{score: number, darts: Dart[]}[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 3));
  };

  const handleFrameCapture = useCallback(async (imageData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (phase === AppPhase.CALIBRATION) {
        const result = await analyzeCalibration(imageData);
        setStatusMsg(result.message || "");
        if (result.detected && result.sectorsIdentified) {
          playSuccessChime();
          setPhase(AppPhase.GAME);
          addLog("Calibrazione completata", 'success');
        }
      } 
      else if (phase === AppPhase.GAME) {
        setStatusMsg("AI sta ragionando...");
        const result = await analyzeScore(imageData);
        
        if (result.detected && result.darts) {
          const newScore = result.totalScore || 0;
          
          // Implementiamo una semplice "validazione a maggioranza"
          // Se per 2 volte consecutive vediamo lo stesso punteggio, lo confermiamo
          scoreBuffer.current.push({ score: newScore, darts: result.darts });
          if (scoreBuffer.current.length > 2) scoreBuffer.current.shift();

          const allMatch = scoreBuffer.current.every(b => b.score === newScore);
          
          if (allMatch || scoreBuffer.current.length === 1) {
            if (newScore !== totalScore) {
              setTotalScore(newScore);
              setCurrentDarts(result.darts);
              playBeep(60, 1000);
              addLog(`Rilevato: ${newScore} pt`);
            } else {
              setCurrentDarts(result.darts); // Aggiorna solo graficamente le punte
            }
          }
        }
        setStatusMsg("In attesa del prossimo frame...");
      }
    } catch (err) {
      addLog("Errore connessione AI", 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [phase, isProcessing, totalScore]);

  return (
    <div className="h-[100dvh] w-screen bg-black text-white flex flex-col fixed inset-0 font-sans overflow-hidden">
      <header className="p-4 pt-safe bg-gray-900/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center font-black shadow-lg shadow-red-600/20">D</div>
          <span className="font-black italic tracking-tighter text-lg">DART<span className="text-red-600">PRO</span></span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-black/50 rounded-full border border-white/5">
          <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest">{isProcessing ? 'Thinking' : 'Ready'}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-[2.5] bg-black relative">
          {phase === AppPhase.SETUP ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-b from-red-600/10 to-black">
              <h2 className="text-4xl font-black italic mb-2">PRECISION AI</h2>
              <p className="text-gray-400 text-xs mb-10 uppercase tracking-[0.4em]">Professional Dart Tracker</p>
              <button 
                onClick={() => setPhase(AppPhase.CALIBRATION)}
                className="w-full max-w-xs h-16 bg-white text-black font-black rounded-2xl text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                Inizia Setup
              </button>
            </div>
          ) : (
            <CameraFeed isActive={true} onFrameCapture={handleFrameCapture} detectedDarts={currentDarts} />
          )}
          
          {statusMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 z-50">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">{statusMsg}</span>
            </div>
          )}
        </div>

        <div className="flex-[1.8] bg-gray-900 p-8 flex flex-col justify-between rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,1)] z-50 border-t border-white/5">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-[11px] font-black uppercase text-red-600 tracking-widest mb-2 block">Punteggio Totale</span>
              <div className="text-9xl font-black font-mono leading-none tracking-tighter">{totalScore}</div>
            </div>
            
            <div className="flex flex-col items-end gap-4">
              <div className="flex gap-2 flex-wrap justify-end max-w-[180px]">
                {currentDarts.map((d, i) => (
                  <div key={i} className="px-3 py-1 bg-red-600/10 border border-red-600/30 rounded-lg text-xs font-black text-red-500">
                    {d.zone}
                  </div>
                ))}
              </div>
              <button 
                onClick={() => { setTotalScore(0); setCurrentDarts([]); scoreBuffer.current = []; }}
                className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-6 overflow-hidden">
            {logs.map((l, i) => (
              <div key={i} className="text-[9px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap bg-black/30 px-3 py-1 rounded-full">
                {l.message}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;