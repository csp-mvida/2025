import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { URGENCY_THRESHOLD_HOURS, SPECIFIC_BUDGET_OPTIONS } from './constants';
import { 
  formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, 
  formatCpfCnpj, isValidCpfCnpj, isValidAccountOrAgency 
} from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, 
  submitRequest, uploadInvoice, createDraftRequest, getRequestByProtocol,
  supabase 
} from './services/api';

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
}
from './components/ui/Icons';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginAdmin } from './components/LoginAdmin';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { RequestTracker } from './components/RequestTracker';
import { ResetPasswordPage } from './src/components/ResetPasswordPage';
import { ForgotPasswordPage } from './src/components/ForgotPasswordPage';
import { RequesterAccessModal } from './src/components/RequesterAccessModal';
import { RequesterDashboard } from './src/components/RequesterDashboard';

function App() {
  const [view, setView] = useState<'welcome' | 'form' | 'login' | 'admin' | 'track' | 'forgot-password' | 'requester-home'>('welcome');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<CSPFormData>({ ...INITIAL_DATA });
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  const routePath = useMemo(() => window.location.pathname, []);
  
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [boletoFiles, setBoletoFiles] = useState<File[]>([]);
  const [transferFiles, setTransferFiles] = useState<File[]>([]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [authorizers, setAuthorizers] = useState<{ id: string; name: string }[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; label: string }[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  const [currentProtocolId, setCurrentProtocolId] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  const isUrgent = checkUrgency(formData.dueDate);

  const getDateValue = () => formData.dueDate ? formData.dueDate.split('T')[0] : '';

  const createInitialDraft = useCallback(async (deptId: string, authId: string, accountId: string) => {
    const protocol = await createDraftRequest(deptId, authId, accountId);
    if (protocol) setCurrentProtocolId(protocol);
    else setInitializationAttempts(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (routePath === '/reset-password') return;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession && view === 'welcome') setView('requester-home');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (!currentSession && (view === 'requester-home' || view === 'form')) {
        setView('welcome');
      }
    });

    return () => subscription.unsubscribe();
  }, [routePath, view]);

  useEffect(() => {
    if ((view === 'requester-home' || view === 'form') && !session && isDataLoaded) {
      setView('welcome');
    }
  }, [view, session, isDataLoaded]);

  useEffect(() => {
    if (routePath === '/reset-password') return;
    const loadData = async () => {
      const [depts, auths, accounts] = await Promise.all([
        fetchDepartments(),
        fetchAuthorizers(),
        fetchPaymentAccounts()
      ]);
      setDepartments(depts);
      setAuthorizers(auths);
      setPaymentAccounts(accounts);
      setIsDataLoaded(true);
    };
    loadData();
  }, [routePath]);

  useEffect(() => {
    if (routePath === '/reset-password') return;
    if (!isDataLoaded || view !== 'form' || currentProtocolId || departments.length === 0 || authorizers.length === 0 || paymentAccounts.length === 0) return;

    if (initializationAttempts < 2) {
      createInitialDraft(departments[0].id, authorizers[0].id, paymentAccounts[0].id);
    }
  }, [routePath, isDataLoaded, view, currentProtocolId, departments, authorizers, paymentAccounts, createInitialDraft, initializationAttempts]);

  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = Array.from(e.target.files || []);
    if (type === 'invoice') setInvoiceFiles(prev => [...prev, ...files]);
    else if (type === 'boleto') setBoletoFiles(prev => [...prev, ...files]);
    else if (type === 'transfer') setTransferFiles(prev => [...prev, ...files]);
  };

  const validateStep = (s: number) => {
    const errs: ValidationErrors = {};
    if (s === 0) {
      if (!formData.requesterName) errs.requesterName = "Responsável é obrigatório";
      if (!isValidPhone(formData.whatsapp)) errs.whatsapp = "WhatsApp inválido";
      if (!formData.departmentId) errs.departmentId = "Departamento é obrigatório";
      if (!formData.authorizer) errs.authorizer = "Autorizador é obrigatório";
      if (!formData.dueDate) errs.dueDate = "Vencimento é obrigatório";
    }
    if (s === 1) {
      if (!formData.paymentAccount) errs.paymentAccount = "Conta é obrigatória";
      if (!formData.supplierName) errs.supplierName = "Fornecedor é obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) errs.value = "Valor é obrigatório";
      if (!formData.paymentMethod) errs.paymentMethod = "Forma é obrigatória";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => validateStep(step) && setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const toastId = toast.loading('Enviando...');
    try {
      const selectedAuthorizer = authorizers.find(a => a.name === formData.authorizer);
      const selectedAccount = paymentAccounts.find(p => p.label === formData.paymentAccount);
      if (await submitRequest(formData, currentProtocolId, selectedAuthorizer!.id, selectedAccount!.id, isUrgent)) {
        setGeneratedId(currentProtocolId);
        setIsSuccess(true);
        toast.success('Enviada!', { id: toastId });
      }
    } catch (err) {
      toast.error('Erro.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_DATA });
    setStep(0);
    setIsSuccess(false);
    setView('requester-home');
  };

  const renderHeader = () => (
    <div className="bg-white border-b border-slate-100 py-3 px-6 flex justify-center fixed top-0 w-full z-50">
      <div className="text-[12px] font-medium text-slate-400 tracking-tight">CSP | <span className="text-slate-600">Central de Solicitação de Pagamento</span></div>
    </div>
  );

  const renderView = () => {
    if (routePath === '/reset-password') return <ResetPasswordPage />;
    if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} onForgotPassword={() => setView('forgot-password')} />;
    if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
    if (view === 'requester-home') return <RequesterDashboard onNewRequest={() => setView('form')} onViewHistory={() => setView('track')} onLogout={() => setView('welcome')} />;
    if (view === 'track') return (
      <div className="min-h-screen relative bg-slate-50 flex items-center justify-center p-6">
        <BackgroundAnimation />
        <RequestTracker 
          departments={departments} 
          authorizers={authorizers} 
          paymentAccounts={paymentAccounts} 
          onBack={() => setView(session ? 'requester-home' : 'welcome')} 
        />
      </div>
    );

    if (view === 'welcome') return (
      <div className="min-h-[100dvh] relative flex flex-col bg-slate-50 overflow-y-auto">
        <BackgroundAnimation />
        <RequesterAccessModal isOpen={isAccessModalOpen} onClose={() => setIsAccessModalOpen(false)} onLoginSuccess={() => setView('requester-home')} />
        <OrientationDrawer isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
        
        <header className="relative z-30 shrink-0">
          <div className="bg-primary py-2 px-4 md:px-6 flex items-center shadow-lg h-12 md:h-14">
            <div className="flex items-center w-full justify-between gap-2">
              <div className="hidden md:block w-40" />
              <button onClick={() => setView('login')} className="flex items-center gap-1.5 text-emerald-300 font-black text-[9px] md:text-xs uppercase tracking-[0.1em] md:tracking-[0.2em] hover:text-white transition-colors">
                <Lock className="w-3.5 h-3.5 md:w-4 h-4" /> Administração
              </button>
              <button onClick={() => setIsInfoOpen(true)} className="flex items-center gap-1.5 text-white font-black text-[9px] md:text-[10px] uppercase tracking-[0.1em] md:tracking-[0.2em] md:w-40 justify-end hover:text-emerald-100 transition-colors">
                <Info className="w-3.5 h-3.5 md:w-4 h-4" /> Regras e Prazos
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10 text-center">
          <img src="/logo.png" alt="Logo" className="h-14 sm:h-16 md:h-24 mb-6 md:mb-12 drop-shadow-2xl animate-fade-up shrink-0" />
          <h1 className="text-3xl sm:text-4xl md:text-7xl font-bold text-slate-900 tracking-tighter mb-3 md:mb-6 animate-fade-up leading-[1.1] md:leading-tight">
            Sua plataforma de <br />
            <span className="text-primary italic font-black">pagamentos.</span>
          </h1>
          <p className="text-sm sm:text-base md:text-xl text-slate-500 font-medium mb-8 md:mb-14 animate-fade-up max-w-[260px] sm:max-w-xs md:max-w-none">
            Envie suas solicitações de forma guiada e segura.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[280px] md:max-w-sm animate-fade-up shrink-0">
            <Button size="lg" onClick={() => setIsAccessModalOpen(true)}>Criar Solicitação</Button>
            <Button variant="outline" size="lg" onClick={() => setView('track')}>Acompanhar Solicitação</Button>
          </div>
        </div>
      </div>
    );

    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col pt-16">
        <BackgroundAnimation />
        {renderHeader()}
        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          {!isSuccess ? (
            <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 duration-700">
              <div className="flex justify-between items-center mb-6">
                <button 
                  onClick={() => setView(session ? 'requester-home' : 'welcome')} 
                  className="flex items-center gap-1.5 text-slate-400 hover:text-primary text-xs font-bold uppercase tracking-widest"
                >
                  <ChevronLeft className="w-4 h-4" /> {session ? 'Dashboard' : 'Início'}
                </button>
              </div>
              <Stepper currentStep={step} />
              <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-50 mb-6">
                {step === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Responsável" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required error={errors.requesterName} />
                    <Input label="WhatsApp" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required error={errors.whatsapp} />
                    <Select label="Departamento" value={formData.departmentId} onChange={e => handleChange('departmentId', e.target.value)} required error={errors.departmentId}>
                      <option value="">Selecione...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <Select label="Autorizador" value={formData.authorizer} onChange={e => handleChange('authorizer', e.target.value)} required error={errors.authorizer}>
                      <option value="">Selecione...</option>
                      {authorizers.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </Select>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Vencimento <span className="text-accent">*</span></label>
                      <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T12:00`)} />
                      <UrgencyAlert isUrgent={isUrgent} />
                    </div>
                  </div>
                )}
                {step === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select label="Conta" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required error={errors.paymentAccount}>
                      <option value="">Selecione...</option>
                      {paymentAccounts.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                    </Select>
                    <Input label="Fornecedor" value={formData.supplierName} onChange={e => handleChange('supplierName', e.target.value)} required error={errors.supplierName} />
                    <Input label="Valor" value={formatCurrency(formData.value)} onChange={e => handleChange('value', parseCurrency(e.target.value))} required error={errors.value} />
                    <Select label="Forma Pagamento" value={formData.paymentMethod} onChange={e => handleChange('paymentMethod', e.target.value)} required error={errors.paymentMethod}>
                      <option value="">Selecione...</option>
                      <option value="PIX">PIX</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Transferência">Transferência</option>
                    </Select>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-6">
                     <h2 className="text-xl font-black">Nota Fiscal</h2>
                     <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                       <input type="file" multiple className="hidden" id="inv" onChange={e => handleFileChange(e, 'invoice')} />
                       <label htmlFor="inv" className="cursor-pointer block">
                         <UploadCloud className="w-12 h-12 text-primary mx-auto mb-2" />
                         <p className="font-bold">Anexar Arquivos</p>
                         <span className="text-xs text-slate-400">{invoiceFiles.length} selecionados</span>
                       </label>
                     </div>
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-6">
                    <Textarea label="Descrição" value={formData.description} onChange={e => handleChange('description', e.target.value)} required error={errors.description} rows={5} />
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} className="w-5 h-5" />
                      <span className="text-sm font-medium">Aceito as regras e prazos.</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <button onClick={prevStep} className={`text-slate-400 font-bold ${step === 0 ? 'invisible' : ''}`}>Voltar</button>
                {step < 3 ? <Button onClick={nextStep}>Próximo</Button> : <Button onClick={handleSubmit} disabled={isSubmitting}>Enviar</Button>}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 animate-in zoom-in duration-500">
               <CheckCircle className="w-20 h-20 text-primary mx-auto mb-6" />
               <h2 className="text-3xl font-black mb-2">Enviado com Sucesso!</h2>
               <p className="text-slate-500 mb-10">Protocolo: <span className="font-mono font-black text-slate-900">{generatedId}</span></p>
               <Button onClick={resetForm}>Voltar ao Painel</Button>
            </div>
          )}
        </main>
      </div>
    );
  };

  return (
    <>
      <Toaster position="top-right" />
      {renderView()}
    </>
  );
}

export default App;