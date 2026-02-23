import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Search, ChevronLeft, Clock, CheckCircle, X, AlertTriangle, FileText, RefreshCw } from './ui/Icons';
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
    label: 'Em análise', 
    color: 'bg-accent/10 text-accent border-accent/20', 
    icon: <Clock className="w-5 h-5" />,
    desc: 'Sua solicitação foi recebida e está aguardando análise do setor financeiro.'
  },
  approved: { 
    label: 'Aprovado para pagamento', 
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
    desc: 'Houve um problema com sua solicitação. Verifique o motivo abaixo.'
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
    const searchProtocol = protocol.trim().toUpperCase();
    if (!searchProtocol) return;

    setLoading(true);
    setError('');
    setRequest(null);

    try {
      const data = await getRequestByProtocol(searchProtocol);
      if (data) {
        setRequest(data);
      } else {
        setError('Protocolo não encontrado. Verifique o código.');
      }
    } catch (err) {
      setError('Ocorreu um erro na busca.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialProtocol) handleSearch();
  }, [initialProtocol]);

  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || 'N/A';

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-medium">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Acompanhar Solicitação</h1>
        <p className="text-slate-500 text-sm">Insira seu código de protocolo.</p>
      </div>

      <form onSubmit={handleSearch} className="mb-10">
        <div className="flex flex-col md:flex-row gap-3">
          <Input 
             label="" placeholder="CSP-YYYYMMDD-XXXX" 
             value={protocol} onChange={e => setProtocol(e.target.value.toUpperCase())}
             className="text-lg font-mono uppercase"
          />
          <Button type="submit" size="lg" disabled={loading || !protocol} className="md:w-40">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </Button>
        </div>
        {error && <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-danger text-sm flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> {error}</div>}
      </form>

      {request && (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
          <div className={`p-8 text-center border-b ${STATUS_MAP[request.status].color}`}>
            <div className="inline-flex p-3 rounded-full bg-white/50 mb-4">{STATUS_MAP[request.status].icon}</div>
            <h2 className="text-2xl font-black uppercase tracking-widest leading-tight">{STATUS_MAP[request.status].label}</h2>
            <p className="text-sm font-medium mt-1">{STATUS_MAP[request.status].desc}</p>
            
            {/* Informação de Pagamento */}
            {request.status === 'paid' && (request as any).paidAt && (
                <div className="mt-4 p-3 bg-white/40 rounded-xl border border-emerald-200/50 inline-block">
                    <span className="text-xs font-bold text-emerald-700">
                        Confirmado em: {new Date((request as any).paidAt).toLocaleString('pt-BR')}
                    </span>
                </div>
            )}

            {/* Motivo da Rejeição */}
            {request.status === 'rejected' && (request as any).rejectionReason && (
                <div className="mt-4 p-4 bg-white/60 rounded-2xl border border-red-200/50 text-left">
                    <span className="block text-[10px] uppercase font-black text-danger/60 mb-1">Motivo da Rejeição:</span>
                    <p className="text-sm font-bold text-danger leading-relaxed italic">"{(request as any).rejectionReason}"</p>
                </div>
            )}
          </div>

          <div className="p-8 grid grid-cols-2 gap-6">
            <div><span className="block text-[10px] uppercase font-bold text-slate-400">Fornecedor</span><p className="font-bold">{request.supplierName}</p></div>
            <div className="text-right"><span className="block text-[10px] uppercase font-bold text-slate-400">Valor</span><p className="font-black text-primary text-xl">{formatCurrency(request.value)}</p></div>
            <div><span className="block text-[10px] uppercase font-bold text-slate-400">Departamento</span><p className="text-sm">{getDepartmentName(request.departmentId)}</p></div>
            <div className="text-right"><span className="block text-[10px] uppercase font-bold text-slate-400">Vencimento</span><p className="text-sm">{new Date(request.dueDate).toLocaleDateString('pt-BR')}</p></div>
          </div>
        </div>
      )}
    </div>
  );
};