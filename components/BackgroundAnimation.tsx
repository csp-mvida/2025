"use client";

import React from 'react';

export const BackgroundAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none bg-slate-50">
      {/* Wave Container */}
      <div className="absolute bottom-0 left-0 w-full h-[60%] opacity-30">
        
        {/* Layer 1: Deep Green Wave */}
        <div className="absolute bottom-0 left-0 w-[200%] h-full animate-wave-slow">
          <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path 
              d="M0,50 C150,100 350,0 500,50 C650,100 850,0 1000,50 L1000,100 L0,100 Z" 
              fill="#008b5a" 
              opacity="0.2"
            />
          </svg>
        </div>

        {/* Layer 2: Amber Wave */}
        <div className="absolute bottom-0 left-0 w-[200%] h-[90%] animate-wave-medium">
          <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path 
              d="M0,50 C200,100 400,0 600,50 C800,100 1000,0 1200,50 L1200,100 L0,100 Z" 
              fill="#f59e0b" 
              opacity="0.1"
            />
          </svg>
        </div>

        {/* Layer 3: Light Green Wave */}
        <div className="absolute bottom-0 left-0 w-[200%] h-[80%] animate-wave-fast">
          <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path 
              d="M0,50 C250,100 450,0 700,50 C950,100 1150,0 1400,50 L1400,100 L0,100 Z" 
              fill="#008b5a" 
              opacity="0.15"
            />
          </svg>
        </div>
      </div>
      
      <style>{`
        @keyframes waveMoveHorizontal {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .animate-wave-slow {
          animation: waveMoveHorizontal 30s linear infinite;
        }
        
        .animate-wave-medium {
          animation: waveMoveHorizontal 20s linear infinite reverse;
        }
        
        .animate-wave-fast {
          animation: waveMoveHorizontal 15s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default BackgroundAnimation;