import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Lock } from 'lucide-react';
import DecipherText from './DecipherText';

interface LoginSequenceProps {
  onComplete: () => void;
}

const LoginSequence: React.FC<LoginSequenceProps> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [showAccess, setShowAccess] = useState(false);

  useEffect(() => {
    const sequence = [
      { text: "BIOS CHECK... OK", delay: 100 },
      { text: "LOADING KERNEL... 100%", delay: 400 },
      { text: "MOUNTING FILESYSTEMS... OK", delay: 800 },
      { text: "ESTABLISHING SECURE HANDSHAKE...", delay: 1200 },
      { text: "VERIFYING ENCRYPTION KEYS...", delay: 1600 },
      { text: "BYPASSING FIREWALL...", delay: 2000 },
      { text: "CONNECTING TO SOLARIA_MAINNET...", delay: 2500 },
      { text: "USER AUTHENTICATION REQUIRED...", delay: 3000 },
    ];

    let timeouts: NodeJS.Timeout[] = [];

    sequence.forEach(({ text, delay }) => {
      const timeout = setTimeout(() => {
        setLogs(prev => [...prev, text]);
        // Scroll to bottom
        const el = document.getElementById('boot-logs');
        if(el) el.scrollTop = el.scrollHeight;
      }, delay);
      timeouts.push(timeout);
    });

    const accessTimeout = setTimeout(() => {
      setShowAccess(true);
    }, 3500);

    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 5500);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(accessTimeout);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center font-mono text-neon-green p-4 overflow-hidden">
      {/* Background Matrix Rain effect opacity low */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 to-black -z-10"></div>

      <div className="w-full max-w-lg relative">
        <div className="flex items-center justify-center mb-8">
           <Cpu size={48} className="text-neon-green animate-pulse-fast" />
        </div>

        <div className="border-l-2 border-neon-green pl-4 mb-8 h-40 overflow-y-auto font-mono text-xs md:text-sm scrollbar-hide" id="boot-logs">
          {logs.map((log, i) => (
            <div key={i} className="mb-1 text-green-500/80">
              <span className="text-neon-green font-bold mr-2">[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
              {log}
            </div>
          ))}
          <div className="animate-blink w-2 h-4 bg-neon-green inline-block align-middle"></div>
        </div>

        {showAccess && (
          <div className="text-center animate-in zoom-in duration-500">
            <div className="border-2 border-neon-green p-4 inline-block bg-black/80 backdrop-blur">
              <h1 className="text-2xl md:text-4xl font-bold tracking-widest">
                <DecipherText text="ACCESS GRANTED" speed={50} />
              </h1>
              <div className="mt-2 text-xs text-gray-400 tracking-[0.2em]">WELCOME TO THE FUTURE</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="absolute bottom-8 text-center text-[10px] text-gray-600">
        SOLARIA VENTURE CAPITAL © {new Date().getFullYear()} // SECURE CONNECTION ESTABLISHED
      </div>
    </div>
  );
};

export default LoginSequence;