import React from 'react';
import { BackgroundAnimation } from '../../components/BackgroundAnimation';
import { PlusCircle, List, LogOut, FileText, CheckCircle, Clock, ChevronRight } from '../../components/ui/Icons';
import { supabase } from '../services/api';

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
    <div className="min-h-screen relative bg-slate-50 flex flex-col">
      <BackgroundAnimation />
      
      <header className="relative z-20 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Área do Requisitante</h1>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Painel de Controle</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-danger rounded-xl transition-all font-bold text-xs uppercase tracking-widest border border-slate-100"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          
          <button 
            onClick={onNewRequest}
            className="group relative bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl hover:shadow-primary/10 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[5rem] group-hover:bg-primary/10 transition-colors" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 ring-8 ring-primary/5">
                <PlusCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Nova Solicitação</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Inicie um novo processo de pagamento preenchendo os dados do fornecedor e anexos.
              </p>
              <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                Começar agora <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </button>

          <button 
            onClick={onViewHistory}
            className="group relative bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl hover:shadow-slate-200/50 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[5rem] group-hover:bg-slate-100 transition-colors" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6 ring-8 ring-slate-50">
                <List className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Minhas Solicitações</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Acompanhe o status, verifique aprovações e baixe comprovantes de pedidos anteriores.
              </p>
              <div className="flex items-center gap-2 text-slate-400 group-hover:text-primary transition-colors font-black text-xs uppercase tracking-widest">
                Ver histórico <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </button>

        </div>

        <div className="mt-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
           <div className="inline-flex items-center gap-6 px-8 py-4 bg-white/50 backdrop-blur-sm rounded-full border border-white/50 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análise rápida</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segurança total</span>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};