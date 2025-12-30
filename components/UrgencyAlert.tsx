import React from 'react';
import { AlertTriangle } from './ui/Icons';

interface UrgencyAlertProps {
  isUrgent: boolean;
}

export const UrgencyAlert: React.FC<UrgencyAlertProps> = ({ isUrgent }) => {
  if (!isUrgent) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300 my-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-4">
        <div className="p-2 bg-amber-100 rounded-full shrink-0">
          <AlertTriangle className="text-amber-600 w-6 h-6" />
        </div>
        <div>
          <h4 className="font-bold text-amber-700 text-sm md:text-base uppercase tracking-wide mb-1">Atenção: Prazo Curto</h4>
          <p className="text-amber-800 text-sm md:text-base leading-relaxed">
            O vencimento é em menos de 2 horas. 
            <span className="block mt-1 font-semibold text-amber-700">
              Por favor, conclua o preenchimento e avise imediatamente no WhatsApp após o envio.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};