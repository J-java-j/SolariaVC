import React, { useEffect, useState } from 'react';

interface DecipherTextProps {
  text: string;
  speed?: number;
  className?: string;
  startDelay?: number;
  reveal?: boolean;
}

const DecipherText: React.FC<DecipherTextProps> = ({ 
  text, 
  speed = 30, 
  className = '', 
  startDelay = 0,
  reveal = true 
}) => {
  const [displayText, setDisplayText] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

  useEffect(() => {
    if (!reveal) return;

    let iteration = 0;
    let interval: NodeJS.Timeout;

    const startAnimation = () => {
      interval = setInterval(() => {
        setDisplayText(prev => 
          text
            .split('')
            .map((char, index) => {
              if (index < iteration) {
                return text[index];
              }
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('')
        );

        if (iteration >= text.length) {
          clearInterval(interval);
        }

        iteration += 1 / 3; // Slow down the reveal relative to the scramble
      }, speed);
    };

    const delayTimeout = setTimeout(startAnimation, startDelay);

    return () => {
      clearTimeout(delayTimeout);
      clearInterval(interval);
    };
  }, [text, speed, startDelay, reveal]);

  return (
    <span className={`font-mono ${className}`}>
      {displayText || (reveal ? '' : text.replace(/./g, '0'))}
    </span>
  );
};

export default DecipherText;