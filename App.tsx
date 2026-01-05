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

      {/* Institutional Top Bar - Redesigned with Green Bar */}
      <div className="absolute top-0 left-0 w-full z-30 animate-fade-up">
        {/* Superior Green Utility Bar */}
        <div className="bg-primary py-2 px-4 md:px-8 flex justify-end">
          <button 
            onClick={() => setView('login')}
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors group"
          >
            <Lock className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Acesso Restrito Admin</span>
          </button>
        </div>
        
        {/* Main Nav in Welcome */}
        <div className="p-4 md:p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <span className="text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:block">Central CSP</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col items-center">
        
        {/* Header Section */}
        <div className="mb-6 md:mb-10 text-center animate-fade-up" style={{ animationDelay: '0.1s' }}>
           <img src="/logo.png" alt="Missão Vida" className="h-16 md:h-24 object-contain mx-auto mb-8 drop-shadow-md" />
           <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-4 mx-auto">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
             </span>
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Painel Financeiro 2025</span>
           </div>
        </div>

        {/* Hero Title */}
        <div className="text-center mb-8 md:mb-12 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <h1 className="text-4xl md:text-7xl text-slate-900 mb-4 md:mb-6 tracking-tighter leading-[1] max-w-3xl px-2">
            <span className="font-light block md:inline text-2xl md:text-5xl">Sua ponte direta com o</span>{' '}
            <span className="font-black text-primary italic">Financeiro.</span>
          </h1>
          <p className="text-base md:text-xl text-slate-500 font-medium max-w-xl mx-auto leading-relaxed px-4">
            Solicite pagamentos de forma padronizada, segura e com total transparência em cada etapa.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="mb-12 md:mb-16 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-[2.5rem] blur-3xl group-hover:bg-primary/30 transition duration-500"></div>
            <button 
              onClick={handleStartRequest} 
              className="relative px-8 py-4 md:px-12 md:py-6 bg-primary hover:bg-primaryHover text-lg md:text-2xl font-bold text-white rounded-3xl shadow-2xl transition-all duration-300 transform group-hover:scale-[1.02] flex items-center gap-4 mx-auto"
            >
              Criar Solicitação
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
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

        {/* Professional Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 w-full px-4 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          
          <div className="bg-white/40 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 md:mb-3">Protocolo Digital</h3>
            <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-medium">
              Geração automática de ID para rastreamento imediate de cada pedido realizado.
            </p>
          </div>

          <div className="bg-white/40 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 md:mb-3">Agilidade Real</h3>
            <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-medium">
              Detecção de urgência e avisos automáticos para garantir prazos críticos.
            </p>
          </div>

          <div className="bg-white/40 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-900/10 rounded-2xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6 text-slate-900" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 md:mb-3">Padronização</h3>
            <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-medium">
              Fluxo guiado que evita erros de preenchimento e agiliza a aprovação.
            </p>
          </div>

        </div>
        
        <div className="mt-12 md:mt-20 py-8 border-t border-slate-200 w-full text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">
            Missão Vida &bull; {new Date().getFullYear()} &bull; Central de Pagamento
          </p>
        </div>
      </div>
    </div>
  );

  // --- RENDER STEPS ---
  const renderStep1 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <Input 
          label="Responsável" 
          value={formData.requesterName} 
          onChange={e => handleChange('requesterName', e.target.value)} 
          required 
          placeholder="Seu nome"
          error={errors.requesterName}
        />
        <Input 
          label="WhatsApp" 
          value={formData.whatsapp} 
          onChange={handlePhoneChange} 
          required 
          placeholder="(00) 00000-0000"
          error={errors.whatsapp}
        />
        <Select 
          label="Núcleo / Depto" 
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
          label="Autorizador" 
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
           <label className="block text-sm md:text-base font-medium text-slate-700 mb-1 text-center md:text-left">
             Vencimento <span className="text-accent">*</span>
           </label>
           <div className="flex gap-2 justify-center md:justify-start">
             <div className="flex-1">
               <input 
                 type="date"
                 className={`w-full px-3 py-2 md:px-4 md:py-2.5 rounded-lg bg-white border shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm md:text-base text-center md:text-left ${errors.dueDate ? 'border-danger' : isUrgent ? 'border-amber-500 text-amber-600' : 'border-slate-300 focus:border-primary'}`}
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
                 className={`w-full px-3 py-2 md:px-4 md:py-2.5 rounded-lg bg-white border shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm md:text-base text-center md:text-left ${errors.dueDate ? 'border-danger' : isUrgent ? 'border-amber-500 text-amber-600' : 'border-slate-300 focus:border-primary'}`}
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
           {errors.dueDate && <p className="mt-1 text-xs text-danger text-center md:text-left">{errors.dueDate}</p>}
           <UrgencyAlert isUrgent={isUrgent} />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
          <label className="block text-sm md:text-base font-medium text-slate-700 mb-1 text-center md:text-left">Verba Específica? <span className="text-accent">*</span></label>
          <div className="flex gap-2 justify-center md:justify-start">
             <label className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs md:text-sm ${formData.isSpecificBudget === 'yes' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" name="budget" className="hidden" checked={formData.isSpecificBudget === 'yes'} onChange={() => handleChange('isSpecificBudget', 'yes')} />
                Sim
             </label>
             <label className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs md:text-sm ${formData.isSpecificBudget === 'no' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}>
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
          <option value="Transferência">Transferência</option>
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
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in">
             <Input 
              label="Código de Barras" 
              value={formData.boletoCode || ''} 
              onChange={e => handleChange('boletoCode', e.target.value)} 
              error={errors.boletoCode}
            />
            <Input 
              type="date"
              label="Vencimento Boleto" 
              value={formData.boletoDueDate || ''} 
              onChange={e => handleChange('boletoDueDate', e.target.value)} 
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div>
        <label className="block text-sm md:text-base font-medium text-slate-700 mb-2 text-center md:text-left">Possui Nota Fiscal? <span className="text-accent">*</span></label>
        <div className="flex gap-2 justify-center md:justify-start">
            <button 
              onClick={() => handleChange('hasInvoice', 'yes')}
              className={`flex-1 py-3 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium text-xs md:text-sm">Sim, possuo</span>
            </button>
            <button 
              onClick={() => handleChange('hasInvoice', 'no')}
              className={`flex-1 py-3 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium text-xs md:text-sm">Não possuo</span>
            </button>
        </div>
      </div>

      {formData.hasInvoice === 'yes' ? (
        <div className="animate-in fade-in">
           <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5 text-center md:text-left">Upload do Anexo <span className="text-accent">*</span></label>
           <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${errors.invoiceFile ? 'border-danger bg-red-50' : isUploading ? 'border-primary bg-primary/5 cursor-wait' : 'border-slate-300 hover:border-primary bg-slate-50'}`}>
              <input type="file" id="file-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} disabled={isUploading} />
              
              {!formData.invoiceFileMeta && !isUploading ? (
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-full shadow-sm">
                    <UploadCloud className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-primary font-medium hover:underline text-xs md:text-sm">Clique para selecionar</span>
                    <p className="text-slate-500 text-[10px] md:text-xs mt-0.5">PDF, JPG ou PNG</p>
                  </div>
                </label>
              ) : isUploading ? (
                 <div className="flex flex-col items-center gap-2">
                   <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                   <span className="text-primary font-medium text-xs md:text-sm">Enviando...</span>
                 </div>
              ) : (
                <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="text-primary w-4 h-4" />
                    <div className="text-left">
                      <p className="text-[10px] md:text-xs font-medium text-slate-900 truncate max-w-[120px]">{formData.invoiceFileMeta?.name}</p>
                      <p className="text-[9px] text-green-600 font-bold">Enviado</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData(prev => ({...prev, invoiceFile: null, invoiceFileMeta: undefined, invoiceUrl: undefined}))}
                    className="p-1 text-slate-400 hover:text-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
           </div>
           {errors.invoiceFile && <p className="mt-1 text-xs text-danger text-center md:text-left">{errors.invoiceFile}</p>}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 animate-in fade-in text-center md:text-left">
           <p className="text-amber-800 text-[11px] md:text-xs mb-2">
             É obrigatório enviar posteriormente pelo WhatsApp para o financeiro.
           </p>
           <label className="flex items-center gap-2 cursor-pointer group justify-center md:justify-start">
             <input 
              type="checkbox" 
              className="peer appearance-none w-4 h-4 border-2 border-amber-500 rounded bg-white checked:bg-amber-500"
              checked={formData.invoiceSentViaWhatsapp}
              onChange={e => handleChange('invoiceSentViaWhatsapp', e.target.checked)}
             />
             <span className="text-[11px] md:text-xs text-slate-600">Comprometo-me a enviar via WhatsApp.</span>
           </label>
           {errors.invoiceSentViaWhatsapp && <p className="mt-1 text-xs text-danger text-center md:text-left">{errors.invoiceSentViaWhatsapp}</p>}
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
        placeholder="Ex: Compra de materiais..."
        error={errors.description}
      />
      
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <label className="flex items-start gap-2.5 cursor-pointer justify-center md:justify-start text-center md:text-left">
           <input 
            type="checkbox" 
            className="peer appearance-none w-5 h-5 border-2 border-primary rounded bg-white checked:bg-primary shrink-0 mt-0.5"
            checked={formData.termsAccepted}
            onChange={e => handleChange('termsAccepted', e.target.checked)}
           />
           <div>
             <span className="text-xs md:text-sm font-medium text-slate-800">Concordo com os prazos e regras.</span>
             {errors.termsAccepted && <p className="mt-1 text-xs text-danger text-center md:text-left">{errors.termsAccepted}</p>}
           </div>
        </label>
      </div>
    </div>
  );

  const renderReview = () => {
    const deptName = departments.find(d => d.id === formData.departmentId)?.name || 'N/A';
    
    const reviewItem = (label: string, value: string | React.ReactNode, full: boolean = false) => (
      <div className={`${full ? 'col-span-2' : ''} bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-center md:text-left`}>
        <span className="block text-[8px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</span>
        <div className="text-[11px] md:text-sm font-medium text-slate-800 truncate mx-auto md:mx-0">{value || '-'}</div>
      </div>
    );

    return (
      <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2 justify-center md:justify-start">
            <FileText className="text-primary w-4 h-4" /> Resumo
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
             {reviewItem("Responsável", formData.requesterName, true)}
             {reviewItem("Depto", deptName)}
             {reviewItem("Vencimento", new Date(formData.dueDate).toLocaleDateString('pt-BR'))}
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
    <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in duration-500 max-w-2xl mx-auto px-2">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
        <CheckCircle className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl md:text-3xl font-bold text-slate-900 mb-1">Enviada!</h2>
      <p className="text-slate-500 mb-6 text-sm">Solicitação processada com sucesso.</p>
      
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primaryDark"></div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Protocolo</p>
        <div className="flex items-center justify-center gap-3">
           <p className="text-xl md:text-3xl font-mono text-slate-900 font-bold tracking-tight">{generatedId}</p>
           <button 
             onClick={handleCopyId}
             className={`p-1.5 rounded-full transition-all duration-300 ${isIdCopied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-primary'}`}
           >
             {isIdCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
           </button>
        </div>
      </div>

      <div className="flex flex-col w-full gap-2">
        <Button id="btn-copy-resume" variant="outline" fullWidth onClick={handleCopyResume} className="border-slate-300 text-slate-700 py-3 text-xs md:text-sm">
          Copiar Resumo
        </Button>
        <Button onClick={handleReset} fullWidth size="md" className="shadow-xl py-3 text-xs md:text-sm">
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
          <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            {/* Superior Utility Green Bar */}
            <div className="bg-primary py-1.5 px-4 md:px-8 flex justify-end">
              <button 
                onClick={() => setView('login')}
                className="flex items-center gap-1.5 text-white/90 hover:text-white transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider group"
              >
                <Lock className="w-3 md:w-3.5 h-3 md:h-3.5 group-hover:scale-110 transition-transform" />
                Acesso Restrito Admin
              </button>
            </div>
            
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 md:py-3 flex items-center justify-between">
              {/* Left: Brand Identity */}
              <div className="flex items-center gap-3 md:gap-4 shrink-0">
                <div 
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => setView('welcome')}
                >
                  <img src="/logo.png" alt="Missão Vida" className="h-7 md:h-12 w-auto object-contain" />
                </div>
                <div className="hidden lg:flex flex-col border-l border-slate-200 pl-4">
                  <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">CSP &bull; Central de Pagamento</span>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center">
                <button
                  onClick={() => setView('welcome')}
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 transition-all text-[10px] md:text-xs font-bold"
                >
                  <Home className="w-3.5 h-3.5 md:w-4 md:h-4" /> 
                  <span className="uppercase tracking-wider">Início</span>
                </button>
              </div>
            </div>
          </header>
        )}

        <div className="w-full max-w-2xl mx-auto p-4 md:p-8 flex-1 flex flex-col relative z-10">
          
          {!isSuccess ? (
            <>
              <div className="mb-6 md:mb-10 text-center animate-in fade-in duration-700">
                <div className="inline-block p-2 bg-primary/5 rounded-2xl mb-4">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-2 tracking-tight">
                  Solicitação de Pagamento
                </h1>
                <p className="text-slate-500 text-xs md:text-base font-medium">Preencha os dados com atenção para agilizar o processo.</p>
              </div>

              <div className="flex justify-center md:justify-end gap-2 mb-4">
                 {Object.values(formData).some(v => v !== '' && v !== 'no' && v !== false) && (
                   <button onClick={clearDraft} className="text-[10px] md:text-xs text-danger font-bold hover:underline flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-transparent hover:border-red-100">
                     <Trash2 className="w-3 h-3" /> Limpar Rascunho
                   </button>
                 )}
              </div>

              <Stepper currentStep={step} />

              <div className="flex-1 mt-6">
                {step === 0 && renderStep1()}
                {step === 1 && renderStep2()}
                {step === 2 && renderStep3()}
                {step === 3 && renderStep4()}
                {step === 4 && renderReview()}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center sticky bottom-0 bg-white/80 backdrop-blur-md py-4 -mx-4 px-4 md:-mx-8 md:px-8 z-10">
                <Button 
                  variant="ghost" 
                  onClick={prevStep} 
                  disabled={step === 0 || isSubmitting}
                  size="md"
                  className={step === 0 ? 'invisible' : 'text-xs md:text-sm px-4'}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>

                {step < 4 ? (
                  <Button onClick={nextStep} size="md" className="px-8 text-xs md:text-sm font-bold shadow-xl shadow-primary/20" disabled={isUploading}>
                    {isUploading ? 'Enviando...' : (
                      <>Próximo Passo <ChevronRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                ) : (
                  <Button 
                    variant={isUrgent ? "accent" : "primary"} 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                    size="md"
                    className="px-10 text-xs md:text-sm font-black shadow-2xl shadow-primary/30"
                  >
                    {isSubmitting ? 'Processando...' : (
                      <>Finalizar e Enviar <CheckCircle className="w-4 h-4 ml-2" /></>
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