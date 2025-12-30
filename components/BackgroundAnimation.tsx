"use client";

import React from 'react';

export const BackgroundAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="var(--tw-primary-color, #008b5a)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        
        {/* Animated Lines */}
        <path
          d="M-20 30 Q 25 10 50 30 T 120 30"
          fill="none"
          stroke="url(#line-gradient)"
          strokeWidth="0.05"
          className="animate-[wave_20s_ease-in-out_infinite]"
        />
        <path
          d="M-20 70 Q 25 50 50 70 T 120 70"
          fill="none"
          stroke="url(#line-gradient)"
          strokeWidth="0.05"
          className="animate-[wave_25s_ease-in-out_infinite_reverse]"
        />
        <path
          d="M-20 50 Q 25 80 50 50 T 120 50"
          fill="none"
          stroke="url(#line-gradient)"
          strokeWidth="0.08"
          className="animate-[wave_30s_ease-in-out_infinite] opacity-50"
        />
      </svg>
      
      <style>{`
        @keyframes wave {
          0%, 100% { transform: translateX(-5%) translateY(0%); }
          50% { transform: translateX(5%) translateY(-2%); }
        }
      `}</style>
    </div>
  );
};