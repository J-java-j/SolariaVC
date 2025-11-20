import React, { useEffect, useState } from 'react';
import { MarketData } from '../types';
import { fetchLiveMarketData } from '../services/geminiService';
import { ArrowUp, ArrowDown, Activity, Wifi, Radio } from 'lucide-react';

const TickerTape: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const getData = async () => {
      try {
        const data = await fetchLiveMarketData();
        if (isMounted && data.length > 0) {
          setMarketData([...data, ...data, ...data]); // Triple for smoother loop
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
      }
    };

    getData();
    const interval = setInterval(getData, 300000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed top-0 left-0 w-full h-10 bg-black border-b border-neon-green/50 flex items-center justify-between px-4 z-50">
         <span className="text-neon-green font-mono text-xs animate-pulse flex items-center gap-2">
           <Activity size={14} />
           INITIALIZING DATA STREAM...
         </span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full h-10 bg-black/90 border-b border-neon-green/50 z-50 flex items-center select-none shadow-[0_0_20px_rgba(0,255,65,0.15)]">
      {/* Fixed Label */}
      <div className="absolute left-0 h-full bg-neon-dark z-10 px-4 flex items-center border-r border-neon-green/50">
        <Radio size={14} className="text-neon-green animate-pulse mr-2" />
        <span className="text-xs font-bold text-neon-green hidden md:inline tracking-widest">LIVE FEED</span>
      </div>
      
      {/* Scrolling Ticker */}
      <div className="flex whitespace-nowrap animate-[scroll_40s_linear_infinite] hover:pause pl-32">
        {marketData.map((item, index) => (
          <div
            key={`${item.symbol}-${index}`}
            className="flex items-center mx-6 font-mono text-xs md:text-sm"
          >
            <span className="font-bold text-white mr-2 tracking-wider">{item.symbol}</span>
            <span className="text-neon-green mr-2">{item.price}</span>
            <span className={`flex items-center text-[10px] ${item.isPositive ? 'text-neon-green' : 'text-red-500'}`}>
              {item.isPositive ? <ArrowUp size={10} className="mr-1" /> : <ArrowDown size={10} className="mr-1" />}
              {item.change}
            </span>
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .hover\\:pause:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default TickerTape;