import React from 'react';

interface CyberCardProps {
  children: React.ReactNode;
  className?: string;
}

const CyberCard: React.FC<CyberCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`relative bg-black/60 backdrop-blur-md border border-neon-green/30 p-8 md:p-12 ${className}`}>
      {/* Top Left Corner */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-neon-green"></div>
      
      {/* Top Right Corner */}
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-neon-green"></div>
      
      {/* Bottom Right Corner */}
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-neon-green"></div>
      
      {/* Bottom Left Corner */}
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-neon-green"></div>

      {/* Decorative Notches */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-[2px] bg-neon-green/50"></div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/3 h-[2px] bg-neon-green/50"></div>

      {/* Scanline Overlay specific to card */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)50%,rgba(0,0,0,0.1)50%)] bg-[length:100%_4px] z-0 opacity-50"></div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default CyberCard;