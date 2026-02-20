import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CSPRequest, RequestStatus } from '../types';
import { getRequests, updateRequestStatus } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { Button } from './ui/Button';
import { 
  Search, Filter, Eye, CheckCircle, AlertTriangle, X, 
  Clock, LayoutDashboard, RefreshCw, FileText, Download, Copy
} from './ui/Icons';
import { BackgroundAnimation } from './BackgroundAnimation';

interface AdminDashboardProps {
  onBack: () => void;
}

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Em análise', color: 'bg-accent/10 text-accent border-accent/20', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'Aprovado', color: 'bg-primary/10 text-primary border-primary/20', icon: <CheckCircle className="w-3 h-3" /> },
  paid: { label: 'Pago', color: 'bg-primaryDark/10 text-primaryDark border-primaryDark/20', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejeitado', color: 'bg-danger/10 text-danger border-danger/20', icon: <X className="w-3 h-3" /> },
  draft: { label: 'Rascunho', color: 'bg-slate-200 text-slate-500 border-slate-300', icon: <FileText className="w-3 h-3" /> }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [requests, setRequests] = useState<CSPRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mês atual como padrão para o filtro de Vencimento
  const currentMonthValue = new Date().toISOString().slice(0, 7);
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthValue);
  
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all' | 'pendencias'>('all');
  const [selectedRequest, setSelectedRequest] = useState<CSPRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Opções de meses começando em Janeiro de 2026 até o mês atual
  const monthOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = 2026;
    const currentMonth = now.getMonth(); // 0-indexed

    for (let m = 0; m <= currentMonth; m++) {
      const date = new Date(currentYear, m, 1);
      const monthLabel = date.toLocaleString('pt-BR', { month: 'short' });
      const value = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
      options.push({ label: `${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}/2026`, value });
    }
    return options.reverse(); // Mais recente primeiro
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: RequestStatus) => {
    if (newStatus === 'rejected') {
        const reason = rejectionReason.trim();
        if (reason.length < 5) {
            toast.error('O motivo da rejeição deve ter pelo menos 5 caracteres.');
            return;
        }
    }

    setIsUpdating(true);
    const success = await updateRequestStatus(id, newStatus, rejectionReason.trim());
    
    if (success) {
      // Atualizar lista local para refletir a mudança imediatamente
      const updatedDate = newStatus === 'paid' ? new Date().toISOString() : null;
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, rejectionReason: rejectionReason.trim(), paidAt: updatedDate } as any : r));
      
      toast.success(`Status atualizado para ${STATUS_CONFIG[newStatus].label}`);
      setSelectedRequest(null); // Fechar modal após sucesso
    } else {
      console.error(`[AdminDashboard] Falha ao atualizar status. Protocolo: ${id}, Status Alvo: ${newStatus}, Payload:`, {
        status: newStatus,
        rejection_reason: rejectionReason
      });
      toast.error('Erro ao atualizar status. Verifique o console.');
    }
    setIsUpdating(false);
  };

  const isIssue = (req: CSPRequest): boolean => {
    const method = req.paymentMethod?.toLowerCase() || '';
    if (method === 'pix' && !req.pixKey) return true;
    if (method === 'boleto' && (!req.boletoUrl || req.boletoUrl === '')) return true;
    if (method.includes('transferencia')) {
        if (!req.transferBankName || !req.transferAccountType || !req.transferAgency || 
            !req.transferAccount || !req.transferCpfCnpj || !req.transferBeneficiaryName) {
            return true;
        }
    }
    if (req.hasInvoice === 'yes' && (!req.invoiceUrl || req.invoiceUrl === 'Pendente via WhatsApp')) return true;
    return false;
  };

  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase();
    
    // Filtro por Mês (Baseado no Vencimento due_date)
    const matchesMonth = monthFilter === 'all' || (req.dueDate && req.dueDate.startsWith(monthFilter));
    
    // Filtro por Busca Textual
    const matchesSearch = 
      req.requesterName.toLowerCase().includes(term) ||
      req.id.toLowerCase().includes(term) || 
      req.supplierName.toLowerCase().includes(term);
    
    // Filtro por Abas/Status
    let matchesFilter = false;
    if (statusFilter === 'all') {
        // Aba "Recebidos": APENAS status 'pending'
        matchesFilter = req.status === 'pending';
    } else if (statusFilter === 'pendencias') {
        // Aba "Incompletos": APENAS status 'pending' + dados incompletos
        matchesFilter = req.status === 'pending' && isIssue(req);
    } else {
        // Demais abas: aprovado, pago, rejeitado, rascunho
        matchesFilter = req.status === statusFilter;
    }
    
    return matchesMonth && matchesSearch && matchesFilter;
  });

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const isAPriority = a.status === 'pending' || a.status === 'approved';
    const isBPriority = b.status === 'pending' || b.status === 'approved';
    if (isAPriority && isBPriority) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (isAPriority) return -1;
    if (isBPriority) return 1;
    return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
  });

  const openDetails = (req: CSPRequest) => {
    setSelectedRequest(req);
    setRejectionReason((req as any).rejectionReason || '');
  };

  const copyProtocol = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Protocolo copiado!');
  };

  const getUrgencyIndicator = (dueDateStr: string) => {
    if (!dueDateStr) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    const dueStr = dueDateStr.split('T')[0];
    if (dueStr < todayStr) {
        return <span className="text-[10px] font-black text-danger uppercase tracking-tighter">Vencido</span>;
    } else if (dueStr === todayStr) {
        return <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Vence hoje</span>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 relative overflow-x-hidden">
      <BackgroundAnimation />
      
      <div className="bg-primaryDark text-white pt-10 pb-16 px-4 md:px-8 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-6 md:gap-4">
          <div className="order-2 md:order-1 text-center md:text-left">
             <div className="flex items-center justify-center md:justify-start gap-2 text-primaryHover mb-1">
               <LayoutDashboard className="w-5 h-5" />
               <span className="uppercase tracking-widest text-[10px] md:text-xs font-bold">Painel Administrativo</span>
             </div>
             <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestão de Solicitações</h1>
          </div>
          <div className="order-1 md:order-2 flex justify-center z-10">
             <img src="/admin-logo.png" alt="Missão Vida" className="h-20 md:h-24 w-auto object-contain" />
          </div>
          <div className="order-3 md:order-3 flex justify-center md:justify-end">
            <Button variant="ghost" className="text-white border border-white/20 hover:bg-white hover:text-primary transition-colors py-2 px-4" onClick={onBack}>Sair do Admin</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-8 relative z-10">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input type="text" placeholder="Protocolo, Nome ou Fornecedor..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Mês (Vencimento)</label>
                <select 
                    value={monthFilter} 
                    onChange={e => setMonthFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all text-sm font-bold text-slate-600"
                >
                    <option value="all">Todos os Meses</option>
                    {monthOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide self-end">
             <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${statusFilter === 'all' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Recebidos</button>
             <button onClick={() => setStatusFilter('pendencias')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap flex items-center gap-1.5 ${statusFilter === 'pendencias' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'}`}>
               <AlertTriangle className="w-4 h-4" /> Incompletos
             </button>
             <button onClick={() => setStatusFilter('approved')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${statusFilter === 'approved' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
               A pagar
             </button>
             {(['paid', 'rejected', 'draft'] as const).map(status => (
               <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${statusFilter === status ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                 {status === 'draft' ? 'Rascunhos' : STATUS_CONFIG[status].label}
               </button>
             ))}
             <button onClick={loadData} className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-primary ml-auto shrink-0"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4">Protocolo / Datas</th>
                   <th className="px-6 py-4">Solicitante</th>
                   <th className="px-6 py-4 text-right">Valor</th>
                   <th className="px-6 py-4 text-center">Ações</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {sortedRequests.length > 0 ? sortedRequests.map(req => (
                   <tr key={req.id} className="hover:bg-primary/5 transition-colors group">
                     <td className="px-6 py-4">
                       <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CONFIG[req.status].color}`}>
                          {STATUS_CONFIG[req.status].icon} {STATUS_CONFIG[req.status].label}
                        </span>
                        {isIssue(req) && req.status !== 'draft' && (
                            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Dados Incompletos</span>
                        )}
                       </div>
                     </td>
                     <td className="px-6 py-4">
                       <div className="font-mono text-sm font-black text-slate-900 group-hover:text-primary leading-none mb-1.5">{req.id}</div>
                       <div className="space-y-1">
                            <div className="text-sm text-slate-500 font-medium">
                                Criado em: {req.createdAt ? new Date(req.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <div className="text-sm text-slate-700 font-bold">
                                    Vence: {req.dueDate ? new Date(req.dueDate).toLocaleDateString('pt-BR') : '—'}
                                    {req.dueDate && req.dueDate.includes('T') && (
                                        <span className="ml-1 text-primary">às: {req.dueDate.split('T')[1].substring(0, 5)}</span>
                                    )}
                                </div>
                                {(req as any).paidAt && (
                                    <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Pago em: {new Date((req as any).paidAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                                {getUrgencyIndicator(req.dueDate)}
                            </div>
                       </div>
                     </td>
                     <td className="px-6 py-4 font-medium text-slate-900">{req.requesterName}</td>
                     <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(req.value)}</td>
                     <td className="px-6 py-4 text-center">
                       <button onClick={() => openDetails(req)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"><Eye className="w-5 h-5" /></button>
                     </td>
                   </tr>
                 )) : (
                    <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">Nenhuma solicitação encontrada para o período.</td>
                    </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                   {selectedRequest.id}
                   <button onClick={() => copyProtocol(selectedRequest.id)} className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-md hover:bg-primary/5"><Copy className="w-4 h-4" /></button>
                 </h2>
               </div>
               <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><X className="w-6 h-6" /></button>
             </div>

             <div className="p-6 overflow-y-auto space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">Dados Gerais</h3>
                    <div><span className="block text-xs text-slate-500">Valor</span> <span className="text-xl font-bold text-primary">{formatCurrency(selectedRequest.value)}</span></div>
                    <div><span className="block text-xs text-slate-500">Solicitante</span> <span className="font-medium text-slate-900">{selectedRequest.requesterName}</span></div>
                    <div><span className="block text-xs text-slate-500">Fornecedor</span> <span className="font-medium text-slate-900">{selectedRequest.supplierName}</span></div>
                    {(selectedRequest as any).paidAt && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <span className="block text-[10px] uppercase font-black text-emerald-600 mb-1">Confirmação de Pagamento</span>
                            <span className="text-sm font-bold text-emerald-700">Pago em: {new Date((selectedRequest as any).paidAt).toLocaleString('pt-BR')}</span>
                        </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">Pagamento</h3>
                    <div><span className="block text-xs text-slate-500">Forma</span> <span className="font-bold text-slate-800">{selectedRequest.paymentMethod}</span></div>
                    {selectedRequest.pixKey && <div><span className="block text-xs text-slate-500">Chave PIX</span> <span className="text-sm font-mono break-all">{selectedRequest.pixKey}</span></div>}
                    {selectedRequest.paymentMethod?.toLowerCase().includes('transferencia') && (
                        <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                            <p><strong>Bco:</strong> {selectedRequest.transferBankName || '?'}</p>
                            <p><strong>Ag/Cc:</strong> {selectedRequest.transferAgency || '?'}/{selectedRequest.transferAccount || '?'}</p>
                            <p><strong>Fav:</strong> {selectedRequest.transferBeneficiaryName || '?'}</p>
                        </div>
                    )}
                  </div>
               </div>

               <div className="space-y-2">
                 <label className="text-xs uppercase tracking-wider font-bold text-slate-400">Motivo da Rejeição / Observações Internas</label>
                 <textarea 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Obrigatório ao rejeitar (mín. 5 caracteres)..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                 />
               </div>

               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                 <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">Descrição do Solicitante</h3>
                 <p className="text-slate-700 text-sm italic">"{selectedRequest.description}"</p>
               </div>
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-center">
               <Button variant="ghost" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'pending')} disabled={isUpdating} className="border border-slate-200">Reverter para Recebidos</Button>
               <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'approved')} disabled={isUpdating} className="text-blue-600 border-blue-200 hover:bg-blue-50">Aprovar</Button>
               <Button variant="primary" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'paid')} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700">Marcar Pago</Button>
               <Button variant="danger" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')} disabled={isUpdating}>Rejeitar</Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};