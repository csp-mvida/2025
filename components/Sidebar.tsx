import React from 'react';
import { AlertTriangle, Clock, FileText } from './ui/Icons';

export const Sidebar: React.FC = () => {
  return (
    <aside className="hidden lg:flex flex-col w-80 fixed right-0 top-0 bottom-0 p-6 bg-detail border-l border-slate-200 z-10 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-2 tracking-tight">Orientações</h2>
        <div className="h-1 w-12 bg-primary rounded-full mb-4"></div>
        <p className="text-slate-600 text-base leading-relaxed">
          O processo de solicitação de contas a pagar é fundamental para a boa gestão administrativa e financeira da empresa.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3 mb-2">
            <FileText className="text-primary w-5 h-5 mt-0.5" />
            <h3 className="font-semibold text-slate-800 text-base">Informações Essenciais</h3>
          </div>
          <p className="text-slate-500 text-sm pl-8">
            Reúna fornecedor, descrição clara, valor exato, nota fiscal e atenção aos prazos antes de iniciar.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3 mb-2">
            <Clock className="text-accent w-5 h-5 mt-0.5" />
            <h3 className="font-semibold text-slate-800 text-base">Prazos & Urgência</h3>
          </div>
          <ul className="text-slate-500 text-sm list-disc list-outside ml-8 space-y-1">
            <li>Prazo mínimo de <strong className="text-accent">2 horas</strong> entre pedido e vencimento.</li>
            <li>Não aceitamos pedidos "para ontem" sem justificativa.</li>
          </ul>
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="flex items-start gap-3 mb-2">
            <AlertTriangle className="text-danger w-5 h-5 mt-0.5" />
            <h3 className="font-semibold text-danger text-base">Emergências</h3>
          </div>
          <p className="text-red-700 text-sm pl-8">
            Para solicitações urgentes (menos de 2h): preencha este formulário e envie uma mensagem imediata via WhatsApp para o financeiro.
          </p>
        </div>
      </div>
      
      <div className="mt-auto pt-8 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
          Departamento Financeiro &copy; {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
};