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
        if (result.detected && result.sectorsIdentified) {
          playSuccessChime();
          setPhase(AppPhase.GAME);
          setStatusMsg("");
          addLog("Sistema Pronto", 'success');
        } else if (result.detected && !result.sectorsIdentified) {
          setStatusMsg("Bersaglio Non Riconosciuto");
          addLog("Settori non identificabili", 'error');
        } else {
          setStatusMsg("Centra il bersaglio...");
        }
      } 
      else if (phase === AppPhase.GAME) {
        const result = await analyzeScore(imageData);
        if (result.detected && result.darts) {
          setCurrentDarts(result.darts);
          const currentReading = result.totalScore || 0;
          
          lastScoreBuffer.current.push(currentReading);
          if (lastScoreBuffer.current.length > 2) lastScoreBuffer.current.shift();
          
          const isStable = lastScoreBuffer.current.length === 1 || lastScoreBuffer.current.every(v => v === currentReading);
          
          if (isStable && currentReading !== totalScore) {
            setTotalScore(currentReading);
            playBeep(60, 1000);
            addLog(`Score: ${currentReading}`, 'success');
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }, [phase, isProcessing, totalScore]);

  const resetGame = () => {
    setTotalScore(0);
    setCurrentDarts([]);
    lastScoreBuffer.current = [];
    addLog("Match resettato", 'info');
  };

  return (
    <div className="h-[100dvh] w-screen bg-black text-white flex flex-col fixed inset-0 font-sans overflow-hidden select-none">
      
      <header className="px-6 pt-safe pb-4 bg-gray-900/90 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center font-black rotate-3 shadow-[0_0_15px_rgba(220,38,38,0.4)]">DV</div>
          <div className="flex flex-col">
            <span className="font-black italic text-xl tracking-tighter leading-none">DART<span className="text-red-600">VISION</span></span>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Ultra Speed AI</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 ${isProcessing ? 'bg-red-600/20' : 'bg-black/50'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-red-600 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">{isProcessing ? 'Fast Scan' : 'Ready'}</span>
           </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-[3] bg-black relative">
          {phase === AppPhase.SETUP ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center z-20">
              <h2 className="text-3xl font-black italic mb-2 tracking-tighter uppercase">Flash Mode</h2>
              <p className="text-gray-500 text-[10px] mb-10 uppercase tracking-[0.4em]">Risposta istantanea attivata</p>
              <button 
                onClick={() => setPhase(AppPhase.CALIBRATION)}
                className="w-full max-w-xs h-16 bg-red-600 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(220,38,38,0.4)]"
              >
                Inizia Scansione
              </button>
            </div>
          ) : (
            <CameraFeed 
              isActive={true} 
              onFrameCapture={handleFrameCapture} 
              detectedDarts={currentDarts}
              // Intervalli ridotti grazie alla velocità del modello Flash
              intervalMs={phase === AppPhase.CALIBRATION ? 800 : 2500}
              lowRes={true} // Forziamo sempre una risoluzione bilanciata per la velocità
            />
          )}
          {statusMsg && phase === AppPhase.CALIBRATION && (
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-30">
              <span className="bg-red-600 text-white text-[10px] font-black px-6 py-2 rounded-full animate-pulse uppercase tracking-widest">
                {statusMsg}
              </span>
            </div>
          )}
        </div>

        <div className="flex-[1.2] bg-gray-900 p-8 flex flex-col justify-between rounded-t-[40px] shadow-[0_-20px_40px_rgba(0,0,0,0.8)] z-50 border-t border-white/5">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-red-600 tracking-widest mb-1">Total</span>
              <div className="text-8xl font-black font-mono leading-none tracking-tighter text-white">
                {totalScore}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="flex gap-1.5 flex-wrap justify-end max-w-[150px]">
                {currentDarts.slice(-3).map((d, i) => (
                  <div key={i} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-red-500">
                    {d.zone}
                  </div>
                ))}
              </div>
              <button onClick={resetGame} className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
};

export default App;