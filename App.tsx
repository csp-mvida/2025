import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors } from './types';
import { URGENCY_THRESHOLD_HOURS } from './constants';
import { formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, generateId } from './utils/formatters';
import { fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, submitRequest, uploadInvoice } from './services/api';
import { generatePDF } from './utils/pdfGenerator';

// Components
import { Stepper } from './components/Stepper';
import { Button } from './components/ui/Button';
import { Input, Select, Textarea } from './components/ui/Input';
import { UrgencyAlert } from './components/UrgencyAlert';
import { 
  Save, Trash2, CheckCircle, UploadCloud, FileText, 
  ChevronRight, ChevronLeft, AlertTriangle, RefreshCw, 
  Home, Lock, Download, Copy, Clock, LayoutDashboard 
} from './components/ui/Icons';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginAdmin } from './components/LoginAdmin';
import { BackgroundAnimation } from './components/BackgroundAnimation';

function App() {
  // State
  const [view, setView] = useState<'welcome' | 'form' | 'login' | 'admin'>('welcome');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<CSPFormData>(INITIAL_DATA);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [authorizers, setAuthorizers] = useState<string[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false); 
  
  // Draft Management State
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Derived State
  const isUrgent = checkUrgency(formData.dueDate);

  // Helper to get split date/time values safely
  const getDateValue = () => formData.dueDate ? formData.dueDate.split('T')[0] : '';
  const getTimeValue = () => formData.dueDate && formData.dueDate.includes('T') ? formData.dueDate.split('T')[1].substring(0, 5) : '';

  // Load Initial Data & Check Draft
  useEffect(() => {
    const loadInitialData = async () => {
      const [depts, auths, accounts] = await Promise.all([
        fetchDepartments(),
        fetchAuthorizers(),
        fetchPaymentAccounts()
      ]);
      setDepartments(depts);
      setAuthorizers(auths);
      setPaymentAccounts(accounts);
    };
    
    loadInitialData();

    const savedDraft = localStorage.getItem('csp_draft');
    if (savedDraft) {
      setHasSavedDraft(true);
    } else {
      setDraftLoaded(true); 
    }
  }, []);

  // Auto-Save Draft Logic
  useEffect(() => {
    if (!isSuccess && draftLoaded) {
      const { invoiceFile, ...dataToSave } = formData;
      localStorage.setItem('csp_draft', JSON.stringify(dataToSave));
    }
  }, [formData, isSuccess, draftLoaded]);

  // Draft Actions
  const handleRestoreDraft = () => {
    const savedDraft = localStorage.getItem('csp_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
        setErrors({});
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    setHasSavedDraft(false); 
    setDraftLoaded(true);    
    setView('form');   
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('csp_draft');
    setFormData(INITIAL_DATA);
    setHasSavedDraft(false);
    setDraftLoaded(true);
  };

  const handleManualSave = () => {
    const { invoiceFile, ...dataToSave } = formData;
    localStorage.setItem('csp_draft', JSON.stringify(dataToSave));
    const btn = document.getElementById('btn-save-draft');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerText = "Salvo!";
      setTimeout(() => btn.innerHTML = originalText, 2000);
    }
  };

  const handleStartRequest = () => {
    setView('form');
    window.scrollTo(0,0);
  };

  // Handlers
  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseCurrency(e.target.value);
    handleChange('value', raw);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange('whatsapp', formatPhone(e.target.value));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({
        ...prev,
        invoiceFile: file, 
        invoiceFileMeta: { name: file.name, size: file.size }
      }));

      setIsUploading(true);
      try {
        const publicUrl = await uploadInvoice(file);
        setFormData(prev => ({
          ...prev,
          invoiceUrl: publicUrl
        }));
        if (errors.invoiceFile) {
          setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors.invoiceFile;
            return newErrors;
          });
        }
      } catch (error) {
        console.error("Upload failed", error);
        alert("Erro ao fazer upload do arquivo. Verifique sua conexão ou tente novamente.");
        setFormData(prev => ({
          ...prev,
          invoiceFile: null,
          invoiceFileMeta: undefined,
          invoiceUrl: undefined
        }));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const clearDraft = () => {
    if (window.confirm("Tem certeza que deseja limpar o rascunho?")) {
      setFormData(INITIAL_DATA);
      localStorage.removeItem('csp_draft');
      setStep(0);
      setErrors({});
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId);
    setIsIdCopied(true);
    setTimeout(() => setIsIdCopied(false), 2000);
  };

  const handleCopyResume = () => {
    const dept = departments.find(d => d.id === formData.departmentId)?.name || 'N/A';
    const text = `*SOLICITAÇÃO CSP*\n` +
      `📄 Protocolo: ${generatedId}\n` +
      `👤 Solicitante: ${formData.requesterName}\n` +
      `🏢 Depto: ${dept}\n` +
      `🤝 Fornecedor: ${formData.supplierName}\n` +
      `💰 Valor: ${formatCurrency(formData.value)}\n` +
      `📅 Vencimento: ${new Date(formData.dueDate).toLocaleDateString('pt-BR')}\n` +
      `📝 Descrição: ${formData.description}`;
    
    navigator.clipboard.writeText(text);
    const btn = document.getElementById('btn-copy-resume');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = "Copiado para WhatsApp!";
      setTimeout(() => btn.innerText = originalText, 2000);
    }
  };

  // Validation Logic per Step
  const validateStep = (currentStep: number): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    if (currentStep === 0) { 
      if (!formData.requesterName) newErrors.requesterName = "Nome é obrigatório";
      if (!formData.whatsapp) {
        newErrors.whatsapp = "WhatsApp inválido";
      } else if (!isValidPhone(formData.whatsapp)) {
        newErrors.whatsapp = "Número inválido. Digite 10 ou 11 dígitos com DDD.";
      }
      if (!formData.departmentId) newErrors.departmentId = "Departamento obrigatório";
      if (!formData.authorizer) newErrors.authorizer = "Autorizador obrigatório";
      if (!formData.dueDate) newErrors.dueDate = "Data de vencimento obrigatória";
    }

    if (currentStep === 1) { 
      if (!formData.paymentAccount) newErrors.paymentAccount = "Conta obrigatória";
      if (formData.isSpecificBudget === 'yes' && !formData.specificBudgetName) newErrors.specificBudgetName = "Nome da verba obrigatório";
      if (!formData.supplierName) newErrors.supplierName = "Fornecedor obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) newErrors.value = "Valor obrigatório";
      if (!formData.paymentMethod) newErrors.paymentMethod = "Forma de pagamento obrigatória";
      if (formData.paymentMethod === 'PIX' && !formData.pixKey) newErrors.pixKey = "Chave PIX obrigatória";
      if (formData.paymentMethod === 'Boleto' && !formData.boletoCode && !formData.hasInvoice) newErrors.boletoCode = "Código de barras necessário se não houver anexo";
    }

    if (currentStep === 2) { 
      if (formData.hasInvoice === 'yes') {
         if (!formData.invoiceFileMeta) {
           newErrors.invoiceFile = "Anexo da nota fiscal é obrigatório";
         } else if (!formData.invoiceUrl && !isUploading) {
           newErrors.invoiceFile = "Falha no upload. Tente anexar novamente.";
         }
      }
      if (formData.hasInvoice === 'no' && !formData.invoiceSentViaWhatsapp) newErrors.invoiceSentViaWhatsapp = "Confirmação de envio via WhatsApp necessária";
    }

    if (currentStep === 3) { 
      if (!formData.description) newErrors.description = "Descrição obrigatória";
      if (!formData.termsAccepted) newErrors.termsAccepted = "Você deve concordar com os prazos";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      isValid = false;
    }

    return isValid;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      if (step === 2 && isUploading) {
        alert("Aguarde o término do upload do arquivo.");
        return;
      }
      setStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;

    setIsSubmitting(true);
    const newId = generateId();
    
    const success = await submitRequest(formData, newId);
    
    if (success) {
      setGeneratedId(newId);
      setIsSuccess(true);
      localStorage.removeItem('csp_draft');
      window.scrollTo(0, 0);
    } else {
      alert("Erro ao enviar solicitação. Tente novamente.");
    }
    setIsSubmitting(false);
  };

  const handleReset = () => {
    setFormData(INITIAL_DATA);
    setIsSuccess(false);
    setStep(0);
    setGeneratedId('');
    setHasSavedDraft(false);
    setView('welcome'); 
  };

  // --- RENDER WELCOME SCREEN ---
  const renderWelcome = () => (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden bg-slate-50">
      <BackgroundAnimation />

      {/* Admin Icon Button - Fixed top right */}
      <div className="absolute top-4 right-4 z-30 animate-fade-up">
        <button 
          onClick={() => setView('login')}
          className="flex flex-col items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/70 backdrop-blur-md border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 transition-all shadow-sm group"
          title="Admin"
        >
          <Lock className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
          <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tighter mt-0.5">Admin</span>
        </button>
      </div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col items-center">
        
        {/* Header Section - Tighter spacing */}
        <div className="mb-8 text-center animate-fade-up" style={{ animationDelay: '0.1s' }}>
           <img src="/logo.png" alt="Missão Vida" className="h-14 md:h-18 object-contain mx-auto mb-6 drop-shadow-sm" />
           <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-4">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
             </span>
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Painel Financeiro 2025</span>
           </div>
        </div>

        {/* Hero Title - More compact */}
        <div className="text-center mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <h1 className="text-4xl md:text-6xl text-slate-900 mb-6 tracking-tighter leading-[1] max-w-3xl">
            <span className="font-light block md:inline text-2xl md:text-4xl">Sua ponte direta com o</span>{' '}
            <span className="font-black text-primary italic">Financeiro.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 font-medium max-w-xl mx-auto leading-relaxed px-4">
            Solicite pagamentos de forma padronizada, segura e com total transparência em cada etapa.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="mb-14 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-[2rem] blur-2xl group-hover:bg-primary/30 transition duration-500"></div>
            <button 
              onClick={handleStartRequest} 
              className="relative px-10 py-5 bg-primary hover:bg-primaryHover text-white text-lg md:text-xl font-bold rounded-2xl shadow-2xl transition-all duration-300 transform group-hover:scale-[1.02] flex items-center gap-4"
            >
              Criar Nova Solicitação
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          {hasSavedDraft && (
            <button 
              onClick={handleRestoreDraft}
              className="mt-6 flex items-center gap-2 mx-auto text-slate-400 hover:text-primary font-bold text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retomar rascunho salvo
            </button>
          )}
        </div>

        {/* Professional Cards Grid - Tighter gaps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 w-full animate-fade-up" style={{ animationDelay: '0.4s' }}>
          
          <div className="bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Protocolo Digital</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              Geração automática de ID para rastreamento imediato de cada pedido realizado.
            </p>
          </div>

          <div className="bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group">
            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Agilidade Real</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              Detecção de urgência e avisos automáticos para garantir prazos críticos.
            </p>
          </div>

          <div className="bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group">
            <div className="w-12 h-12 bg-slate-900/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CheckCircle className="w-5 h-5 text-slate-900" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Padronização</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              Fluxo guiado que evita erros de preenchimento e agiliza a aprovação.
            </p>
          </div>

        </div>
        
        <div className="mt-14 py-6 border-t border-slate-200 w-full text-center">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.4em]">
            Missão Vida &bull; {new Date().getFullYear()} &bull; Central de Pagamento
          </p>
        </div>
      </div>
    </div>
  );

  // --- RENDER STEPS ---
  const renderStep1 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Responsável pela solicitação" 
          value={formData.requesterName} 
          onChange={e => handleChange('requesterName', e.target.value)} 
          required 
          placeholder="Seu nome completo"
          error={errors.requesterName}
        />
        <Input 
          label="WhatsApp para contato" 
          value={formData.whatsapp} 
          onChange={handlePhoneChange} 
          required 
          placeholder="(00) 00000-0000"
          helperText="Digite com DDD (10 ou 11 dígitos)"
          error={errors.whatsapp}
        />
        <Select 
          label="Núcleo / Departamento" 
          value={formData.departmentId} 
          onChange={e => handleChange('departmentId', e.target.value)} 
          required
          error={errors.departmentId}
        >
          <option value="">Selecione...</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </Select>
        <Select 
          label="Quem autorizou?" 
          value={formData.authorizer} 
          onChange={e => handleChange('authorizer', e.target.value)} 
          required
          error={errors.authorizer}
        >
          <option value="">Selecione...</option>
          {authorizers.map(auth => (
            <option key={auth} value={auth}>{auth}</option>
          ))}
        </Select>
        
        <div className="md:col-span-2">
           <label className="block text-sm md:text-base font-medium text-slate-700 mb-1">
             Vencimento do Pagamento <span className="text-accent">*</span>
           </label>
           <div className="flex gap-3">
             <div className="flex-1">
               <input 
                 type="date"
                 className={`w-full px-4 py-2 rounded-lg bg-white border shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm md:text-base ${errors.dueDate ? 'border-danger' : isUrgent ? 'border-amber-500 text-amber-600' : 'border-slate-300 focus:border-primary'}`}
                 value={getDateValue()} 
                 onChange={e => {
                   const newDate = e.target.value;
                   const currentTime = getTimeValue() || '00:00';
                   if (!newDate) handleChange('dueDate', '');
                   else handleChange('dueDate', `${newDate}T${currentTime}`);
                 }} 
                 required 
               />
             </div>
             <div className="w-1/3">
               <input 
                 type="time"
                 className={`w-full px-4 py-2 rounded-lg bg-white border shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm md:text-base ${errors.dueDate ? 'border-danger' : isUrgent ? 'border-amber-500 text-amber-600' : 'border-slate-300 focus:border-primary'}`}
                 value={getTimeValue()} 
                 onChange={e => {
                   const newTime = e.target.value;
                   const currentDate = getDateValue();
                   if (currentDate) {
                     handleChange('dueDate', `${currentDate}T${newTime || '00:00'}`);
                   }
                 }} 
               />
             </div>
           </div>
           {errors.dueDate && <p className="mt-1 text-xs text-danger">{errors.dueDate}</p>}
           <UrgencyAlert isUrgent={isUrgent} />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select 
          label="Conta de Pagamento" 
          value={formData.paymentAccount} 
          onChange={e => handleChange('paymentAccount', e.target.value)} 
          required
          error={errors.paymentAccount}
        >
          <option value="">Selecione...</option>
          {paymentAccounts.map(acc => (
            <option key={acc} value={acc}>{acc}</option>
          ))}
        </Select>
        
        <div className="md:col-span-1">
          <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5">Verba Específica? <span className="text-accent">*</span></label>
          <div className="flex gap-2">
             <label className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg border cursor-pointer transition-all text-xs md:text-sm ${formData.isSpecificBudget === 'yes' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" name="budget" className="hidden" checked={formData.isSpecificBudget === 'yes'} onChange={() => handleChange('isSpecificBudget', 'yes')} />
                Sim
             </label>
             <label className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg border cursor-pointer transition-all text-xs md:text-sm ${formData.isSpecificBudget === 'no' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" name="budget" className="hidden" checked={formData.isSpecificBudget === 'no'} onChange={() => handleChange('isSpecificBudget', 'no')} />
                Não
             </label>
          </div>
        </div>

        {formData.isSpecificBudget === 'yes' && (
           <Input 
            label="Qual Verba?" 
            value={formData.specificBudgetName || ''} 
            onChange={e => handleChange('specificBudgetName', e.target.value)} 
            required 
            className="md:col-span-2 animate-in fade-in"
            error={errors.specificBudgetName}
          />
        )}

        <Input 
          label="Fornecedor / Recebedor" 
          value={formData.supplierName} 
          onChange={e => handleChange('supplierName', e.target.value)} 
          required 
          error={errors.supplierName}
        />
        
        <Input 
          label="Valor (R$)" 
          value={formatCurrency(formData.value)} 
          onChange={handleCurrencyChange} 
          required 
          placeholder="R$ 0,00"
          error={errors.value}
        />

        <Select 
          label="Forma de Pagamento" 
          value={formData.paymentMethod} 
          onChange={e => handleChange('paymentMethod', e.target.value)} 
          required
          error={errors.paymentMethod}
        >
          <option value="">Selecione...</option>
          <option value="PIX">PIX</option>
          <option value="Boleto">Boleto</option>
          <option value="Transferência">Transferência Bancária</option>
        </Select>

        {formData.paymentMethod === 'PIX' && (
          <Input 
            label="Chave PIX" 
            value={formData.pixKey || ''} 
            onChange={e => handleChange('pixKey', e.target.value)} 
            required 
            className="animate-in fade-in"
            error={errors.pixKey}
          />
        )}

        {formData.paymentMethod === 'Boleto' && (
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
             <Input 
              label="Linha Digitável / Código" 
              value={formData.boletoCode || ''} 
              onChange={e => handleChange('boletoCode', e.target.value)} 
              error={errors.boletoCode}
            />
            <Input 
              type="date"
              label="Vencimento do Boleto" 
              value={formData.boletoDueDate || ''} 
              onChange={e => handleChange('boletoDueDate', e.target.value)} 
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div>
        <label className="block text-sm md:text-base font-medium text-slate-700 mb-2">Possui Nota Fiscal? <span className="text-accent">*</span></label>
        <div className="flex gap-3">
            <button 
              onClick={() => handleChange('hasInvoice', 'yes')}
              className={`flex-1 py-3 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <FileText className="w-5 h-5 md:w-6 md:h-6" />
              <span className="font-medium text-xs md:text-base">Sim, possuo</span>
            </button>
            <button 
              onClick={() => handleChange('hasInvoice', 'no')}
              className={`flex-1 py-3 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
              <span className="font-medium text-xs md:text-base">Não possuo agora</span>
            </button>
        </div>
      </div>

      {formData.hasInvoice === 'yes' ? (
        <div className="animate-in fade-in">
           <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5">Upload do Anexo <span className="text-accent">*</span></label>
           <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${errors.invoiceFile ? 'border-danger bg-red-50' : isUploading ? 'border-primary bg-primary/5 cursor-wait' : 'border-slate-300 hover:border-primary bg-slate-50'}`}>
              <input type="file" id="file-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} disabled={isUploading} />
              
              {!formData.invoiceFileMeta && !isUploading ? (
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-full shadow-sm">
                    <UploadCloud className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                  </div>
                  <div>
                    <span className="text-primary font-medium hover:underline text-sm md:text-base">Clique para selecionar</span>
                    <p className="text-slate-500 text-[10px] md:text-xs mt-0.5">PDF, JPG ou PNG</p>
                  </div>
                </label>
              ) : isUploading ? (
                 <div className="flex flex-col items-center gap-2">
                   <RefreshCw className="w-6 h-6 md:w-8 md:h-8 text-primary animate-spin" />
                   <span className="text-primary font-medium text-sm md:text-base">Enviando arquivo...</span>
                 </div>
              ) : (
                <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                  <div className="flex items-center gap-3">
                    <FileText className="text-primary w-4 h-4" />
                    <div className="text-left">
                      <p className="text-xs md:text-sm font-medium text-slate-900 truncate max-w-[150px]">{formData.invoiceFileMeta?.name}</p>
                      <p className="text-[10px] md:text-xs text-slate-500">{(formData.invoiceFileMeta!.size / 1024).toFixed(1)} KB • <span className="text-green-600 font-bold">Enviado</span></p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData(prev => ({...prev, invoiceFile: null, invoiceFileMeta: undefined, invoiceUrl: undefined}))}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
           </div>
           {errors.invoiceFile && <p className="mt-1.5 text-xs text-danger">{errors.invoiceFile}</p>}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 animate-in fade-in">
           <p className="text-amber-800 text-xs md:text-sm mb-2">
             Caso não tenha a nota fiscal agora, é obrigatório enviá-la posteriormente pelo WhatsApp para o setor financeiro.
           </p>
           <label className="flex items-center gap-2.5 cursor-pointer group">
             <div className="relative flex items-center">
               <input 
                type="checkbox" 
                className="peer appearance-none w-5 h-5 border-2 border-amber-500 rounded bg-white checked:bg-amber-500 transition-colors"
                checked={formData.invoiceSentViaWhatsapp}
                onChange={e => handleChange('invoiceSentViaWhatsapp', e.target.checked)}
               />
               <CheckCircle className="w-3 h-3 text-white absolute left-1 top-1 opacity-0 peer-checked:opacity-100 pointer-events-none" />
             </div>
             <span className="text-xs md:text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
               Comprometo-me a enviar a NF pelo WhatsApp.
             </span>
           </label>
           {errors.invoiceSentViaWhatsapp && <p className="mt-1.5 text-xs text-danger">{errors.invoiceSentViaWhatsapp}</p>}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <Textarea 
        label="Descrição do Pagamento" 
        value={formData.description} 
        onChange={e => handleChange('description', e.target.value)} 
        required 
        rows={3}
        placeholder="Ex: Compra de materiais de escritório..."
        error={errors.description}
      />
      
      <Input 
        label="Número de Autorização (Opcional)" 
        value={formData.authNumber || ''} 
        onChange={e => handleChange('authNumber', e.target.value)} 
        placeholder="Se houver um código prévio"
      />

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
        <label className="flex items-start gap-2.5 cursor-pointer group">
           <div className="relative flex items-start mt-0.5">
             <input 
              type="checkbox" 
              className="peer appearance-none w-5 h-5 border-2 border-primary rounded bg-white checked:bg-primary transition-colors"
              checked={formData.termsAccepted}
              onChange={e => handleChange('termsAccepted', e.target.checked)}
             />
             <CheckCircle className="w-3 h-3 text-white absolute left-1 top-1 opacity-0 peer-checked:opacity-100 pointer-events-none" />
           </div>
           <div>
             <span className="text-xs md:text-sm font-medium text-slate-800 group-hover:text-black transition-colors">
               Confirmo que li e concordo com os prazos e regras.
             </span>
             {errors.termsAccepted && <p className="mt-1 text-xs text-danger">{errors.termsAccepted}</p>}
           </div>
        </label>
      </div>
    </div>
  );

  const renderReview = () => {
    const deptName = departments.find(d => d.id === formData.departmentId)?.name || 'N/A';
    
    const reviewItem = (label: string, value: string | React.ReactNode, full: boolean = false) => (
      <div className={`${full ? 'col-span-2' : ''} bg-white p-3 rounded-lg border border-slate-200 shadow-sm`}>
        <span className="block text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</span>
        <div className="text-xs md:text-sm font-medium text-slate-800 truncate">{value || '-'}</div>
      </div>
    );

    return (
      <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200 shadow-lg">
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <FileText className="text-primary w-4 h-4" /> Resumo
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
             {reviewItem("Responsável", formData.requesterName, true)}
             {reviewItem("Departamento", deptName)}
             {reviewItem("Vencimento", new Date(formData.dueDate).toLocaleString('pt-BR'))}
             {reviewItem("Fornecedor", formData.supplierName)}
             {reviewItem("Valor", <span className="text-primary font-bold">{formatCurrency(formData.value)}</span>)}
             {reviewItem("Autorizador", formData.authorizer)}
             {reviewItem("Descrição", formData.description, true)}
          </div>
        </div>
        
        <UrgencyAlert isUrgent={isUrgent} />
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in duration-500 max-w-2xl mx-auto">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
        <CheckCircle className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Enviada!</h2>
      <p className="text-slate-500 mb-6 text-base">Solicitação processada com sucesso.</p>
      
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primaryDark"></div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Protocolo</p>
        <div className="flex items-center justify-center gap-3">
           <p className="text-2xl md:text-3xl font-mono text-slate-900 font-bold tracking-tight">{generatedId}</p>
           <button 
             onClick={handleCopyId}
             className={`p-1.5 rounded-full transition-all duration-300 ${isIdCopied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-primary'}`}
           >
             {isIdCopied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
           </button>
        </div>
      </div>

      <div className="flex flex-col w-full gap-2">
        <Button id="btn-copy-resume" variant="outline" fullWidth onClick={handleCopyResume} className="border-slate-300 text-slate-700 py-3 text-sm">
          Copiar Resumo
        </Button>
        <Button onClick={handleReset} fullWidth size="md" className="shadow-xl py-3 text-sm">
          Nova Solicitação
        </Button>
      </div>
    </div>
  );

  if (view === 'login') {
    return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  }

  if (view === 'admin') {
    return <AdminDashboard onBack={() => setView('welcome')} />;
  }

  if (view === 'welcome') {
    return renderWelcome();
  }

  return (
    <div className="min-h-screen bg-background text-slate-800 selection:bg-primary/20">
      <BackgroundAnimation />

      <main className="min-h-screen flex flex-col relative z-10">
        {!isSuccess && (
          <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-20 flex flex-col items-center">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={() => setView('welcome')}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-primary transition-colors text-xs font-medium"
              >
                <Home className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Início</span>
              </button>
              <button 
                onClick={() => setView('login')}
                className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                title="Admin"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
            <img src="/logo.png" alt="Missão Vida" className="h-10 md:h-12 object-contain" />
          </div>
        )}

        <div className="w-full max-w-2xl mx-auto p-4 md:p-6 flex-1 flex flex-col relative z-10">
          
          {!isSuccess ? (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                  Nova Solicitação
                </h1>
                <p className="text-slate-500 text-sm md:text-base">Preencha os dados abaixo.</p>
              </div>

              <div className="flex justify-end gap-2 mb-4">
                 {Object.values(formData).some(v => v !== '' && v !== 'no' && v !== false) && (
                   <button onClick={clearDraft} className="text-[10px] text-danger hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                     <Trash2 className="w-2.5 h-2.5" /> Limpar rascunho
                   </button>
                 )}
              </div>

              <Stepper currentStep={step} />

              <div className="flex-1 mt-4">
                {step === 0 && renderStep1()}
                {step === 1 && renderStep2()}
                {step === 2 && renderStep3()}
                {step === 3 && renderStep4()}
                {step === 4 && renderReview()}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center sticky bottom-0 bg-white/95 backdrop-blur py-3 -mx-4 px-4 md:mx-0 md:px-0 z-10">
                <Button 
                  variant="ghost" 
                  onClick={prevStep} 
                  disabled={step === 0 || isSubmitting}
                  size="sm"
                  className={step === 0 ? 'invisible' : ''}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1.5" /> Voltar
                </Button>

                {step < 4 ? (
                  <Button onClick={nextStep} size="sm" className="px-6" disabled={isUploading}>
                    {isUploading ? 'Enviando...' : (
                      <>Próximo <ChevronRight className="w-3.5 h-3.5 ml-1.5" /></>
                    )}
                  </Button>
                ) : (
                  <Button 
                    variant={isUrgent ? "accent" : "primary"} 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                    size="sm"
                    className="px-6 shadow-lg"
                  >
                    {isSubmitting ? 'Enviando...' : (
                      <>Confirmar Envio <CheckCircle className="w-3.5 h-3.5 ml-1.5" /></>
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : (
            renderSuccess()
          )}
        </div>
      </main>
    </div>
  );
}

export default App;