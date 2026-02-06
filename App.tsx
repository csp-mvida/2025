import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { 
  formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, 
  formatCpfCnpj 
} from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, 
  submitRequest, uploadInvoice, createDraftRequest, updateRequestAttachments, getRequestByProtocol 
} from './services/api';
import { validateSubmission } from './lib/paymentRequestRules';
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
  Home, Lock, Copy, Info, Clock, X
} from './components/ui/Icons';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginAdmin } from './components/LoginAdmin';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { RequestTracker } from './components/RequestTracker';

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
  const [isInfoOpen, setIsInfoOpen] = useState(false);
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
            setFormData({ ...loaded, id: exists.id });
          } else {
            localStorage.removeItem('csp_draft');
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
    if (s === 2) {
      if (formData.hasInvoice === 'yes' && (!formData.invoiceUrls || formData.invoiceUrls.length === 0)) errs.invoiceFile = "Anexo obrigatório";
    }
    if (s === 3) {
      if (!formData.description) errs.description = "Descrição obrigatória";
      if (!formData.termsAccepted) errs.termsAccepted = "Aceite os termos";
    }
    setErrors(errs); return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateStep(4) || !currentProtocolId) return;

    // Validação lógica final antes do envio
    const logicValidation = validateSubmission({
      ...formData,
      status: 'pending' as any // Simulando transição para validação
    });

    if (!logicValidation.valid) {
      toast.error(logicValidation.error || "Existem pendências no preenchimento.");
      return;
    }

    setIsSubmitting(true);
    const authId = authorizers.find(a => a.name === formData.authorizer)?.id;
    const accId = paymentAccounts.find(p => p.label === formData.paymentAccount)?.id;
    
    if (authId && accId && await submitRequest(formData, currentProtocolId, authId, accId, isUrgent)) {
      setGeneratedId(currentProtocolId); setIsSuccess(true); localStorage.removeItem('csp_draft');
    } else {
      toast.error('Erro ao enviar solicitação.');
    }
    setIsSubmitting(false);
  };

  if (view === 'login' || (view === 'admin' && !session)) return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return (
    <div className="min-h-screen relative bg-slate-50 flex items-center justify-center p-4">
      <Toaster position="top-right" /> <BackgroundAnimation />
      <div className="bg-white border-b border-slate-100 py-2 fixed top-0 w-full z-50 text-center text-[10px] text-slate-400 font-bold tracking-widest">CSP | CENTRAL DE PAGAMENTOS</div>
      <RequestTracker initialProtocol={generatedId} onBack={() => setView('welcome')} departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} />
    </div>
  );

  if (view === 'welcome') return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 overflow-x-hidden">
      <Toaster position="top-right" /> <BackgroundAnimation /> <OrientationDrawer isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <header className="relative z-30"><div className="bg-primary py-2 px-6 flex items-center justify-between h-14 shadow-lg">
        <button onClick={() => setView('login')} className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest hover:opacity-80 transition-opacity"><Lock className="w-4 h-4" /> {session ? 'Painel Gestão' : 'Área Restrita'}</button>
        <button onClick={() => setIsInfoOpen(true)} className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest hover:opacity-80 transition-opacity"><Info className="w-4 h-4" /> Regras e Prazos</button>
      </div></header>
      <div className="max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center p-8 text-center">
        <img src="/logo.png" alt="Logo" className="h-24 mb-12 drop-shadow-2xl animate-fade-up" />
        <h1 className="text-4xl md:text-7xl font-bold text-slate-900 tracking-tighter mb-6 animate-fade-up">Sua plataforma de <span className="text-primary italic font-black">pagamentos.</span></h1>
        <p className="text-sm md:text-xl text-slate-500 font-medium mb-12 animate-fade-up">Solicite pagamentos de forma guiada, segura e organizada.</p>
        <div className="flex flex-col gap-4 w-full max-w-sm px-4 animate-fade-up">
          <Button size="lg" onClick={() => setView('form')} className="rounded-2xl py-6 font-black shadow-2xl transition-transform hover:scale-[1.02]">Criar Solicitação</Button>
          <Button variant="outline" size="lg" onClick={() => setView('track')} className="rounded-2xl py-6 font-bold bg-white border-slate-200 text-slate-600 hover:border-primary/50 transition-all">Acompanhar Status</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16">
      <Toaster position="top-right" /> <BackgroundAnimation />
      <div className="bg-white border-b border-slate-100 py-2 fixed top-0 w-full z-50 text-center text-[10px] text-slate-400 font-bold tracking-widest uppercase">CSP | Fluxo de Solicitação</div>
      <main className="flex-1 flex flex-col items-center p-4 md:p-8">
        {!isSuccess ? (
          <div className="w-full max-w-3xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6 px-1">
              <button onClick={() => setView('welcome')} className="text-slate-400 hover:text-primary transition-colors font-bold uppercase text-[10px] flex items-center gap-2"><Home className="w-4 h-4" /> Início</button>
              <div className="flex gap-4"><button onClick={() => { if(confirm("Limpar todos os dados digitados?")) { localStorage.removeItem('csp_draft'); window.location.reload(); } }} className="text-danger hover:opacity-80 transition-opacity uppercase text-[10px] font-bold">Limpar Tudo</button></div>
            </div>
            <Stepper currentStep={step} />
            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl shadow-slate-200/50 border border-slate-50 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/10"></div>
              {step === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <Input label="Responsável" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required error={errors.requesterName} />
                  <Input label="WhatsApp" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required error={errors.whatsapp} placeholder="(00) 00000-0000" />
                  <Select label="Departamento" value={formData.departmentId} onChange={e => handleChange('departmentId', e.target.value)} required error={errors.departmentId}>
                    <option value="">Selecione...</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                  <Select label="Autorizador" value={formData.authorizer} onChange={e => handleChange('authorizer', e.target.value)} required error={errors.authorizer}>
                    <option value="">Selecione...</option>{authorizers.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </Select>
                  <div className="md:col-span-2"><Input label="Vencimento" type="date" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T12:00`)} required error={errors.dueDate} /></div>
                </div>
              )}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <Select label="Conta de Pagamento" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required error={errors.paymentAccount}>
                    <option value="">Selecione...</option>{paymentAccounts.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                  </Select>
                  <Input label="Fornecedor / Recebedor" value={formData.supplierName} onChange={e => handleChange('supplierName', e.target.value)} required error={errors.supplierName} />
                  <Input label="Valor do Pagamento" value={formatCurrency(formData.value)} onChange={e => handleChange('value', parseCurrency(e.target.value))} required error={errors.value} placeholder="R$ 0,00" />
                  <Select label="Forma de Pagamento" value={formData.paymentMethod} onChange={e => handleChange('paymentMethod', e.target.value)} required error={errors.paymentMethod}>
                    <option value="">Selecione...</option><option value="PIX">PIX</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
                  </Select>
                  {formData.paymentMethod === 'PIX' && <div className="md:col-span-2"><Input label="Chave PIX" value={formData.pixKey} onChange={e => handleChange('pixKey', e.target.value)} required /></div>}
                  {formData.paymentMethod === 'Boleto' && (
                    <div className="md:col-span-2 border-2 border-dashed border-primary/20 rounded-xl p-6 text-center bg-primary/5">
                      <input type="file" className="hidden" id="boleto-upload" onChange={e => handleFileChange(e, 'boleto')} />
                      <label htmlFor="boleto-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <UploadCloud className="w-8 h-8 text-primary" />
                        <span className="font-bold text-xs">Anexar Boleto (PDF ou Foto)</span>
                      </label>
                      {formData.boletoFilesMeta?.map((f, i) => <div key={i} className="mt-2 text-[10px] font-bold text-primary">{f.name}</div>)}
                    </div>
                  )}
                </div>
              )}
              {step === 2 && (
                <div className="space-y-8">
                  <label className="block text-sm font-bold text-center uppercase tracking-widest text-slate-400">Comprovação Fiscal</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleChange('hasInvoice', 'yes')} className={`p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.hasInvoice === 'yes' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-400'}`}><FileText className="w-8 h-8" /><span className="font-bold">Sim, possuo NF</span></button>
                    <button onClick={() => handleChange('hasInvoice', 'no')} className={`p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.hasInvoice === 'no' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-400'}`}><AlertTriangle className="w-8 h-8" /><span className="font-bold">Não possuo</span></button>
                  </div>
                  {formData.hasInvoice === 'yes' && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:border-primary/50 transition-colors">
                      <input type="file" multiple className="hidden" id="invoice-upload" onChange={e => handleFileChange(e, 'invoice')} />
                      <label htmlFor="invoice-upload" className="cursor-pointer flex flex-col items-center gap-3">
                        <UploadCloud className="w-10 h-10 text-slate-300" />
                        <span className="font-bold text-slate-500">Clique para anexar Notas Fiscais</span>
                      </label>
                      {formData.invoiceFilesMeta?.map((f, i) => <div key={i} className="mt-2 text-xs font-bold text-primary italic">✓ {f.name}</div>)}
                    </div>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-8">
                  <Textarea label="Descrição Detalhada do Pagamento" value={formData.description} onChange={e => handleChange('description', e.target.value)} required error={errors.description} rows={5} placeholder="Descreva para que serve este pagamento..." />
                  <label className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl cursor-pointer">
                    <input type="checkbox" className="mt-1 w-5 h-5 rounded border-slate-300 text-primary" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} />
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Confirmo que as informações acima são verdadeiras e que a solicitação foi autorizada pelo coordenador do núcleo.</span>
                  </label>
                </div>
              )}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 text-center">
                    <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-primary">Tudo Pronto!</h3>
                    <p className="text-sm text-slate-600 mt-2">Clique em confirmar para gerar seu protocolo.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-bold text-slate-400">
                    <div className="bg-slate-50 p-4 rounded-xl"><span className="block mb-1">Fornecedor</span><span className="text-slate-900">{formData.supplierName}</span></div>
                    <div className="bg-slate-50 p-4 rounded-xl"><span className="block mb-1">Valor</span><span className="text-primary">{formatCurrency(formData.value)}</span></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-4">
              <button onClick={() => setStep(s => s - 1)} className={`text-slate-400 hover:text-slate-600 transition-colors font-bold uppercase text-xs flex items-center gap-2 ${step === 0 ? 'invisible' : ''}`}><ChevronLeft className="w-4 h-4" /> Voltar</button>
              <Button onClick={step < 4 ? () => validateStep(step) && setStep(s => s + 1) : handleSubmit} disabled={isSubmitting} size="lg" className="px-10 rounded-xl shadow-xl">
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : step < 4 ? 'Próximo' : 'Confirmar Envio'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 md:p-16 bg-white rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-500 max-w-lg mx-auto">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8"><CheckCircle className="w-12 h-12 text-primary" /></div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter">Solicitação Enviada!</h2>
            <p className="text-slate-500 mb-8 font-medium">Anote seu protocolo para acompanhamento:</p>
            <div className="bg-slate-50 p-6 rounded-2xl mb-10 flex items-center justify-center gap-4 border border-slate-100 group">
              <span className="text-2xl md:text-3xl font-mono font-black text-slate-900 tracking-widest">{generatedId}</span>
              <button onClick={() => { navigator.clipboard.writeText(generatedId); toast.success("Copiado!"); }} className="p-2 text-slate-400 hover:text-primary transition-colors"><Copy className="w-5 h-5" /></button>
            </div>
            <Button onClick={() => window.location.reload()} size="lg" fullWidth className="rounded-2xl py-6 font-black uppercase tracking-widest text-sm">Novo Pagamento</Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;