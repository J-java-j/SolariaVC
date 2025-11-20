
import React, { useEffect, useState, useRef } from 'react';
import { TerminalLine } from '../types';
import { Terminal, X, Minimize2, Maximize2, Copy, Check } from 'lucide-react';
import { generateSystemMessage } from '../services/geminiService';
import { BACKEND_CODE } from '../services/newsletterService';

interface TerminalWindowProps {
    onClose?: () => void;
}

const TerminalWindow: React.FC<TerminalWindowProps> = ({ onClose }) => {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addLine = (text: string, type: TerminalLine['type'] = 'info') => {
    setLines(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      text,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour12: false })
    }]);
  };

  useEffect(() => {
    // Initial Greeting
    const init = async () => {
       addLine("SOLARIA_OS [Version 2.5.1]", 'system');
       addLine("(c) 2025 Solaria Venture Capital. All rights reserved.", 'system');
       addLine("Type 'help' for commands.", 'info');
       
       const msg = await generateSystemMessage();
       addLine(`> ${msg}`, 'success');
    };
    init();
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines]);

  const handleCopyCode = () => {
      navigator.clipboard.writeText(BACKEND_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLine("Backend script copied to clipboard.", 'success');
  };

  const handleCommand = async (cmd: string) => {
    const command = cmd.trim().toLowerCase();
    
    switch(command) {
        case 'help':
            addLine("AVAILABLE COMMANDS:", 'system');
            addLine("  help      - Show this list", 'info');
            addLine("  status    - Check system status", 'info');
            addLine("  hack      - Initiate brute-force simulation", 'warning');
            addLine("  deploy    - Get Google backend code", 'warning');
            addLine("  about     - Display organization info", 'info');
            addLine("  contact   - Show communication channels", 'info');
            addLine("  exit      - Close terminal", 'info');
            break;
        case 'clear':
            setLines([]);
            break;
        case 'status':
            addLine("SYSTEM STATUS: PRE-LAUNCH", 'success');
            addLine("MARKET DATA STREAM: ACTIVE", 'success');
            addLine("USER_CONNECTION: SECURE", 'success');
            break;
        case 'hack':
            addLine("INITIATING BRUTE FORCE ATTACK...", 'warning');
            for(let i = 0; i < 5; i++) {
                await new Promise(r => setTimeout(r, 400));
                addLine(`Injecting payload to node 0x${Math.floor(Math.random()*1000).toString(16)}...`, 'info');
            }
            await new Promise(r => setTimeout(r, 500));
            addLine("ACCESS GRANTED. REVEALING HIDDEN DATA...", 'success');
            addLine("Found string: 'THE FUTURE IS DECENTRALIZED'", 'system');
            break;
        case 'deploy':
            addLine("=== GOOGLE BACKEND SETUP ===", 'system');
            
            addLine("STEP 1: Type 'copy' to get the script.", 'info');
            addLine("STEP 2: Paste into Extensions > Apps Script.", 'info');
            
            await new Promise(r => setTimeout(r, 200));
            addLine("CRITICAL: Select function 'SETUP_PERMISSIONS' and click Run.", 'warning');
            addLine("        (This fixes the permission error)", 'warning');
            
            await new Promise(r => setTimeout(r, 200));
            addLine("STEP 3: Deploy > New Deployment > Web App.", 'info');
            addLine("        Execute as: Me, Access: Anyone.", 'info');
            addLine("STEP 4: Paste URL into newsletterService.ts", 'success');
            break;
        case 'copy':
             handleCopyCode();
             break;
        case 'about':
            addLine("Solaria VC is a student-run venture capital fund at UCSD.", 'system');
            addLine("Focus: Blockchain, AI, and Deep Tech.", 'info');
            break;
        case 'contact':
            addLine("Email: contact@solariavc.com", 'info');
            addLine("Instagram: @solaria_ucsd", 'info');
            break;
        case 'exit':
            if(onClose) onClose();
            break;
        default:
            addLine(`Command not found: ${command}`, 'error');
            break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    addLine(`user@solaria:~$ ${inputValue}`, 'info');
    handleCommand(inputValue);
    setInputValue('');
  };

  return (
    <div className="fixed inset-0 md:inset-auto md:top-1/4 md:left-1/4 md:right-1/4 md:bottom-1/4 bg-black/90 border border-neon-green rounded-lg backdrop-blur-md shadow-[0_0_50px_rgba(0,255,65,0.3)] overflow-hidden flex flex-col z-50 animate-in zoom-in-95 duration-200">
      {/* Terminal Header */}
      <div className="bg-neon-dark border-b border-neon-green p-2 flex items-center justify-between select-none cursor-move" onMouseDown={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 text-neon-green text-xs font-bold">
          <Terminal size={14} />
          <span>ROOT_ACCESS_TERMINAL</span>
        </div>
        <div className="flex gap-2">
           <button className="text-neon-green hover:text-white transition-colors"><Minimize2 size={14} /></button>
           <button onClick={onClose} className="text-neon-green hover:text-red-500 transition-colors"><X size={14} /></button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-sm space-y-1 custom-scrollbar" onClick={() => inputRef.current?.focus()}>
        {lines.map(line => (
          <div key={line.id} className="break-words">
            <span className="text-gray-500 text-xs mr-3">[{line.timestamp}]</span>
            <span className={`
              ${line.type === 'error' ? 'text-red-500' : ''}
              ${line.type === 'warning' ? 'text-yellow-400' : ''}
              ${line.type === 'success' ? 'text-neon-green font-bold' : ''}
              ${line.type === 'system' ? 'text-cyan-400' : ''}
              ${line.type === 'info' ? 'text-gray-300' : ''}
            `}>
              {line.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 border-t border-neon-green bg-black flex items-center">
        <span className="text-neon-green font-bold mr-2">user@solaria:~$</span>
        <form onSubmit={handleSubmit} className="flex-1">
            <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full bg-transparent text-neon-green focus:outline-none font-mono caret-neon-green"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            />
        </form>
      </div>
    </div>
  );
};

export default TerminalWindow;
