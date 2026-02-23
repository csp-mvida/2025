import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { URGENCY_THRESHOLD_HOURS } from './constants';
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
  const [authorizers, setAuthorizers] = useState<{ id: string; name: string }[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; label: string }[]>([]);
  const [budgets, setBudgets] = useState<{ id: string; name: string }[]>([]);
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
      const [depts, auths, accounts, bgs] = await Promise.all([
        fetchDepartments(),
        fetchAuthorizers(),
        fetchPaymentAccounts(),
        fetchBudgets()
      ]);
      setDepartments(depts);
      setAuthorizers(auths);
      setPaymentAccounts(accounts);
      setBudgets(bgs);
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
            protocolToUse = existingRequest.id;
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


  const handleChange = (field: string, value: any) => {
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
        
        // FIX: Se mudar a verba, atualiza o nome para o review
        if (field === 'specificBudgetId') {
            const budget = budgets.find(b => b.id === value);
            newState.specificBudgetName = budget ? budget.name : '';
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
    const isTransfer = type === 'transfer';
    
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
    } else if (isTransfer) {
        setFormData(prev => ({ ...prev, transferFilesMeta: updatedMeta, transferUrls: updatedUrls, transferUrl: serializedUrls }));
        await updateRequestAttachments(currentProtocolId, 'transfer', serializedUrls);
    }
    toast.success('Arquivo removido.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentProtocolId) return;

    const isInvoice = type === 'invoice';
    const isBoleto = type === 'boleto';
    const isTransfer = type === 'transfer';
    
    const MAX_FILES = 10;
    const MAX_SIZE_BYTES = 100 * 1024 * 1024;

    const currentCount = isInvoice ? (formData.invoiceFilesMeta?.length || 0) : isBoleto ? (formData.boletoFilesMeta?.length || 0) : (formData.transferFilesMeta?.length || 0);
    if (currentCount + files.length > MAX_FILES) {
      toast.error(`Limite máximo de ${MAX_FILES} arquivos excedido.`);
      return;
    }

    const toastId = toast.loading(`Enviando ${files.length} arquivo(s)...`);
    
    if (isInvoice) setIsUploading(true);
    else if (isBoleto) setIsUploadingBoleto(true);
    else if (isTransfer) setIsUploadingTransfer(true);

    try {
      const newUrls: string[] = isInvoice ? [...(formData.invoiceUrls || [])] : isBoleto ? [...(formData.boletoUrls || [])] : [...(formData.transferUrls || [])];
      const newMeta: FileMeta[] = isInvoice ? [...(formData.invoiceFilesMeta || [])] : isBoleto ? [...(formData.boletoFilesMeta || [])] : [...(formData.transferFilesMeta || [])];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`Arquivo "${file.name}" excede o limite.`, { id: toastId });
          throw new Error('File too large');
        }
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
      } else if (isTransfer) {
        setFormData(prev => ({ ...prev, transferUrls: newUrls, transferFilesMeta: newMeta, transferUrl: serializedUrls }));
        await updateRequestAttachments(currentProtocolId, 'transfer', serializedUrls);
      }
      toast.success('Arquivos enviados!', { id: toastId });
    } catch (error: any) {
      if (error.message !== 'File too large') toast.error('Falha no upload.', { id: toastId });
    } finally {
      if (isInvoice) setIsUploading(false);
      else if (isBoleto) setIsUploadingBoleto(false);
      else if (isTransfer) setIsUploadingTransfer(false);
    }
  };

  const validateStep = (s: number) => {
    const errs: any = {};
    if (s === 0) {
      if (!formData.requesterName) errs.requesterName = "Responsável é obrigatório";
      if (!isValidPhone(formData.whatsapp)) errs.whatsapp = "WhatsApp inválido";
      if (!formData.departmentId) errs.departmentId = "Departamento é obrigatório";
      if (!formData.authorizer) errs.authorizer = "Autorizador é obrigatório";
      if (!formData.dueDate) errs.dueDate = "Vencimento é obrigatório";
    }
    if (s === 1) {
      if (!formData.paymentAccount) errs.paymentAccount = "Conta é obrigatória";
      // FIX: Validação do budget_id
      if (formData.isSpecificBudget === 'yes' && !(formData as any).specificBudgetId) errs.specificBudgetId = "Selecione a verba específica.";
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
      if (formData.hasInvoice === 'no' && !formData.invoiceSentViaWhatsapp) errs.invoiceSentViaWhatsapp = "Compromisso necessário.";
    }
    if (s === 3 && !formData.description) errs.description = "Descrição é obrigatória";
    if (s === 3 && !formData.termsAccepted) errs.termsAccepted = "Aceite os termos";

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
      toast.success('Solicitação enviada!');
    } else {
      toast.error('Erro ao enviar solicitação.');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_DATA });
    setStep(0);
    setIsSuccess(false);
    setCurrentProtocolId('');
    setInitializationAttempts(0);
    localStorage.removeItem('csp_draft');
    setView('welcome');
  };

  const saveDraft = () => {
    if (!currentProtocolId) return;
    localStorage.setItem('csp_draft', JSON.stringify({ ...formData, id: currentProtocolId }));
    setHasSavedDraft(true);
    toast.success('Rascunho salvo!');
  };

  const clearDraft = () => {
    localStorage.removeItem('csp_draft');
    setFormData({ ...INITIAL_DATA });
    setHasSavedDraft(false);
    setCurrentProtocolId('');
    setInitializationAttempts(0);
    toast.success('Dados limpos.');
  };

  const renderStep1 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Input label="Responsável pela solicitação" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required error={errors.requesterName} />
      <Input label="WhatsApp para contato" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required error={errors.whatsapp} />
      <Select label="Núcleo / Departamento" value={formData.departmentId} onChange={e => handleChange('departmentId', e.target.value)} required error={errors.departmentId}>
        <option value="">Selecione...</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </Select>
      <Select label="Quem autorizou?" value={formData.authorizer} onChange={e => handleChange('authorizer', e.target.value)} required error={errors.authorizer}>
        <option value="">Selecione...</option>
        {authorizers.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
      </Select>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Vencimento do Pagamento <span className="text-accent">*</span></label>
        <div className="flex flex-col md:flex-row gap-4">
          <input type="date" className="flex-1 px-4 py-3 rounded-xl border border-slate-200" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T${getTimeValue() || '12:00'}`)} />
          {showTimeInput ? (
            <div className="flex-1 flex gap-2">
              <input type="time" className="flex-1 px-4 py-3 rounded-xl border border-primary/30" value={getTimeValue()} onChange={e => handleChange('dueDate', `${getDateValue()}T${e.target.value}`)} />
              <button onClick={() => { setShowTimeInput(false); handleChange('dueDate', `${getDateValue()}T12:00`); }} className="p-3 text-slate-400"><Trash2 className="w-5 h-5" /></button>
            </div>
          ) : (
            <button onClick={() => setShowTimeInput(true)} className="flex-1 px-4 py-3 rounded-xl border border-dashed text-slate-400 text-sm font-bold flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" /> Definir horário?
            </button>
          )}
        </div>
        {errors.dueDate && <p className="text-xs text-danger mt-1">{errors.dueDate}</p>}
        <UrgencyAlert isUrgent={isUrgent} />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Select label="Conta de Pagamento" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required error={errors.paymentAccount}>
        <option value="">Selecione...</option>
        {paymentAccounts.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
      </Select>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Verba Específica? <span className="text-accent">*</span></label>
        <div className="flex gap-2">
          <button onClick={() => handleChange('isSpecificBudget', 'yes')} className={`flex-1 py-3 rounded-xl border ${formData.isSpecificBudget === 'yes' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white text-slate-500'}`}>Sim</button>
          <button onClick={() => { handleChange('isSpecificBudget', 'no'); handleChange('specificBudgetId', ''); }} className={`flex-1 py-3 rounded-xl border ${formData.isSpecificBudget === 'no' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white text-slate-500'}`}>Não</button>
        </div>
      </div>
      {formData.isSpecificBudget === 'yes' && (
        <div className="md:col-span-2">
          {/* FIX: Select agora usa budget.id (UUID) */}
          <Select label="Escolha a Verba Específica" value={(formData as any).specificBudgetId} onChange={e => handleChange('specificBudgetId', e.target.value)} required error={errors.specificBudgetId}>
            <option value="">Selecione a verba...</option>
            {budgets.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
          </Select>
        </div>
      )}
      <Input label="Fornecedor / Recebedor" value={formData.supplierName} onChange={e => handleChange('supplierName', e.target.value)} required error={errors.supplierName} />
      <Input label="Valor (R$)" value={formatCurrency(formData.value)} onChange={e => handleChange('value', parseCurrency(e.target.value))} required error={errors.value} />
      <div className="md:col-span-2">
        <Select label="Forma de Pagamento" value={formData.paymentMethod} onChange={e => handleChange('paymentMethod', e.target.value)} required error={errors.paymentMethod}>
          <option value="">Selecione...</option>
          <option value="PIX">PIX</option>
          <option value="Boleto">Boleto</option>
          <option value="Transferência">Transferência</option>
        </Select>
      </div>
      {formData.paymentMethod === 'PIX' && (
        <div className="md:col-span-2"><Input label="Chave PIX" value={formData.pixKey} onChange={e => handleChange('pixKey', e.target.value)} required error={errors.pixKey} /></div>
      )}
      {formData.paymentMethod === 'Boleto' && (
          <div className="md:col-span-2 space-y-4">
              <label className="block text-sm font-medium text-slate-700">Anexos do Boleto <span className="text-accent">*</span></label>
              <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-6 text-center relative group">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'boleto')} />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    {isUploadingBoleto ? <RefreshCw className="w-6 h-6 text-primary animate-spin" /> : <UploadCloud className="w-6 h-6 text-primary" />}
                  </div>
                  <p className="font-bold text-primary text-xs">Anexar boletos</p>
                </div>
              </div>
              {errors.boletoFile && <p className="text-xs text-danger mt-1">{errors.boletoFile}</p>}
          </div>
      )}
      {formData.paymentMethod === 'Transferência' && (
          <div className="md:col-span-2 space-y-4">
              <Input label="Banco" value={formData.transferBankName} onChange={e => handleChange('transferBankName', e.target.value)} required error={errors.transferBankName} />
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Agência" value={formData.transferAgency} onChange={e => handleChange('transferAgency', e.target.value)} required error={errors.transferAgency} />
                  <Input label="Conta" value={formData.transferAccount} onChange={e => handleChange('transferAccount', e.target.value)} required error={errors.transferAccount} />
              </div>
              <Input label="CPF/CNPJ Favorecido" value={formData.transferCpfCnpj} onChange={e => handleChange('transferCpfCnpj', e.target.value)} required error={errors.transferCpfCnpj} />
              <Input label="Nome Favorecido" value={formData.transferBeneficiaryName} onChange={e => handleChange('transferBeneficiaryName', e.target.value)} required error={errors.transferBeneficiaryName} />
          </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-4 text-center md:text-left">Possui Nota Fiscal? <span className="text-accent">*</span></label>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => handleChange('hasInvoice', 'yes')} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <FileText className="w-8 h-8" /><span className="font-bold">Sim</span>
          </button>
          <button onClick={() => { handleChange('hasInvoice', 'no'); setShowInvoiceCommitmentModal(true); }} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <AlertTriangle className="w-8 h-8" /><span className="font-bold">Não</span>
          </button>
        </div>
      </div>
      {formData.hasInvoice === 'yes' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-2xl p-10 text-center relative">
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'invoice')} />
            <div className="flex flex-col items-center gap-2">
              {isUploading ? <RefreshCw className="w-14 h-14 text-primary animate-spin" /> : <UploadCloud className="w-14 h-14 text-primary" />}
              <p className="font-bold text-primary">Anexar NF</p>
            </div>
          </div>
          {errors.invoiceFile && <p className="text-xs text-danger text-center">{errors.invoiceFile}</p>}
        </div>
      )}
      {showInvoiceCommitmentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-accent mx-auto mb-4" />
            <p className="text-slate-600 mb-6">Compromete-se a enviar a NF via WhatsApp?</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { setShowInvoiceCommitmentModal(false); handleChange('hasInvoice', 'yes'); }}>Voltar</Button>
              <Button variant="primary" onClick={() => { handleChange('invoiceSentViaWhatsapp', true); setShowInvoiceCommitmentModal(false); }}>Aceitar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Textarea label="Descrição do Pagamento" required value={formData.description} onChange={e => handleChange('description', e.target.value)} error={errors.description} rows={4} />
      <div className={`p-6 rounded-2xl border transition-all ${formData.termsAccepted ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-slate-100'}`}>
        <label className="flex items-start gap-4 cursor-pointer">
          <input type="checkbox" className="mt-1 w-5 h-5 rounded" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} />
          <p className="font-bold text-slate-800 text-sm">Confirmo que li e concordo com os prazos.</p>
        </label>
      </div>
      {errors.termsAccepted && <p className="text-xs text-danger">{errors.termsAccepted}</p>}
    </div>
  );

  const renderReview = () => {
    const items = [
      { label: 'Responsável', value: formData.requesterName },
      { label: 'Vencimento', value: new Date(formData.dueDate).toLocaleString('pt-BR') },
      { label: 'Fornecedor', value: formData.supplierName },
      { label: 'Valor', value: formatCurrency(formData.value), color: 'text-primary' },
      { label: 'Forma Pagto', value: formData.paymentMethod },
      { label: 'Autorizador', value: formData.authorizer },
      { label: 'Verba Específica', value: formData.isSpecificBudget === 'yes' ? formData.specificBudgetName : 'Não' },
      { label: 'Descrição', value: formData.description, full: true }
    ];
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
        {items.map((item, i) => (
          <div key={i} className={`p-4 rounded-xl border border-slate-50 ${item.full ? 'md:col-span-2' : ''}`}>
            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{item.label}</span>
            <span className={`block font-bold text-slate-800 ${item.color || ''}`}>{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderHeader = () => (
    <div className="bg-white border-b border-slate-100 py-3 px-6 flex justify-center fixed top-0 w-full z-50 text-xs font-medium text-slate-400">
      CSP | <span className="text-slate-600 ml-1">Central de Solicitação de Pagamento</span>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center py-12 animate-in zoom-in duration-500 max-w-lg mx-auto w-full text-center">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6"><CheckCircle className="w-10 h-10 text-primary" /></div>
      <h2 className="text-3xl font-black text-slate-900 mb-2">Enviada!</h2>
      <div className="w-full bg-white rounded-[2.5rem] p-10 mb-10 shadow-2xl border-t-4 border-primary">
        <p className="text-[10px] uppercase font-black text-slate-300 mb-4 tracking-widest">Protocolo</p>
        <div className="flex items-center justify-center gap-4">
          <span className="text-4xl font-mono font-black text-slate-900">{generatedId}</span>
          <button onClick={() => { navigator.clipboard.writeText(generatedId); toast.success('Copiado!'); }} className="p-3 bg-slate-100 rounded-2xl"><Copy className="w-5 h-5" /></button>
        </div>
      </div>
      <Button onClick={resetForm} fullWidth size="lg">Voltar ao Início</Button>
    </div>
  );

  if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return (
    <div className="min-h-screen relative bg-slate-50 flex items-center justify-center p-6">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      {renderHeader()}
      <RequestTracker initialProtocol={generatedId} onBack={() => setView('welcome')} departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} />
    </div>
  );

  if (view === 'welcome') return (
    <div className="min-h-screen relative flex flex-col bg-slate-50">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      <OrientationDrawer isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <header className="bg-primary py-2 px-6 flex justify-between items-center text-white text-[10px] font-black uppercase tracking-widest relative z-30">
        <button onClick={() => setView('login')} className="flex items-center gap-2"><Lock className="w-4 h-4" /> Administração</button>
        <button onClick={() => setIsInfoOpen(true)} className="flex items-center gap-2"><Info className="w-4 h-4" /> Regras</button>
      </header>
      <div className="max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
        <img src="/logo.png" alt="Logo" className="h-24 mb-12 drop-shadow-2xl animate-fade-up" />
        <h1 className="text-7xl font-bold text-slate-900 tracking-tighter mb-6 animate-fade-up">Plataforma de <span className="text-primary italic">pagamentos.</span></h1>
        <div className="flex flex-col gap-4 w-full max-w-sm animate-fade-up">
          <Button size="lg" onClick={() => setView('form')} className="py-6 text-xl font-black">Criar Solicitação</Button>
          <Button variant="outline" size="lg" onClick={() => setView('track')} className="py-6 text-lg font-bold">Acompanhar</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      {renderHeader()}
      <main className="flex-1 flex flex-col items-center p-8">
        {!isSuccess ? (
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-700">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('welcome')} className="text-slate-400 font-bold text-xs uppercase"><Home className="w-4 h-4" /> Início</button>
              <div className="flex gap-4">
                <button onClick={clearDraft} className="text-danger font-bold text-[10px] uppercase">Limpar</button>
                <button onClick={saveDraft} className="text-primary font-bold text-[10px] uppercase border px-2 py-1 rounded-lg">Salvar</button>
              </div>
            </div>
            <Stepper currentStep={step} />
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl mb-6">
              {step === 0 && renderStep1()}
              {step === 1 && renderStep2()}
              {step === 2 && renderStep3()}
              {step === 3 && renderStep4()}
              {step === 4 && renderReview()}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
              <button onClick={prevStep} className={`text-slate-400 font-bold text-sm ${step === 0 ? 'invisible' : ''}`}><ChevronLeft className="w-5 h-5" /> Voltar</button>
              {step < 4 ? (
                <Button onClick={nextStep} className="px-10 py-4">Próximo <ChevronRight className="w-5 h-5 ml-1.5" /></Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting} className="px-10 py-4 bg-primaryDark">
                  {isSubmitting ? 'Enviando...' : 'Confirmar'}
                </Button>
              )}
            </div>
          </div>
        ) : renderSuccess()}
      </main>
    </div>
  );
}

export default App;