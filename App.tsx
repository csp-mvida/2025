import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors } from './types';
import { AUTHORIZERS, PAYMENT_ACCOUNTS, URGENCY_THRESHOLD_HOURS } from './constants';
import { formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, generateId } from './utils/formatters';
import { fetchDepartments, submitRequest, uploadInvoice } from './services/api';
import { generatePDF } from './utils/pdfGenerator';

// Components
import { Stepper } from './components/Stepper';
import { Button } from './components/ui/Button';
import { Input, Select, Textarea } from './components/ui/Input';
import { UrgencyAlert } from './components/UrgencyAlert';
import { Save, Trash2, CheckCircle, UploadCloud, FileText, ChevronRight, ChevronLeft, AlertTriangle, RefreshCw, Clock, Home, Lock, Download, Copy } from './components/ui/Icons';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  // State
  const [view, setView] = useState<'welcome' | 'form' | 'admin'>('welcome');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<CSPFormData>(INITIAL_DATA);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state for file upload
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false); // State for ID copy feedback
  
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
    fetchDepartments().then(setDepartments);
    const savedDraft = localStorage.getItem('csp_draft');
    if (savedDraft) {
      setHasSavedDraft(true);
    } else {
      setDraftLoaded(true); // Ready to start new
    }
  }, []);

  // Auto-Save Draft Logic
  useEffect(() => {
    // Only save if:
    // 1. Not currently submitting/success
    // 2. Draft has been loaded or discarded (user made a choice or started fresh)
    // 3. There is some data (prevent saving empty initial state over a draft if logic fails)
    if (!isSuccess && draftLoaded) {
      // Don't save the full file object to local storage, it causes issues
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
        // Clean errors on restore
        setErrors({});
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    setHasSavedDraft(false); // Hide banner
    setDraftLoaded(true);    // Enable auto-save
    setView('form');   // Go directly to form if restoring
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
    // Simple visual feedback
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
    // Clear error for this field
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
    // Allows user to type, format applies on render/change
    handleChange('whatsapp', formatPhone(e.target.value));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Update local state for immediate feedback
      setFormData(prev => ({
        ...prev,
        invoiceFile: file, 
        invoiceFileMeta: { name: file.name, size: file.size }
      }));

      // Trigger Upload immediately
      setIsUploading(true);
      try {
        const publicUrl = await uploadInvoice(file);
        setFormData(prev => ({
          ...prev,
          invoiceUrl: publicUrl
        }));
        
        // Clear error if any
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
        // Reset file input on failure
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
    // Visual feedback handled by button text momentarily or simple alert
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

    if (currentStep === 0) { // Identification
      if (!formData.requesterName) newErrors.requesterName = "Nome é obrigatório";
      
      // WhatsApp Validation
      if (!formData.whatsapp) {
        newErrors.whatsapp = "WhatsApp inválido";
      } else if (!isValidPhone(formData.whatsapp)) {
        newErrors.whatsapp = "Número inválido. Digite 10 ou 11 dígitos com DDD.";
      }

      if (!formData.departmentId) newErrors.departmentId = "Departamento obrigatório";
      if (!formData.authorizer) newErrors.authorizer = "Autorizador obrigatório";
      if (!formData.dueDate) newErrors.dueDate = "Data de vencimento obrigatória";
    }

    if (currentStep === 1) { // Payment
      if (!formData.paymentAccount) newErrors.paymentAccount = "Conta obrigatória";
      if (formData.isSpecificBudget === 'yes' && !formData.specificBudgetName) newErrors.specificBudgetName = "Nome da verba obrigatório";
      if (!formData.supplierName) newErrors.supplierName = "Fornecedor obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) newErrors.value = "Valor obrigatório";
      if (!formData.paymentMethod) newErrors.paymentMethod = "Forma de pagamento obrigatória";
      if (formData.paymentMethod === 'PIX' && !formData.pixKey) newErrors.pixKey = "Chave PIX obrigatória";
      if (formData.paymentMethod === 'Boleto' && !formData.boletoCode && !formData.hasInvoice) newErrors.boletoCode = "Código de barras necessário se não houver anexo";
    }

    if (currentStep === 2) { // Proof
      // Check if file is selected AND upload is complete (URL present)
      if (formData.hasInvoice === 'yes') {
         if (!formData.invoiceFileMeta) {
           newErrors.invoiceFile = "Anexo da nota fiscal é obrigatório";
         } else if (!formData.invoiceUrl && !isUploading) {
           // Allow proceeding if uploading? No, better wait.
           // Actually, if we are not uploading and have meta but no URL, upload likely failed.
           newErrors.invoiceFile = "Falha no upload. Tente anexar novamente.";
         }
      }
      if (formData.hasInvoice === 'no' && !formData.invoiceSentViaWhatsapp) newErrors.invoiceSentViaWhatsapp = "Confirmação de envio via WhatsApp necessária";
    }

    if (currentStep === 3) { // Description
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
    
    // Submit with ID
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
    setView('welcome'); // Return to welcome screen on reset
  };

  // --- RENDER WELCOME SCREEN ---
  const renderWelcome = () => (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden bg-slate-50 selection:bg-primary/20">
      
      {/* Premium Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-primary/5 via-slate-50 to-transparent rounded-[100%] blur-3xl pointer-events-none opacity-60"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-accent/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Admin Link */}
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={() => setView('admin')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 backdrop-blur border border-slate-200 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-white transition-all shadow-sm"
        >
          <Lock className="w-3 h-3" />
          Acesso Administrativo
        </button>
      </div>

      <div className="w-full max-w-6xl relative z-10 flex flex-col items-center">
        
        {/* Institutional Logo */}
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
           <img src="/logo.png" alt="Missão Vida" className="h-24 md:h-32 object-contain" />
        </div>

        {/* Institutional Tag */}
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-[11px] font-bold text-slate-600 uppercase tracking-widest">
             <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
             Sistema Financeiro Online
           </div>
        </div>

        {/* Hero Section with Forced 2-Line Title on Desktop */}
        <div className="text-center mb-16 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-8 tracking-tight leading-[1.15] md:leading-[1.1]">
            Central de Solicitação
            <br className="hidden lg:block" /> {/* Break forced only on desktop */}
             <span className="lg:hidden"> </span> {/* Space on mobile */}
            <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-primary to-primaryDark pb-2">
              de Pagamento
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/10 hidden md:block" viewBox="0 0 100 10" preserveAspectRatio="none">
                 <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
              </svg>
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-slate-500 leading-relaxed font-light mx-auto max-w-2xl">
            Gestão transparente e ágil. Centralize suas contas a pagar com padronização e segurança.
          </p>
        </div>

        {/* Action Button - Premium & Glowy */}
        <div className="flex flex-col items-center gap-6 mb-24 w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primaryDark rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <button 
              onClick={handleStartRequest} 
              className="relative px-8 py-4 md:px-12 md:py-6 bg-primary hover:bg-primaryHover text-white text-lg md:text-xl font-semibold rounded-full shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 flex items-center gap-3"
            >
              Iniciar Nova Solicitação
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          {hasSavedDraft && (
             <button 
               onClick={handleStartRequest} 
               className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all text-sm font-medium shadow-sm"
             >
               <RefreshCw className="w-4 h-4" />
               Retomar rascunho anterior
             </button>
          )}
        </div>

        {/* High-End Minimalist Cards - Start */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 w-full animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          
          {/* Card 1: Dados Essenciais */}
          <div className="group relative bg-white p-10 rounded-[24px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all duration-500 ease-out border border-slate-50 overflow-hidden text-left">
             {/* Sliding Sidebar */}
            <div className="absolute left-0 bottom-0 w-1.5 h-0 group-hover:h-full bg-emerald-500 transition-all duration-700 ease-out"></div>
            
            {/* Icon Wrapper */}
            <div className="relative w-14 h-14 rounded-full bg-emerald-50/50 flex items-center justify-center mb-8 group-hover:bg-emerald-50 transition-colors duration-500">
              <FileText className="w-6 h-6 text-slate-600 stroke-[1.5] group-hover:text-emerald-600 transition-colors" />
            </div>

            <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-tight mb-4 group-hover:text-emerald-700 transition-colors">Dados Essenciais</h3>
            <p className="text-[#666] text-sm leading-loose font-light">
              Tenha em mãos os dados do fornecedor, valor exato e a <span className="font-medium text-slate-800">Nota Fiscal</span> para agilizar a aprovação.
            </p>
          </div>

          {/* Card 2: Prazos e Regras */}
          <div className="group relative bg-white p-10 rounded-[24px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all duration-500 ease-out border border-slate-50 overflow-hidden text-left">
            {/* Sliding Sidebar */}
            <div className="absolute left-0 bottom-0 w-1.5 h-0 group-hover:h-full bg-amber-500 transition-all duration-700 ease-out"></div>

            {/* Icon Wrapper */}
            <div className="relative w-14 h-14 rounded-full bg-amber-50/50 flex items-center justify-center mb-8 group-hover:bg-amber-50 transition-colors duration-500">
              <Clock className="w-6 h-6 text-slate-600 stroke-[1.5] group-hover:text-amber-600 transition-colors" />
            </div>

            <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-tight mb-4 group-hover:text-amber-700 transition-colors">Prazos e Regras</h3>
            <p className="text-[#666] text-sm leading-loose font-light">
              Respeite o prazo mínimo de <strong className="text-slate-800 font-medium">2 horas</strong> para processamento. Planeje com antecedência.
            </p>
          </div>

          {/* Card 3: Urgências */}
          <div className="group relative bg-white p-10 rounded-[24px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all duration-500 ease-out border border-slate-50 overflow-hidden text-left">
            {/* Sliding Sidebar */}
            <div className="absolute left-0 bottom-0 w-1.5 h-0 group-hover:h-full bg-rose-500 transition-all duration-700 ease-out"></div>

            {/* Icon Wrapper */}
            <div className="relative w-14 h-14 rounded-full bg-rose-50/50 flex items-center justify-center mb-8 group-hover:bg-rose-50 transition-colors duration-500">
              <AlertTriangle className="w-6 h-6 text-slate-600 stroke-[1.5] group-hover:text-rose-600 transition-colors" />
            </div>

            <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-tight mb-4 group-hover:text-rose-700 transition-colors">Urgências</h3>
            <p className="text-[#666] text-sm leading-loose font-light">
              Emergências reais (menos de 2h) devem ser lançadas e comunicadas via <strong className="text-slate-900 font-bold">WhatsApp</strong>.
            </p>
          </div>

        </div>
        {/* High-End Minimalist Cards - End */}
        
        <div className="mt-20 text-center animate-in fade-in duration-1000 delay-500">
          <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest font-semibold hover:text-primary transition-colors cursor-default">
            CSP &copy; {new Date().getFullYear()} • Tecnologia & Finanças
          </p>
        </div>
      </div>
    </div>
  );

  // --- RENDER STEPS ---

  const renderStep1 = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          {AUTHORIZERS.map(auth => (
            <option key={auth} value={auth}>{auth}</option>
          ))}
        </Select>
        
        {/* Split Date/Time Input Logic */}
        <div className="md:col-span-2">
           <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5">
             Vencimento do Pagamento <span className="text-accent">*</span>
           </label>
           <div className="flex gap-4">
             <div className="flex-1">
               <input 
                 type="date"
                 className={`w-full px-4 py-2.5 md:py-3 rounded-lg bg-white border shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 text-base md:text-lg ${errors.dueDate ? 'border-danger' : isUrgent ? 'border-amber-500 text-amber-600' : 'border-slate-300 focus:border-primary'}`}
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
                 className={`w-full px-4 py-2.5 md:py-3 rounded-lg bg-white border shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 text-base md:text-lg ${errors.dueDate ? 'border-danger' : isUrgent ? 'border-amber-500 text-amber-600' : 'border-slate-300 focus:border-primary'}`}
                 value={getTimeValue()} 
                 onChange={e => {
                   const newTime = e.target.value;
                   const currentDate = getDateValue();
                   // Only update if date is present, otherwise wait for date
                   if (currentDate) {
                     handleChange('dueDate', `${currentDate}T${newTime || '00:00'}`);
                   }
                 }} 
               />
             </div>
           </div>
           {errors.dueDate && <p className="mt-1 text-sm md:text-base text-danger">{errors.dueDate}</p>}
           <p className="mt-1 text-xs md:text-sm text-slate-500">
             Horário é opcional (padrão 00:00).
           </p>
           <UrgencyAlert isUrgent={isUrgent} />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select 
          label="Conta de Pagamento" 
          value={formData.paymentAccount} 
          onChange={e => handleChange('paymentAccount', e.target.value)} 
          required
          error={errors.paymentAccount}
        >
          <option value="">Selecione...</option>
          {PAYMENT_ACCOUNTS.map(acc => (
            <option key={acc} value={acc}>{acc}</option>
          ))}
        </Select>
        
        <div className="md:col-span-1">
          <label className="block text-sm md:text-base font-medium text-slate-700 mb-2">Verba Específica? <span className="text-accent">*</span></label>
          <div className="flex gap-4">
             <label className={`flex-1 flex items-center justify-center px-4 py-2 md:py-3 rounded-lg border cursor-pointer transition-all text-sm md:text-base ${formData.isSpecificBudget === 'yes' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" name="budget" className="hidden" checked={formData.isSpecificBudget === 'yes'} onChange={() => handleChange('isSpecificBudget', 'yes')} />
                Sim
             </label>
             <label className={`flex-1 flex items-center justify-center px-4 py-2 md:py-3 rounded-lg border cursor-pointer transition-all text-sm md:text-base ${formData.isSpecificBudget === 'no' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}>
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
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
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
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div>
        <label className="block text-sm md:text-base font-medium text-slate-700 mb-3">Possui Nota Fiscal? <span className="text-accent">*</span></label>
        <div className="flex gap-4">
            <button 
              onClick={() => handleChange('hasInvoice', 'yes')}
              className={`flex-1 py-4 px-6 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <FileText className="w-6 h-6 md:w-8 md:h-8" />
              <span className="font-medium text-sm md:text-lg">Sim, possuo</span>
            </button>
            <button 
              onClick={() => handleChange('hasInvoice', 'no')}
              className={`flex-1 py-4 px-6 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />
              <span className="font-medium text-sm md:text-lg">Não possuo agora</span>
            </button>
        </div>
      </div>

      {formData.hasInvoice === 'yes' ? (
        <div className="animate-in fade-in">
           <label className="block text-sm md:text-base font-medium text-slate-700 mb-2">Upload do Anexo <span className="text-accent">*</span></label>
           <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${errors.invoiceFile ? 'border-danger bg-red-50' : isUploading ? 'border-primary bg-primary/5 cursor-wait' : 'border-slate-300 hover:border-primary bg-slate-50'}`}>
              <input type="file" id="file-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} disabled={isUploading} />
              
              {!formData.invoiceFileMeta && !isUploading ? (
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-full shadow-sm">
                    <UploadCloud className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                  </div>
                  <div>
                    <span className="text-primary font-medium hover:underline text-base md:text-lg">Clique para selecionar</span>
                    <p className="text-slate-500 text-sm md:text-base mt-1">PDF, JPG ou PNG</p>
                  </div>
                </label>
              ) : isUploading ? (
                 <div className="flex flex-col items-center gap-3">
                   <RefreshCw className="w-8 h-8 md:w-10 md:h-10 text-primary animate-spin" />
                   <span className="text-primary font-medium text-base md:text-lg">Enviando arquivo...</span>
                 </div>
              ) : (
                <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                  <div className="flex items-center gap-3">
                    <FileText className="text-primary w-5 h-5" />
                    <div className="text-left">
                      <p className="text-sm md:text-base font-medium text-slate-900 truncate max-w-[200px]">{formData.invoiceFileMeta?.name}</p>
                      <p className="text-xs md:text-sm text-slate-500">{(formData.invoiceFileMeta!.size / 1024).toFixed(1)} KB • <span className="text-green-600 font-bold">Enviado</span></p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData(prev => ({...prev, invoiceFile: null, invoiceFileMeta: undefined, invoiceUrl: undefined}))}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
           </div>
           {errors.invoiceFile && <p className="mt-2 text-sm text-danger">{errors.invoiceFile}</p>}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 animate-in fade-in">
           <p className="text-amber-800 text-sm md:text-base mb-3">
             Caso não tenha a nota fiscal agora, é obrigatório enviá-la posteriormente pelo WhatsApp para o setor financeiro.
           </p>
           <label className="flex items-center gap-3 cursor-pointer group">
             <div className="relative flex items-center">
               <input 
                type="checkbox" 
                className="peer appearance-none w-5 h-5 md:w-6 md:h-6 border-2 border-amber-500 rounded bg-white checked:bg-amber-500 transition-colors"
                checked={formData.invoiceSentViaWhatsapp}
                onChange={e => handleChange('invoiceSentViaWhatsapp', e.target.checked)}
               />
               <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white absolute left-1 top-1 opacity-0 peer-checked:opacity-100 pointer-events-none" />
             </div>
             <span className="text-sm md:text-base text-slate-600 group-hover:text-slate-900 transition-colors">
               Comprometo-me a enviar a NF pelo WhatsApp.
             </span>
           </label>
           {errors.invoiceSentViaWhatsapp && <p className="mt-2 text-sm text-danger">{errors.invoiceSentViaWhatsapp}</p>}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <Textarea 
        label="Descrição do Pagamento" 
        value={formData.description} 
        onChange={e => handleChange('description', e.target.value)} 
        required 
        rows={4}
        placeholder="Ex: Pagamento referente à compra de materiais de escritório para o mês de Outubro..."
        error={errors.description}
      />
      
      <Input 
        label="Número de Autorização (Opcional)" 
        value={formData.authNumber || ''} 
        onChange={e => handleChange('authNumber', e.target.value)} 
        placeholder="Se houver um código prévio"
      />

      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-6">
        <label className="flex items-start gap-3 cursor-pointer group">
           <div className="relative flex items-start mt-0.5">
             <input 
              type="checkbox" 
              className="peer appearance-none w-5 h-5 md:w-6 md:h-6 border-2 border-primary rounded bg-white checked:bg-primary transition-colors"
              checked={formData.termsAccepted}
              onChange={e => handleChange('termsAccepted', e.target.checked)}
             />
             <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white absolute left-0.5 top-0.5 opacity-0 peer-checked:opacity-100 pointer-events-none" />
           </div>
           <div>
             <span className="text-sm md:text-base font-medium text-slate-800 group-hover:text-black transition-colors">
               Confirmo que li e concordo com os prazos e regras.
             </span>
             <p className="text-xs md:text-sm text-slate-500 mt-1">
               Entendo que solicitações urgentes devem ser comunicadas via WhatsApp.
             </p>
             {errors.termsAccepted && <p className="mt-2 text-sm text-danger">{errors.termsAccepted}</p>}
           </div>
        </label>
      </div>
    </div>
  );

  const renderReview = () => {
    const deptName = departments.find(d => d.id === formData.departmentId)?.name || 'N/A';
    
    const reviewItem = (label: string, value: string | React.ReactNode, full: boolean = false) => (
      <div className={`${full ? 'col-span-2' : ''} bg-white p-3 md:p-4 rounded-lg border border-slate-200 shadow-sm`}>
        <span className="block text-[10px] md:text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</span>
        <div className="text-sm md:text-lg font-medium text-slate-800">{value || '-'}</div>
      </div>
    );

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 border border-slate-200 shadow-lg">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="text-primary w-5 h-5" /> Resumo da Solicitação
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
             {reviewItem("Responsável", formData.requesterName, true)}
             {reviewItem("Departamento", deptName)}
             {reviewItem("Vencimento", new Date(formData.dueDate).toLocaleString('pt-BR'))}
             {reviewItem("Fornecedor", formData.supplierName)}
             {reviewItem("Valor", <span className="text-primary font-bold">{formatCurrency(formData.value)}</span>)}
             {reviewItem("Forma Pagto", formData.paymentMethod)}
             {reviewItem("Autorizador", formData.authorizer)}
             {reviewItem("Descrição", formData.description, true)}
             {reviewItem("Anexo", formData.invoiceFileMeta ? formData.invoiceFileMeta.name : (formData.invoiceSentViaWhatsapp ? "Enviará via WhatsApp" : "Não"), true)}
          </div>
        </div>
        
        <UrgencyAlert isUrgent={isUrgent} />

        <div className="flex gap-4 p-4 bg-slate-50 rounded-lg text-sm md:text-base text-slate-600 border border-slate-200">
          <AlertTriangle className="w-5 h-5 shrink-0 text-slate-500" />
          <p>Verifique todas as informações antes de enviar. Após o envio, você receberá um ID de protocolo.</p>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in duration-500 max-w-2xl mx-auto">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
        <CheckCircle className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Solicitação Enviada!</h2>
      <p className="text-slate-500 mb-8 text-lg">Sua solicitação foi processada com sucesso.</p>
      
      {/* Central Card with Protocol ID */}
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-8 mb-8 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primaryDark"></div>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">ID do Protocolo</p>
        <div className="flex items-center justify-center gap-4">
           <p className="text-3xl md:text-4xl font-mono text-slate-900 font-bold tracking-tight">{generatedId}</p>
           <button 
             onClick={handleCopyId}
             className={`p-2 rounded-full transition-all duration-300 ${isIdCopied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-primary'}`}
             title="Copiar ID"
           >
             {isIdCopied ? <CheckCircle className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
           </button>
        </div>
        
        {/* Visual feedback for copied state */}
        <div className={`mt-2 text-sm font-medium text-green-600 transition-opacity duration-300 ${isIdCopied ? 'opacity-100' : 'opacity-0'}`}>
          Copiado!
        </div>
      </div>

      {isUrgent && (
        <div className="w-full bg-amber-50 border border-amber-200 p-4 rounded-xl mb-8 flex items-start gap-3 text-left">
          <AlertTriangle className="text-amber-600 w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-amber-800 text-sm md:text-base">
            <strong>Atenção:</strong> Solicitação urgente identificada. Envie o ID acima para o financeiro via WhatsApp para agilizar a aprovação.
          </p>
        </div>
      )}

      <div className="flex flex-col w-full gap-3">
        <Button id="btn-copy-resume" variant="outline" fullWidth onClick={handleCopyResume} className="border-slate-300 text-slate-700 hover:bg-slate-50 py-4">
          <Copy className="w-4 h-4 mr-2" /> Copiar Resumo
        </Button>
        <Button onClick={handleReset} fullWidth size="lg" className="shadow-xl py-4">
          <RefreshCw className="w-4 h-4 mr-2" /> Nova Solicitação
        </Button>
      </div>
    </div>
  );

  // --- ROUTING LOGIC ---

  if (view === 'admin') {
    return <AdminDashboard onBack={() => setView('welcome')} />;
  }

  if (view === 'welcome') {
    return renderWelcome();
  }

  // View === 'form'
  return (
    <div className="min-h-screen bg-background text-slate-800 selection:bg-primary/20">
      {/* Mobile Header for context */}
      <div className="lg:hidden p-4 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20 flex items-center justify-between">
        <img src="/logo.png" alt="Missão Vida" className="h-10 object-contain" />
        <h1 className="font-bold text-sm text-slate-900">CSP <span className="text-slate-400">| Pagamentos</span></h1>
      </div>

      <main className="min-h-screen flex flex-col">
        {/* Restore Draft Banner */}
        {hasSavedDraft && !isSuccess && (
          <div className="bg-white border-b border-primary/20 px-4 py-3 md:px-8 lg:px-12 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm">
            <div className="flex items-center gap-3">
              <RefreshCw className="text-primary w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm md:text-base font-medium text-slate-800">Rascunho encontrado</p>
                <p className="text-xs md:text-sm text-slate-500">Deseja continuar preenchendo a solicitação anterior?</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
               <button 
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
               >
                 Descartar
               </button>
               <button 
                onClick={handleRestoreDraft}
                className="px-3 py-1.5 text-xs font-medium bg-primary hover:bg-primaryHover text-white rounded-lg transition-colors shadow-lg shadow-primary/20"
               >
                 Restaurar
               </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-3xl mx-auto p-4 md:p-8 lg:p-12 flex-1 flex flex-col">
          
          {/* Header with Logo for Form View */}
          {!isSuccess && (
            <div className="flex justify-between items-start mb-10">
              <img src="/logo.png" alt="Missão Vida" className="h-16 md:h-20 object-contain hidden lg:block" />
              <button
                onClick={() => setView('welcome')}
                className="inline-flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-sm font-medium w-fit mt-2"
              >
                <Home className="w-4 h-4" /> Voltar ao Início
              </button>
            </div>
          )}

          {!isSuccess ? (
            <>
              {/* Title Section */}
              <div className="mb-10">
                <div className="hidden lg:block mb-2 text-primary font-bold tracking-wider text-xs uppercase">Financeiro</div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                  Nova Solicitação
                </h1>
                <p className="text-slate-500 md:text-lg">Preencha os dados abaixo para registrar um novo pagamento.</p>
              </div>

              {/* Toolbar */}
              <div className="flex justify-end gap-3 mb-6">
                 {/* Always show draft controls if data exists or draft loaded */}
                 {Object.values(formData).some(v => v !== '' && v !== 'no' && v !== false) && (
                   <>
                     <button onClick={clearDraft} className="text-xs text-danger hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                       <Trash2 className="w-3 h-3" /> Limpar rascunho
                     </button>
                     <button id="btn-save-draft" onClick={handleManualSave} className="text-xs text-primary hover:text-primaryHover border border-primary/20 hover:border-primary/50 bg-white flex items-center gap-1 px-3 py-1 rounded transition-all shadow-sm">
                       <Save className="w-3 h-3" /> Salvar rascunho
                     </button>
                   </>
                 )}
              </div>

              {/* Progress */}
              <Stepper currentStep={step} />

              {/* Form Content */}
              <div className="flex-1">
                {step === 0 && renderStep1()}
                {step === 1 && renderStep2()}
                {step === 2 && renderStep3()}
                {step === 3 && renderStep4()}
                {step === 4 && renderReview()}
              </div>

              {/* Footer Actions */}
              <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center sticky bottom-0 bg-white/95 backdrop-blur py-4 -mx-4 px-4 md:mx-0 md:px-0 z-10">
                <Button 
                  variant="ghost" 
                  onClick={prevStep} 
                  disabled={step === 0 || isSubmitting}
                  className={step === 0 ? 'invisible' : ''}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>

                {step < 4 ? (
                  <Button onClick={nextStep} className="px-8" disabled={isUploading}>
                    {isUploading ? 'Enviando Arquivo...' : (
                      <>Próximo <ChevronRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                ) : (
                  <div className="flex gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => generatePDF(formData, departments)}
                      disabled={isSubmitting}
                      className="hidden md:inline-flex"
                    >
                      <Download className="w-4 h-4 mr-2" /> Baixar Resumo
                    </Button>
                    <Button 
                      variant={isUrgent ? "accent" : "primary"} // Use amber if urgent
                      onClick={handleSubmit} 
                      disabled={isSubmitting}
                      className="px-8 shadow-xl"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Enviando...
                        </span>
                      ) : (
                        <>Confirmar Envio <CheckCircle className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </div>
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