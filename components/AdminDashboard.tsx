import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CSPRequest, RequestStatus } from '../types';
import { getRequests, updateRequestStatus, uploadInvoice, updatePaymentReceipt, closeRequest } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { Button } from './ui/Button';
import { 
  Search, Eye, CheckCircle, AlertTriangle, X, 
  Clock, LayoutDashboard, RefreshCw, Copy, FileText, Download, UploadCloud
} from './ui/Icons';
import { BackgroundAnimation } from './BackgroundAnimation';

// Ícone de Clipe definido localmente
const Paperclip = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

interface AdminDashboardProps {
  onBack: () => void;
}

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Recebidos', color: 'bg-accent/10 text-accent border-accent/20', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'A pagar', color: 'bg-primary/10 text-primary border-primary/20', icon: <CheckCircle className="w-3 h-3" /> },
  paid: { label: 'Pago', color: 'bg-primaryDark/10 text-primaryDark border-primaryDark/20', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejeitado', color: 'bg-danger/10 text-danger border-danger/20', icon: <X className="w-3 h-3" /> },
  draft: { label: 'Rascunho', color: 'bg-slate-200 text-slate-500 border-slate-300', icon: <FileText className="w-3 h-3" /> }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [requests, setRequests] = useState<CSPRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<CSPRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // State para o comprovante de pagamento
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // State para feedback de cópia
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  
  // State para o Preview de Arquivo
  const [previewData, setPreviewData] = useState<{ url: string, title: string } | null>(null);

  // Filtro de meses iniciando em Jan/2026
  const monthOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();
    const startYear = 2026;
    const currentYear = Math.max(startYear, now.getFullYear());
    const currentMonth = (currentYear === now.getFullYear()) ? now.getMonth() : 11;

    for (let y = startYear; y <= currentYear; y++) {
      const stopMonth = (y === currentYear) ? currentMonth : 11;
      for (let m = 0; m <= stopMonth; m++) {
        const date = new Date(y, m, 1);
        const monthLabel = date.toLocaleString('pt-BR', { month: 'short' });
        const value = `${y}-${String(m + 1).padStart(2, '0')}`;
        options.push({ 
          label: `${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}/${y}`, 
          value 
        });
      }
    }
    return options.reverse();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getRequests();
    setRequests(data.filter(r => r.status !== 'draft'));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: RequestStatus) => {
    if (newStatus === 'rejected') {
        const reason = rejectionReason.trim();
        if (reason.length < 5) {
            toast.error("Informe o motivo da rejeição (mín. 5 caracteres).");
            return;
        }
    }

    setIsUpdating(true);
    try {
      const reason = rejectionReason.trim();
      const success = await updateRequestStatus(id, newStatus, reason);
      
      if (success) {
        setRequests(prev => prev.map(r => r.id === id ? { 
          ...r, 
          status: newStatus, 
          rejectionReason: reason, 
          paidAt: newStatus === 'paid' ? new Date().toISOString() : r.paidAt,
          closedAt: undefined // Limpa encerramento ao mudar status
        } as any : r));
        
        toast.success(`Status atualizado para ${STATUS_CONFIG[newStatus].label}`);
        setSelectedRequest(prev => prev && prev.id === id ? { ...prev, status: newStatus, closedAt: undefined } as any : prev);
        
        if (newStatus === 'rejected') {
          setRejectionReason('');
        }
      } else {
        toast.error('Erro ao atualizar status.');
      }
    } catch (err: any) {
       toast.error('Erro inesperado.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile || !selectedRequest) return;
    
    setIsUploadingReceipt(true);
    const toastId = toast.loading('Enviando comprovante...');
    
    try {
      const url = await uploadInvoice(receiptFile, 'receipt', selectedRequest.id);
      const success = await updatePaymentReceipt(selectedRequest.id, url);
      
      if (success) {
        setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, paymentReceiptUrl: url } as any : r));
        setSelectedRequest(prev => prev ? { ...prev, paymentReceiptUrl: url } as any : null);
        setReceiptFile(null);
        toast.success('Comprovante enviado com sucesso!', { id: toastId });
      } else {
        throw new Error('Erro ao atualizar banco de dados.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar comprovante.', { id: toastId });
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleCloseAtendimento = async () => {
      if (!selectedRequest || !(selectedRequest as any).paymentReceiptUrl) return;

      setIsUpdating(true);
      try {
          const success = await closeRequest(selectedRequest.id);
          if (success) {
              const now = new Date().toISOString();
              setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, closedAt: now } as any : r));
              setSelectedRequest(prev => prev ? { ...prev, closedAt: now } as any : null);
              toast.success('Atendimento encerrado com sucesso!');
          } else {
              toast.error('Erro ao encerrar atendimento.');
          }
      } catch (e) {
          toast.error('Ocorreu um erro.');
      } finally {
          setIsUpdating(false);
      }
  };

  const handleDownloadFile = async (url: string, label: string, protocol: string) => {
    const toastId = toast.loading('Preparando download...');
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const extension = url.split('.').pop()?.split('?')[0] || (blob.type.includes('pdf') ? 'pdf' : 'jpg');
      const filename = `${protocol}-${label.replace(/\s+/g, '-')}.${extension}`;
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success('Download concluído!', { id: toastId });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar arquivo.', { id: toastId });
      window.open(url, '_blank');
    }
  };

  const isIssue = (req: CSPRequest): boolean => {
    const method = req.paymentMethod?.toLowerCase() || '';
    if (method === 'pix' && !req.pixKey) return true;
    if (method === 'boleto' && (!req.boletoUrl || req.boletoUrl === '')) return true;
    if (req.hasInvoice === 'yes' && (!req.invoiceUrl || req.invoiceUrl === 'Pendente via WhatsApp')) return true;
    return false;
  };

  const getAttachmentCount = (req: CSPRequest) => {
    const countField = (field: string | undefined) => {
      if (!field || field === 'Pendente via WhatsApp' || field === '[]' || field === '""') return 0;
      try {
        const parsed = JSON.parse(field);
        if (Array.isArray(parsed)) return parsed.filter(u => u && u.trim() !== "").length;
        return 1;
      } catch (e) {
        return 1;
      }
    };
    return countField(req.invoiceUrl) + countField(req.boletoUrl) + countField(req.transferUrl) + ((req as any).paymentReceiptUrl ? 1 : 0);
  };

  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase();
    const matchesMonth = monthFilter === 'all' || (req.dueDate && req.dueDate.startsWith(monthFilter));
    const matchesSearch = req.requesterName.toLowerCase().includes(term) || req.id.toLowerCase().includes(term) || req.supplierName.toLowerCase().includes(term);
    
    let matchesFilter = false;
    if (statusFilter === 'all') matchesFilter = req.status === 'pending';
    else matchesFilter = req.status === statusFilter;
    
    return matchesMonth && matchesSearch && matchesFilter;
  });

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
  });

  const renderAttachmentLinks = (serializedUrls: string | undefined, label: string, protocol: string) => {
    if (!serializedUrls || serializedUrls === 'Pendente via WhatsApp' || serializedUrls === '[]' || serializedUrls === '""') {
        return (
            <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</span>
                <span className="text-[11px] text-slate-400 italic">Pendente / Não enviado</span>
            </div>
        );
    }

    let urls: string[] = [];
    try {
        const parsed = JSON.parse(serializedUrls);
        urls = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        urls = [serializedUrls];
    }

    urls = urls.filter(u => u && u.trim() !== "");

    if (urls.length === 0) {
        return (
            <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</span>
                <span className="text-[11px] text-slate-400 italic">Nenhum anexo</span>
            </div>
        );
    }

    return (
        <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-2">{label}</span>
            <div className="space-y-2">
                {urls.map((url, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 group hover:border-primary/30 transition-all shadow-sm">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-[11px] font-bold text-slate-600 truncate">
                                {label} {urls.length > 1 ? `#${idx + 1}` : ''}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <button 
                                onClick={() => setPreviewData({ url, title: `${label} - ${protocol}` })}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                            >
                                <Eye className="w-3.5 h-3.5" /> Visualizar
                            </button>
                            <button 
                                onClick={() => handleDownloadFile(url, label, protocol)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" /> Baixar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const renderRevertButton = () => {
    if (!selectedRequest) return null;
    
    let label = "";
    let targetStatus: RequestStatus | null = null;
    
    if (selectedRequest.status === 'approved' || selectedRequest.status === 'rejected') {
      label = "Voltar para Recebidos";
      targetStatus = 'pending';
    } else if (selectedRequest.status === 'paid') {
      label = "Voltar para A pagar";
      targetStatus = 'approved';
    }
    
    if (!targetStatus) return null;
    
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => handleStatusUpdate(selectedRequest.id, targetStatus!)} 
        disabled={isUpdating} 
        className="text-slate-400 font-bold hover:text-slate-600 border border-slate-200"
      >
        <RefreshCw className="w-4 h-4 mr-2" /> {label}
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 relative overflow-x-hidden">
      <BackgroundAnimation />
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header Admin */}
      <div className="bg-primaryDark text-white pt-10 pb-16 px-4 md:px-8 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-6 md:gap-4">
          <div className="order-2 md:order-1 text-center md:text-left">
             <div className="flex items-center justify-center md:justify-start gap-2 text-primaryHover mb-1">
               <LayoutDashboard className="w-5 h-5" />
               <span className="uppercase tracking-widest text-[10px] md:text-xs font-bold">Painel Administrativo</span>
             </div>
             <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestão Financeira</h1>
          </div>
          <div className="order-1 md:order-2 flex justify-center z-10">
             <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-white/20 shadow-xl bg-white">
                <img src="/admin-logo.png" alt="Logo" className="w-full h-full object-contain" />
             </div>
          </div>
          <div className="order-3 md:order-3 flex justify-center md:justify-end">
            <Button variant="ghost" className="text-white border border-white/20 hover:bg-white hover:text-primary transition-colors py-2 px-4" onClick={onBack}>Sair do Admin</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-8 relative z-10">
        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input type="text" placeholder="Buscar por nome ou protocolo..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none shadow-sm transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full md:w-auto px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm text-sm font-bold text-slate-600 outline-none">
                <option value="all">MÊS (VENCIMENTO)</option>
                {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          {/* Abas com Scroll Otimizado */}
          <div className="relative w-full md:w-auto">
              <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none z-10 md:hidden"></div>
              <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none z-10 md:hidden"></div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory px-4 md:px-0">
                 {['all', 'approved', 'paid', 'rejected'].map((status) => (
                   <button 
                      key={status} 
                      onClick={() => setStatusFilter(status as any)} 
                      className={`min-h-[40px] px-5 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap snap-start ${statusFilter === status ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
                   >
                     {status === 'all' ? 'Recebidos' : status === 'approved' ? 'A pagar' : STATUS_CONFIG[status as RequestStatus].label}
                   </button>
                 ))}
                 <button onClick={loadData} className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-primary transition-all shrink-0"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
              </div>
          </div>
        </div>

        {/* Desktop: Tabela de Solicitações */}
        <div className="hidden md:block bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4">Protocolo / Vencimento</th>
                   <th className="px-6 py-4">Solicitante</th>
                   <th className="px-6 py-4 text-right">Valor</th>
                   <th className="px-6 py-4 text-center">Detalhes</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {sortedRequests.length > 0 ? sortedRequests.map(req => {
                   const count = getAttachmentCount(req);
                   return (
                   <tr key={req.id} className="hover:bg-primary/5 transition-colors group">
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${STATUS_CONFIG[req.status].color}`}>
                                {STATUS_CONFIG[req.status].icon} {STATUS_CONFIG[req.status].label}
                            </span>
                            {isIssue(req) && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                            {req.closedAt && <span className="w-2 h-2 rounded-full bg-slate-400" title="Atendimento Encerrado"></span>}
                        </div>
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex items-center gap-2 mb-1">
                          <div className="font-mono text-sm font-black text-slate-900">{req.id}</div>
                          {count > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-base font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                               <Paperclip className="w-3.5 h-3.5" /> {count}
                            </span>
                          )}
                       </div>
                       <div className="text-[10px] text-slate-500 font-bold">VENCE: {new Date(req.dueDate).toLocaleDateString('pt-BR')}</div>
                     </td>
                     <td className="px-6 py-4 font-bold text-slate-900 text-sm">{req.requesterName}</td>
                     <td className="px-6 py-4 text-right font-black text-slate-900 text-base">{formatCurrency(req.value)}</td>
                     <td className="px-6 py-4 text-center">
                       <button onClick={() => { setSelectedRequest(req); setRejectionReason(''); }} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"><Eye className="w-6 h-6" /></button>
                     </td>
                   </tr>
                 )}) : <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">Nenhuma solicitação filtrada.</td></tr>}
               </tbody>
             </table>
           </div>
        </div>

        {/* Mobile: Lista de Cards */}
        <div className="md:hidden space-y-4">
          {sortedRequests.length > 0 ? sortedRequests.map(req => {
            const count = getAttachmentCount(req);
            return (
              <div key={req.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${STATUS_CONFIG[req.status].color}`}>
                      {STATUS_CONFIG[req.status].icon} {STATUS_CONFIG[req.status].label}
                    </span>
                    {isIssue(req) && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    {req.closedAt && <span className="w-2 h-2 rounded-full bg-slate-400"></span>}
                  </div>
                  <button onClick={() => { setSelectedRequest(req); setRejectionReason(''); }} className="p-2 text-primary bg-primary/5 rounded-lg active:scale-95 transition-all"><Eye className="w-5 h-5" /></button>
                </div>
                
                <div className="flex justify-between items-start gap-2">
                  <div className="overflow-hidden">
                    <div className="font-mono text-sm font-black text-slate-900 truncate">{req.id}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Vencimento: {new Date(req.dueDate).toLocaleDateString('pt-BR')}</div>
                  </div>
                  {count > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                      <Paperclip className="w-3 h-3" /> {count}
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-50 flex justify-between items-end">
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Solicitante</span>
                    <span className="font-bold text-slate-900 text-sm leading-tight block">{req.requesterName}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Valor</span>
                    <span className="font-black text-slate-900 text-lg leading-tight block">{formatCurrency(req.value)}</span>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-12 text-center text-slate-400 font-medium bg-white rounded-2xl border border-dashed border-slate-200">
              Nenhuma solicitação encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tighter">
                 {selectedRequest.id} 
                 <button 
                  onClick={() => { 
                    navigator.clipboard.writeText(selectedRequest.id); 
                    setCopiedProtocol(true);
                    setTimeout(() => setCopiedProtocol(false), 2000);
                    toast.success('Protocolo copiado!'); 
                  }} 
                  className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-white shadow-sm border border-transparent hover:border-slate-100"
                >
                  {copiedProtocol ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
               </h2>
               <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-danger p-2 rounded-full hover:bg-red-50 transition-colors"><X className="w-6 h-6" /></button>
             </div>
             
             <div className="p-8 overflow-y-auto space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <h3 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Identificação</h3>
                    <div><span className="block text-xs text-slate-400 font-bold uppercase mb-1">Valor</span> <span className="text-2xl font-black text-primary">{formatCurrency(selectedRequest.value)}</span></div>
                    <div><span className="block text-xs text-slate-400 font-bold uppercase mb-1">Fornecedor</span> <span className="font-bold text-slate-800">{selectedRequest.supplierName}</span></div>
                    <div><span className="block text-xs text-slate-400 font-bold uppercase mb-1">Vencimento</span> <span className="font-bold text-slate-800">{new Date(selectedRequest.dueDate).toLocaleString('pt-BR')}</span></div>
                  </div>
                  <div className="space-y-5">
                    <h3 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Pagamento</h3>
                    <div><span className="block text-xs text-slate-400 font-bold uppercase mb-1">Forma</span> <span className="font-black text-slate-800 px-3 py-1 bg-slate-100 rounded-lg">{selectedRequest.paymentMethod}</span></div>
                    {selectedRequest.paymentMethod === 'PIX' && (
                        <div><span className="block text-xs text-slate-400 font-bold uppercase mb-1">Chave PIX</span> <span className="font-bold text-slate-800 break-all">{selectedRequest.pixKey || 'N/A'}</span></div>
                    )}
                  </div>
               </div>

               <div className="space-y-4 pt-6 border-t border-slate-100">
                  <h3 className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center gap-2">
                    <Paperclip className="w-4 h-4" /> Arquivos Anexados
                  </h3>
                  <div className="grid grid-cols-1 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    {renderAttachmentLinks(selectedRequest.invoiceUrl, 'Nota Fiscal', selectedRequest.id)}
                    {renderAttachmentLinks(selectedRequest.boletoUrl, 'Boleto Bancário', selectedRequest.id)}
                    {selectedRequest.paymentMethod === 'Transferência' && renderAttachmentLinks(selectedRequest.transferUrl, 'Dados de Transferência', selectedRequest.id)}
                  </div>
               </div>

               {selectedRequest.status === 'paid' && (
                 <div className="space-y-4 pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[10px] uppercase font-black text-primary tracking-widest flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Comprovante de Pagamento
                        </h3>
                        {(selectedRequest as any).paymentReceiptUrl && (
                          <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1 animate-in fade-in duration-300">
                            Comprovante enviado ✅
                          </p>
                        )}
                      </div>
                      
                      {selectedRequest.closedAt && (
                        <span className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg">Atendimento Encerrado</span>
                      )}
                    </div>

                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-primary/20">
                      {(selectedRequest as any).paymentReceiptUrl ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-primary/10 shadow-sm">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                <span className="text-sm font-bold text-slate-700">Comprovante de Pagamento</span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                  onClick={() => setPreviewData({ url: (selectedRequest as any).paymentReceiptUrl, title: `Comprovante - ${selectedRequest.id}` })}
                                  className="px-4 py-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-all"
                                >Visualizar</button>
                                <button 
                                  onClick={() => handleDownloadFile((selectedRequest as any).paymentReceiptUrl, 'Comprovante', selectedRequest.id)}
                                  className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                                >Baixar</button>
                            </div>
                          </div>
                          
                          {!selectedRequest.closedAt && (
                              <div className="pt-4 flex flex-col items-center gap-2">
                                <Button 
                                    fullWidth size="sm" 
                                    onClick={handleCloseAtendimento} 
                                    disabled={isUpdating}
                                    className="bg-slate-900 text-white font-black uppercase tracking-widest text-[11px] shadow-xl shadow-slate-900/20"
                                >
                                    Encerrar Atendimento
                                </Button>
                                <label className="block cursor-pointer text-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400 hover:text-primary transition-colors">Substituir comprovante?</span>
                                    <input type="file" className="sr-only" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                                </label>
                              </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                           <label className="border-2 border-dashed border-primary/20 bg-white rounded-2xl p-6 text-center hover:border-primary/40 transition-colors cursor-pointer block">
                              <input type="file" className="sr-only" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                              <div className="flex flex-col items-center gap-2">
                                 <UploadCloud className="w-8 h-8 text-primary/40" />
                                 <p className="font-bold text-slate-600 text-xs">
                                   {receiptFile ? receiptFile.name : 'Selecione o arquivo do comprovante'}
                                 </p>
                              </div>
                           </label>
                           {receiptFile && (
                             <Button 
                                fullWidth size="sm" 
                                onClick={handleUploadReceipt} 
                                disabled={isUploadingReceipt}
                                className="bg-primary text-white font-black uppercase tracking-widest text-[10px]"
                             >
                               {isUploadingReceipt ? 'Enviando...' : 'Enviar Comprovante de Pagamento'}
                             </Button>
                           )}
                           <p className="text-[10px] text-center text-slate-400 italic">Envie o comprovante para habilitar o encerramento do atendimento.</p>
                        </div>
                      )}
                    </div>
                 </div>
               )}

               {selectedRequest.status !== 'paid' && (
                 <div className="space-y-3">
                   <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Observações da Rejeição</label>
                   <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Descreva o motivo caso vá rejeitar esta solicitação..." rows={3} className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-sm focus:ring-4 focus:ring-primary/5 outline-none transition-all bg-white" />
                 </div>
               )}
               
               <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                 <h3 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Descrição do Solicitante</h3>
                 <p className="text-slate-600 text-sm font-medium leading-relaxed italic">"{selectedRequest.description}"</p>
               </div>
             </div>
             
             <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col gap-5">
               <div className="flex flex-wrap justify-center items-center gap-4">
                 {renderRevertButton()}
                 {!selectedRequest.closedAt && (
                   <>
                    <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'approved')} disabled={isUpdating} className="font-bold min-w-[140px]">Aprovar Pagamento</Button>
                    <Button variant="primary" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'paid')} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700 font-bold min-w-[140px]">Marcar como Pago</Button>
                   </>
                 )}
               </div>
               
               <div className="flex justify-center pt-2">
                 {!selectedRequest.closedAt && (
                    <Button variant="danger" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')} disabled={isUpdating || rejectionReason.trim().length < 5} className="font-bold w-full md:w-auto md:min-w-[280px]">Rejeitar Pedido</Button>
                 )}
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Modal de Preview de Arquivo */}
      {previewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl h-full max-h-full rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
             <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                   <FileText className="w-6 h-6 text-primary" />
                 </div>
                 <h3 className="font-black text-slate-900 tracking-tight">{previewData.title}</h3>
               </div>
               <button 
                  onClick={() => setPreviewData(null)} 
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-danger transition-all"
                >
                 <X className="w-4 h-4" /> Fechar Visualização
               </button>
             </div>
             <div className="flex-1 bg-slate-100 overflow-hidden relative">
                {previewData.url.toLowerCase().includes('.pdf') || previewData.url.includes('blob') ? (
                  <iframe 
                    src={`${previewData.url}#toolbar=0&navpanes=0`} 
                    className="w-full h-full border-0" 
                    title="PDF Preview"
                  />
                ) : (
                  <div className="w-full h-full overflow-auto p-10 flex items-center justify-center">
                    <img 
                      src={previewData.url} 
                      alt="Preview" 
                      className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border-8 border-white" 
                    />
                  </div>
                )}
             </div>
             <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                <button 
                  onClick={() => {
                    const parts = previewData.title.split(' - ');
                    handleDownloadFile(previewData.url, parts[0], parts[1]);
                  }}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                >
                  <Download className="w-5 h-5" /> Baixar este arquivo agora
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};