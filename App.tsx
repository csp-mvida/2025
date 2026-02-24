import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { URGENCY_THRESHOLD_HOURS, SPECIFIC_BUDGET_OPTIONS } from './constants';
import { 
  formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, 
  formatCpfCnpj, isValidCpfCnpj, isValidAccountOrAgency 
} from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, 
  submitRequest, uploadInvoice, createDraftRequest, getRequestByProtocol 
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
  
  // State Local para Arquivos (Em memória)
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
  const [isIdCopied, setIsIdCopied] = useState(false); 
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
    } else {
      setInitializationAttempts(prev => prev + 1);
    }
  }, [formData]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!isDataLoaded || view !== 'form' || currentProtocolId || departments.length === 0 || authorizers.length === 0 || paymentAccounts.length === 0) return;

    if (initializationAttempts < 2) {
      createInitialDraft(departments[0].id, authorizers[0].id, paymentAccounts[0].id);
    } else {
      toast.error('Falha ao iniciar o formulário.');
    }
  }, [isDataLoaded, view, currentProtocolId, departments, authorizers, paymentAccounts, createInitialDraft, initializationAttempts]);

  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => {
        let processedValue = value;
        if (field === 'pixKey' && (prev.pixKeyType === 'cpf' || prev.pixKeyType === 'cnpj' || prev.pixKeyType === 'phone')) {
            processedValue = value.replace(/\D/g, '');
        }
        const newState = { ...prev, [field]: processedValue };
        if (field === 'paymentMethod') {
            newState.pixKey = '';
            newState.pixKeyType = '';
            setBoletoFiles([]);
            setTransferFiles([]);
        }
        if (field === 'pixKeyType') newState.pixKey = '';
        if (field === 'transferCpfCnpj') newState.transferCpfCnpj = formatCpfCnpj(value);
        return newState;
    });
    if (errors[field]) setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRemoveFile = (idx: number, type: 'invoice' | 'boleto' | 'transfer') => {
    if (type === 'invoice') setInvoiceFiles(prev => prev.filter((_, i) => i !== idx));
    else if (type === 'boleto') setBoletoFiles(prev => prev.filter((_, i) => i !== idx));
    else if (type === 'transfer') setTransferFiles(prev => prev.filter((_, i) => i !== idx));
    toast.success('Arquivo removido da seleção.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const MAX_FILES = 10;
    const currentCount = type === 'invoice' ? invoiceFiles.length : type === 'boleto' ? boletoFiles.length : transferFiles.length;
    
    if (currentCount + files.length > MAX_FILES) {
      toast.error(`Limite máximo de ${MAX_FILES} arquivos excedido.`);
      return;
    }

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
      if (formData.isSpecificBudget === 'yes' && !formData.specificBudgetName) errs.specificBudgetName = "Selecione a verba";
      if (!formData.supplierName) errs.supplierName = "Fornecedor é obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) errs.value = "Valor é obrigatório";
      if (!formData.paymentMethod) errs.paymentMethod = "Forma é obrigatória";
      
      if (formData.paymentMethod === 'PIX') {
        if (!formData.pixKeyType) errs.pixKeyType = "Selecione o tipo de chave PIX";
        if (!formData.pixKey) errs.pixKey = "Chave PIX é obrigatória";
      }
      if (formData.paymentMethod === 'Boleto' && boletoFiles.length === 0) errs.boletoFile = "Selecione o anexo do boleto";
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
      if (formData.hasInvoice === 'yes' && invoiceFiles.length === 0) errs.invoiceFile = "Selecione a Nota Fiscal";
      if (formData.hasInvoice === 'no' && !formData.invoiceSentViaWhatsapp) errs.invoiceSentViaWhatsapp = "Você deve se comprometer a enviar o comprovante.";
    }
    if (s === 3) {
      if (!formData.description) errs.description = "Descrição é obrigatória";
      if (!formData.termsAccepted) errs.termsAccepted = "Você deve aceitar os termos";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => validateStep(step) && setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setIsSubmitting(true);
    const toastId = toast.loading('Processando arquivos e enviando solicitação...');

    try {
      // 1. Upload de Arquivos Pendentes
      let finalInvoiceUrl = 'Pendente via WhatsApp';
      let finalBoletoUrl = '';
      let finalTransferUrl = '';

      if (formData.hasInvoice === 'yes' && invoiceFiles.length > 0) {
        const urls = await Promise.all(invoiceFiles.map(f => uploadInvoice(f, 'invoice', currentProtocolId)));
        finalInvoiceUrl = JSON.stringify(urls);
      }

      if (formData.paymentMethod === 'Boleto' && boletoFiles.length > 0) {
        const urls = await Promise.all(boletoFiles.map(f => uploadInvoice(f, 'boleto', currentProtocolId)));
        finalBoletoUrl = JSON.stringify(urls);
      }

      if (formData.paymentMethod === 'Transferência' && transferFiles.length > 0) {
        const urls = await Promise.all(transferFiles.map(f => uploadInvoice(f, 'transfer', currentProtocolId)));
        finalTransferUrl = JSON.stringify(urls);
      }

      // 2. Preparar Dados Finais
      const selectedAuthorizer = authorizers.find(a => a.name === formData.authorizer);
      const selectedAccount = paymentAccounts.find(p => p.label === formData.paymentAccount);
      
      const finalFormData = {
        ...formData,
        invoiceUrl: finalInvoiceUrl,
        boletoUrl: finalBoletoUrl,
        transferUrl: finalTransferUrl
      };

      // 3. Submeter
      if (await submitRequest(finalFormData, currentProtocolId, selectedAuthorizer!.id, selectedAccount!.id, isUrgent)) {
        setGeneratedId(currentProtocolId);
        setIsSuccess(true);
        toast.success('Solicitação enviada!', { id: toastId });
      } else {
        throw new Error('Erro ao salvar no banco');
      }
    } catch (err) {
      toast.error('Falha ao concluir solicitação. Verifique sua conexão.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_DATA });
    setInvoiceFiles([]);
    setBoletoFiles([]);
    setTransferFiles([]);
    setStep(0);
    setIsSuccess(false);
    setCurrentProtocolId('');
    setInitializationAttempts(0);
    setView('welcome');
  };

  const handleInvoiceOptionClick = (option: 'yes' | 'no') => {
    handleChange('hasInvoice', option);
    if (option === 'no') setShowInvoiceCommitmentModal(true);
    else handleChange('invoiceSentViaWhatsapp', false);
  };

  const getPixKeyDisplayValue = () => {
    if (!formData.pixKey) return '';
    if (formData.pixKeyType === 'cpf' || formData.pixKeyType === 'cnpj') return formatCpfCnpj(formData.pixKey);
    if (formData.pixKeyType === 'phone') return formatPhone(formData.pixKey);
    return formData.pixKey;
  };

  const renderStep1 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Input label="Responsável pela solicitação" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required error={errors.requesterName} placeholder="Seu nome completo" />
      <Input label="WhatsApp para contato" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required error={errors.whatsapp} placeholder="(00) 00000-0000" />
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
          <input type="date" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T${getTimeValue() || '12:00'}`)} />
          {showTimeInput ? (
            <div className="flex-1 flex gap-2">
              <input type="time" className="flex-1 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 focus:ring-2 focus:ring-primary/20 outline-none" value={getTimeValue()} onChange={e => handleChange('dueDate', `${getDateValue()}T${e.target.value}`)} />
              <button onClick={() => { setShowTimeInput(false); handleChange('dueDate', `${getDateValue()}T12:00`); }} className="p-3 text-slate-400 hover:text-danger"><Trash2 className="w-5 h-5" /></button>
            </div>
          ) : (
            <button onClick={() => setShowTimeInput(true)} className="flex-1 px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm font-bold flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-all group">
              <Clock className="w-4 h-4" /> Definir horário?
            </button>
          )}
        </div>
        {errors.dueDate && <p className="text-xs text-danger mt-1">{errors.dueDate}</p>}
        <UrgencyAlert isUrgent={isUrgent} />
      </div>
    </div>
  );

  const renderBoletoFields = () => (
    <div className="md:col-span-2 space-y-4">
      <label className="block text-sm font-medium text-slate-700">Anexos do Boleto <span className="text-accent">*</span></label>
      <label className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer block">
        <input type="file" multiple className="sr-only" onChange={(e) => handleFileChange(e, 'boleto')} />
        <div className="flex flex-col items-center gap-2">
          <UploadCloud className="w-8 h-8 text-primary" />
          <p className="font-bold text-primary text-xs">Clique ou arraste até 10 boletos aqui</p>
          <div className="mt-1 px-3 py-1 bg-white/50 rounded-full">
            <p className="text-[10px] text-slate-600 font-bold">{boletoFiles.length}/10 boletos selecionados</p>
          </div>
        </div>
      </label>
      {boletoFiles.map((file, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
          </div>
          <button onClick={() => handleRemoveFile(idx, 'boleto')} className="p-1.5 text-slate-400 hover:text-danger"><X className="w-4 h-4" /></button>
        </div>
      ))}
      {errors.boletoFile && <p className="text-xs text-danger mt-1">{errors.boletoFile}</p>}
    </div>
  );

  const renderTransferFields = () => (
    <div className="md:col-span-2 space-y-4">
        <Input label="Banco" value={formData.transferBankName} onChange={e => handleChange('transferBankName', e.target.value)} required error={errors.transferBankName} />
        <Select label="Tipo de Conta" value={formData.transferAccountType} onChange={e => handleChange('transferAccountType', e.target.value)} required error={errors.transferAccountType}>
            <option value="">Selecione...</option>
            <option value="Corrente">Conta Corrente</option>
            <option value="Poupança">Conta Poupança</option>
        </Select>
        <div className="grid grid-cols-2 gap-4">
            <Input label="Agência" value={formData.transferAgency} onChange={e => handleChange('transferAgency', e.target.value)} required error={errors.transferAgency} />
            <Input label="Conta" value={formData.transferAccount} onChange={e => handleChange('transferAccount', e.target.value)} required error={errors.transferAccount} />
        </div>
        <Input label="CPF/CNPJ Favorecido" value={formData.transferCpfCnpj} onChange={e => handleChange('transferCpfCnpj', e.target.value)} required error={errors.transferCpfCnpj} />
        <Input label="Nome Favorecido" value={formData.transferBeneficiaryName} onChange={e => handleChange('transferBeneficiaryName', e.target.value)} required error={errors.transferBeneficiaryName} />
        <div className="pt-2 space-y-2">
            <label className="block text-sm font-medium text-slate-700">Comprovante de Dados (Opcional)</label>
            <label className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer block">
                <input type="file" multiple className="sr-only" onChange={(e) => handleFileChange(e, 'transfer')} />
                <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="w-6 h-6 text-slate-400" />
                    <p className="font-bold text-slate-700 text-xs">Anexar arquivos</p>
                    <div className="mt-1 px-3 py-1 bg-white/50 rounded-full">
                        <p className="text-[10px] text-slate-600 font-bold">{transferFiles.length}/10 arquivos selecionados</p>
                    </div>
                </div>
            </label>
            {transferFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
                    </div>
                    <button onClick={() => handleRemoveFile(idx, 'transfer')} className="p-1.5 text-slate-400 hover:text-danger"><X className="w-4 h-4" /></button>
                </div>
            ))}
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
          <button onClick={() => handleChange('isSpecificBudget', 'yes')} className={`flex-1 py-3 rounded-xl border ${formData.isSpecificBudget === 'yes' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Sim</button>
          <button onClick={() => { handleChange('isSpecificBudget', 'no'); handleChange('specificBudgetName', ''); }} className={`flex-1 py-3 rounded-xl border ${formData.isSpecificBudget === 'no' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Não</button>
        </div>
      </div>
      {formData.isSpecificBudget === 'yes' && (
        <div className="md:col-span-2">
          <Select label="Escolha a Verba" value={formData.specificBudgetName} onChange={e => handleChange('specificBudgetName', e.target.value)} required error={errors.specificBudgetName}>
            <option value="">Selecione...</option>
            {SPECIFIC_BUDGET_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
      {formData.paymentMethod === 'PIX' && (
        <div className="md:col-span-2 space-y-4">
          <label className="block text-sm font-medium text-slate-700">Tipo de chave PIX <span className="text-accent">*</span></label>
          <div className="flex flex-wrap gap-2">
            {['cpf', 'cnpj', 'email', 'phone', 'random'].map(type => (
              <button key={type} onClick={() => handleChange('pixKeyType', type)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase border transition-all ${formData.pixKeyType === type ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200'}`}>{type}</button>
            ))}
          </div>
          <Input label="Chave PIX" value={getPixKeyDisplayValue()} onChange={e => handleChange('pixKey', e.target.value)} required error={errors.pixKey} disabled={!formData.pixKeyType} />
        </div>
      )}
      {formData.paymentMethod === 'Boleto' && renderBoletoFields()}
      {formData.paymentMethod === 'Transferência' && renderTransferFields()}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-4 text-center md:text-left">Possui Nota Fiscal? <span className="text-accent">*</span></label>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => handleInvoiceOptionClick('yes')} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <FileText className="w-8 h-8" />
            <span className="font-bold">Sim, possuo</span>
          </button>
          <button onClick={() => handleInvoiceOptionClick('no')} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <AlertTriangle className="w-8 h-8" />
            <span className="font-bold">Não possuo</span>
          </button>
        </div>
      </div>
      {formData.hasInvoice === 'yes' && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Anexos da Nota Fiscal <span className="text-accent">*</span></label>
          <label className="border-2 border-dashed border-slate-200 rounded-2xl p-6 md:p-10 text-center hover:border-primary/50 transition-colors cursor-pointer block">
            <input type="file" multiple className="sr-only" onChange={(e) => handleFileChange(e, 'invoice')} />
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="w-12 h-12 text-primary" />
              <p className="font-bold text-primary text-xs">Clique para selecionar arquivos</p>
              <div className="mt-1 px-3 py-1 bg-slate-100 rounded-full">
                <p className="text-[10px] text-slate-600 font-bold">{invoiceFiles.length}/10 arquivos selecionados</p>
              </div>
            </div>
          </label>
          {invoiceFiles.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
              </div>
              <button onClick={() => handleRemoveFile(idx, 'invoice')} className="p-1.5 text-slate-400 hover:text-danger"><X className="w-4 h-4" /></button>
            </div>
          ))}
          {errors.invoiceFile && <p className="text-xs text-danger text-center">{errors.invoiceFile}</p>}
        </div>
      )}
      {formData.hasInvoice === 'no' && formData.invoiceSentViaWhatsapp && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-primary text-sm">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Compromisso de envio via WhatsApp aceito.</span>
        </div>
      )}
      {errors.invoiceSentViaWhatsapp && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-danger text-sm">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Você deve aceitar o compromisso.</span>
        </div>
      )}
      {showInvoiceCommitmentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-accent mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Compromisso de Envio</h3>
            <p className="text-slate-600 text-sm mb-6">Ao prosseguir sem a NF, você se compromete a enviá-la imediatamente via WhatsApp para o financeiro.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => { setShowInvoiceCommitmentModal(false); handleChange('hasInvoice', 'yes'); }}>Voltar</Button>
              <Button variant="primary" size="sm" onClick={() => { handleChange('invoiceSentViaWhatsapp', true); setShowInvoiceCommitmentModal(false); }}>Aceitar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <Textarea label="Descrição do Pagamento" required value={formData.description} onChange={e => handleChange('description', e.target.value)} error={errors.description} rows={4} />
      <div className={`p-4 md:p-6 rounded-2xl border ${formData.termsAccepted ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-slate-100'}`}>
        <label className="flex items-start gap-4 cursor-pointer">
          <input type="checkbox" className="mt-1 w-5 h-5 text-primary" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} />
          <div className="space-y-1">
            <p className="font-bold text-slate-800 text-sm">Li e concordo com os prazos e regras.</p>
            <p className="text-xs text-slate-500">Solicitações urgentes devem ser comunicadas via WhatsApp.</p>
          </div>
        </label>
      </div>
    </div>
  );

  const renderReview = () => {
    const items = [
      { label: 'Responsável', value: formData.requesterName },
      { label: 'Departamento', value: departments.find(d => d.id === formData.departmentId)?.name || 'N/A' },
      { label: 'Vencimento', value: new Date(formData.dueDate).toLocaleString('pt-BR') },
      { label: 'Fornecedor', value: formData.supplierName },
      { label: 'Valor', value: formatCurrency(formData.value), color: 'text-primary' },
      { label: 'Forma Pagto', value: formData.paymentMethod },
      { label: 'NF Selecionada', value: formData.hasInvoice === 'yes' ? `${invoiceFiles.length} arquivo(s)` : 'Não possui' },
      { label: 'Boleto Selecionado', value: formData.paymentMethod === 'Boleto' ? `${boletoFiles.length} arquivo(s)` : 'N/A' }
    ];

    return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-slate-800">Resumo da Solicitação</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-50">
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{item.label}</span>
                <span className={`block font-bold text-slate-800 ${item.color || ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHeader = () => (
    <div className="bg-white border-b border-slate-100 py-3 px-6 flex justify-center fixed top-0 w-full z-50">
      <div className="text-[12px] font-medium text-slate-400 tracking-tight">CSP | <span className="text-slate-600">Central de Solicitação de Pagamento</span></div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center py-12 animate-in zoom-in duration-500 max-w-lg mx-auto w-full">
      <CheckCircle className="w-20 h-20 text-primary mb-6" />
      <h2 className="text-3xl font-black text-slate-900 mb-2">Solicitação Enviada!</h2>
      <p className="text-slate-500 mb-10 text-center font-medium">Seu pedido foi registrado e entrará em análise.</p>
      <div className="w-full bg-white rounded-[2.5rem] p-10 mb-10 shadow-2xl border border-slate-50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
        <p className="text-[10px] uppercase font-black text-slate-300 tracking-[0.3em] mb-4">Código do Protocolo</p>
        <div className="flex items-center justify-center gap-4">
          <span className="text-4xl font-mono font-black text-slate-900">{generatedId}</span>
          <button onClick={() => { navigator.clipboard.writeText(generatedId); toast.success('Protocolo copiado!'); }} className="p-3 bg-slate-100 rounded-2xl hover:bg-primary/10 transition-all">
            <Copy className="w-5 h-5" />
          </button>
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
    <div className="h-[100svh] relative flex flex-col bg-slate-50 overflow-hidden">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      <OrientationDrawer isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      
      {/* Topo: Menu Compacto */}
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

      {/* Centro: Logo + Título */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10 text-center">
        <img src="/logo.png" alt="Logo" className="h-14 sm:h-16 md:h-24 mb-6 md:mb-12 drop-shadow-2xl animate-fade-up shrink-0" />
        
        <h1 className="text-3xl sm:text-4xl md:text-7xl font-bold text-slate-900 tracking-tighter mb-3 md:mb-6 animate-fade-up leading-[1.1] md:leading-tight">
          Sua plataforma de <br />
          <span className="text-primary italic font-black">pagamentos.</span>
        </h1>
        
        <p className="text-sm sm:text-base md:text-xl text-slate-500 font-medium mb-8 md:mb-14 animate-fade-up max-w-[260px] sm:max-w-xs md:max-w-none">
          Envie suas solicitações de forma guiada e segura.
        </p>
        
        {/* Rodapé: Botões */}
        <div className="flex flex-col gap-3 w-full max-w-[280px] md:max-w-sm animate-fade-up shrink-0">
          <Button size="lg" className="h-12 md:h-auto text-base md:text-lg py-0" onClick={() => setView('form')}>
            Criar Solicitação
          </Button>
          <Button variant="outline" size="lg" className="h-12 md:h-auto text-base md:text-lg py-0" onClick={() => setView('track')}>
            Acompanhar Solicitação
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      {renderHeader()}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {!isSuccess ? (
          <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 duration-700">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('welcome')} className="flex items-center gap-1.5 text-slate-400 hover:text-primary text-xs font-bold uppercase tracking-widest"><Home className="w-4 h-4" /> Início</button>
              <button onClick={() => resetForm()} className="flex items-center gap-1.5 text-danger font-bold uppercase text-[10px]"><Trash2 className="w-4 h-4" /> Limpar tudo</button>
            </div>
            <div className="mb-6">
               <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1 block">Financeiro</span>
               <h1 className="text-5xl font-bold text-slate-900 tracking-tighter mb-1">Nova Solicitação</h1>
            </div>
            <Stepper currentStep={step} />
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-50 mb-6">
              {step === 0 && renderStep1()}
              {step === 1 && renderStep2()}
              {step === 2 && renderStep3()}
              {step === 3 && renderStep4()}
              {step === 4 && renderReview()}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <button onClick={prevStep} className={`flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-sm ${step === 0 ? 'invisible' : ''}`}><ChevronLeft className="w-5 h-5" /> Voltar</button>
              {step < 4 ? (
                <Button onClick={nextStep} size="md">Próximo <ChevronRight className="w-5 h-5 ml-1.5" /></Button>
              ) : (
                <Button onClick={handleSubmit} size="md" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : <span className="flex items-center gap-1.5">Confirmar <CheckCircle className="w-5 h-5" /></span>}
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