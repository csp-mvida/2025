import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta, Budget } from './types';
import { 
  formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, 
  formatCpfCnpj, isValidCpfCnpj, isValidAccountOrAgency 
} from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, fetchBudgets,
  submitRequest, uploadInvoice, createDraftRequest, updateRequestAttachments, getRequestByProtocol 
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

function App() {
  const [view, setView] = useState<'welcome' | 'form' | 'login' | 'admin' | 'track'>('welcome');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<CSPFormData>({ ...INITIAL_DATA });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
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
      const [depts, auths, accounts, bgtList] = await Promise.all([
        fetchDepartments(),
        fetchAuthorizers(),
        fetchPaymentAccounts(),
        fetchBudgets()
      ]);
      setDepartments(depts);
      setAuthorizers(auths);
      setPaymentAccounts(accounts);
      setBudgets(bgtList);
      setIsDataLoaded(true);
    };
    loadData();

    const saved = localStorage.getItem('csp_draft');
    if (saved) setHasSavedDraft(true);
  }, []);

  useEffect(() => {
    if (!isDataLoaded || view !== 'form' || currentProtocolId || departments.length === 0 || authorizers.length === 0 || paymentAccounts.length === 0) {
      return;
    }

    const initializeProtocol = async () => {
      const savedDraft = localStorage.getItem('csp_draft');
      let protocolToUse = '';
      let loadedData: CSPFormData | null = null;

      if (savedDraft) {
        loadedData = JSON.parse(savedDraft);
        if (loadedData.id) {
          const existingRequest = await getRequestByProtocol(loadedData.id);
          if (existingRequest && existingRequest.status === 'draft') {
            protocolToUse = existingRequest.id!;
            setFormData(loadedData);
            setHasSavedDraft(true);
          } else {
            localStorage.removeItem('csp_draft');
            setHasSavedDraft(false);
            loadedData = null;
          }
        }
      }

      if (!protocolToUse) {
        await createInitialDraft(departments[0].id, authorizers[0].id, paymentAccounts[0].id);
      } else {
        setCurrentProtocolId(protocolToUse);
      }
    };

    if (initializationAttempts === 0) {
      initializeProtocol();
    } else if (initializationAttempts === 1) {
      initializeProtocol();
    } else if (initializationAttempts >= 2) {
      toast.error('Falha ao iniciar o formulário. Tente recarregar.');
    }

  }, [isDataLoaded, view, currentProtocolId, departments, authorizers, paymentAccounts, createInitialDraft, initializationAttempts]);

  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => {
        const newState = { ...prev, [field]: value };
        if (field === 'paymentMethod') {
            newState.pixKey = '';
            newState.boletoUrl = '';
            newState.boletoUrls = [];
            newState.boletoFilesMeta = [];
            newState.transferBankName = '';
            newState.transferAccountType = '';
            newState.transferAgency = '';
            newState.transferAccount = '';
            newState.transferCpfCnpj = '';
            newState.transferBeneficiaryName = '';
            newState.transferUrl = '';
            newState.transferUrls = [];
            newState.transferFilesMeta = [];
        }
        if (field === 'transferCpfCnpj') {
            newState.transferCpfCnpj = formatCpfCnpj(value);
        }
        return newState;
    });
    if (errors[field]) setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRemoveFile = async (idx: number, type: 'invoice' | 'boleto' | 'transfer') => {
    if (!currentProtocolId) return;
    const isInvoice = type === 'invoice';
    const isBoleto = type === 'boleto';
    const updatedMeta = [...(isInvoice ? (formData.invoiceFilesMeta || []) : isBoleto ? (formData.boletoFilesMeta || []) : (formData.transferFilesMeta || []))];
    const updatedUrls = [...(isInvoice ? (formData.invoiceUrls || []) : isBoleto ? (formData.boletoUrls || []) : (formData.transferUrls || []))];
    updatedMeta.splice(idx, 1);
    updatedUrls.splice(idx, 1);
    const serializedUrls = updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : '';
    if (isInvoice) {
      setFormData(prev => ({ ...prev, invoiceFilesMeta: updatedMeta, invoiceUrls: updatedUrls, invoiceUrl: serializedUrls }));
      await updateRequestAttachments(currentProtocolId, 'invoice', serializedUrls);
    } else if (isBoleto) {
      setFormData(prev => ({ ...prev, boletoFilesMeta: updatedMeta, boletoUrls: updatedUrls, boletoUrl: serializedUrls }));
      await updateRequestAttachments(currentProtocolId, 'boleto', serializedUrls);
    } else {
        setFormData(prev => ({ ...prev, transferFilesMeta: updatedMeta, transferUrls: updatedUrls, transferUrl: serializedUrls }));
        await updateRequestAttachments(currentProtocolId, 'transfer', serializedUrls);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentProtocolId) return;
    const isInvoice = type === 'invoice';
    const isBoleto = type === 'boleto';
    const toastId = toast.loading(`Enviando ${files.length} arquivo(s)...`);
    if (isInvoice) setIsUploading(true);
    else if (isBoleto) setIsUploadingBoleto(true);
    else setIsUploadingTransfer(true);
    try {
      const newUrls: string[] = isInvoice ? [...(formData.invoiceUrls || [])] : isBoleto ? [...(formData.boletoUrls || [])] : [...(formData.transferUrls || [])];
      const newMeta: FileMeta[] = isInvoice ? [...(formData.invoiceFilesMeta || [])] : isBoleto ? [...(formData.boletoFilesMeta || [])] : [...(formData.transferFilesMeta || [])];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadInvoice(file, type, currentProtocolId);
        newUrls.push(url);
        newMeta.push({ name: file.name, size: file.size, url });
      }
      const serializedUrls = JSON.stringify(newUrls);
      if (isInvoice) {
        setFormData(prev => ({ ...prev, invoiceUrls: newUrls, invoiceFilesMeta: newMeta, invoiceUrl: serializedUrls }));
        await updateRequestAttachments(currentProtocolId, 'invoice', serializedUrls);
      } else if (isBoleto) {
        setFormData(prev => ({ ...prev, boletoUrls: newUrls, boletoFilesMeta: newMeta, boletoUrl: serializedUrls }));
        await updateRequestAttachments(currentProtocolId, 'boleto', serializedUrls);
      } else {
        setFormData(prev => ({ ...prev, transferUrls: newUrls, transferFilesMeta: newMeta, transferUrl: serializedUrls }));
        await updateRequestAttachments(currentProtocolId, 'transfer', serializedUrls);
      }
      toast.success('Arquivos enviados!', { id: toastId });
    } catch (error: any) {
      toast.error('Falha no upload.', { id: toastId });
    } finally {
      setIsUploading(false); setIsUploadingBoleto(false); setIsUploadingTransfer(false);
    }
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
      if (formData.isSpecificBudget === 'yes' && !formData.budgetId) errs.budgetId = "Selecione a verba";
      if (!formData.supplierName) errs.supplierName = "Fornecedor é obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) errs.value = "Valor é obrigatório";
      if (!formData.paymentMethod) errs.paymentMethod = "Forma é obrigatória";
      if (formData.paymentMethod === 'Boleto' && (!formData.boletoUrls || formData.boletoUrls.length === 0)) errs.boletoFile = "Anexo do boleto necessário";
      if (formData.paymentMethod === 'Transferência') {
          if (!formData.transferBankName) errs.transferBankName = "Banco é obrigatório";
          if (!formData.transferAccountType) errs.transferAccountType = "Tipo de conta é obrigatório";
          if (!isValidAccountOrAgency(formData.transferAgency || '')) errs.transferAgency = "Agência é obrigatória";
          if (!isValidAccountOrAgency(formData.transferAccount || '')) errs.transferAccount = "Conta é obrigatória";
          if (!isValidCpfCnpj(formData.transferCpfCnpj || '')) errs.transferCpfCnpj = "CPF/CNPJ inválido";
          if (!formData.transferBeneficiaryName) errs.transferBeneficiaryName = "Nome do favorecido é obrigatório";
      }
    }
    if (s === 2) {
      if (formData.hasInvoice === 'yes' && (!formData.invoiceUrls || formData.invoiceUrls.length === 0)) errs.invoiceFile = "Upload necessário";
      if (formData.hasInvoice === 'no' && !formData.invoiceSentViaWhatsapp) errs.invoiceSentViaWhatsapp = "Você deve se comprometer a enviar o comprovante via WhatsApp.";
    }
    if (s === 3 && !formData.description) errs.description = "Descrição é obrigatória";
    if (s === 3 && !formData.termsAccepted) errs.termsAccepted = "Você deve aceitar os termos";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => validateStep(step) && setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!validateStep(4) || !currentProtocolId) return;
    setIsSubmitting(true);
    const selectedAuthorizer = authorizers.find(a => a.name === formData.authorizer);
    const selectedAccount = paymentAccounts.find(p => p.label === formData.paymentAccount);
    if (!selectedAuthorizer || !selectedAccount) {
        toast.error('Erro de mapeamento.');
        setIsSubmitting(false);
        return;
    }
    if (await submitRequest(formData, currentProtocolId, selectedAuthorizer.id, selectedAccount.id, isUrgent)) {
      setGeneratedId(currentProtocolId);
      setIsSuccess(true);
      localStorage.removeItem('csp_draft');
    } else {
      toast.error('Erro ao enviar solicitação.');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => { setFormData({ ...INITIAL_DATA }); setStep(0); setIsSuccess(false); setCurrentProtocolId(''); setInitializationAttempts(0); localStorage.removeItem('csp_draft'); setView('welcome'); };

  const renderStep2 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Select label="Conta de Pagamento" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required error={errors.paymentAccount}>
        <option value="">Selecione...</option>
        {paymentAccounts.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
      </Select>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Verba Específica? <span className="text-accent">*</span></label>
        <div className="flex gap-2">
          <button onClick={() => handleChange('isSpecificBudget', 'yes')} className={`flex-1 py-3 rounded-xl border transition-all ${formData.isSpecificBudget === 'yes' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Sim</button>
          <button onClick={() => { handleChange('isSpecificBudget', 'no'); handleChange('budgetId', ''); handleChange('specificBudgetName', ''); }} className={`flex-1 py-3 rounded-xl border transition-all ${formData.isSpecificBudget === 'no' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Não</button>
        </div>
      </div>
      {formData.isSpecificBudget === 'yes' && (
        <div className="md:col-span-2 animate-in slide-in-from-top-2 duration-300">
          <Select label="Escolha a Verba Específica" value={formData.budgetId} onChange={e => {
              const selected = budgets.find(b => b.id === e.target.value);
              handleChange('budgetId', e.target.value);
              handleChange('specificBudgetName', selected?.name || '');
          }} required error={errors.budgetId}>
            <option value="">Selecione a verba...</option>
            {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
      )}
      <Input label="Fornecedor / Recebedor" value={formData.supplierName} onChange={e => handleChange('supplierName', e.target.value)} required error={errors.supplierName} />
      <Input label="Valor (R$)" value={formatCurrency(formData.value)} onChange={e => handleChange('value', parseCurrency(e.target.value))} required error={errors.value} placeholder="R$ 0,00" />
      <div className="md:col-span-2">
        <Select label="Forma de Pagamento" value={formData.paymentMethod} onChange={e => handleChange('paymentMethod', e.target.value)} required error={errors.paymentMethod}>
          <option value="">Selecione...</option>
          <option value="PIX">PIX</option>
          <option value="Boleto">Boleto</option>
          <option value="Transferência">Transferência</option>
        </Select>
      </div>
      {formData.paymentMethod === 'PIX' && <div className="md:col-span-2"><Input label="Chave PIX" value={formData.pixKey} onChange={e => handleChange('pixKey', e.target.value)} required error={errors.pixKey} /></div>}
      {formData.paymentMethod === 'Boleto' && (
        <div className="md:col-span-2 space-y-4">
            <label className="block text-sm font-medium text-slate-700">Anexos do Boleto <span className="text-accent">*</span></label>
            <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-6 text-center relative group">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'boleto')} />
                <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="w-6 h-6 text-primary" />
                    <p className="font-bold text-primary text-sm">Clique ou arraste boletos aqui</p>
                </div>
            </div>
            {formData.boletoFilesMeta && formData.boletoFilesMeta.length > 0 && (
                <div className="space-y-2">
                    {formData.boletoFilesMeta.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
                            <span className="text-xs font-bold">{file.name}</span>
                            <button onClick={() => handleRemoveFile(idx, 'boleto')}><X className="w-4 h-4 text-slate-400" /></button>
                        </div>
                    ))}
                </div>
            )}
            {errors.boletoFile && <p className="text-xs text-danger">{errors.boletoFile}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-12 md:pt-16 selection:bg-primary/10">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      <div className="bg-white border-b border-slate-100 py-2 md:py-3 px-6 flex justify-center fixed top-0 w-full z-50">
        <div className="text-[9px] md:text-[12px] font-medium text-slate-400 tracking-tight">CSP | <span className="text-slate-600">Central de Solicitação de Pagamento</span></div>
      </div>
      <main className="flex-1 flex flex-col items-center justify-start md:justify-center p-4 pt-6 md:p-8">
        {view === 'welcome' ? (
          <div className="max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center p-4 relative z-10 text-center">
            <img src="/logo.png" alt="Logo" className="h-12 md:h-24 mb-4 md:mb-12" />
            <h1 className="text-3xl md:text-7xl font-bold text-slate-900 tracking-tighter mb-14">Sua plataforma de <span className="text-primary italic font-black">pagamentos.</span></h1>
            <div className="flex flex-col gap-4 w-full max-w-sm">
                <Button size="lg" onClick={() => setView('form')} className="rounded-2xl py-6 font-black shadow-2xl">Criar Solicitação</Button>
                <Button variant="outline" size="lg" onClick={() => setView('track')} className="rounded-2xl py-6 bg-white font-bold">Acompanhar Solicitação</Button>
            </div>
          </div>
        ) : view === 'form' ? (
          !isSuccess ? (
            <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 duration-700">
                <Stepper currentStep={step} />
                <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 shadow-2xl border border-slate-50 mb-6">
                    {step === 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
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
                            <div className="md:col-span-2"><Input label="Vencimento" type="date" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T12:00`)} required error={errors.dueDate} /></div>
                        </div>
                    )}
                    {step === 1 && renderStep2()}
                    {step === 2 && (
                        <div className="space-y-6">
                            <label className="block text-sm font-medium text-slate-700 text-center">Possui Nota Fiscal? <span className="text-accent">*</span></label>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => handleChange('hasInvoice', 'yes')} className={`p-6 rounded-2xl border-2 ${formData.hasInvoice === 'yes' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>Sim</button>
                                <button onClick={() => { handleChange('hasInvoice', 'no'); setShowInvoiceCommitmentModal(true); }} className={`p-6 rounded-2xl border-2 ${formData.hasInvoice === 'no' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>Não</button>
                            </div>
                            {formData.hasInvoice === 'yes' && (
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center relative">
                                    <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'invoice')} />
                                    <UploadCloud className="w-12 h-12 text-primary mx-auto mb-2" />
                                    <p className="font-bold text-primary">Clique ou arraste arquivos aqui</p>
                                </div>
                            )}
                        </div>
                    )}
                    {step === 3 && <div className="space-y-6"><Textarea label="Descrição" required value={formData.description} onChange={e => handleChange('description', e.target.value)} error={errors.description} rows={4} /><label className="flex items-start gap-4 cursor-pointer"><input type="checkbox" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} /><span>Aceito os termos</span></label></div>}
                    {step === 4 && <div className="p-6 bg-slate-50 rounded-xl"><h3 className="font-bold mb-4">Resumo</h3><p>Solicitante: {formData.requesterName}</p><p>Fornecedor: {formData.supplierName}</p><p>Valor: {formatCurrency(formData.value)}</p></div>}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                    <button onClick={prevStep} className={`font-bold ${step === 0 ? 'invisible' : ''}`}>Voltar</button>
                    {step < 4 ? <Button onClick={nextStep}>Próximo</Button> : <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Enviando...' : 'Confirmar'}</Button>}
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="w-20 h-20 text-primary mb-6" />
                <h2 className="text-3xl font-black mb-2">Solicitação Enviada!</h2>
                <div className="bg-white rounded-3xl p-10 shadow-2xl border border-slate-50 text-center mb-10"><p className="text-[10px] uppercase font-black text-slate-300 mb-4">Protocolo</p><span className="text-4xl font-mono font-black">{generatedId}</span></div>
                <Button onClick={resetForm}>Voltar ao Início</Button>
            </div>
          )
        ) : view === 'login' ? (
          <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />
        ) : view === 'admin' ? (
          <AdminDashboard onBack={() => setView('welcome')} />
        ) : (
          <RequestTracker onBack={() => setView('welcome')} departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} />
        )}
      </main>
      {showInvoiceCommitmentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-accent mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Compromisso de Envio</h3>
            <p className="text-slate-600 text-sm mb-6">Você se compromete a enviar a nota via WhatsApp?</p>
            <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => { setShowInvoiceCommitmentModal(false); handleChange('hasInvoice', 'yes'); }}>Voltar</Button><Button onClick={() => { handleChange('invoiceSentViaWhatsapp', true); setShowInvoiceCommitmentModal(false); }}>Aceitar</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;