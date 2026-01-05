import React from 'react';
import { CheckCircle } from './ui/Icons';

interface StepperProps {
  currentStep: number;
}

const STEPS = ["Identificação", "Pagamento", "Comprovação", "Descrição", "Revisão"];

export const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  return (
    <div className="w-full mb-6">
      <div className="relative flex justify-between">
        {STEPS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <div key={index} className="flex flex-col items-center relative z-10 w-full group">
              <div 
                className={`
                  w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isCompleted 
                    ? 'bg-primary border-primary text-white scale-100' 
                    : isCurrent 
                      ? 'bg-white border-primary text-primary shadow-[0_0_15px_rgba(0,139,90,0.3)] scale-110' 
                      : 'bg-slate-100 border-slate-300 text-slate-400'}
                `}
              >
                {isCompleted ? <CheckCircle className="w-5 h-5 md:w-6 md:h-6" /> : <span className="text-xs md:text-base font-bold">{index + 1}</span>}
              </div>
              <span 
                className={`
                  absolute -bottom-8 text-[10px] md:text-sm font-medium uppercase tracking-wider transition-colors duration-300
                  ${isCurrent ? 'text-primary' : isCompleted ? 'text-slate-500' : 'text-slate-400'}
                `}
              >
                {label}
              </span>
            </div>
          );
        })}
        
        {/* Progress Line Background */}
        <div className="absolute top-4 md:top-5 left-0 w-full h-0.5 bg-slate-200 -z-0"></div>
        
        {/* Active Progress Line */}
        <div 
          className="absolute top-4 md:top-5 left-0 h-0.5 bg-primary transition-all duration-500 ease-in-out -z-0"
          style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};