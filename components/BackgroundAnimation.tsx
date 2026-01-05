"use client";

import React from 'react';

export const BackgroundAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none opacity-40">
      <div className="absolute inset-0 bg-slate-50"></div>
      
      <svg
        className="absolute w-[200%] h-full top-0 left-0"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#008b5a" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#008b5a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#008b5a" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="wave-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.02" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Onda 1: Verde Primário Profunda */}
        <path
          d="M0,400 C150,350 350,450 500,400 C650,350 850,450 1000,400 L1000,1000 L0,1000 Z"
          fill="url(#wave-grad-1)"
          className="animate-wave-slow"
        />

        {/* Onda 2: Âmbar Sutil Intermediária */}
        <path
          d="M0,500 C200,450 400,550 600,500 C800,450 1000,550 1200,500 L1200,1000 L0,1000 Z"
          fill="url(#wave-grad-2)"
          className="animate-wave-medium"
        />

        {/* Onda 3: Verde Primário Superficial */}
        <path
          d="M0,600 C250,550 450,650 700,600 C950,550 1150,650 1400,600 L1400,1000 L0,1000 Z"
          fill="url(#wave-grad-1)"
          className="animate-wave-fast"
        />
      </svg>
      
      <style>{`
        @keyframes waveMove {
          0% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-15%) translateY(15px); }
          100% { transform: translateX(0) translateY(0); }
        }
        
        @keyframes waveMoveReverse {
          0% { transform: translateX(-20%) translateY(0); }
          50% { transform: translateX(-5%) translateY(-10px); }
          100% { transform: translateX(-20%) translateY(0); }
        }

        .animate-wave-slow {
          animation: waveMove 25s ease-in-out infinite;
        }
        
        .animate-wave-medium {
          animation: waveMoveReverse 35s ease-in-out infinite;
        }
        
        .animate-wave-fast {
          animation: waveMove 20s ease-in-out infinite;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
};

export default BackgroundAnimation;