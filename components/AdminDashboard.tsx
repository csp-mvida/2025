import React, { useState, useEffect } from 'react';
import { CSPRequest, RequestStatus } from '../types';
import { getRequests, approveRequest, rejectRequest, markAsPaid, subscribeToRequests } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { Button } from './ui/Button';
import { supabase } from '../src/integrations/supabase/client';
import { 
  Search, Filter, Eye, CheckCircle, AlertTriangle, X, 
  Clock, LayoutDashboard, RefreshCw, FileText, Download 
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
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await getRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const subscription = subscribeToRequests(loadData);
    return () => { subscription.unsubscribe(); };
  }, []);

  const handleAction = async (action: 'approve' | 'reject' | 'pay') => {
    if (!selectedRequest) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let success = false;
    if (action === 'approve') success = await approveRequest(selectedRequest.id, user.id);
    if (action === 'reject') {
      if (!rejectionReason) return;
      success = await rejectRequest(selectedRequest.id, user.id, rejectionReason);
      setShowRejectModal(false);
    }
    if (action === 'pay') success = await markAsPaid(selectedRequest.id);

    if (success) {
      setSelectedRequest(null);
      setRejectionReason('');
    }
  };

  const getAnexos = (req: CSPRequest) => {
    const list = [];
    if (req.invoiceUrl && req.invoiceUrl !== 'Pendente via WhatsApp') {
      try { list.push({ label: 'NF', urls: JSON.parse(req.invoiceUrl) }); } catch { list.push({ label: 'NF', urls: [req.invoiceUrl] }); }
    }
    if (req.boletoUrl) {
      try { list.push({ label: 'Boleto', urls: JSON.parse(req.boletoUrl) }); } catch { list.push({ label: 'Boleto', urls: [req.boletoUrl] }); }
    }
    if (req.transferUrl) {
      try { list.push({ label: 'Comprovante Banco', urls: JSON.parse(req.transferUrl) }); } catch { list.push({ label: 'Comprovante Banco', urls: [req.transferUrl] }); }
    }
    return list;
  };

  const filtered = requests.filter(r => (statusFilter === 'all' || r.status === statusFilter) && (r.id.includes(searchTerm.toUpperCase()) || r.requesterName.toLowerCase().includes(searchTerm.toLowerCase())));

  return (
    <div className="min-h-screen bg-slate-50 relative pb-20">
      <BackgroundAnimation />
      <div className="bg-primaryDark text-white pt-10 pb-16 px-8 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Financeiro</h1>
            <p className="text-emerald-300 text-sm">Gestão de solicitações de pagamento</p>
          </div>
          <Button variant="outline" className="text-white border-white/20" onClick={onBack}>Sair</Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 -mt-8 relative z-10">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Protocolo ou Solicitante..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select label="" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-48 !mb-0">
            <option value="all">Todos Status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="paid">Pago</option>
            <option value="rejected">Rejeitado</option>
          </Select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-4">Protocolo</th>
                <th className="px-6 py-4">Solicitante</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(req => (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-sm font-bold">{req.id}</td>
                  <td className="px-6 py-4">{req.requesterName}</td>
                  <td className="px-6 py-4 text-right font-bold text-primary">{formatCurrency(req.value)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CONFIG[req.status].color}`}>
                      {STATUS_CONFIG[req.status].icon} {STATUS_CONFIG[req.status].label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => setSelectedRequest(req)} className="p-2 text-slate-400 hover:text-primary"><Eye className="w-5 h-5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold">{selectedRequest.id}</h2>
              <button onClick={() => setSelectedRequest(null)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-[10px] uppercase text-slate-400 font-bold">Solicitante</span><p className="font-bold">{selectedRequest.requesterName}</p></div>
                <div><span className="text-[10px] uppercase text-slate-400 font-bold">Valor</span><p className="font-bold text-primary text-lg">{formatCurrency(selectedRequest.value)}</p></div>
                <div className="col-span-2"><span className="text-[10px] uppercase text-slate-400 font-bold">Forma</span><p className="font-bold">{selectedRequest.paymentMethod}</p></div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Anexos</span>
                <div className="flex flex-wrap gap-2">
                  {getAnexos(selectedRequest).map((group, i) => group.urls.map((url: string, j: number) => (
                    <a key={`${i}-${j}`} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-slate-100 rounded text-xs font-bold text-primary hover:bg-primary/10">
                      <Download className="w-3 h-3" /> {group.label} {j+1}
                    </a>
                  )))}
                  {!getAnexos(selectedRequest).length && <p className="text-xs text-slate-400 italic">Nenhum anexo disponível</p>}
                </div>
              </div>
              {selectedRequest.rejectionReason && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <span className="text-[10px] uppercase text-red-400 font-bold">Motivo da Rejeição</span>
                  <p className="text-red-700 text-sm">{selectedRequest.rejectionReason}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex gap-2 justify-end">
              {selectedRequest.status === 'pending' && (
                <>
                  <Button variant="danger" size="sm" onClick={() => setShowRejectModal(true)}>Rejeitar</Button>
                  <Button variant="primary" size="sm" onClick={() => handleAction('approve')}>Aprovar</Button>
                </>
              )}
              {selectedRequest.status === 'approved' && <Button variant="primary" size="sm" onClick={() => handleAction('pay')}>Marcar Pago</Button>}
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white w-full max-w-md rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4">Motivo da Rejeição</h3>
            <textarea className="w-full p-3 border rounded-lg h-32 mb-4" placeholder="Descreva o motivo..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
              <Button variant="danger" size="sm" disabled={!rejectionReason} onClick={() => handleAction('reject')}>Confirmar Rejeição</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Select = ({ label, value, onChange, children, className }: any) => (
  <div className={`mb-4 ${className}`}>
    {label && <label className="block text-xs font-bold text-slate-400 mb-1">{label}</label>}
    <select value={value} onChange={onChange} className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium">
      {children}
    </select>
  </div>
);