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

  // Helper to check if form is essentially empty (excluding file objects)
  const isFormEmpty = useCallback((data: CSPFormData) => {
    const { invoiceFile, boletoFile, invoiceFileMeta, boletoFileMeta, ...dataToCheck } = data;
    const { invoiceFile: initialInv, boletoFile: initialBol, invoiceFileMeta: initialInvMeta, boletoFileMeta: initialBolMeta, ...initialDataToCheck } = INITIAL_DATA;
    
    // Check if all non-file fields match the initial state
    return JSON.stringify(dataToCheck) === JSON.stringify(initialDataToCheck);
  }, []);

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
      try {
        const parsed = JSON.parse(savedDraft);
        if (!isFormEmpty(parsed as CSPFormData)) {
          setHasSavedDraft(true);
        } else {
          localStorage.removeItem('csp_draft');
        }
      } catch (e) {
        console.error("Failed to parse draft", e);
        localStorage.removeItem('csp_draft');
      }
    }
  }, [isFormEmpty]);

  // Auto-Save Draft Logic
  useEffect(() => {
    if (isFormEmpty(formData)) {
        localStorage.removeItem('csp_draft');
        setHasSavedDraft(false);
        return;
    }
    
    if (!isSuccess) {
      const { invoiceFile, boletoFile, ...dataToSave } = formData;
      localStorage.setItem('csp_draft', JSON.stringify(dataToSave));
      setHasSavedDraft(true);
    }
  }, [formData, isSuccess, isFormEmpty]);

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
    setView('form');   
  };

  const handleManualSave = () => {
    if (isFormEmpty(formData)) {
        alert("Não há dados para salvar.");
        return;
    }
    const { invoiceFile, boletoFile, ...dataToSave } = formData;
    localStorage.setItem('csp_draft', JSON.stringify(dataToSave));
    setHasSavedDraft(true);
  };

  const handleStartRequest = () => {
    setView('form');
    window.scrollTo(0,0);
    setHasSavedDraft(false);
  };

  const handleTrackRequest = () => {
    setView('track');
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
      } catch (error) {
        console.error("Upload failed", error);
        alert("Erro ao fazer upload do arquivo.");
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

  const handleBoletoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({
        ...prev,
        boletoFile: file, 
        boletoFileMeta: { name: file.name, size: file.size }
      }));

      setIsUploadingBoleto(true);
      try {
        const publicUrl = await uploadInvoice(file);
        setFormData(prev => ({
          ...prev,
          boletoUrl: publicUrl
        }));
      } catch (error) {
        console.error("Boleto upload failed", error);
        alert("Erro ao fazer upload do boleto.");
        setFormData(prev => ({
          ...prev,
          boletoFile: null,
          boletoFileMeta: undefined,
          boletoUrl: undefined
        }));
      } finally {
        setIsUploadingBoleto(false);
      }
    }
  };

  const clearDraft = () => {
    if (window.confirm("Tem certeza que deseja limpar o rascunho?")) {
      setFormData(INITIAL_DATA);
      localStorage.removeItem('csp_draft');
      setHasSavedDraft(false);
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
        newErrors.whatsapp = "Número inválido.";
      }
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
      isValid = false;
    }

    return isValid;
  };

  const nextStep = () => {
    if (validateStep(step)) {
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
    } else {
      alert("Erro ao enviar.");
    }
    setIsSubmitting(false);
  };

  const handleReset = () => {
    setFormData(INITIAL_DATA);
    setIsSuccess(false);
    setStep(0);
    setGeneratedId('');
    setView('welcome'); 
  };

  const goToTrackingFromSuccess = () => {
    setView('track');
    setIsSuccess(false);
    window.scrollTo(0,0);
  };

  // --- RENDER WELCOME SCREEN ---
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

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-6 text-center animate-in zoom-in duration-500 max-w-2xl mx-auto px-2">
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
           <button onClick={handleCopyId} className={`p-1.5 rounded-full transition-all duration-300 ${isIdCopied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-primary'}`}>
             {isIdCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
           </button>
        </div>
      </div>

      <div className="flex flex-col w-full gap-2">
        <Button id="btn-copy-resume" variant="outline" fullWidth onClick={handleCopyResume} className="border-slate-300 text-slate-700 py-3 text-xs md:text-sm">
          Copiar Resumo
        </Button>
        <Button onClick={goToTrackingFromSuccess} variant="secondary" fullWidth size="md" className="py-3 text-xs md:text-sm">
          Ver Status em Tempo Real
        </Button>
        <Button onClick={handleReset} fullWidth size="md" className="shadow-xl py-3 text-xs md:text-sm">
          Página Inicial
        </Button>
      </div>
    </div>
  );

  if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return <div className="min-h-screen relative bg-slate-50"><BackgroundAnimation /><RequestTracker initialProtocol={generatedId} onBack={() => setView('welcome')} /></div>;
  if (view === 'welcome') return renderWelcome();

  return (
    <div className="min-h-screen bg-background text-slate-800 selection:bg-primary/20">
      <BackgroundAnimation />
      <main className="min-h-screen flex flex-col relative z-10">
        {!isSuccess && (
          <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            <div className="bg-primary py-2.5 px-4 flex justify-center shadow-md">
              <button onClick={() => setView('login')} className="flex items-center gap-1.5 md:gap-2 text-white font-bold hover:scale-105 transition-all text-[11px] md:text-sm uppercase tracking-widest group">
                <Lock className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                Acesso Restrito <span className="text-green-300">Admin</span>
              </button>
            </div>
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4 shrink-0">
                <div className="cursor-pointer transition-opacity hover:opacity-80" onClick={() => setView('welcome')}>
                  <img src="/logo.png" alt="Missão Vida" className="h-8 md:h-12 w-auto object-contain" />
                </div>
              </div>
              <div className="flex items-center">
                <button onClick={() => setView('welcome')} className="flex items-center gap-1.5 md:gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 transition-all text-[10px] md:text-xs font-bold">
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
              <div className="mb-4 md:mb-6 text-center animate-in fade-in duration-700">
                <div className="inline-block p-1.5 bg-primary/5 rounded-2xl mb-2"><FileText className="w-6 h-6 text-primary" /></div>
                <h1 className="text-xl md:text-3xl font-bold text-slate-900 mb-1 tracking-tight">Solicitação de Pagamento</h1>
                <p className="text-slate-500 text-[10px] md:text-sm font-medium">Preencha os dados com atenção para agilizar o processo.</p>
              </div>
              <div className="flex justify-center md:justify-end gap-2 mb-3">
                 {!isFormEmpty(formData) && (
                   <button onClick={clearDraft} className="text-[10px] text-danger font-bold hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-all">
                     <Trash2 className="w-3 h-3" /> Limpar Rascunho
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
              <div className="mt-6 pt-2 border-t border-slate-100 flex justify-between items-center sticky bottom-0 bg-white/80 backdrop-blur-md py-3 -mx-4 px-4 md:-mx-8 md:px-8 z-10">
                <Button variant="ghost" onClick={prevStep} disabled={step === 0 || isSubmitting} size="md" className={step === 0 ? 'invisible' : 'text-xs px-4'}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                {step < 4 ? (
                  <Button onClick={nextStep} size="md" className="px-6 text-xs font-bold shadow-lg shadow-primary/20" disabled={isUploading || isUploadingBoleto}>
                    {isUploading || isUploadingBoleto ? 'Enviando...' : <>{'Próximo Passo'} <ChevronRight className="w-4 h-4 ml-1" /></>}
                  </Button>
                ) : (
                  <Button variant={isUrgent ? "accent" : "primary"} onClick={handleSubmit} disabled={isSubmitting} size="md" className="px-8 text-xs font-black shadow-xl shadow-primary/30">
                    {isSubmitting ? 'Processando...' : <>{'Finalizar e Enviar'} <CheckCircle className="w-4 h-4 ml-1" /></>}
                  </Button>
                )}
              </div>
            </>
          ) : renderSuccess()}
        </div>
      </main>
      {!isSuccess && view === 'form' && (
        <footer className="w-full pt-3 pb-8 border-t border-slate-200 text-center relative z-10">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">Missão Vida &bull; {new Date().getFullYear()} &bull; Central de Pagamento</p>
        </footer>
      )}
    </div>
  );
}

export default App;