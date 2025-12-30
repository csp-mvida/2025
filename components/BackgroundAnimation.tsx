"use client";

import React from 'react';

export const BackgroundAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none opacity-30">
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="line-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#008b5a" stopOpacity="0.15" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="line-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        
        {/* Camada 1: Linhas Lentas e Longas */}
        <path
          d="M-20 20 Q 30 5 60 25 T 130 15"
          fill="none"
          stroke="url(#line-grad-1)"
          strokeWidth="0.03"
          className="animate-[float_25s_ease-in-out_infinite]"
        />
        <path
          d="M-20 85 Q 20 70 50 90 T 130 75"
          fill="none"
          stroke="url(#line-grad-1)"
          strokeWidth="0.04"
          className="animate-[float_35s_ease-in-out_infinite_reverse]"
        />
        
        {/* Camada 2: Detalhes em Âmbar Sutis */}
        <path
          d="M-30 50 Q 25 75 55 45 T 140 55"
          fill="none"
          stroke="url(#line-grad-2)"
          strokeWidth="0.02"
          className="animate-[float_40s_linear_infinite]"
        />
        
        {/* Camada 3: Linhas Médias */}
        <path
          d="M-10 40 Q 45 20 75 45 T 120 35"
          fill="none"
          stroke="url(#line-grad-1)"
          strokeWidth="0.03"
          className="animate-[float_30s_ease-in-out_infinite_delay]"
        />
      </svg>
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(-2%, 0%) rotate(0deg); }
          50% { transform: translate(2%, -1%) rotate(0.5deg); }
        }
        .animate-delay {
          animation-delay: -10s;
        }
      `}</style>
    </div>
  );
};