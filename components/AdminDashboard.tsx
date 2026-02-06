import React, { useState, useEffect } from 'react';
import { CSPRequest, RequestStatus } from '../types';
import { getRequests, updateRequestStatus, signOut } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { computeRequestFlags } from '../lib/paymentRequestRules';
import { toast } from 'react-hot-toast';
import { Button } from './ui/Button';
import { 
  Search, Eye, CheckCircle, X, 
  Clock, LayoutDashboard, RefreshCw, FileText, Download, AlertTriangle 
} from './ui/Icons';
import { BackgroundAnimation } from './BackgroundAnimation';

interface AdminDashboardProps {
  onBack: () => void;
}

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: 'bg-accent/10 text-accent border-accent/20', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'Aprovado', color: 'bg-primary/10 text-primary border-primary/20', icon: <CheckCircle className="w-3 h-3" /> },
  paid: { label: 'Pago', color: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejeitado', color: 'bg-danger/10 text-danger border-danger/20', icon: <X className="w-3 h-3" /> },
  draft: { label: 'Rascunho', color: 'bg-slate-200 text-slate-500 border-slate-300', icon: <FileText className="w-3 h-3" /> }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [requests, setRequests] = useState<CSPRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<CSPRequest | null>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await getRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleStatusUpdate = async (id: string, newStatus: RequestStatus) => {
    const request = requests.find(r => r.id === id);
    if (newStatus === 'approved' || newStatus === 'paid') {
      const flags = computeRequestFlags(request || {});
      if (flags.critical_blockers) {
        toast.error(`Não é possível prosseguir: ${flags.blocker_messages[0]}`);
        return;
      }
    }

    if (await updateRequestStatus(id, newStatus)) {
      toast.success(`Status atualizado para ${STATUS_CONFIG[newStatus].label}`);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      if (selectedRequest?.id === id) setSelectedRequest(prev => prev ? { ...prev, status: newStatus } : null);
    } else {
      toast.error("Erro ao atualizar status.");
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === 'all' || req.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const getUrls = (urlJson: string | undefined): string[] => {
    if (!urlJson || urlJson === 'Pendente via WhatsApp') return [];
    try { return JSON.parse(urlJson); } catch { return [urlJson]; }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 relative overflow-x-hidden">
      <BackgroundAnimation />
      <div className="bg-primaryDark text-white pt-10 pb-16 px-8 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-primaryHover mb-1"><LayoutDashboard className="w-5 h-5" /><span className="uppercase tracking-widest text-xs font-bold">Painel Administrativo</span></div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Solicitações</h1>
          </div>
          <div className="flex items-center gap-4">
            <img src="/admin-logo.png" alt="Logo" className="h-16" />
            <Button variant="ghost" className="text-white border border-white/20" onClick={async () => { await signOut(); onBack(); }}>Logout</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 -mt-8 relative z-10">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto">
             {(['all', 'pending', 'approved', 'paid', 'rejected'] as const).map(status => (
               <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${statusFilter === status ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-600'}`}>{status === 'all' ? 'Todos' : STATUS_CONFIG[status].label}</button>
             ))}
             <button onClick={loadData} className="p-2.5 rounded-lg bg-white border border-slate-200 hover:text-primary transition-colors"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-left">
             <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold"><th className="px-6 py-4">Status</th><th className="px-6 py-4">ID / Data</th><th className="px-6 py-4">Solicitante</th><th className="px-6 py-4 text-right">Valor</th><th className="px-6 py-4 text-center">Ações</th></tr></thead>
             <tbody className="divide-y divide-slate-100">{filteredRequests.map(req => (
               <tr key={req.id} className="hover:bg-primary/5 group transition-colors"><td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CONFIG[req.status].color}`}>{STATUS_CONFIG[req.status].icon} {STATUS_CONFIG[req.status].label}</span></td><td className="px-6 py-4"><div className="font-mono text-sm font-medium">{req.id}</div><div className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</div></td><td className="px-6 py-4 font-medium">{req.requesterName}</td><td className="px-6 py-4 text-right font-medium">{formatCurrency(req.value)}</td><td className="px-6 py-4 text-center"><button onClick={() => setSelectedRequest(req)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Eye className="w-5 h-5" /></button></td></tr>
             ))}</tbody>
           </table>
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
             <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50"><div><h2 className="text-lg font-bold">{selectedRequest.id}</h2><p className="text-xs text-slate-500">{new Date(selectedRequest.createdAt).toLocaleString('pt-BR')}</p></div><button onClick={() => setSelectedRequest(null)} className="text-slate-400 p-2"><X className="w-6 h-6" /></button></div>
             <div className="p-6 overflow-y-auto space-y-6">
               <div className="grid grid-cols-2 gap-6"><div><span className="text-xs text-slate-500">Valor</span><p className="text-xl font-bold text-primary">{formatCurrency(selectedRequest.value)}</p></div><div><span className="text-xs text-slate-500">Vencimento</span><p className="font-medium text-accent">{new Date(selectedRequest.dueDate).toLocaleString('pt-BR')}</p></div></div>
               
               {computeRequestFlags(selectedRequest).critical_blockers && (
                 <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-danger uppercase">Pendências Detectadas</p>
                      <ul className="text-xs text-red-700 list-disc ml-4 mt-1">
                        {computeRequestFlags(selectedRequest).blocker_messages.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                 </div>
               )}

               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><h3 className="text-xs font-bold text-slate-400 mb-2">Descrição</h3><p className="text-sm">{selectedRequest.description}</p></div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                   <h3 className="text-xs font-bold text-slate-400 uppercase">Dados da Solicitação</h3>
                   <div className="text-sm"><span className="text-slate-500">Método:</span> <span className="font-bold">{selectedRequest.paymentMethod}</span></div>
                   {selectedRequest.pixKey && <div className="text-sm"><span className="text-slate-500">PIX:</span> <span className="font-mono">{selectedRequest.pixKey}</span></div>}
                   {selectedRequest.transferBankName && (
                     <div className="text-xs space-y-1 bg-white p-2 border rounded">
                       <div>{selectedRequest.transferBankName} - {selectedRequest.transferAccountType}</div>
                       <div>Ag: {selectedRequest.transferAgency} / Cc: {selectedRequest.transferAccount}</div>
                       <div className="font-bold">{selectedRequest.transferBeneficiaryName}</div>
                       <div className="text-[10px]">{selectedRequest.transferCpfCnpj}</div>
                     </div>
                   )}
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xs font-bold text-slate-400 uppercase">Documentos</h3>
                   {getUrls(selectedRequest.invoiceUrl).map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-white border rounded text-[10px] text-primary font-bold hover:bg-slate-50"><Download className="w-3 h-3" /> Nota Fiscal {i + 1}</a>)}
                   {getUrls(selectedRequest.boletoUrl).map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-white border rounded text-[10px] text-accent font-bold hover:bg-slate-50"><Download className="w-3 h-3" /> Boleto {i + 1}</a>)}
                   {selectedRequest.invoiceUrl === 'Pendente via WhatsApp' && <span className="text-[10px] text-accent font-bold italic block">Aguardando NF via WhatsApp</span>}
                 </div>
               </div>
             </div>
             <div className="p-4 border-t flex gap-3 justify-end bg-slate-50/50">
               {(selectedRequest.status === 'pending' || selectedRequest.status === 'approved') && (
                 <Button variant="danger" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')}>Rejeitar</Button>
               )}
               {selectedRequest.status === 'pending' && (
                 <Button variant="primary" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'approved')}>Aprovar</Button>
               )}
               {selectedRequest.status === 'approved' && (
                 <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusUpdate(selectedRequest.id, 'paid')}>Marcar como Pago</Button>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};