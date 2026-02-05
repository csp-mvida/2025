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
        setFormData(prev => ({ ...prev, boletoUrl: publicUrl }));
      } catch (error) {
        alert("Erro no upload.");
      } finally {
        setIsUploadingBoleto(false);
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
    <div className="text-center animate-in zoom-in duration-500 py-10">
      <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
      <h2 className="text-2xl font-bold">Enviada com Sucesso!</h2>
      <div className="my-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-lg">
        <span className="text-[10px] uppercase font-bold text-slate-400">Protocolo</span>
        <div className="text-2xl font-mono font-black text-slate-900 mt-1">{generatedId}</div>
      </div>
      <div className="space-y-2">
        <Button variant="outline" fullWidth onClick={handleCopyResume}>Copiar Resumo</Button>
        <Button fullWidth onClick={handleReset}>Voltar ao Início</Button>
      </div>
    </div>
  );

  const renderWelcome = () => (
    <div className="min-h-screen relative flex flex-col bg-slate-50">
      <BackgroundAnimation />
      <header className="relative z-30">
        <div className="bg-primary py-2.5 px-4 flex justify-center">
          <button onClick={() => setView('login')} className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest"><Lock className="w-4 h-4" /> Acesso Admin</button>
        </div>
      </header>
      <div className="max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center p-8 relative z-10 text-center">
        <img src="/logo.png" alt="Logo" className="h-20 mb-10" />
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 leading-tight">Gestão de <span className="text-primary italic">Pagamentos.</span></h1>
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Button size="lg" onClick={handleStartRequest} className="rounded-2xl">Criar Solicitação</Button>
          <Button variant="outline" size="lg" onClick={handleTrackRequest} className="rounded-2xl bg-white">Acompanhar Pedido</Button>
          {hasSavedDraft && <button onClick={handleRestoreDraft} className="text-xs text-slate-400 font-bold flex items-center gap-2 justify-center"><RefreshCw className="w-3 h-3" /> Continuar rascunho</button>}
        </div>
      </div>
    </div>
  );

  if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return <div className="min-h-screen relative bg-slate-50"><BackgroundAnimation /><RequestTracker onBack={() => setView('welcome')} /></div>;
  if (view === 'welcome') return renderWelcome();

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-primary/20">
      <BackgroundAnimation />
      <main className="max-w-2xl mx-auto p-4 md:p-8 relative z-10">
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