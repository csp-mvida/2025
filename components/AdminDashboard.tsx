import React, { useState, useEffect } from 'react';
import { CSPRequest, RequestStatus } from '../types';
import { getRequests, updateRequestStatus } from '../services/api';
import { formatCurrency, formatPhone } from '../utils/formatters';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { 
  Search, Filter, Eye, CheckCircle, AlertTriangle, X, 
  Clock, LayoutDashboard, RefreshCw, FileText 
} from './ui/Icons';
import { BackgroundAnimation } from './BackgroundAnimation';

interface AdminDashboardProps {
  onBack: () => void;
}

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Pendente', 
    color: 'bg-accent/10 text-accent border-accent/20', 
    icon: <Clock className="w-3 h-3" /> 
  },
  approved: { 
    label: 'Aprovado', 
    color: 'bg-primary/10 text-primary border-primary/20', 
    icon: <CheckCircle className="w-3 h-3" /> 
  },
  paid: { 
    label: 'Pago', 
    color: 'bg-primaryDark/10 text-primaryDark border-primaryDark/20', 
    icon: <CheckCircle className="w-3 h-3" /> 
  },
  rejected: { 
    label: 'Rejeitado', 
    color: 'bg-danger/10 text-danger border-danger/20', 
    icon: <X className="w-3 h-3" /> 
  },
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
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = statusFilter === 'all' || req.status === statusFilter;
    
    return matchesSearch && matchesFilter;
  });

  const totalValue = filteredRequests.reduce((acc, req) => {
    const val = parseFloat(req.value.replace(/[^0-9]/g, '')) / 100;
    return acc + val;
  }, 0);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 relative overflow-x-hidden">
      <BackgroundAnimation />
      
      {/* Admin Header */}
      <div className="bg-primaryDark text-white pt-10 pb-16 px-4 md:px-8 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-6 md:gap-4">
          
          {/* Left: Titles */}
          <div className="order-2 md:order-1 text-center md:text-left">
             <div className="flex items-center justify-center md:justify-start gap-2 text-primaryHover mb-1">
               <LayoutDashboard className="w-5 h-5" />
               <span className="uppercase tracking-widest text-[10px] md:text-xs font-bold">Painel Administrativo</span>
             </div>
             <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestão de Solicitações</h1>
          </div>

          {/* Center: Logo */}
          <div className="order-1 md:order-2 flex justify-center z-10">
             <img 
               src="/admin-logo.png" 
               alt="Missão Vida" 
               className="h-20 md:h-24 w-auto object-contain" 
             />
          </div>

          {/* Right: Action Button */}
          <div className="order-3 md:order-3 flex justify-center md:justify-end">
            <Button 
              variant="ghost" 
              className="text-white border border-white/20 hover:bg-white hover:text-primary hover:border-white/20 transition-colors py-2 px-4" 
              onClick={onBack}
            >
              Sair do Admin
            </Button>
          </div>
          
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-8 relative z-10">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
             <p className="text-sm text-slate-500 font-medium mb-1">Total Filtrado</p>
             <h3 className="text-2xl font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</h3>
           </div>
           <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
             <p className="text-sm text-slate-500 font-medium mb-1">Solicitações Pendentes</p>
             <div className="flex items-center gap-2">
               <h3 className="text-2xl font-bold text-accent">{pendingCount}</h3>
               {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-bold border border-accent/20">Ação necessária</span>}
             </div>
           </div>
           <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
             <p className="text-sm text-slate-500 font-medium mb-1">Total de Registros</p>
             <h3 className="text-2xl font-bold text-slate-900">{requests.length}</h3>
           </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por ID, Nome ou Fornecedor..." 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
             <Filter className="text-slate-400 w-5 h-5 shrink-0" />
             {(['all', 'pending', 'approved', 'paid', 'rejected'] as const).map(status => (
               <button
                 key={status}
                 onClick={() => setStatusFilter(status)}
                 className={`
                   px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border
                   ${statusFilter === status 
                     ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                     : 'bg-white/80 backdrop-blur-sm border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}
                 `}
               >
                 {status === 'all' ? 'Todos' : STATUS_CONFIG[status].label}
               </button>
             ))}
             <button onClick={loadData} className="p-2.5 rounded-lg bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all ml-auto" title="Atualizar">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4">ID / Data</th>
                   <th className="px-6 py-4">Solicitante</th>
                   <th className="px-6 py-4">Fornecedor</th>
                   <th className="px-6 py-4 text-right">Valor</th>
                   <th className="px-6 py-4 text-center">Ações</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {loading ? (
                   <tr>
                     <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Carregando dados...</td>
                   </tr>
                 ) : filteredRequests.length === 0 ? (
                    <tr>
                     <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhuma solicitação encontrada.</td>
                   </tr>
                 ) : (
                   filteredRequests.map(req => {
                     const status = STATUS_CONFIG[req.status];
                     return (
                       <tr key={req.id} className="hover:bg-primary/5 transition-colors group">
                         <td className="px-6 py-4">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                             {status.icon}
                             {status.label}
                           </span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="font-mono text-sm font-medium text-slate-900 group-hover:text-primary transition-colors">{req.id}</div>
                           <div className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="text-sm font-medium text-slate-900">{req.requesterName}</div>
                           <div className="text-xs text-slate-500 truncate max-w-[150px]">{req.description}</div>
                         </td>
                         <td className="px-6 py-4 text-sm text-slate-600">
                           {req.supplierName}
                         </td>
                         <td className="px-6 py-4 text-right font-medium text-slate-900">
                           {formatCurrency(req.value)}
                         </td>
                         <td className="px-6 py-4 text-center">
                           <button 
                             onClick={() => setSelectedRequest(req)}
                             className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                             title="Ver Detalhes"
                           >
                             <Eye className="w-5 h-5" />
                           </button>
                         </td>
                       </tr>
                     );
                   })
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             {/* Modal Header */}
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                   {selectedRequest.id}
                   <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${STATUS_CONFIG[selectedRequest.status].color}`}>
                     {STATUS_CONFIG[selectedRequest.status].label}
                   </span>
                 </h2>
                 <p className="text-xs text-slate-500">Criado em {new Date(selectedRequest.createdAt).toLocaleString('pt-BR')}</p>
               </div>
               <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                 <X className="w-6 h-6" />
               </button>
             </div>

             {/* Modal Body */}
             <div className="p-6 overflow-y-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Dados do Pagamento</h3>
                    <div><span className="block text-xs text-slate-500">Valor</span> <span className="text-xl font-bold text-primary">{formatCurrency(selectedRequest.value)}</span></div>
                    <div><span className="block text-xs text-slate-500">Fornecedor</span> <span className="font-medium text-slate-900">{selectedRequest.supplierName}</span></div>
                    <div><span className="block text-xs text-slate-500">Vencimento</span> <span className="font-medium text-accent">{new Date(selectedRequest.dueDate).toLocaleString('pt-BR')}</span></div>
                    <div><span className="block text-xs text-slate-500">Conta</span> <span className="text-slate-700">{selectedRequest.paymentAccount}</span></div>
                    <div><span className="block text-xs text-slate-500">Método</span> <span className="text-slate-700">{selectedRequest.paymentMethod}</span></div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Solicitante</h3>
                    <div><span className="block text-xs text-slate-500">Nome</span> <span className="font-medium text-slate-900">{selectedRequest.requesterName}</span></div>
                    <div><span className="block text-xs text-slate-500">WhatsApp</span> <span className="text-slate-700">{selectedRequest.whatsapp}</span></div>
                    <div><span className="block text-xs text-slate-500">Autorizador</span> <span className="text-slate-700">{selectedRequest.authorizer}</span></div>
                    <div><span className="block text-xs text-slate-500">Departamento ID</span> <span className="text-slate-700">{selectedRequest.departmentId}</span></div>
                    <div>
                      <span className="block text-xs text-slate-500 mb-1">Anexo</span> 
                      {selectedRequest.invoiceFileMeta ? (
                        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 text-sm text-primary">
                          <FileText className="w-4 h-4" /> {selectedRequest.invoiceFileMeta.name}
                        </div>
                      ) : (
                        <span className="text-accent text-sm italic flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Pendente (Enviar via Zap)
                        </span>
                      )}
                    </div>
                  </div>
               </div>
               
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                 <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Descrição</h3>
                 <p className="text-slate-700 text-sm leading-relaxed">{selectedRequest.description}</p>
               </div>
             </div>

             {/* Modal Footer Actions */}
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
               {selectedRequest.status === 'rejected' && (
                 <Button variant="ghost" size="sm" onClick={() => handleStatusUpdate(selectedRequest.id, 'pending')}>Reabrir</Button>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};