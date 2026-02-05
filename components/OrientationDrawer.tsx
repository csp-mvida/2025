import React from 'react';
import { X, FileText, Clock, AlertTriangle, Info } from './ui/Icons';

interface OrientationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrientationDrawer: React.FC<OrientationDrawerProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-[60] shadow-2xl transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Info className="text-primary w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Guia de Solicitação</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Prazos & Diretrizes</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <FileText className="text-primary w-5 h-5" />
                <h3 className="font-bold text-slate-800">Informações Essenciais</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Para que sua solicitação seja processada sem atrasos, certifique-se de ter em mãos:
              </p>
              <ul className="space-y-3">
                {['Dados completos do fornecedor', 'Nota Fiscal ou comprovante equivalente', 'Aprovação prévia do coordenador', 'Chave PIX ou dados bancários corretos'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="text-accent w-5 h-5" />
                <h3 className="font-bold text-amber-800">Prazos e Urgência</h3>
              </div>
              <p className="text-amber-700 text-sm leading-relaxed mb-4">
                O setor financeiro trabalha com um cronograma rigoroso de processamento.
              </p>
              <div className="bg-white/50 p-3 rounded-xl border border-amber-200/50">
                <p className="text-xs text-amber-900 font-medium">
                  Solicitações com vencimento inferior a <strong className="font-black">2 horas</strong> são consideradas urgentes e exigem justificativa.
                </p>
              </div>
            </section>

            <section className="p-6 bg-red-50 rounded-2xl border border-red-100">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="text-danger w-5 h-5" />
                <h3 className="font-bold text-red-800">Emergências</h3>
              </div>
              <p className="text-red-700 text-sm leading-relaxed">
                Em casos críticos de "pagamento imediato", após enviar o formulário, <span className="font-bold underline">entre em contato via WhatsApp</span> com o financeiro informando o número do protocolo.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
              Departamento Financeiro &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};