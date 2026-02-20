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
  pending: { label: 'Pendente', color: 'bg-accent/10 text-accent border-accent/20', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'Aprovado', color: 'bg-primary/10 text-primary border-primary/20', icon: <CheckCircle className="w-3 h-3" /> },
  paid: { label: 'Pago', color: 'bg-primaryDark/10 text-primaryDark border-primaryDark/20', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejeitado', color: 'bg-danger/10 text-danger border-danger/20', icon: <X className="w-3 h-3" /> },
  draft: { label: 'Rascunho', color: 'bg-slate-200 text-slate-500 border-slate-300', icon: <FileText className="w-3 h-3" /> }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [requests, setRequests] = useState<CSPRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all' | 'pendencias'>('all');
  const [selectedRequest, setSelectedRequest] = useState<CSPRequest | null>(null);

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
    const success = await updateRequestStatus(id, newStatus);
    if (success) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      if (selectedRequest && selectedRequest.id === id) {
        setSelectedRequest(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success('Status atualizado!');
    }
  };

  const isIssue = (req: CSPRequest): boolean => {
    const method = req.paymentMethod?.toLowerCase() || '';
    
    // PIX sem chave
    if (method === 'pix' && !req.pixKey) return true;
    
    // Boleto sem anexo
    if (method === 'boleto' && (!req.boletoUrl || req.boletoUrl === '')) return true;
    
    // Transferência incompleta
    if (method.includes('transferencia')) {
        if (!req.transferBankName || !req.transferAccountType || !req.transferAgency || 
            !req.transferAccount || !req.transferCpfCnpj || !req.transferBeneficiaryName) {
            return true;
        }
    }
    
    // NF Pendente (marcada como SIM mas sem URL válida)
    if (req.hasInvoice === 'yes' && (!req.invoiceUrl || req.invoiceUrl === 'Pendente via WhatsApp')) return true;
    
    return false;
  };

  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      req.requesterName.toLowerCase().includes(term) ||
      req.id.toLowerCase().includes(term) || 
      req.supplierName.toLowerCase().includes(term);
    
    let matchesFilter = false;
    
    if (statusFilter === 'all') {
        matchesFilter = req.status !== 'draft';
    } else if (statusFilter === 'pendencias') {
        matchesFilter = req.status !== 'draft' && isIssue(req);
    } else {
        matchesFilter = req.status === statusFilter;
    }

    return matchesSearch && matchesFilter;
  });

  // Ordenação solicitada
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const isAPriority = a.status === 'pending' || a.status === 'approved';
    const isBPriority = b.status === 'pending' || b.status === 'approved';

    if (isAPriority && isBPriority) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    
    // Se um for prioridade e o outro não
    if (isAPriority) return -1;
    if (isBPriority) return 1;

    // Se ambos forem Paid ou Rejected
    return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
  });

  const getInvoiceUrls = (request: CSPRequest): string[] => {
    if (!request.invoiceUrl || request.invoiceUrl === 'Pendente via WhatsApp') return [];
    try {
      const parsed = JSON.parse(request.invoiceUrl);
      return Array.isArray(parsed) ? parsed : [request.invoiceUrl];
    } catch {
      return [request.invoiceUrl];
    }
  };

  const copyProtocol = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Protocolo copiado!');
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
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Protocolo, Nome ou Fornecedor..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
             <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${statusFilter === 'all' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Todos</button>
             <button onClick={() => setStatusFilter('pendencias')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap flex items-center gap-1.5 ${statusFilter === 'pendencias' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'}`}>
               <AlertTriangle className="w-4 h-4" /> Pendências
             </button>
             {(['pending', 'approved', 'paid', 'rejected', 'draft'] as const).map(status => (
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
                   <th className="px-6 py-4">Protocolo / Data</th>
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
                            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pendente de dados</span>
                        )}
                       </div>
                     </td>
                     <td className="px-6 py-4">
                       <div className="font-mono text-sm font-medium text-slate-900 group-hover:text-primary">{req.id}</div>
                       <div className="text-xs text-slate-500">{new Date(req.createdAt!).toLocaleDateString('pt-BR')}</div>
                     </td>
                     <td className="px-6 py-4 font-medium text-slate-900">{req.requesterName}</td>
                     <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(req.value)}</td>
                     <td className="px-6 py-4 text-center">
                       <button onClick={() => setSelectedRequest(req)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"><Eye className="w-5 h-5" /></button>
                     </td>
                   </tr>
                 )) : (
                    <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">Nenhuma solicitação encontrada para este filtro.</td>
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
                   <button 
                     onClick={() => copyProtocol(selectedRequest.id)}
                     className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-md hover:bg-primary/5"
                     title="Copiar Protocolo"
                   >
                     <Copy className="w-4 h-4" />
                   </button>
                 </h2>
                 <p className="text-xs text-slate-500">Criado em {new Date(selectedRequest.createdAt!).toLocaleString('pt-BR')}</p>
               </div>
               <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><X className="w-6 h-6" /></button>
             </div>

             <div className="p-6 overflow-y-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Dados do Pagamento</h3>
                    <div><span className="block text-xs text-slate-500">Valor</span> <span className="text-xl font-bold text-primary">{formatCurrency(selectedRequest.value)}</span></div>
                    <div><span className="block text-xs text-slate-500">Fornecedor</span> <span className="font-medium text-slate-900">{selectedRequest.supplierName}</span></div>
                    <div><span className="block text-xs text-slate-500">Forma / Detalhes</span> 
                        <span className="font-bold text-slate-800 text-sm block">
                            {selectedRequest.paymentMethod || 'Não definido'} 
                            {selectedRequest.pixKey && ` - Chave: ${selectedRequest.pixKey}`}
                        </span>
                        {selectedRequest.paymentMethod?.toLowerCase().includes('transferencia') && (
                            <div className="mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                <p><strong>Banco:</strong> {selectedRequest.transferBankName || '?'}</p>
                                <p><strong>Agência:</strong> {selectedRequest.transferAgency || '?'} | <strong>Conta:</strong> {selectedRequest.transferAccount || '?'}</p>
                                <p><strong>Favorecido:</strong> {selectedRequest.transferBeneficiaryName || '?'}</p>
                            </div>
                        )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Anexos</h3>
                    {getInvoiceUrls(selectedRequest).length > 0 ? (
                      <div className="space-y-2">
                        {getInvoiceUrls(selectedRequest).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 text-xs text-primary font-bold hover:bg-primary/5 transition-all">
                            <Download className="w-3 h-3" /> Nota Fiscal {i + 1}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-amber-600 text-[10px] font-bold flex items-center gap-1 bg-amber-50 p-2 rounded border border-amber-100"><AlertTriangle className="w-3 h-3" /> NF: {selectedRequest.invoiceUrl || 'Pendente'}</span>
                    )}
                    {selectedRequest.boletoUrl && (
                      <a href={selectedRequest.boletoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 text-xs text-primary font-bold hover:bg-primary/5 transition-all mt-2">
                        <Download className="w-3 h-3" /> Visualizar Boleto
                      </a>
                    )}
                  </div>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                 <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Descrição</h3>
                 <p className="text-slate-700 text-sm leading-relaxed italic">"{selectedRequest.description}"</p>
               </div>
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-3 justify-end">
               {selectedRequest.status === 'pending' && (
                 <>
                   <Button variant="danger" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')}>Rejeitar</Button>
                   <Button variant="primary" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'approved')}>Aprovar</Button>
                 </>
               )}
               {selectedRequest.status === 'approved' && (
                 <Button variant="primary" size="sm" className="bg-primaryDark hover:bg-primary" onClick={() => handleStatusUpdate(selectedRequest.id, 'paid')}>Marcar como Pago</Button>
               )}
               {selectedRequest.status === 'paid' && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 px-4"><CheckCircle className="w-4 h-4" /> Pagamento Concluído</span>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};