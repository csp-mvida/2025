import React from 'react';
import { CheckCircle } from './ui/Icons';

interface StepperProps {
  currentStep: number;
}

const STEPS = ["IDENTIFICAÇÃO", "PAGAMENTO", "COMPROVAÇÃO", "DESCRIÇÃO", "REVISÃO"];

export const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  return (
    <div className="w-full mb-12">
      <div className="relative flex justify-between">
        {STEPS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <div key={index} className="flex flex-col items-center relative z-10 w-full">
              <div 
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isCompleted 
                    ? 'bg-primary border-primary text-white' 
                    : isCurrent 
                      ? 'bg-white border-primary text-primary shadow-[0_0_15px_rgba(0,139,90,0.2)]' 
                      : 'bg-white border-slate-200 text-slate-300'}
                `}
              >
                {isCompleted ? <CheckCircle className="w-6 h-6" /> : <span className="text-base font-bold">{index + 1}</span>}
              </div>
              <span 
                className={`
                  absolute -bottom-7 text-[10px] font-bold tracking-wider transition-colors duration-300 whitespace-nowrap
                  ${isCurrent ? 'text-primary' : isCompleted ? 'text-slate-500' : 'text-slate-400'}
                  hidden md:block
                `}
              >
                {label}
              </span>
            </div>
          );
        })}
        
        {/* Progress Line Background */}
        <div className="absolute top-[18px] left-0 w-full h-[4px] bg-slate-100 -z-0"></div>
        
        {/* Active Progress Line */}
        <div 
          className="absolute top-[18px] left-0 h-[4px] bg-primary transition-all duration-700 ease-in-out -z-0"
          style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};