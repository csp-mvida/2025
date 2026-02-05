import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Search, ChevronLeft, Clock, CheckCircle, X, AlertTriangle, FileText, Download, RefreshCw } from './ui/Icons';
import { getRequestByProtocol } from '../services/api';
import { CSPRequest, RequestStatus, Department } from '../types';
import { formatCurrency } from '../utils/formatters';

interface RequestTrackerProps {
  initialProtocol?: string;
  onBack: () => void;
  departments: Department[];
  authorizers: { id: string; name: string }[];
  paymentAccounts: { id: string; label: string }[];
}

const STATUS_MAP: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  pending: { 
    label: 'Pendente', 
    color: 'bg-accent/10 text-accent border-accent/20', 
    icon: <Clock className="w-5 h-5" />,
    desc: 'Sua solicitação foi recebida e está aguardando análise do setor financeiro.'
  },
  approved: { 
    label: 'Aprovado', 
    color: 'bg-primary/10 text-primary border-primary/20', 
    icon: <CheckCircle className="w-5 h-5" />,
    desc: 'Tudo certo! Sua solicitação foi aprovada e entrará na fila de pagamentos.'
  },
  paid: { 
    label: 'Pago', 
    color: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20', 
    icon: <CheckCircle className="w-5 h-5" />,
    desc: 'Pagamento realizado com sucesso.'
  },
  rejected: { 
    label: 'Rejeitado', 
    color: 'bg-danger/10 text-danger border-danger/20', 
    icon: <X className="w-5 h-5" />,
    desc: 'Houve um problema com sua solicitação. Verifique os dados ou contate o financeiro.'
  },
  draft: {
    label: 'Rascunho',
    color: 'bg-slate-200/50 text-slate-600 border-slate-300/50',
    icon: <FileText className="w-5 h-5" />,
    desc: 'Esta solicitação ainda está em rascunho e não foi enviada para análise.'
  }
};

export const RequestTracker: React.FC<RequestTrackerProps> = ({ initialProtocol = '', onBack, departments, authorizers, paymentAccounts }) => {
  const [protocol, setProtocol] = useState(initialProtocol);
  const [request, setRequest] = useState<CSPRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!protocol) return;

    setLoading(true);
    setError('');
    setRequest(null);

    try {
      const data = await getRequestByProtocol(protocol);
      if (data) {
        setRequest(data);
      } else {
        setError('Protocolo não encontrado. Verifique o código e tente novamente.');
      }
    } catch (err) {
      setError('Ocorreu um erro na busca. Tente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialProtocol) {
      handleSearch();
    }
  }, [initialProtocol]);

  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || 'N/A';
  const getAuthorizerName = (id: string) => authorizers.find(a => a.id === id)?.name || 'N/A';
  const getPaymentAccountLabel = (id: string) => paymentAccounts.find(p => p.id === id)?.label || 'N/A';

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-medium"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Acompanhar Solicitação</h1>
        <p className="text-slate-500 text-sm">Insira seu código de protocolo para ver o status em tempo real.</p>
      </div>

      <form onSubmit={handleSearch} className="mb-10">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
             <Input 
                label="" 
                placeholder="CSP-YYYYMMDD-XXXX" 
                value={protocol} 
                onChange={e => setProtocol(e.target.value.toUpperCase())}
                className="pr-12 text-lg font-mono placeholder:font-sans uppercase"
             />
             <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <FileText className="w-5 h-5" />
             </div>
          </div>
          <Button type="submit" size="lg" disabled={loading || !protocol} className="md:w-40">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Buscar</span>}
          </Button>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-danger text-sm animate-in shake">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}
      </form>

      {request && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          {/* Status Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
             <div className={`p-8 text-center border-b border-slate-50 ${STATUS_MAP[request.status].color}`}>
                <div className="inline-flex p-3 rounded-full bg-white/50 mb-4 shadow-sm">
                  {STATUS_MAP[request.status].icon}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-widest mb-1">{STATUS_MAP[request.status].label}</h2>
                <p className="text-sm font-medium opacity-80 max-w-sm mx-auto">{STATUS_MAP[request.status].desc}</p>
             </div>

             <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div>
                     <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Fornecedor</span>
                     <p className="font-bold text-slate-900">{request.supplierName}</p>
                   </div>
                   <div className="text-right">
                     <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Valor</span>
                     {/* O valor é armazenado em centavos (string) no request, formatamos para BRL */}
                     <p className="font-black text-primary text-xl">{formatCurrency(request.value)}</p>
                   </div>
                   <div>
                     <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Vencimento</span>
                     <p className="font-medium text-slate-700">{new Date(request.dueDate).toLocaleDateString('pt-BR')}</p>
                   </div>
                   <div className="text-right">
                     <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Criado em</span>
                     <p className="font-medium text-slate-700">{new Date(request.createdAt!).toLocaleDateString('pt-BR')}</p>
                   </div>
                   
                   {/* Novos campos de detalhe */}
                   <div>
                     <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Departamento</span>
                     <p className="font-medium text-slate-700">{getDepartmentName(request.departmentId)}</p>
                   </div>
                   <div className="text-right">
                     <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Conta de Pagamento</span>
                     {/* O paymentAccount no request é o ID, precisamos do Label */}
                     <p className="font-medium text-slate-700">{getPaymentAccountLabel(request.paymentAccount)}</p>
                   </div>
                   <div className="col-span-2">
                     <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Autorizador</span>
                     {/* O authorizer no request é o ID, precisamos do Name */}
                     <p className="font-medium text-slate-700">{getAuthorizerName(request.authorizer)}</p>
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                   <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Descrição</span>
                   <p className="text-sm text-slate-600 leading-relaxed italic">"{request.description}"</p>
                </div>

                {(request.invoiceUrl || request.boletoUrl) && (
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                     {request.invoiceUrl && request.invoiceUrl !== 'Pendente via WhatsApp' && (
                       <a 
                         href={request.invoiceUrl} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 text-primary font-bold text-xs border border-slate-100 hover:bg-primary hover:text-white transition-all group"
                       >
                         <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                         Visualizar Nota Fiscal
                       </a>
                     )}
                     {request.boletoUrl && (
                       <a 
                         href={request.boletoUrl} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 text-primary font-bold text-xs border border-slate-100 hover:bg-primary hover:text-white transition-all group"
                       >
                         <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                         Visualizar Boleto
                       </a>
                     )}
                  </div>
                )}
             </div>
          </div>
          
          <div className="text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Protocolo: {request.id}</p>
          </div>
        </div>
      )}
    </div>
  );
};