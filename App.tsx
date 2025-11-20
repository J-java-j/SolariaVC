
import React, { useState, useEffect, useRef } from 'react';
import MatrixRain from './components/MatrixRain';
import TickerTape from './components/TickerTape';
import LoginSequence from './components/LoginSequence';
import DecipherText from './components/DecipherText';
import CyberCard from './components/CyberCard';
import TerminalWindow from './components/TerminalWindow';
import ParticleNetwork from './components/ParticleNetwork';
import { generateNewsHeadline } from './services/geminiService';
import { submitEmail } from './services/newsletterService';
import { Shield, ChevronRight, Terminal, Lock, Unlock, Radio, Zap, Loader, CheckCircle, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [newsHeadline, setNewsHeadline] = useState("INITIALIZING NEWS FEED...");
  
  // Override Button State
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  // Email State
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [emailMsg, setEmailMsg] = useState('');

  useEffect(() => {
    if(isLoggedIn) {
        // Cycle news headlines
        const updateNews = async () => {
            const news = await generateNewsHeadline();
            setNewsHeadline(news);
        };
        updateNews();
        const interval = setInterval(updateNews, 10000);
        return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Hold to decrypt logic
  const startHold = () => {
    setIsHolding(true);
    holdInterval.current = setInterval(() => {
        setProgress(prev => {
            if (prev >= 100) {
                clearInterval(holdInterval.current!);
                setTerminalOpen(true);
                return 0;
            }
            return prev + 2; // Speed of fill
        });
    }, 30);
  };

  const stopHold = () => {
    setIsHolding(false);
    if (holdInterval.current) clearInterval(holdInterval.current);
    setProgress(0);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || emailStatus === 'loading') return;

    setEmailStatus('loading');
    const result = await submitEmail(email);

    if (result.success) {
        setEmailStatus('success');
        setEmailMsg(result.message);
        setEmail('');
    } else {
        setEmailStatus('error');
        setEmailMsg(result.message);
        setTimeout(() => setEmailStatus('idle'), 3000);
    }
  };

  if (!isLoggedIn) {
    return <LoginSequence onComplete={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen w-full bg-black text-neon-green font-mono overflow-hidden relative scanlines selection:bg-neon-green selection:text-black flex flex-col">
      {/* Background FX */}
      <div className="cyber-grid"></div>
      <MatrixRain />
      <ParticleNetwork />
      
      {/* Top Navigation / Ticker */}
      <TickerTape />

      {/* Floating Terminal */}
      {terminalOpen && <TerminalWindow onClose={() => setTerminalOpen(false)} />}
      
      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        
        <CyberCard className="w-full max-w-4xl transform transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,255,65,0.15)]">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Left Column: Branding */}
            <div className="text-center md:text-left">
                <div className="flex justify-center md:justify-start mb-6 relative">
                    <div className="absolute inset-0 bg-neon-green/20 blur-2xl rounded-full animate-pulse"></div>
                    <Shield size={64} className="text-neon-green relative z-10" />
                </div>
                
                <h1 className="text-6xl md:text-7xl font-bold tracking-tighter mb-2 text-white glitch-text" data-text="SOLARIA">
                    SOLARIA
                </h1>
                <div className="h-8">
                    <h2 className="text-xl text-neon-green font-light tracking-[0.4em] uppercase">
                        <DecipherText text="VENTURE CAPITAL" speed={40} />
                    </h2>
                </div>
                
                <p className="mt-6 text-gray-400 text-sm leading-relaxed max-w-md">
                    San Diego's premier student-run venture fund. We deploy capital into the decentralized future. 
                    <span className="text-neon-green block mt-2">Algorithms Initializing...</span>
                </p>

                {/* News Ticker Box */}
                <div className="mt-8 p-3 bg-black/50 border-l-2 border-neon-green text-xs text-gray-400 flex items-center gap-3">
                    <Radio size={14} className="text-neon-green animate-pulse" />
                    <span className="uppercase tracking-wide line-clamp-1">
                        LATEST: <span className="text-white">{newsHeadline}</span>
                    </span>
                </div>
            </div>

            {/* Right Column: Interactive Module */}
            <div className="flex flex-col items-center justify-center gap-6 border-t md:border-t-0 md:border-l border-neon-green/20 pt-8 md:pt-0 md:pl-8">
                
                <div className="w-full space-y-4">
                    <div className="flex justify-between items-center text-xs uppercase tracking-wider text-gray-500">
                        <span>System Status</span>
                        <span className="text-neon-green flex items-center gap-1">
                            <span className="w-2 h-2 bg-neon-green rounded-full animate-blink"></span>
                            Locked
                        </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-12 bg-black border border-neon-green/50 relative overflow-hidden group cursor-pointer select-none"
                         onMouseDown={startHold}
                         onMouseUp={stopHold}
                         onMouseLeave={stopHold}
                         onTouchStart={startHold}
                         onTouchEnd={stopHold}
                    >
                        {/* Fill */}
                        <div 
                            className="absolute top-0 left-0 h-full bg-neon-green/20 transition-all duration-75 ease-linear"
                            style={{ width: `${progress}%` }}
                        ></div>
                        
                        {/* Text */}
                        <div className="absolute inset-0 flex items-center justify-center gap-3 text-neon-green group-hover:text-white transition-colors z-10">
                            {progress > 0 ? (
                                <Zap size={18} className="animate-bounce" />
                            ) : (
                                <Lock size={18} />
                            )}
                            <span className="font-bold tracking-widest">
                                {progress > 0 ? `DECRYPTING... ${progress}%` : "HOLD TO ACCESS SYSTEM"}
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] text-center text-gray-600">
                        Press and hold to override security protocols
                    </p>
                </div>

                {/* Mailing List */}
                <div className="w-full mt-4">
                    <div className="text-xs text-neon-green mb-2 flex items-center gap-2">
                        <Terminal size={12} />
                        <span>PRIORITY_ACCESS_LIST</span>
                    </div>
                    
                    {emailStatus === 'success' ? (
                         <div className="w-full bg-neon-green/10 border border-neon-green p-3 text-center animate-in fade-in duration-500">
                            <CheckCircle size={24} className="mx-auto text-neon-green mb-1" />
                            <span className="text-xs font-bold tracking-wider text-white">{emailMsg}</span>
                         </div>
                    ) : (
                        <form onSubmit={handleEmailSubmit} className="relative group">
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={emailStatus === 'loading'}
                                placeholder={emailStatus === 'loading' ? 'TRANSMITTING_DATA...' : 'enter_email...'}
                                className="w-full bg-black/50 border border-gray-800 text-neon-green text-sm p-3 pr-12 focus:outline-none focus:border-neon-green transition-all placeholder-gray-700 font-mono disabled:opacity-50"
                            />
                            <button 
                                type="submit"
                                disabled={emailStatus === 'loading'}
                                className="absolute right-1 top-1 bottom-1 px-3 bg-neon-green/10 hover:bg-neon-green hover:text-black text-neon-green transition-colors border border-neon-green/20 flex items-center justify-center disabled:cursor-not-allowed"
                            >
                                {emailStatus === 'loading' ? <Loader size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                            </button>
                        </form>
                    )}
                    {emailStatus === 'error' && (
                        <p className="text-[10px] text-red-500 mt-1">{emailMsg}</p>
                    )}
                </div>

            </div>

          </div>
          
          {/* Footer Metadata */}
          <div className="mt-10 pt-6 border-t border-neon-green/10 flex justify-between items-end text-[10px] text-gray-600">
             <div>
                 ID: SOL-9928-X <br/>
                 LOC: UCSD, CA
             </div>
             <div className="flex items-center gap-4">
                 <span className="hover:text-neon-green cursor-pointer transition-colors">INSTAGRAM</span>
                 <span className="hover:text-neon-green cursor-pointer transition-colors">LINKEDIN</span>
             </div>
          </div>

        </CyberCard>
      </div>
    </div>
  );
};

export default App;
