import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { URGENCY_THRESHOLD_HOURS, SPECIFIC_BUDGET_OPTIONS } from './constants';
import { formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, generateId } from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, 
  submitRequest, uploadInvoice, updateRequestAttachments 
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false); 
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [showInvoiceCommitmentModal, setShowInvoiceCommitmentModal] = useState(false);
  
  // Geramos um ID local imediatamente para servir de base para os uploads de arquivos
  const [tempProtocolId] = useState(() => generateId());

  const isUrgent = checkUrgency(formData.dueDate);

  const getDateValue = () => formData.dueDate ? formData.dueDate.split('T')[0] : '';
  const getTimeValue = () => formData.dueDate && formData.dueDate.includes('T') ? formData.dueDate.split('T')[1].substring(0, 5) : '';

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
  }, []);

  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRemoveFile = async (idx: number, type: 'invoice' | 'boleto') => {
    const isInvoice = type === 'invoice';
    const updatedMeta = [...(isInvoice ? (formData.invoiceFilesMeta || []) : (formData.boletoFilesMeta || []))];
    const updatedUrls = [...(isInvoice ? (formData.invoiceUrls || []) : (formData.boletoUrls || []))];
    
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
    } else {
      setFormData(prev => ({
        ...prev,
        boletoFilesMeta: updatedMeta,
        boletoUrls: updatedUrls,
        boletoUrl: serializedUrls
      }));
    }
    toast.success('Arquivo removido.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const isInvoice = type === 'invoice';
    const MAX_FILES = 10;
    const MAX_SIZE_MB = 100;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    const currentCount = isInvoice ? (formData.invoiceFilesMeta?.length || 0) : (formData.boletoFilesMeta?.length || 0);
    if (currentCount + files.length > MAX_FILES) {
      toast.error(`Limite máximo de ${MAX_FILES} arquivos excedido.`);
      return;
    }

    const toastId = toast.loading(`Enviando ${files.length} arquivo(s)...`);
    
    if (isInvoice) setIsUploading(true);
    else setIsUploadingBoleto(true);

    try {
      const newUrls: string[] = isInvoice ? [...(formData.invoiceUrls || [])] : [...(formData.boletoUrls || [])];
      const newMeta: FileMeta[] = isInvoice ? [...(formData.invoiceFilesMeta || [])] : [...(formData.boletoFilesMeta || [])];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`Arquivo "${file.name}" excede 100MB.`, { id: toastId });
          continue;
        }

        const url = await uploadInvoice(file, type, tempProtocolId);
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
      } else {
        setFormData(prev => ({
          ...prev,
          boletoUrls: newUrls,
          boletoFilesMeta: newMeta,
          boletoUrl: serializedUrls
        }));
      }

      toast.success('Arquivos carregados!', { id: toastId });
    } catch (error: any) {
      toast.error('Falha no upload. Tente novamente.', { id: toastId });
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
      if (formData.paymentMethod === 'Boleto' && (!formData.boletoUrls || formData.boletoUrls.length === 0)) errs.boletoFile = "Anexo do boleto necessário";
    }
    if (s === 2) {
      if (formData.hasInvoice === 'yes' && (!formData.invoiceUrls || formData.invoiceUrls.length === 0)) errs.invoiceFile = "Upload necessário";
      if (formData.hasInvoice === 'no' && !formData.invoiceSentViaWhatsapp) errs.invoiceSentViaWhatsapp = "Necessário compromisso via WhatsApp.";
    }
    if (s === 3 && !formData.description) errs.description = "Descrição é obrigatória";
    if (s === 3 && !formData.termsAccepted) errs.termsAccepted = "Aceite os termos";

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
        toast.error('Erro nos dados do formulário.');
        setIsSubmitting(false);
        return;
    }

    // Enviamos a solicitação. O banco gerará o protocolo final.
    const success = await submitRequest(formData, '', selectedAuthorizer.id, selectedAccount.id, isUrgent);
    
    if (success) {
      // Como o trigger do banco gera o protocolo baseado em tempo real, 
      // para exibir o ID correto na tela de sucesso sem atraso, 
      // vamos recriar a lógica do trigger para exibição visual ou buscar o último inserido.
      // Simplificando: o usuário receberá o protocolo na tela de sucesso após a confirmação.
      
      // Para fins visuais imediatos, usaremos o ID gerado pelo banco se retornado, 
      // ou recarregamos a busca pelo último pedido do usuário.
      // Por agora, vamos gerar o ID visual baseado no momento do envio para garantir que combine com o banco.
      const now = new Date();
      const visualId = `CSP-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      
      setGeneratedId(visualId);
      setIsSuccess(true);
      toast.success('Solicitação enviada!');
    } else {
      toast.error('Erro ao enviar. Tente novamente.');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_DATA });
    setStep(0);
    setIsSuccess(false);
    setView('welcome');
  };

  const saveDraft = () => {
    localStorage.setItem('csp_draft', JSON.stringify(formData));
    toast.success('Rascunho salvo no navegador!');
  };

  const clearDraft = () => {
    localStorage.removeItem('csp_draft');
    setFormData({ ...INITIAL_DATA });
    toast.success('Dados limpos.');
  };

  const handleInvoiceOptionClick = (option: 'yes' | 'no') => {
    handleChange('hasInvoice', option);
    if (option === 'no') {
      setShowInvoiceCommitmentModal(true);
    } else {
      handleChange('invoiceSentViaWhatsapp', false);
    }
  };

  const renderStep1 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Input label="Responsável pela solicitação" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required error={errors.requesterName} placeholder="Seu nome completo" />
      <div className="space-y-1">
        <Input label="WhatsApp para contato" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required error={errors.whatsapp} placeholder="(00) 00000-0000" />
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
          <input type="date" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T${getTimeValue() || '12:00'}`)} />
          <button onClick={() => setShowTimeInput(!showTimeInput)} className="flex-1 px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm font-bold flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-all">
            <Clock className="w-4 h-4" /> Horário específico?
          </button>
        </div>
        {showTimeInput && <input type="time" className="w-full mt-4 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 focus:ring-2 focus:ring-primary/20 outline-none animate-in slide-in-from-top-2" value={getTimeValue()} onChange={e => handleChange('dueDate', `${getDateValue()}T${e.target.value}`)} />}
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
      <Select label="Verba Específica?" value={formData.isSpecificBudget} onChange={e => handleChange('isSpecificBudget', e.target.value)}>
        <option value="no">Não</option>
        <option value="yes">Sim</option>
      </Select>
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
      {formData.paymentMethod === 'Boleto' && (
        <div className="md:col-span-2 space-y-4">
          <label className="block text-sm font-medium text-slate-700">Anexos do Boleto <span className="text-accent">*</span></label>
          <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-6 text-center hover:border-primary/50 cursor-pointer relative">
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'boleto')} />
            <UploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="font-bold text-primary text-xs">Anexe até 10 boletos aqui</p>
            <p className="text-[10px] text-slate-400">(Máx 100MB por arquivo)</p>
          </div>
          <div className="space-y-2">
            {formData.boletoFilesMeta?.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 text-xs">
                <span className="font-bold text-slate-700 truncate">{file.name}</span>
                <button onClick={() => handleRemoveFile(idx, 'boleto')} className="text-danger p-1"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => handleInvoiceOptionClick('yes')} className={`p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
          <FileText className="w-8 h-8 mx-auto mb-2" />
          <span className="font-bold text-xs">Possuo Nota Fiscal</span>
        </button>
        <button onClick={() => handleInvoiceOptionClick('no')} className={`p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <span className="font-bold text-xs">Não possuo</span>
        </button>
      </div>
      
      {formData.hasInvoice === 'yes' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer relative">
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'invoice')} />
            <UploadCloud className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="font-bold text-primary text-sm">Anexar Notas Fiscais</p>
          </div>
          <div className="space-y-2">
            {formData.invoiceFilesMeta?.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                <span className="font-bold text-slate-700 truncate">{file.name}</span>
                <button onClick={() => handleRemoveFile(idx, 'invoice')} className="text-danger p-1"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInvoiceCommitmentModal && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <p className="text-sm text-amber-800 mb-4">Se você não tem a nota agora, deve enviá-la via WhatsApp após o envio.</p>
          <Button size="sm" onClick={() => { handleChange('invoiceSentViaWhatsapp', true); setShowInvoiceCommitmentModal(false); }}>Aceitar Compromisso</Button>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Textarea label="Descrição do Pagamento" required value={formData.description} onChange={e => handleChange('description', e.target.value)} error={errors.description} rows={4} placeholder="Descreva o motivo do pagamento..." />
      <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer">
        <input type="checkbox" className="w-5 h-5 rounded text-primary" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} />
        <span className="text-xs font-bold text-slate-700">Concordo com os prazos e diretrizes.</span>
      </label>
    </div>
  );

  const renderReview = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
      <h3 className="font-bold text-slate-800">Resumo Final</h3>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div><span className="text-slate-400 uppercase font-bold text-[9px]">Responsável</span><p className="font-bold">{formData.requesterName}</p></div>
        <div><span className="text-slate-400 uppercase font-bold text-[9px]">Valor</span><p className="font-bold text-primary">{formatCurrency(formData.value)}</p></div>
        <div><span className="text-slate-400 uppercase font-bold text-[9px]">Fornecedor</span><p className="font-bold">{formData.supplierName}</p></div>
        <div><span className="text-slate-400 uppercase font-bold text-[9px]">Vencimento</span><p className="font-bold">{new Date(formData.dueDate).toLocaleString('pt-BR')}</p></div>
      </div>
    </div>
  );

  const renderHeader = () => (
    <div className="bg-white border-b border-slate-100 py-3 px-6 flex justify-center fixed top-0 w-full z-50">
      <div className="text-[12px] font-medium text-slate-400">CSP | <span className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Central de Pagamento</span></div>
    </div>
  );

  if (view === 'welcome') return (
    <div className="min-h-screen relative flex flex-col bg-slate-50">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      <header className="bg-primary py-2 px-6 flex justify-between items-center h-12 relative z-20">
        <button onClick={() => setView('login')} className="text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> Administração</button>
        <button onClick={() => setIsInfoOpen(true)} className="text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Regras</button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center z-10">
        <img src="/logo.png" alt="Logo" className="h-20 mb-12" />
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">Solicitações de <span className="text-primary italic">pagamento.</span></h1>
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Button size="lg" onClick={() => setView('form')} className="rounded-2xl py-6 font-black text-xl">Criar Solicitação</Button>
          <Button variant="outline" size="lg" onClick={() => setView('track')} className="rounded-2xl py-6 font-bold text-lg bg-white">Acompanhar Status</Button>
        </div>
      </div>
      <OrientationDrawer isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );

  if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <BackgroundAnimation />
      {renderHeader()}
      <RequestTracker initialProtocol="" onBack={() => setView('welcome')} departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      {renderHeader()}
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
        {!isSuccess ? (
          <>
            <div className="flex justify-between mb-8">
              <button onClick={() => setView('welcome')} className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1"><Home className="w-4 h-4" /> Início</button>
              <div className="flex gap-4">
                <button onClick={clearDraft} className="text-danger font-bold uppercase text-[10px]">Limpar</button>
                <button onClick={saveDraft} className="text-primary font-bold uppercase text-[10px]">Salvar</button>
              </div>
            </div>
            <Stepper currentStep={step} />
            <div className="bg-white rounded-3xl p-8 shadow-2xl mb-8">
              {step === 0 && renderStep1()}
              {step === 1 && renderStep2()}
              {step === 2 && renderStep3()}
              {step === 3 && renderStep4()}
              {step === 4 && renderReview()}
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className={`text-slate-400 font-bold ${step === 0 ? 'invisible' : ''}`}>Voltar</button>
              <Button onClick={step < 4 ? nextStep : handleSubmit} size="lg" disabled={isSubmitting} className="rounded-xl px-12">
                {step < 4 ? 'Próximo' : (isSubmitting ? 'Enviando...' : 'Confirmar')}
              </Button>
            </div>
          </>
        ) : renderSuccess()}
      </main>
    </div>
  );
}

export default App;