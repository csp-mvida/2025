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
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 
  const [isUploadingBoleto, setIsUploadingBoleto] = useState(false);
  const [isUploadingTransfer, setIsUploadingTransfer] = useState(false); // NEW state for transfer upload
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false); 
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [showInvoiceCommitmentModal, setShowInvoiceCommitmentModal] = useState(false);
  
  const [currentProtocolId, setCurrentProtocolId] = useState(''); // Protocolo/ID do rascunho no DB
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [initializationAttempts, setInitializationAttempts] = useState(0); // Tarefa 3: Contar tentativas

  const isUrgent = checkUrgency(formData.dueDate);

  const getDateValue = () => formData.dueDate ? formData.dueDate.split('T')[0] : '';
  const getTimeValue = () => formData.dueDate && formData.dueDate.includes('T') ? formData.dueDate.split('T')[1].substring(0, 5) : '';

  // Tarefa 2: Função para criar o rascunho no DB
  const createInitialDraft = useCallback(async (deptId: string, authId: string, accountId: string) => {
    const protocol = await createDraftRequest(deptId, authId, accountId);
    if (protocol) {
      setCurrentProtocolId(protocol);
      // Atualiza o rascunho local com o novo protocolo
      localStorage.setItem('csp_draft', JSON.stringify({ ...formData, id: protocol }));
      console.log(`[App] Draft created with DB protocol: ${protocol}`);
    } else {
      console.error(`Falha ao criar rascunho inicial.`);
      // Se falhar, incrementa a tentativa para o useEffect decidir o que fazer
      setInitializationAttempts(prev => prev + 1);
    }
  }, [formData]);

  // Efeito para carregar dados de lookup
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

    const saved = localStorage.getItem('csp_draft');
    if (saved) setHasSavedDraft(true);
    
  }, []); // Executa apenas uma vez ao montar

  // Efeito para inicializar o protocolo (Tarefa 1, 2, 3)
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
          // 2. OU recupera um draft existente e valida se ele ainda existe no DB
          const existingRequest = await getRequestByProtocol(loadedData.id);
          if (existingRequest && existingRequest.status === 'draft') {
            protocolToUse = existingRequest.id;
            setFormData(loadedData);
            setHasSavedDraft(true);
            toast.success('Rascunho carregado!');
          } else {
            // Draft local existe, mas não é válido/não está no DB (ou foi submetido)
            localStorage.removeItem('csp_draft');
            setHasSavedDraft(false);
            loadedData = null;
          }
        }
      }

      if (!protocolToUse) {
        // 2. Crie um novo registro DRAFT
        console.log('[App] Creating new draft...');
        // Usamos os IDs do primeiro item de cada lista como fallback para criar o rascunho
        await createInitialDraft(departments[0].id, authorizers[0].id, paymentAccounts[0].id);
      } else {
        setCurrentProtocolId(protocolToUse);
      }
    };

    // Tarefa 3: Tenta re-inicializar automaticamente uma vez se falhar
    if (initializationAttempts === 0) {
      initializeProtocol();
    } else if (initializationAttempts === 1) {
      // Segunda tentativa (re-inicialização automática)
      console.warn('[App] Retrying draft creation...');
      initializeProtocol();
    } else if (initializationAttempts >= 2) {
      // Se falhar duas vezes, mostra a mensagem de erro
      toast.error('Falha ao iniciar o formulário. Tente recarregar.');
    }

  }, [isDataLoaded, view, currentProtocolId, departments, authorizers, paymentAccounts, createInitialDraft, initializationAttempts]);


  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => {
        let processedValue = value;

        // Limpeza de caracteres não numéricos para PIX
        if (field === 'pixKey') {
            if (prev.pixKeyType === 'cpf' || prev.pixKeyType === 'cnpj' || prev.pixKeyType === 'phone') {
                processedValue = value.replace(/\D/g, '');
            }
        }

        const newState = { ...prev, [field]: processedValue };

        // Task 5: Clear specific fields when payment method changes
        if (field === 'paymentMethod') {
            newState.pixKey = '';
            newState.pixKeyType = '';
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

        // Limpar chave se mudar o tipo de chave PIX
        if (field === 'pixKeyType') {
            newState.pixKey = '';
        }
        
        // Apply formatting for transfer CPF/CNPJ
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
    if (!currentProtocolId) {
      toast.error('Erro: Protocolo não definido para remover arquivo.');
      return;
    }
    
    const isInvoice = type === 'invoice';
    const isBoleto = type === 'boleto';
    const isTransfer = type === 'transfer';
    
    const updatedMeta = [...(isInvoice ? (formData.invoiceFilesMeta || []) : isBoleto ? (formData.boletoFilesMeta || []) : (formData.transferFilesMeta || []))];
    const updatedUrls = [...(isInvoice ? (formData.invoiceUrls || []) : isBoleto ? (formData.boletoUrls || []) : (formData.transferUrls || []))];
    
    updatedMeta.splice(idx, 1);
    updatedUrls.splice(idx, 1);
    
    const serializedUrls = updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : '';
    
    if (isInvoice) {
      setFormData(prev => ({
        ...prev,
        invoiceFilesMeta: updatedMeta,
        invoiceUrls: updatedUrls,
        invoiceUrl: serializedUrls
      }));
      await updateRequestAttachments(currentProtocolId, 'invoice', serializedUrls);
    } else if (isBoleto) {
      setFormData(prev => ({
        ...prev,
        boletoFilesMeta: updatedMeta,
        boletoUrls: updatedUrls,
        boletoUrl: serializedUrls
      }));
      await updateRequestAttachments(currentProtocolId, 'boleto', serializedUrls);
    } else if (isTransfer) { // Transfer
        setFormData(prev => ({
            ...prev,
            transferFilesMeta: updatedMeta,
            transferUrls: updatedUrls,
            transferUrl: serializedUrls
        }));
        await updateRequestAttachments(currentProtocolId, 'transfer', serializedUrls);
    }
    toast.success('Arquivo removido.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = e.target.files;
    // Tarefa 3: Não permitir upload se o protocolo não estiver inicializado
    if (!files || files.length === 0) return;
    if (!currentProtocolId) {
      toast.error('Erro: Protocolo não inicializado. Tente recarregar o formulário.');
      return;
    }

    const isInvoice = type === 'invoice';
    const isBoleto = type === 'boleto';
    const isTransfer = type === 'transfer';
    
    const MAX_FILES = 10;
    const MAX_SIZE_MB = 100;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

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
      const newUrls: string[] = isInvoice ? [...(formData.invoiceUrls || [])] : isBoleto ? [...(formData.boletoUrls || [])] : [...(formData.transferUrls || [] )];
      const newMeta: FileMeta[] = isInvoice ? [...(formData.invoiceFilesMeta || [])] : isBoleto ? [...(formData.boletoFilesMeta || [])] : [...(formData.transferFilesMeta || [])];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`Arquivo "${file.name}" excede o limite de ${MAX_SIZE_MB}MB.`, { id: toastId });
          throw new Error('File too large');
        }

        // Tarefa 5: uploadInvoice usa currentProtocolId
        const url = await uploadInvoice(file, type, currentProtocolId);
        newUrls.push(url);
        newMeta.push({ name: file.name, size: file.size, url });
      }

      const serializedUrls = JSON.stringify(newUrls);
      
      if (isInvoice) {
        setFormData(prev => ({
          ...prev,
          invoiceUrls: newUrls,
          invoiceFilesMeta: newMeta,
          invoiceUrl: serializedUrls
        }));
        await updateRequestAttachments(currentProtocolId, 'invoice', serializedUrls);
      } else if (isBoleto) {
        setFormData(prev => ({
          ...prev,
          boletoUrls: newUrls,
          boletoFilesMeta: newMeta,
          boletoUrl: serializedUrls
        }));
        await updateRequestAttachments(currentProtocolId, 'boleto', serializedUrls);
      } else if (isTransfer) { // Transfer
        setFormData(prev => ({
            ...prev,
            transferUrls: newUrls,
            transferFilesMeta: newMeta,
            transferUrl: serializedUrls
        }));
        await updateRequestAttachments(currentProtocolId, 'transfer', serializedUrls);
      }

      toast.success('Arquivos enviados!', { id: toastId });
    } catch (error: any) {
      console.error("Upload error", error);
      if (error.message !== 'File too large') {
        toast.error('Falha no upload. Tente novamente.', { id: toastId });
      }
    } finally {
      if (isInvoice) setIsUploading(false);
      else if (isBoleto) setIsUploadingBoleto(false);
      else if (isTransfer) setIsUploadingTransfer(false);
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
      if (formData.isSpecificBudget === 'yes' && !formData.specificBudgetName) errs.specificBudgetName = "Selecione a verba";
      if (!formData.supplierName) errs.supplierName = "Fornecedor é obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) errs.value = "Valor é obrigatório";
      if (!formData.paymentMethod) errs.paymentMethod = "Forma é obrigatória";
      
      if (formData.paymentMethod === 'PIX') {
        if (!formData.pixKeyType) {
          errs.pixKeyType = "Selecione o tipo de chave PIX";
          toast.error("Selecione o tipo de chave PIX.");
        }
        if (!formData.pixKey) errs.pixKey = "Chave PIX é obrigatória";
        
        if (formData.pixKeyType === 'email' && formData.pixKey && (!formData.pixKey.includes('@') || !formData.pixKey.includes('.'))) {
          errs.pixKey = "E-mail inválido";
        }
      }
      
      if (formData.paymentMethod === 'Boleto' && (!formData.boletoUrls || formData.boletoUrls.length === 0)) errs.boletoFile = "Anexo do boleto necessário";
      
      // NEW Transfer validation
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
    // 1. Validação final (redundante, mas seguro)
    if (!validateStep(4)) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!currentProtocolId) {
      toast.error('Erro: Protocolo não inicializado. Tentando re-inicializar...');
      if (departments.length > 0 && authorizers.length > 0 && paymentAccounts.length > 0) {
        await createInitialDraft(departments[0].id, authorizers[0].id, paymentAccounts[0].id);
      }
      if (!currentProtocolId) return;
    }
    
    setIsSubmitting(true);
    
    // 2. Mapeamento de IDs
    const selectedAuthorizer = authorizers.find(a => a.name === formData.authorizer);
    const selectedAccount = paymentAccounts.find(p => p.label === formData.paymentAccount);
    const isUrgent = checkUrgency(formData.dueDate);

    if (!selectedAuthorizer) {
        console.error('Mapeamento falhou: Autorizador não encontrado.', { authorizerName: formData.authorizer });
        toast.error('Erro de mapeamento: Autorizador não encontrado.');
        setIsSubmitting(false);
        return;
    }
    if (!selectedAccount) {
        console.error('Mapeamento falhou: Conta de Pagamento não encontrada.', { accountLabel: formData.paymentAccount });
        toast.error('Erro de mapeamento: Conta de Pagamento não encontrada.');
        setIsSubmitting(false);
        return;
    }

    // 3. Submissão (UPDATE no registro DRAFT)
    if (await submitRequest(formData, currentProtocolId, selectedAuthorizer.id, selectedAccount.id, isUrgent)) {
      setGeneratedId(currentProtocolId);
      setIsSuccess(true);
      localStorage.removeItem('csp_draft');
      toast.success('Solicitação enviada com sucesso!');
    } else {
      // O erro detalhado já é logado dentro de submitRequest (services/api.ts)
      toast.error('Erro ao enviar solicitação. Verifique o console para detalhes.');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_DATA });
    setStep(0);
    setIsSuccess(false);
    setCurrentProtocolId(''); // Limpa o protocolo
    setInitializationAttempts(0); // Reseta tentativas
    localStorage.removeItem('csp_draft');
    // O useEffect de inicialização cuidará de criar um novo rascunho
    setView('welcome');
  };

  const saveDraft = () => {
    if (!currentProtocolId) {
      toast.error('Não é possível salvar: Protocolo não inicializado.');
      return;
    }
    // Adiciona o ID do protocolo ao rascunho antes de salvar
    const draftToSave = { ...formData, id: currentProtocolId };
    localStorage.setItem('csp_draft', JSON.stringify(draftToSave));
    setHasSavedDraft(true);
    toast.success('Rascunho salvo localmente!');
  };

  const clearDraft = () => {
    localStorage.removeItem('csp_draft');
    setFormData({ ...INITIAL_DATA });
    setHasSavedDraft(false);
    setCurrentProtocolId(''); // Limpa o protocolo
    setInitializationAttempts(0); // Reseta tentativas
    // O useEffect de inicialização cuidará de criar um novo rascunho
    toast.success('Dados limpos.');
  };

  const handleInvoiceOptionClick = (option: 'yes' | 'no') => {
    handleChange('hasInvoice', option);
    if (option === 'no') {
      setShowInvoiceCommitmentModal(true);
      handleChange('invoiceSentViaWhatsapp', false);
    } else {
      handleChange('invoiceSentViaWhatsapp', false);
      setErrors(prev => {
        const next = { ...prev };
        delete next.invoiceSentViaWhatsapp;
        return next;
      });
    }
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
      <div className="space-y-1">
        <Input label="WhatsApp para contato" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required error={errors.whatsapp} placeholder="(00) 00000-0000" />
        <p className="text-[10px] text-slate-400">Digite com DDD (10 ou 11 dígitos)</p>
      </div>
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
          <input 
            type="date" 
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
            value={getDateValue()} 
            onChange={e => handleChange('dueDate', `${e.target.value}T${getTimeValue() || '12:00'}`)} 
          />
          {showTimeInput ? (
            <div className="flex-1 flex gap-2 animate-in slide-in-from-left-2 duration-300">
              <input 
                type="time" 
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none bg-primary/5 border-primary/30" 
                value={getTimeValue()} 
                onChange={e => handleChange('dueDate', `${getDateValue()}T${e.target.value}`)} 
              />
              <button onClick={() => { setShowTimeInput(false); handleChange('dueDate', `${getDateValue()}T12:00`); }} className="p-3 text-slate-400 hover:text-danger transition-colors"><Trash2 className="w-5 h-5" /></button>
            </div>
          ) : (
            <button onClick={() => setShowTimeInput(true)} className="flex-1 px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm font-bold flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-all group">
              <Clock className="w-4 h-4 group-hover:scale-110 transition-transform" /> Definir horário específico?
            </button>
          )}
        </div>
        {errors.dueDate && <p className="text-xs text-danger mt-1">{errors.dueDate}</p>}
        <UrgencyAlert isUrgent={isUrgent} />
      </div>
    </div>
  );

  const renderBoletoFields = () => (
    <div className="md:col-span-2 animate-in slide-in-from-top-4 duration-300 space-y-4">
      <label className="block text-sm font-medium text-slate-700">Anexos do Boleto <span className="text-accent">*</span></label>
      <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer relative group">
        <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'boleto')} />
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
            {isUploadingBoleto ? <RefreshCw className="w-6 h-6 text-primary animate-spin" /> : <UploadCloud className="w-6 h-6 text-primary" />}
          </div>
          <p className="font-bold text-primary text-xs md:text-sm">Clique ou arraste até 10 boletos aqui</p>
          <p className="text-[9px] md:text-[10px] text-slate-400">PDF ou Imagem (Máx 100MB por arquivo)</p>
          <div className="mt-1 px-3 py-1 bg-white/50 rounded-full">
            <p className="text-[10px] text-slate-600 font-bold">{formData.boletoFilesMeta?.length || 0}/10 boletos anexados</p>
          </div>
        </div>
      </div>

      {/* Lista de Boletos Enviados */}
      {formData.boletoFilesMeta && formData.boletoFilesMeta.length > 0 && (
        <div className="space-y-2 animate-in fade-in duration-300">
          {formData.boletoFilesMeta.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 group">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <button onClick={() => handleRemoveFile(idx, 'boleto')} className="p-1.5 text-slate-400 hover:text-danger hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
      {errors.boletoFile && <p className="text-xs text-danger mt-1">{errors.boletoFile}</p>}
    </div>
  );

  const renderTransferFields = () => (
    <div className="md:col-span-2 animate-in slide-in-from-top-4 duration-300 space-y-4">
        <Input label="Banco" value={formData.transferBankName} onChange={e => handleChange('transferBankName', e.target.value)} required error={errors.transferBankName} placeholder="Nome do Banco" />
        
        <Select label="Tipo de Conta" value={formData.transferAccountType} onChange={e => handleChange('transferAccountType', e.target.value)} required error={errors.transferAccountType}>
            <option value="">Selecione...</option>
            <option value="Corrente">Conta Corrente</option>
            <option value="Poupança">Conta Poupança</option>
        </Select>

        <div className="grid grid-cols-2 gap-4">
            <Input label="Agência (c/ dígito)" value={formData.transferAgency} onChange={e => handleChange('transferAgency', e.target.value)} required error={errors.transferAgency} placeholder="Ex: 0000-0" />
            <Input label="Conta (c/ dígito)" value={formData.transferAccount} onChange={e => handleChange('transferAccount', e.target.value)} required error={errors.transferAccount} placeholder="Ex: 000000-0" />
        </div>

        <Input label="CPF/CNPJ do Favorecido" value={formData.transferCpfCnpj} onChange={e => handleChange('transferCpfCnpj', e.target.value)} required error={errors.transferCpfCnpj} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
        <Input label="Nome do Favorecido" value={formData.transferBeneficiaryName} onChange={e => handleChange('transferBeneficiaryName', e.target.value)} required error={errors.transferBeneficiaryName} placeholder="Nome completo ou Razão Social" />

        {/* Upload Comprovante Bancário (Opcional) */}
        <div className="pt-4 space-y-2">
            <label className="block text-sm font-medium text-slate-700">Comprovante de Dados Bancários (Opcional)</label>
            <div className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer relative group">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'transfer')} />
                <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                        {isUploadingTransfer ? <RefreshCw className="w-5 h-5 text-primary animate-spin" /> : <UploadCloud className="w-5 h-5 text-primary" />}
                    </div>
                    <p className="font-bold text-slate-700 text-xs md:text-sm">Clique para anexar comprovante (Opcional)</p>
                    <p className="text-[9px] md:text-[10px] text-slate-400">Print, PDF ou Imagem</p>
                    <div className="mt-1 px-3 py-1 bg-white/50 rounded-full">
                        <p className="text-[10px] text-slate-600 font-bold">{formData.transferFilesMeta?.length || 0}/10 arquivos anexados</p>
                    </div>
                </div>
            </div>
            
            {/* Lista de Arquivos Enviados */}
            {formData.transferFilesMeta && formData.transferFilesMeta.length > 0 && (
                <div className="space-y-2 animate-in fade-in duration-300">
                    {formData.transferFilesMeta.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                            <button onClick={() => handleRemoveFile(idx, 'transfer')} className="p-1.5 text-slate-400 hover:text-danger hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}
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
          <button onClick={() => handleChange('isSpecificBudget', 'yes')} className={`flex-1 py-3 rounded-xl border transition-all ${formData.isSpecificBudget === 'yes' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Sim</button>
          <button onClick={() => { handleChange('isSpecificBudget', 'no'); handleChange('specificBudgetName', ''); }} className={`flex-1 py-3 rounded-xl border transition-all ${formData.isSpecificBudget === 'no' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Não</button>
        </div>
      </div>
      {formData.isSpecificBudget === 'yes' && (
        <div className="md:col-span-2 animate-in slide-in-from-top-2 duration-300">
          <Select label="Escolha a Verba Específica" value={formData.specificBudgetName} onChange={e => handleChange('specificBudgetName', e.target.value)} required error={errors.specificBudgetName}>
            <option value="">Selecione a verba...</option>
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
        <div className="md:col-span-2 animate-in slide-in-from-top-4 duration-300 space-y-5">
          <div className="space-y-3">
            <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5 text-center md:text-left leading-tight">Tipo de chave PIX <span className="text-accent">*</span></label>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              {[
                { id: 'cpf', label: 'CPF' },
                { id: 'cnpj', label: 'CNPJ' },
                { id: 'email', label: 'E-mail' },
                { id: 'phone', label: 'Telefone' },
                { id: 'random', label: 'Aleatória' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => handleChange('pixKeyType', type.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest border transition-all ${
                    formData.pixKeyType === type.id 
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-primary/50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            {errors.pixKeyType && <p className="text-xs text-danger text-center md:text-left">{errors.pixKeyType}</p>}
          </div>
          
          <Input 
            label="Chave PIX" 
            value={getPixKeyDisplayValue()} 
            onChange={e => handleChange('pixKey', e.target.value)} 
            required 
            error={errors.pixKey} 
            placeholder={!formData.pixKeyType ? "Selecione o tipo primeiro" : `Digite sua chave ${formData.pixKeyType?.toUpperCase()} aqui`}
            disabled={!formData.pixKeyType}
            className="font-mono"
          />
        </div>
      )}
      {formData.paymentMethod === 'Boleto' && renderBoletoFields()}
      {formData.paymentMethod === 'Transferência' && renderTransferFields()}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3 md:mb-4 text-center md:text-left">Possui Nota Fiscal? <span className="text-accent">*</span></label>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <button onClick={() => handleInvoiceOptionClick('yes')} className={`flex flex-col items-center gap-2 md:gap-3 p-4 md:p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <FileText className="w-6 h-6 md:w-8 md:h-8" />
            <span className="font-bold text-xs md:text-base">Sim, possuo</span>
          </button>
          <button onClick={() => handleInvoiceOptionClick('no')} className={`flex flex-col items-center gap-2 md:gap-3 p-4 md:p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />
            <span className="font-bold text-xs md:text-base">Não possuo</span>
          </button>
        </div>
      </div>
      
      {formData.hasInvoice === 'yes' && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700 text-center md:text-left">Anexos da Nota Fiscal <span className="text-accent">*</span></label>
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 md:p-10 text-center hover:border-primary/50 transition-colors cursor-pointer relative group">
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'invoice')} />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-primary/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                {isUploading ? <RefreshCw className="w-6 h-6 text-primary animate-spin" /> : <UploadCloud className="w-6 h-6 text-primary" />}
              </div>
              <p className="font-bold text-primary text-xs md:text-sm">Clique ou arraste até 10 arquivos aqui</p>
              <p className="text-[10px] md:text-xs text-slate-500 font-medium">Limite individual de 100MB por arquivo</p>
              <div className="mt-1 px-3 py-1 bg-slate-100 rounded-full">
                <p className="text-[10px] text-slate-600 font-bold">{formData.invoiceFilesMeta?.length || 0}/10 arquivos selecionados</p>
              </div>
            </div>
          </div>

          {/* Lista de Arquivos Enviados */}
          {formData.invoiceFilesMeta && formData.invoiceFilesMeta.length > 0 && (
            <div className="space-y-2 mt-4 animate-in fade-in duration-300">
              {formData.invoiceFilesMeta.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <button onClick={() => handleRemoveFile(idx, 'invoice')} className="p-1.5 text-slate-400 hover:text-danger hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          {errors.invoiceFile && <p className="text-xs text-danger text-center">{errors.invoiceFile}</p>}
        </div>
      )}

      {formData.hasInvoice === 'no' && formData.invoiceSentViaWhatsapp && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-primary text-sm animate-in fade-in duration-300">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">Compromisso de envio via WhatsApp aceito.</span>
        </div>
      )}
      
      {errors.invoiceSentViaWhatsapp && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-danger text-sm animate-in shake">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium">Você deve aceitar o compromisso para prosseguir.</span>
        </div>
      )}

      {showInvoiceCommitmentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 text-center">
              <AlertTriangle className="w-10 h-10 text-accent mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Compromisso de Envio</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Ao prosseguir sem a Nota Fiscal, você se compromete a enviar o comprovante imediatamente após o envio desta solicitação para o WhatsApp do Departamento Financeiro.</p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => { setShowInvoiceCommitmentModal(false); handleChange('hasInvoice', 'yes'); }}>Voltar</Button>
              <Button variant="primary" size="sm" onClick={() => { handleChange('invoiceSentViaWhatsapp', true); setShowInvoiceCommitmentModal(false); }}>Aceitar e Continuar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Textarea label="Descrição do Pagamento" required value={formData.description} onChange={e => handleChange('description', e.target.value)} error={errors.description} rows={4} placeholder="Ex: Pagamento referente à compra de materiais de escritório..." />
      <div className={`p-4 md:p-6 rounded-2xl border transition-all ${formData.termsAccepted ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-slate-100'}`}>
        <label className="flex items-start gap-3 md:gap-4 cursor-pointer">
          <input type="checkbox" className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} />
          <div className="space-y-1">
            <p className="font-bold text-slate-800 text-xs md:text-sm">Confirmo que li e concordo com os prazos e regras.</p>
            <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed">Entendo que solicitações urgentes devem ser comunicadas via WhatsApp.</p>
          </div>
        </label>
      </div>
      {errors.termsAccepted && <p className="text-xs text-danger">{errors.termsAccepted}</p>}
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
      { label: 'Autorizador', value: formData.authorizer },
      { label: 'Verba Específica', value: formData.isSpecificBudget === 'yes' ? formData.specificBudgetName : 'Não' },
      
      // Detalhes de Pagamento
      ...(formData.paymentMethod === 'PIX' ? [
        { label: 'Tipo Chave PIX', value: formData.pixKeyType?.toUpperCase() || 'N/A' },
        { label: 'Chave PIX', value: getPixKeyDisplayValue() || 'N/A' }
      ] : []),
      
      ...(formData.paymentMethod === 'Transferência' ? [
        { label: 'Banco', value: formData.transferBankName || 'N/A' },
        { label: 'Tipo de Conta', value: formData.transferAccountType || 'N/A' },
        { label: 'Agência/Conta', value: `${formData.transferAgency || 'N/A'} / ${formData.transferAccount || 'N/A'}` },
        { label: 'Favorecido', value: formData.transferBeneficiaryName || 'N/A' },
        { label: 'CPF/CNPJ', value: formData.transferCpfCnpj || 'N/A' },
        { label: 'Anexo Transferência', value: formData.transferFilesMeta?.length ? `${formData.transferFilesMeta.length} arquivo(s) enviado(s)` : 'Nenhum', full: false }
      ] : []),

      { label: 'Descrição', value: formData.description, full: true },
      { label: 'Anexos Nota', value: formData.invoiceFilesMeta?.length ? `${formData.invoiceFilesMeta.length} arquivo(s)` : (formData.hasInvoice === 'no' ? 'Pendente WhatsApp' : 'Nenhum'), full: false },
      { label: 'Anexos Boleto', value: formData.boletoFilesMeta?.length ? `${formData.boletoFilesMeta.length} arquivo(s)` : 'Nenhum', full: false }
    ];

    return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-slate-800 text-xs md:text-base">Resumo da Solicitação</h3>
          </div>
          <div className="p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            {items.map((item, i) => (
              <div key={i} className={`p-3 md:p-4 rounded-xl border border-slate-50 ${item.full ? 'md:col-span-2' : ''}`}>
                <span className="block text-[9px] md:text-[10px] uppercase font-bold text-slate-400 mb-1">{item.label}</span>
                <span className={`block font-bold text-slate-800 text-xs md:text-base ${item.color || ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHeader = () => (
    <div className="bg-white border-b border-slate-100 py-2 md:py-3 px-6 flex justify-center fixed top-0 w-full z-50">
      <div className="text-[9px] md:text-[12px] font-medium text-slate-400 tracking-tight">CSP | <span className="text-slate-600">Central de Solicitação de Pagamento</span></div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-6 md:py-12 animate-in zoom-in duration-500 max-w-lg mx-auto w-full">
      <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
        <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-primary" />
      </div>
      <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2 text-center">Solicitação Enviada!</h2>
      <p className="text-sm md:text-base text-slate-500 mb-8 md:mb-10 text-center font-medium">Seu pedido foi registrado e entrará em análise.</p>
      
      <div className="w-full bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 mb-10 shadow-2xl shadow-primary/10 border border-slate-50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 md:h-1.5 bg-primary"></div>
        <p className="text-[10px] uppercase font-black text-slate-300 tracking-[0.3em] mb-4">Código do Protocolo</p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <span className="text-2xl md:text-4xl font-mono font-black text-slate-900 tracking-tighter">{generatedId}</span>
          <button onClick={() => { navigator.clipboard.writeText(generatedId); setIsIdCopied(true); setTimeout(() => setIsIdCopied(false), 2000); toast.success('Protocolo copiado!'); }} className={`p-3 rounded-xl md:rounded-2xl transition-all ${isIdCopied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary'}`}>
            <Copy className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full px-4">
        <Button onClick={resetForm} fullWidth size="lg" className="rounded-xl md:rounded-2xl shadow-xl py-4 md:py-5 font-black uppercase tracking-widest text-sm md:text-base">Voltar ao Início</Button>
        <Button variant="ghost" onClick={() => setView('track')} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Acompanhar Status</Button>
      </div>
    </div>
  );

  if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return (
    <div className="min-h-screen relative bg-slate-50 flex items-center justify-center p-4 md:p-6">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      {renderHeader()}
      <RequestTracker 
        initialProtocol={generatedId} 
        onBack={() => setView('welcome')} 
        departments={departments}
        authorizers={authorizers}
        paymentAccounts={paymentAccounts}
      />
    </div>
  );

  // Se a view for 'welcome', renderiza a tela de boas-vindas
  if (view === 'welcome') return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 overflow-x-hidden">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      <OrientationDrawer isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      
      <header className="relative z-30">
        <div className="bg-primary py-2 px-4 md:px-6 flex items-center shadow-lg relative h-10 md:h-14">
          <div className="flex md:hidden justify-between w-full">
            <button onClick={() => setView('login')} className="flex items-center gap-2 text-white font-black text-[11px] uppercase tracking-[0.2em]">
              <Lock className="w-3.5 h-3.5" /> Administração
            </button>
            <button onClick={() => setIsInfoOpen(true)} className="flex items-center gap-2 text-white font-black text-[9px] uppercase tracking-[0.2em]">
              <Info className="w-3.5 h-3.5" /> Regras e Prazos
            </button>
          </div>

          <div className="hidden md:flex items-center w-full justify-between">
            <div className="w-40" />
            <button onClick={() => setView('login')} className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-[0.2em] hover:text-white transition-colors">
              <Lock className="w-4 h-4" /> Administração
            </button>
            <button onClick={() => setIsInfoOpen(true)} className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-80 transition-opacity w-40 justify-end">
              <Info className="w-4 h-4" /> Regras e Prazos
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center p-4 pt-8 md:p-8 relative z-10 text-center">
        <img src="/logo.png" alt="Logo" className="h-12 md:h-24 mb-4 md:mb-12 md:-mt-20 drop-shadow-2xl animate-fade-up" />
        <div className="space-y-4 md:space-y-6 max-w-3xl mb-6 md:mb-14 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-3xl md:text-7xl font-bold text-slate-900 tracking-tighter leading-tight px-2">Sua plataforma de <span className="text-primary italic font-black">pagamentos.</span></h1>
          <p className="text-sm md:text-xl text-slate-500 font-medium px-4 md:px-8 leading-relaxed">Envie suas solicitações de forma guiada e segura.</p>
        </div>
        <div className="flex flex-col gap-4 w-full max-w-sm animate-fade-up px-4" style={{ animationDelay: '0.2s' }}>
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Button size="lg" onClick={() => setView('form')} className="relative w-full rounded-2xl py-5 md:py-6 text-lg md:text-xl font-black shadow-2xl">Criar Solicitação</Button>
          </div>
          <Button variant="outline" size="lg" onClick={() => setView('track')} className="rounded-2xl py-5 md:py-6 bg-white border-slate-200 text-slate-600 font-bold hover:border-primary/50 text-base md:text-lg">Acompanhar Solicitação</Button>
        </div>
      </div>
    </div>
  );

  // Se a view for 'form', renderiza o formulário
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-12 md:pt-16 selection:bg-primary/10">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      {renderHeader()}
      <main className="flex-1 flex flex-col items-center justify-start md:justify-center p-4 pt-6 md:p-8">
        {!isSuccess ? (
          <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 duration-700">
            <div className="flex flex-row justify-between items-center gap-4 mb-6 md:mb-6 px-1">
              <button onClick={() => setView('welcome')} className="flex items-center gap-1.5 text-slate-400 hover:text-primary transition-colors text-[9px] md:text-xs font-bold uppercase tracking-widest"><Home className="w-3.5 h-3.5 md:w-4 md:h-4" /> Início</button>
              <div className="flex gap-2 md:gap-4">
                <button onClick={clearDraft} className="flex items-center gap-1.5 text-danger hover:opacity-80 transition-opacity text-[8px] md:text-[10px] font-bold uppercase"><Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Limpar</button>
                <button onClick={saveDraft} className="flex items-center gap-1.5 text-primary border border-primary/20 bg-primary/5 px-2 py-1 md:py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-[8px] md:text-[10px] font-bold uppercase"><Save className="w-3 h-3 md:w-3.5 md:h-3.5" /> Salvar</button>
              </div>
            </div>

            <div className="mb-6 md:mb-6 text-center md:text-left">
               <span className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1 block">Financeiro</span>
               <h1 className="text-2xl md:text-5xl font-bold text-slate-900 tracking-tighter mb-1">Nova Solicitação</h1>
            </div>

            <Stepper currentStep={step} />

            <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 shadow-2xl shadow-slate-200/50 border border-slate-50 mb-6 md:mb-6">
              {step === 0 && renderStep1()}
              {step === 1 && renderStep2()}
              {step === 2 && renderStep3()}
              {step === 3 && renderStep4()}
              {step === 4 && renderReview()}
            </div>

            <div className="flex justify-between items-center pt-6 md:pt-4 border-t border-slate-200">
              <button onClick={prevStep} className={`flex items-center gap-1.5 md:gap-2 text-slate-400 hover:text-slate-600 font-bold text-xs md:text-sm transition-all ${step === 0 ? 'invisible' : ''}`}><ChevronLeft className="w-4 h-4 md:w-5 md:h-5" /> Voltar</button>
              {step < 4 ? (
                <Button onClick={nextStep} size="md" className="rounded-xl px-6 md:px-10 py-3 md:py-4 shadow-xl text-xs md:text-base">Próximo <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1.5" /></Button>
              ) : (
                <Button onClick={handleSubmit} size="md" disabled={isSubmitting} className="rounded-xl px-6 md:px-10 py-3 md:py-4 shadow-xl bg-primaryDark text-xs md:text-base">
                  {isSubmitting ? 'Enviando...' : <span className="flex items-center gap-1.5">Confirmar <CheckCircle className="w-4 h-4 md:w-5 md:h-5" /></span>}
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