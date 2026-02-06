import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { 
  formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, 
  formatCpfCnpj, isValidCpfCnpj, isValidAccountOrAgency 
} from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, 
  submitRequest, uploadInvoice, createDraftRequest, updateRequestAttachments, getRequestByProtocol,
  getSession 
} from './services/api';
import { supabase } from './src/integrations/supabase/client';

// Components
import { Stepper } from './components/Stepper';
import { Button } from './components/ui/Button';
import { Input, Select, Textarea } from './components/ui/Input';
import { UrgencyAlert } from './components/UrgencyAlert';
import { OrientationDrawer } from './components/OrientationDrawer';
import { 
  CheckCircle, UploadCloud, FileText, 
  ChevronRight, ChevronLeft, AlertTriangle, RefreshCw, 
  Home, Lock, Copy, Search, Trash2, Save, Info, Clock, X
} from './components/ui/Icons';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginAdmin } from './components/LoginAdmin';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { RequestTracker } from './components/RequestTracker';

const SPECIFIC_BUDGET_OPTIONS = [
  "Casa do Profeta", "Convênio Triagem", "Convênio CEV", "Fazenda", "Granja", "Veículos", "Verba Pr. Douglas", "Verba Pr. João", "Outros"
];

function App() {
  const [view, setView] = useState<'welcome' | 'form' | 'login' | 'admin' | 'track'>('welcome');
  const [session, setSession] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<CSPFormData>({ ...INITIAL_DATA });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [authorizers, setAuthorizers] = useState<{ id: string; name: string }[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; label: string }[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 
  const [isUploadingBoleto, setIsUploadingBoleto] = useState(false);
  const [isUploadingTransfer, setIsUploadingTransfer] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false); 
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [showInvoiceCommitmentModal, setShowInvoiceCommitmentModal] = useState(false);
  const [currentProtocolId, setCurrentProtocolId] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  const isUrgent = checkUrgency(formData.dueDate);
  const getDateValue = () => formData.dueDate ? formData.dueDate.split('T')[0] : '';
  const getTimeValue = () => formData.dueDate && formData.dueDate.includes('T') ? formData.dueDate.split('T')[1].substring(0, 5) : '';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const createInitialDraft = useCallback(async (deptId: string, authId: string, accountId: string) => {
    const protocol = await createDraftRequest(deptId, authId, accountId);
    if (protocol) {
      setCurrentProtocolId(protocol);
      localStorage.setItem('csp_draft', JSON.stringify({ ...formData, id: protocol }));
    } else {
      setInitializationAttempts(prev => prev + 1);
    }
  }, [formData]);

  useEffect(() => {
    const loadData = async () => {
      const [depts, auths, accounts] = await Promise.all([
        fetchDepartments(), fetchAuthorizers(), fetchPaymentAccounts()
      ]);
      setDepartments(depts); setAuthorizers(auths); setPaymentAccounts(accounts);
      setIsDataLoaded(true);
    };
    loadData();
    if (localStorage.getItem('csp_draft')) setHasSavedDraft(true);
  }, []);

  useEffect(() => {
    if (!isDataLoaded || view !== 'form' || currentProtocolId || departments.length === 0 || authorizers.length === 0 || paymentAccounts.length === 0) return;
    const initializeProtocol = async () => {
      const savedDraft = localStorage.getItem('csp_draft');
      let protocolToUse = '';
      if (savedDraft) {
        const loaded = JSON.parse(savedDraft);
        if (loaded.id) {
          const exists = await getRequestByProtocol(loaded.id);
          if (exists && exists.status === 'draft') {
            protocolToUse = exists.id;
            setFormData(loaded);
            setHasSavedDraft(true);
          } else {
            localStorage.removeItem('csp_draft');
            setHasSavedDraft(false);
          }
        }
      }
      if (!protocolToUse) {
        await createInitialDraft(departments[0].id, authorizers[0].id, paymentAccounts[0].id);
      } else {
        setCurrentProtocolId(protocolToUse);
      }
    };
    if (initializationAttempts < 2) initializeProtocol();
    else toast.error('Erro ao iniciar formulário.');
  }, [isDataLoaded, view, currentProtocolId, departments, authorizers, paymentAccounts, createInitialDraft, initializationAttempts]);

  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => {
        const newState = { ...prev, [field]: value };
        if (field === 'paymentMethod') {
            newState.pixKey = ''; newState.boletoUrl = ''; newState.boletoUrls = []; newState.boletoFilesMeta = [];
            newState.transferBankName = ''; newState.transferAccountType = ''; newState.transferAgency = '';
            newState.transferAccount = ''; newState.transferCpfCnpj = ''; newState.transferBeneficiaryName = '';
            newState.transferUrl = ''; newState.transferUrls = []; newState.transferFilesMeta = [];
        }
        if (field === 'transferCpfCnpj') newState.transferCpfCnpj = formatCpfCnpj(value);
        return newState;
    });
    if (errors[field]) setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentProtocolId) return;
    const isInvoice = type === 'invoice'; const isBoleto = type === 'boleto'; const isTransfer = type === 'transfer';
    const toastId = toast.loading(`Enviando ${files.length} arquivo(s)...`);
    if (isInvoice) setIsUploading(true); else if (isBoleto) setIsUploadingBoleto(true); else if (isTransfer) setIsUploadingTransfer(true);
    try {
      const newUrls = isInvoice ? [...(formData.invoiceUrls || [])] : isBoleto ? [...(formData.boletoUrls || [])] : [...(formData.transferUrls || [])];
      const newMeta = isInvoice ? [...(formData.invoiceFilesMeta || [])] : isBoleto ? [...(formData.boletoFilesMeta || [])] : [...(formData.transferFilesMeta || [])];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadInvoice(files[i], type, currentProtocolId);
        newUrls.push(url); newMeta.push({ name: files[i].name, size: files[i].size, url });
      }
      const serialized = JSON.stringify(newUrls);
      if (isInvoice) { setFormData(prev => ({ ...prev, invoiceUrls: newUrls, invoiceFilesMeta: newMeta, invoiceUrl: serialized })); await updateRequestAttachments(currentProtocolId, 'invoice', serialized); }
      else if (isBoleto) { setFormData(prev => ({ ...prev, boletoUrls: newUrls, boletoFilesMeta: newMeta, boletoUrl: serialized })); await updateRequestAttachments(currentProtocolId, 'boleto', serialized); }
      else if (isTransfer) { setFormData(prev => ({ ...prev, transferUrls: newUrls, transferFilesMeta: newMeta, transferUrl: serialized })); await updateRequestAttachments(currentProtocolId, 'transfer', serialized); }
      toast.success('Arquivos enviados!', { id: toastId });
    } catch (error) { toast.error('Falha no upload.', { id: toastId }); } finally { setIsUploading(false); setIsUploadingBoleto(false); setIsUploadingTransfer(false); }
  };

  const validateStep = (s: number) => {
    const errs: ValidationErrors = {};
    if (s === 0) {
      if (!formData.requesterName) errs.requesterName = "Obrigatório";
      if (!isValidPhone(formData.whatsapp)) errs.whatsapp = "Inválido";
      if (!formData.departmentId) errs.departmentId = "Obrigatório";
      if (!formData.authorizer) errs.authorizer = "Obrigatório";
      if (!formData.dueDate) errs.dueDate = "Obrigatório";
    }
    if (s === 1) {
      if (!formData.paymentAccount) errs.paymentAccount = "Obrigatório";
      if (!formData.supplierName) errs.supplierName = "Obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) errs.value = "Obrigatório";
      if (!formData.paymentMethod) errs.paymentMethod = "Obrigatório";
    }
    setErrors(errs); return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateStep(4) || !currentProtocolId) return;
    setIsSubmitting(true);
    const authId = authorizers.find(a => a.name === formData.authorizer)?.id;
    const accId = paymentAccounts.find(p => p.label === formData.paymentAccount)?.id;
    if (authId && accId && await submitRequest(formData, currentProtocolId, authId, accId, isUrgent)) {
      setGeneratedId(currentProtocolId); setIsSuccess(true); localStorage.removeItem('csp_draft');
    } else toast.error('Erro ao enviar.');
    setIsSubmitting(false);
  };

  if (view === 'login' || (view === 'admin' && !session)) return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return (
    <div className="min-h-screen relative bg-slate-50 flex items-center justify-center p-4">
      <Toaster position="top-right" /> <BackgroundAnimation />
      <div className="bg-white border-b border-slate-100 py-2 fixed top-0 w-full z-50 text-center text-xs text-slate-400">CSP | Central de Pagamento</div>
      <RequestTracker initialProtocol={generatedId} onBack={() => setView('welcome')} departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} />
    </div>
  );

  if (view === 'welcome') return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 overflow-x-hidden">
      <Toaster position="top-right" /> <BackgroundAnimation /> <OrientationDrawer isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <header className="relative z-30"><div className="bg-primary py-2 px-6 flex items-center justify-between h-14">
        <button onClick={() => setView('login')} className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest"><Lock className="w-4 h-4" /> {session ? 'Painel' : 'Acesso'}</button>
        <button onClick={() => setIsInfoOpen(true)} className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest"><Info className="w-4 h-4" /> Regras</button>
      </div></header>
      <div className="max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center p-8 text-center">
        <img src="/logo.png" alt="Logo" className="h-24 mb-12" />
        <h1 className="text-4xl md:text-7xl font-bold text-slate-900 tracking-tighter mb-6">Sua plataforma de <span className="text-primary italic">pagamentos.</span></h1>
        <div className="flex flex-col gap-4 w-full max-w-sm px-4">
          <Button size="lg" onClick={() => setView('form')} className="rounded-2xl py-6 font-black shadow-2xl">Criar Solicitação</Button>
          <Button variant="outline" size="lg" onClick={() => setView('track')} className="rounded-2xl py-6 font-bold">Acompanhar Status</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16">
      <Toaster position="top-right" /> <BackgroundAnimation />
      <div className="bg-white border-b border-slate-100 py-2 fixed top-0 w-full z-50 text-center text-xs text-slate-400">CSP | Central de Pagamento</div>
      <main className="flex-1 flex flex-col items-center p-8">
        {!isSuccess ? (
          <div className="w-full max-w-3xl animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('welcome')} className="text-slate-400 font-bold uppercase text-xs"><Home className="w-4 h-4" /></button>
              <div className="flex gap-4"><button onClick={() => localStorage.removeItem('csp_draft')} className="text-danger uppercase text-[10px] font-bold">Limpar</button></div>
            </div>
            <Stepper currentStep={step} />
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-50 mb-6">
              {step === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Responsável" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required />
                  <Input label="WhatsApp" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required />
                  <Select label="Departamento" value={formData.departmentId} onChange={e => handleChange('departmentId', e.target.value)} required>
                    <option value="">Selecione...</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                  <Select label="Autorizador" value={formData.authorizer} onChange={e => handleChange('authorizer', e.target.value)} required>
                    <option value="">Selecione...</option>{authorizers.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </Select>
                  <div className="md:col-span-2"><Input label="Vencimento" type="date" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T12:00`)} required /></div>
                </div>
              )}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Select label="Conta" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required>
                    <option value="">Selecione...</option>{paymentAccounts.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                  </Select>
                  <Input label="Fornecedor" value={formData.supplierName} onChange={e => handleChange('supplierName', e.target.value)} required />
                  <Input label="Valor" value={formatCurrency(formData.value)} onChange={e => handleChange('value', parseCurrency(e.target.value))} required />
                  <Select label="Método" value={formData.paymentMethod} onChange={e => handleChange('paymentMethod', e.target.value)} required>
                    <option value="">Selecione...</option><option value="PIX">PIX</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
                  </Select>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-8">
                  <label className="block text-sm font-bold text-center">Possui Nota Fiscal?</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleChange('hasInvoice', 'yes')} className={`p-6 rounded-2xl border-2 ${formData.hasInvoice === 'yes' ? 'border-primary' : 'border-slate-100'}`}>Sim</button>
                    <button onClick={() => handleChange('hasInvoice', 'no')} className={`p-6 rounded-2xl border-2 ${formData.hasInvoice === 'no' ? 'border-primary' : 'border-slate-100'}`}>Não</button>
                  </div>
                </div>
              )}
              {step === 3 && <Textarea label="Descrição" value={formData.description} onChange={e => handleChange('description', e.target.value)} required />}
              {step === 4 && <div className="text-center font-bold">Revise os dados antes de enviar.</div>}
            </div>
            <div className="flex justify-between items-center pt-4">
              <button onClick={() => setStep(s => s - 1)} className={`text-slate-400 font-bold ${step === 0 ? 'invisible' : ''}`}>Voltar</button>
              <Button onClick={step < 4 ? () => validateStep(step) && setStep(s => s + 1) : handleSubmit} disabled={isSubmitting}>{step < 4 ? 'Próximo' : 'Confirmar'}</Button>
            </div>
          </div>
        ) : (
          <div className="text-center p-12 bg-white rounded-[2.5rem] shadow-2xl">
            <CheckCircle className="w-20 h-20 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-black mb-4">Sucesso!</h2>
            <p className="text-slate-500 mb-8">Protocolo: <span className="text-slate-900 font-mono font-black">{generatedId}</span></p>
            <Button onClick={() => setView('welcome')}>Início</Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;