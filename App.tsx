import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { URGENCY_THRESHOLD_HOURS, SPECIFIC_BUDGET_OPTIONS } from './constants';
import { formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, generateId } from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, 
  submitRequest, uploadInvoice, createDraftRequest, updateRequestAttachments 
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
  const [formData, setFormData] = useState<CSPFormData>({ ...INITIAL_DATA, boletoUrl: '' });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [authorizers, setAuthorizers] = useState<{ id: string; name: string }[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; label: string }[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 
  const [isUploadingBoleto, setIsUploadingBoleto] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false); 
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [showInvoiceCommitmentModal, setShowInvoiceCommitmentModal] = useState(false);
  
  const [currentProtocolId, setCurrentProtocolId] = useState(generateId());

  const isUrgent = checkUrgency(formData.dueDate);

  const getDateValue = () => formData.dueDate ? formData.dueDate.split('T')[0] : '';
  const getTimeValue = () => formData.dueDate && formData.dueDate.includes('T') ? formData.dueDate.split('T')[1].substring(0, 5) : '';

  const createInitialDraft = useCallback(async (protocolId: string) => {
    const success = await createDraftRequest(protocolId);
    if (!success) {
      console.error(`Falha ao criar rascunho inicial para o protocolo ${protocolId}.`);
    }
  }, []);

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
    };
    loadData();

    const saved = localStorage.getItem('csp_draft');
    if (saved) setHasSavedDraft(true);
    
    createInitialDraft(currentProtocolId);
  }, [currentProtocolId, createInitialDraft]);

  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRemoveFile = async (index: number) => {
    const updatedMeta = [...(formData.invoiceFilesMeta || [])];
    const updatedUrls = [...(formData.invoiceUrls || [])];
    
    updatedMeta.splice(index, 1);
    updatedUrls.splice(index, 1);
    
    const serializedUrls = JSON.stringify(updatedUrls);
    
    setFormData(prev => ({
      ...prev,
      invoiceFilesMeta: updatedMeta,
      invoiceUrls: updatedUrls,
      invoiceUrl: updatedUrls.length > 0 ? serializedUrls : ''
    }));

    await updateRequestAttachments(currentProtocolId, 'invoice', updatedUrls.length > 0 ? serializedUrls : '');
    toast.success('Arquivo removido.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const isInvoice = type === 'invoice';
    const MAX_FILES = 10;
    const MAX_SIZE_MB = 100;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (isInvoice) {
      const currentCount = formData.invoiceFilesMeta?.length || 0;
      if (currentCount + files.length > MAX_FILES) {
        toast.error(`Limite máximo de ${MAX_FILES} anexos excedido.`);
        return;
      }
    }

    const toastId = toast.loading(isInvoice ? `Enviando ${files.length} arquivo(s)...` : 'Enviando boleto...');
    
    if (isInvoice) setIsUploading(true);
    else setIsUploadingBoleto(true);

    try {
      const newUrls: string[] = isInvoice ? [...(formData.invoiceUrls || [])] : [];
      const newMeta: FileMeta[] = isInvoice ? [...(formData.invoiceFilesMeta || [])] : [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`Arquivo "${file.name}" excede o limite de ${MAX_SIZE_MB}MB.`, { id: toastId });
          throw new Error('File too large');
        }

        const url = await uploadInvoice(file, type, currentProtocolId);
        
        if (isInvoice) {
          newUrls.push(url);
          newMeta.push({ name: file.name, size: file.size, url });
        } else {
          setFormData(prev => ({ 
            ...prev, 
            boletoUrl: url, 
            boletoFileMeta: { name: file.name, size: file.size } 
          }));
          await updateRequestAttachments(currentProtocolId, 'boleto', url);
        }
      }

      if (isInvoice) {
        const serializedUrls = JSON.stringify(newUrls);
        setFormData(prev => ({
          ...prev,
          invoiceUrls: newUrls,
          invoiceFilesMeta: newMeta,
          invoiceUrl: serializedUrls
        }));
        await updateRequestAttachments(currentProtocolId, 'invoice', serializedUrls);
      }

      toast.success(isInvoice ? 'Arquivos enviados com sucesso!' : 'Boleto enviado!', { id: toastId });
    } catch (error: any) {
      console.error("Upload error", error);
      if (error.message !== 'File too large') {
        toast.error('Falha no upload. Tente novamente.', { id: toastId });
      }
    } finally {
      if (isInvoice) setIsUploading(false);
      else setIsUploadingBoleto(false);
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
      if (formData.paymentMethod === 'Boleto' && !formData.boletoUrl) errs.boletoFile = "Anexo do boleto necessário";
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
    setIsSubmitting(true);
    const selectedAuthorizer = authorizers.find(a => a.name === formData.authorizer);
    const selectedAccount = paymentAccounts.find(p => p.label === formData.paymentAccount);
    const isUrgent = checkUrgency(formData.dueDate);

    if (!selectedAuthorizer || !selectedAccount) {
        toast.error('Erro de mapeamento: Autorizador ou Conta de Pagamento não encontrados.');
        setIsSubmitting(false);
        return;
    }

    if (await submitRequest(formData, currentProtocolId, selectedAuthorizer.id, selectedAccount.id, isUrgent)) {
      setGeneratedId(currentProtocolId);
      setIsSuccess(true);
      localStorage.removeItem('csp_draft');
      toast.success('Solicitação enviada com sucesso!');
    } else {
      toast.error('Erro ao enviar solicitação.');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_DATA, boletoUrl: '' });
    setStep(0);
    setIsSuccess(false);
    setCurrentProtocolId(generateId());
    setView('welcome');
  };

  const saveDraft = () => {
    const { invoiceFile, ...data } = formData;
    localStorage.setItem('csp_draft', JSON.stringify(data));
    setHasSavedDraft(true);
    toast.success('Rascunho salvo localmente!');
  };

  const clearDraft = () => {
    localStorage.removeItem('csp_draft');
    setFormData({ ...INITIAL_DATA, boletoUrl: '' });
    setHasSavedDraft(false);
    setCurrentProtocolId(generateId());
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
      {formData.paymentMethod === 'Boleto' && (
        <div className="md:col-span-2 animate-in slide-in-from-top-4 duration-300">
          <label className="block text-sm font-medium text-slate-700 mb-2">Anexo do Boleto <span className="text-accent">*</span></label>
          <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-4 md:p-6 text-center hover:border-primary/50 transition-colors cursor-pointer relative group">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'boleto')} />
            <div className="flex items-center justify-center gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                {isUploadingBoleto ? <RefreshCw className="w-5 h-5 md:w-6 md:h-6 text-primary animate-spin" /> : <UploadCloud className="w-5 h-5 md:w-6 md:h-6 text-primary" />}
              </div>
              <div className="text-left overflow-hidden">
                <p className="font-bold text-primary text-xs md:text-sm truncate max-w-[180px] md:max-w-xs">{formData.boletoFileMeta?.name || "Anexe o arquivo do boleto aqui"}</p>
                <p className="text-[9px] md:text-[10px] text-slate-400">PDF ou Imagem (Máx 100MB)</p>
              </div>
            </div>
          </div>
          {errors.boletoFile && <p className="text-xs text-danger mt-1">{errors.boletoFile}</p>}
        </div>
      )}
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
                  <button onClick={() => handleRemoveFile(idx)} className="p-1.5 text-slate-400 hover:text-danger hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
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
      { label: 'Descrição', value: formData.description, full: true },
      { label: 'Anexos Nota', value: formData.invoiceFilesMeta?.length ? `${formData.invoiceFilesMeta.length} arquivo(s) enviado(s)` : (formData.hasInvoice === 'no' ? 'Pendente via WhatsApp' : 'Não possui'), full: false },
      { label: 'Anexo Boleto', value: formData.boletoUrl ? 'Enviado' : 'N/A', full: false }
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
        <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-3 border border-slate-100">
          <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />
          <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed">Verifique todas as informações antes de enviar.</p>
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