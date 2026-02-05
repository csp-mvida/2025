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
  Home, Lock, Download, Copy, Clock, LayoutDashboard, Search
}
from './components/ui/Icons';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginAdmin } from './components/LoginAdmin';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { RequestTracker } from './components/RequestTracker';

function App() {
  // State
  const [view, setView] = useState<'welcome' | 'form' | 'login' | 'admin' | 'track'>('welcome');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<CSPFormData>(INITIAL_DATA);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [authorizers, setAuthorizers] = useState<string[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 
  const [isUploadingBoleto, setIsUploadingBoleto] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false); 
  
  // Draft Management State
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  // Derived State
  const isUrgent = checkUrgency(formData.dueDate);

  // Helper to get split date/time values safely
  const getDateValue = () => formData.dueDate ? formData.dueDate.split('T')[0] : '';
  const getTimeValue = () => formData.dueDate && formData.dueDate.includes('T') ? formData.dueDate.split('T')[1].substring(0, 5) : '';

  // Helper to check if form is essentially empty
  const isFormEmpty = useCallback((data: CSPFormData) => {
    const { invoiceFile, boletoFile, invoiceFileMeta, boletoFileMeta, ...dataToCheck } = data;
    const { invoiceFile: initialInv, boletoFile: initialBol, invoiceFileMeta: initialInvMeta, boletoFileMeta: initialBolMeta, ...initialDataToCheck } = INITIAL_DATA;
    return JSON.stringify(dataToCheck) === JSON.stringify(initialDataToCheck);
  }, []);

  // Load Initial Data
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
      try {
        const parsed = JSON.parse(savedDraft);
        if (!isFormEmpty(parsed as CSPFormData)) {
          setHasSavedDraft(true);
        }
      } catch (e) {
        localStorage.removeItem('csp_draft');
      }
    }
  }, [isFormEmpty]);

  // Auto-Save Draft
  useEffect(() => {
    if (isFormEmpty(formData)) {
        localStorage.removeItem('csp_draft');
        setHasSavedDraft(false);
        return;
    }
    
    if (!isSuccess && view === 'form') {
      const { invoiceFile, boletoFile, ...dataToSave } = formData;
      localStorage.setItem('csp_draft', JSON.stringify(dataToSave));
      setHasSavedDraft(true);
    }
  }, [formData, isSuccess, isFormEmpty, view]);

  // Handlers
  const handleStartRequest = () => {
    setView('form');
    setStep(0);
    window.scrollTo(0,0);
  };

  const handleTrackRequest = () => {
    setView('track');
    window.scrollTo(0,0);
  };

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
    setView('form');   
  };

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
        setFormData(prev => ({ ...prev, invoiceUrl: publicUrl }));
      } catch (error) {
        alert("Erro no upload.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: ValidationErrors = {};
    if (currentStep === 0) { 
      if (!formData.requesterName) newErrors.requesterName = "Nome é obrigatório";
      if (!isValidPhone(formData.whatsapp)) newErrors.whatsapp = "WhatsApp inválido";
      if (!formData.departmentId) newErrors.departmentId = "Depto obrigatório";
      if (!formData.authorizer) newErrors.authorizer = "Autorizador obrigatório";
      if (!formData.dueDate) newErrors.dueDate = "Vencimento obrigatório";
    }
    if (currentStep === 1) { 
      if (!formData.paymentAccount) newErrors.paymentAccount = "Conta obrigatória";
      if (!formData.supplierName) newErrors.supplierName = "Fornecedor obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) newErrors.value = "Valor obrigatório";
      if (!formData.paymentMethod) newErrors.paymentMethod = "Forma obrigatória";
    }
    if (currentStep === 2) { 
      if (formData.hasInvoice === 'yes' && !formData.invoiceFileMeta) newErrors.invoiceFile = "Anexo obrigatório";
      if (formData.hasInvoice === 'no' && !formData.invoiceSentViaWhatsapp) newErrors.invoiceSentViaWhatsapp = "Aviso necessário";
    }
    if (currentStep === 3) { 
      if (!formData.description) newErrors.description = "Descrição obrigatória";
      if (!formData.termsAccepted) newErrors.termsAccepted = "Concordância obrigatória";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  const nextStep = () => validateStep(step) && setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setIsSubmitting(true);
    const newId = generateId();
    if (await submitRequest(formData, newId)) {
      setGeneratedId(newId);
      setIsSuccess(true);
      localStorage.removeItem('csp_draft');
    } else {
      alert("Erro ao enviar.");
    }
    setIsSubmitting(false);
  };

  const handleReset = () => {
    setFormData(INITIAL_DATA);
    setIsSuccess(false);
    setStep(0);
    setView('welcome'); 
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId);
    setIsIdCopied(true);
    setTimeout(() => setIsIdCopied(false), 2000);
  };

  const handleCopyResume = () => {
    const dept = departments.find(d => d.id === formData.departmentId)?.name || 'N/A';
    const text = `*SOLICITAÇÃO CSP*\n📄 Protocolo: ${generatedId}\n👤 Solicitante: ${formData.requesterName}\n🏢 Depto: ${dept}\n🤝 Fornecedor: ${formData.supplierName}\n💰 Valor: ${formatCurrency(formData.value)}\n📅 Vencimento: ${new Date(formData.dueDate).toLocaleDateString('pt-BR')}\n📝 Descrição: ${formData.description}`;
    navigator.clipboard.writeText(text);
  };

  const goToTrackingFromSuccess = () => {
    setView('track');
    setIsSuccess(false);
    window.scrollTo(0,0);
  };

  // --- Step Renders ---
  const renderStep1 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input label="Responsável" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required error={errors.requesterName} />
        <Input label="WhatsApp" value={formData.whatsapp} onChange={handlePhoneChange} required placeholder="(00) 00000-0000" error={errors.whatsapp} />
        <Select label="Núcleo / Depto" value={formData.departmentId} onChange={e => handleChange('departmentId', e.target.value)} required error={errors.departmentId}>
          <option value="">Selecione...</option>
          {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
        </Select>
        <Select label="Autorizador" value={formData.authorizer} onChange={e => handleChange('authorizer', e.target.value)} required error={errors.authorizer}>
          <option value="">Selecione...</option>
          {authorizers.map(auth => <option key={auth} value={auth}>{auth}</option>)}
        </Select>
        <div className="md:col-span-2">
           <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento <span className="text-accent">*</span></label>
           <div className="flex gap-2">
             <input type="date" className="flex-1 px-4 py-2 rounded-lg border border-slate-300" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T${getTimeValue() || '00:00'}`)} />
             <input type="time" className="w-1/3 px-4 py-2 rounded-lg border border-slate-300" value={getTimeValue()} onChange={e => handleChange('dueDate', `${getDateValue()}T${e.target.value || '00:00'}`)} />
           </div>
           {errors.dueDate && <p className="text-xs text-danger mt-1">{errors.dueDate}</p>}
           <UrgencyAlert isUrgent={isUrgent} />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select label="Conta de Pagamento" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required error={errors.paymentAccount}>
          <option value="">Selecione...</option>
          {paymentAccounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
        </Select>
        <Input label="Fornecedor / Recebedor" value={formData.supplierName} onChange={e => handleChange('supplierName', e.target.value)} required error={errors.supplierName} />
        <Input label="Valor (R$)" value={formatCurrency(formData.value)} onChange={handleCurrencyChange} required placeholder="R$ 0,00" error={errors.value} />
        <Select label="Forma de Pagamento" value={formData.paymentMethod} onChange={e => handleChange('paymentMethod', e.target.value)} required error={errors.paymentMethod}>
          <option value="">Selecione...</option>
          <option value="PIX">PIX</option>
          <option value="Boleto">Boleto</option>
          <option value="Transferência">Transferência</option>
        </Select>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="text-center md:text-left">
        <label className="block text-sm font-medium text-slate-700 mb-2">Possui Nota Fiscal? *</label>
        <div className="flex gap-2">
          <button onClick={() => handleChange('hasInvoice', 'yes')} className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-1 ${formData.hasInvoice === 'yes' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300'}`}><FileText className="w-5 h-5" /><span className="text-xs">Sim</span></button>
          <button onClick={() => handleChange('hasInvoice', 'no')} className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-1 ${formData.hasInvoice === 'no' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-300'}`}><AlertTriangle className="w-5 h-5" /><span className="text-xs">Não</span></button>
        </div>
      </div>
      {formData.hasInvoice === 'yes' && (
        <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center">
          <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} />
          <label htmlFor="file-upload" className="cursor-pointer">
            {isUploading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : <UploadCloud className="w-5 h-5 text-primary mx-auto" />}
            <span className="text-xs text-primary font-bold block mt-1">{formData.invoiceFileMeta?.name || "Anexar Nota"}</span>
          </label>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <Textarea label="Descrição" value={formData.description} onChange={e => handleChange('description', e.target.value)} required rows={3} error={errors.description} />
      <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
        <input type="checkbox" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} className="w-4 h-4" />
        <span className="text-xs font-medium">Concordo com os prazos e regras.</span>
      </label>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-3 animate-in slide-in-from-right-4 duration-500">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <h3 className="font-bold text-sm text-primary">Resumo dos Dados</h3>
        <p className="text-xs"><strong>Solicitante:</strong> {formData.requesterName}</p>
        <p className="text-xs"><strong>Fornecedor:</strong> {formData.supplierName}</p>
        <p className="text-xs"><strong>Valor:</strong> {formatCurrency(formData.value)}</p>
        <p className="text-xs"><strong>Vencimento:</strong> {new Date(formData.dueDate).toLocaleString('pt-BR')}</p>
      </div>
      <UrgencyAlert isUrgent={isUrgent} />
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in duration-500 max-w-2xl mx-auto px-4">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
        <CheckCircle className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Enviada!</h2>
      <p className="text-slate-500 mb-6 text-sm">Solicitação processada com sucesso.</p>
      
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primaryDark"></div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Protocolo</p>
        <div className="flex items-center justify-center gap-3">
           <p className="text-xl md:text-3xl font-mono text-slate-900 font-bold tracking-tight">{generatedId}</p>
           <button onClick={handleCopyId} className={`p-1.5 rounded-full transition-all duration-300 ${isIdCopied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-primary'}`}>
             {isIdCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        <Button variant="outline" onClick={handleCopyResume} className="border-slate-300 text-slate-700 py-4 text-xs font-bold uppercase tracking-wider">
          Copiar Resumo
        </Button>
        <Button onClick={goToTrackingFromSuccess} variant="secondary" className="py-4 text-xs font-bold uppercase tracking-wider border-slate-200">
          Acompanhar Status
        </Button>
        <Button onClick={handleReset} fullWidth className="md:col-span-2 shadow-xl py-4 text-sm font-black uppercase tracking-[0.2em]">
          Voltar para o Início
        </Button>
      </div>
    </div>
  );

  const renderWelcome = () => (
    <div className="min-h-screen relative flex flex-col bg-slate-50">
      <BackgroundAnimation />
      <header className="relative z-30">
        <div className="bg-primary py-2.5 px-4 flex justify-center shadow-md">
          <button onClick={() => setView('login')} className="flex items-center gap-2 text-white font-bold hover:scale-105 transition-all group">
            <Lock className="w-4 h-4" />
            <span className="text-[11px] md:text-sm uppercase tracking-widest">Acesso Restrito <span className="text-green-300">Admin</span></span>
          </button>
        </div>
      </header>

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10">
        <div className="mt-4 mb-8 md:mb-10 text-center animate-fade-up">
           <img src="/logo.png" alt="Missão Vida" className="h-16 md:h-24 object-contain mx-auto mb-6 drop-shadow-md" />
           <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mx-auto">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
             </span>
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Central de Solicitação de Pagamentos</span>
           </div>
        </div>

        <div className="text-center mb-8 md:mb-10 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-4xl md:text-6xl text-slate-900 mb-4 tracking-tighter leading-[1.1] max-w-4xl px-2">
            <span className="font-light block md:inline text-2xl md:text-4xl">Sua ponte direta com o</span>{' '}
            <span className="font-black text-primary italic">Financeiro.</span>
          </h1>
          <p className="text-sm md:text-lg text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed px-4">
            Solicite pagamentos de forma padronizada, segura e com total transparência em cada etapa.
          </p>
        </div>

        <div className="mb-10 md:mb-12 animate-fade-up flex flex-col items-center gap-4" style={{ animationDelay: '0.2s' }}>
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-[2.5rem] blur-2xl group-hover:bg-primary/30 transition duration-500"></div>
            <button 
              onClick={handleStartRequest} 
              className="relative px-8 py-4 md:px-12 md:py-5 bg-primary hover:bg-primaryHover text-lg md:text-xl font-bold text-white rounded-3xl shadow-2xl transition-all duration-300 transform group-hover:scale-[1.03] flex items-center gap-4 mx-auto"
            >
              Criar Solicitação
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
            </button>
          </div>
          
          <button 
            onClick={handleTrackRequest}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow-md"
          >
            <Search className="w-4 h-4" />
            Acompanhar Solicitação
          </button>

          {hasSavedDraft && (
            <button onClick={handleRestoreDraft} className="flex items-center gap-2 mx-auto text-slate-400 hover:text-primary font-bold text-xs transition-colors py-1 px-4 rounded-full hover:bg-white shadow-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Retomar rascunho salvo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full px-4 mb-12 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2">Protocolo Digital</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">Geração automática de ID para rastreamento imediato de cada pedido realizado.</p>
          </div>
          <div className="bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2">Agilidade Real</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">Detecção de urgência e avisos automáticos para garantir prazos críticos.</p>
          </div>
          <div className="bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 hover:bg-white transition-all duration-500 group flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 bg-slate-900/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6 text-slate-900" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2">Padronização</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">Fluxo guiado que evita erros de preenchimento e agiliza a aprovação.</p>
          </div>
        </div>
        
        <footer className="mt-auto pt-3 pb-8 border-t border-slate-200 w-full text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">Missão Vida &bull; {new Date().getFullYear()} &bull; Central de Pagamento</p>
        </footer>
      </div>
    </div>
  );

  if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return <div className="min-h-screen relative bg-slate-50 flex flex-col justify-center"><BackgroundAnimation /><RequestTracker initialProtocol={generatedId} onBack={() => setView('welcome')} /></div>;
  if (view === 'welcome') return renderWelcome();

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-primary/20 flex flex-col justify-center">
      <BackgroundAnimation />
      <main className="max-w-2xl mx-auto p-4 md:p-8 relative z-10 w-full">
        {!isSuccess ? (
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white">
            <h1 className="text-2xl font-bold text-center mb-6">Nova Solicitação</h1>
            <Stepper currentStep={step} />
            <div className="mt-8">
              {step === 0 && renderStep1()}
              {step === 1 && renderStep2()}
              {step === 2 && renderStep3()}
              {step === 3 && renderStep4()}
              {step === 4 && renderReview()}
            </div>
            <div className="mt-8 pt-4 border-t flex justify-between items-center">
              <Button variant="ghost" onClick={prevStep} disabled={step === 0} className={step === 0 ? 'invisible' : ''}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              {step < 4 ? (
                <Button onClick={nextStep}>Próximo <ChevronRight className="w-4 h-4 ml-1" /></Button>
              ) : (
                <Button variant={isUrgent ? "accent" : "primary"} onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Enviando...' : 'Finalizar'}</Button>
              )}
            </div>
          </div>
        ) : renderSuccess()}
      </main>
    </div>
  );
}

export default App;