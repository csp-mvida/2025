import React from 'react';
import { BackgroundAnimation } from '../../components/BackgroundAnimation';
import { PlusCircle, List, LogOut, FileText, CheckCircle, Clock, ChevronRight } from '../../components/ui/Icons';
import { supabase } from '../../services/api';

interface RequesterDashboardProps {
  onNewRequest: () => void;
  onViewHistory: () => void;
  onLogout: () => void;
}

export const RequesterDashboard: React.FC<RequesterDashboardProps> = ({ onNewRequest, onViewHistory, onLogout }) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <div className="min-h-screen relative flex flex-col bg-gradient-to-br from-white via-slate-50 to-emerald-50/30">
      <BackgroundAnimation />
      
      {/* Header Refinado */}
      <header className="relative z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-5 md:px-10 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center ring-4 ring-primary/5">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Área do Requisitante</h1>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Painel de Controle</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-red-50 text-slate-500 hover:text-danger rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-widest border border-slate-200 hover:border-red-100 shadow-sm active:scale-95"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 md:p-12 lg:p-20">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          
          {/* Card: Nova Solicitação */}
          <button 
            onClick={onNewRequest}
            className="group relative bg-white p-10 md:p-14 rounded-[3rem] border border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_60px_rgba(0,139,90,0.12)] transition-all duration-500 text-left overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-bl-[6rem] group-hover:bg-primary/10 transition-colors duration-500" />
            <div className="relative z-10 flex-1">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 ring-[12px] ring-primary/5 group-hover:scale-110 transition-transform duration-500">
                <PlusCircle className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Nova Solicitação</h2>
              <p className="text-slate-600 text-base leading-relaxed mb-10 font-medium opacity-90">
                Inicie um novo processo de pagamento preenchendo os dados do fornecedor e anexos necessários.
              </p>
            </div>
            <div className="relative z-10 flex items-center gap-3 text-primary font-black text-xs uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform duration-300">
              Começar agora <ChevronRight className="w-5 h-5" />
            </div>
          </button>

          {/* Card: Minhas Solicitações */}
          <button 
            onClick={onViewHistory}
            className="group relative bg-white p-10 md:p-14 rounded-[3rem] border border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_60px_rgba(30,41,59,0.08)] transition-all duration-500 text-left overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-slate-50 rounded-bl-[6rem] group-hover:bg-slate-100 transition-colors duration-500" />
            <div className="relative z-10 flex-1">
              <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-8 ring-[12px] ring-slate-50 group-hover:scale-110 transition-transform duration-500">
                <List className="w-10 h-10 text-slate-400 group-hover:text-primary transition-colors" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Minhas Solicitações</h2>
              <p className="text-slate-600 text-base leading-relaxed mb-10 font-medium opacity-90">
                Acompanhe o status em tempo real, verifique aprovações e baixe comprovantes de pedidos.
              </p>
            </div>
            <div className="relative z-10 flex items-center gap-3 text-slate-400 group-hover:text-primary transition-all duration-300 font-black text-xs uppercase tracking-[0.2em] group-hover:translate-x-2">
              Ver histórico <ChevronRight className="w-5 h-5" />
            </div>
          </button>

        </div>

        {/* Selo de Confiança Refinado */}
        <div className="mt-20 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
           <div className="inline-flex items-center gap-8 px-10 py-5 bg-white/40 backdrop-blur-md rounded-full border border-white/60 shadow-sm">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Análise rápida</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Segurança total</span>
              </div>
           </div>
        </div>
      </main>

      {/* Footer Minimalista */}
      <footer className="relative z-10 py-8 text-center">
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] opacity-60">
          Departamento Financeiro &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
};