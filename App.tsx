import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors } from './types';
import { URGENCY_THRESHOLD_HOURS } from './constants';
import { formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, generateId } from './utils/formatters';
import { fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, submitRequest, uploadInvoice } from './services/api';

// Components
import { Stepper } from './components/Stepper';
import { Button } from './components/ui/Button';
import { Input, Select, Textarea } from './components/ui/Input';
import { UrgencyAlert } from './components/UrgencyAlert';
import { 
  CheckCircle, UploadCloud, FileText, 
  ChevronRight, ChevronLeft, AlertTriangle, RefreshCw, 
  Home, Lock, Copy, Search, Trash2, Save
}
from './components/ui/Icons';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginAdmin } from './components/LoginAdmin';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { RequestTracker } from './components/RequestTracker';

function App() {
  const [view, setView] = useState<'welcome' | 'form' | 'login' | 'admin' | 'track'>('welcome');
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
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

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

    const saved = localStorage.getItem('csp_draft');
    if (saved) setHasSavedDraft(true);
  }, []);

  const handleChange = (field: keyof CSPFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, invoiceFileMeta: { name: file.name, size: file.size } }));
      setIsUploading(true);
      try {
        const url = await uploadInvoice(file);
        setFormData(prev => ({ ...prev, invoiceUrl: url }));
      } finally {
        setIsUploading(false);
      }
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
      if (!formData.supplierName) errs.supplierName = "Fornecedor é obrigatório";
      if (!formData.value || parseInt(formData.value) === 0) errs.value = "Valor é obrigatório";
      if (!formData.paymentMethod) errs.paymentMethod = "Forma é obrigatória";
    }
    if (s === 2 && formData.hasInvoice === 'yes' && !formData.invoiceUrl) errs.invoiceFile = "Upload necessário";
    if (s === 3 && !formData.description) errs.description = "Descrição é obrigatória";
    if (s === 3 && !formData.termsAccepted) errs.termsAccepted = "Você deve aceitar os termos";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => validateStep(step) && setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const id = generateId();
    if (await submitRequest(formData, id)) {
      setGeneratedId(id);
      setIsSuccess(true);
      localStorage.removeItem('csp_draft');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData(INITIAL_DATA);
    setStep(0);
    setIsSuccess(false);
    setView('welcome');
  };

  const saveDraft = () => {
    const { invoiceFile, ...data } = formData;
    localStorage.setItem('csp_draft', JSON.stringify(data));
    setHasSavedDraft(true);
  };

  const clearDraft = () => {
    localStorage.removeItem('csp_draft');
    setFormData(INITIAL_DATA);
    setHasSavedDraft(false);
  };

  const renderStep1 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
        {authorizers.map(a => <option key={a} value={a}>{a}</option>)}
      </Select>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Vencimento do Pagamento <span className="text-accent">*</span></label>
        <div className="flex gap-2">
          <input type="date" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none" value={getDateValue()} onChange={e => handleChange('dueDate', `${e.target.value}T${getTimeValue() || '12:00'}`)} />
          <input type="time" className="w-32 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none" value={getTimeValue()} onChange={e => handleChange('dueDate', `${getDateValue()}T${e.target.value}`)} />
        </div>
        {errors.dueDate && <p className="text-xs text-danger mt-1">{errors.dueDate}</p>}
        <UrgencyAlert isUrgent={isUrgent} />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Select label="Conta de Pagamento" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required error={errors.paymentAccount}>
        <option value="">Selecione...</option>
        {paymentAccounts.map(p => <option key={p} value={p}>{p}</option>)}
      </Select>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Verba Específica? <span className="text-accent">*</span></label>
        <div className="flex gap-2">
          <button onClick={() => handleChange('isSpecificBudget', 'yes')} className={`flex-1 py-3 rounded-xl border transition-all ${formData.isSpecificBudget === 'yes' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Sim</button>
          <button onClick={() => handleChange('isSpecificBudget', 'no')} className={`flex-1 py-3 rounded-xl border transition-all ${formData.isSpecificBudget === 'no' ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>Não</button>
        </div>
      </div>
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
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-4">Possui Nota Fiscal? <span className="text-accent">*</span></label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => handleChange('hasInvoice', 'yes')} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'yes' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <FileText className="w-8 h-8" />
            <span className="font-bold">Sim, possuo</span>
          </button>
          <button onClick={() => handleChange('hasInvoice', 'no')} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${formData.hasInvoice === 'no' ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'}`}>
            <AlertTriangle className="w-8 h-8" />
            <span className="font-bold">Não possuo agora</span>
          </button>
        </div>
      </div>
      {formData.hasInvoice === 'yes' && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Upload do Anexo <span className="text-accent">*</span></label>
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer relative group">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                {isUploading ? <RefreshCw className="w-8 h-8 text-primary animate-spin" /> : <UploadCloud className="w-8 h-8 text-primary" />}
              </div>
              <div className="space-y-1">
                <p className="font-bold text-primary">{formData.invoiceFileMeta?.name || "Clique para selecionar"}</p>
                <p className="text-xs text-slate-400">PDF, JPG ou PNG</p>
              </div>
            </div>
          </div>
          {errors.invoiceFile && <p className="text-xs text-danger text-center">{errors.invoiceFile}</p>}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Textarea label="Descrição do Pagamento" required value={formData.description} onChange={e => handleChange('description', e.target.value)} error={errors.description} rows={4} placeholder="Ex: Pagamento referente à compra de materiais de escritório para o mês de Outubro..." />
      <Input label="Número de Autorização (Opcional)" value={formData.authNumber || ''} onChange={e => handleChange('authNumber', e.target.value)} placeholder="Se houver um código prévio" />
      <div className={`p-6 rounded-2xl border transition-all ${formData.termsAccepted ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-slate-100'}`}>
        <label className="flex items-start gap-4 cursor-pointer">
          <input type="checkbox" className="mt-1.5 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} />
          <div className="space-y-1">
            <p className="font-bold text-slate-800 text-sm">Confirmo que li e concordo com os prazos e regras.</p>
            <p className="text-xs text-slate-500 leading-relaxed">Entendo que solicitações urgentes devem ser comunicadas via WhatsApp.</p>
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
      { label: 'Descrição', value: formData.description, full: true },
      { label: 'Anexo', value: formData.invoiceUrl ? 'Enviado' : 'Enviará via WhatsApp', full: true }
    ];

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-slate-800">Resumo da Solicitação</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, i) => (
              <div key={i} className={`p-4 rounded-xl border border-slate-50 ${item.full ? 'md:col-span-2' : ''}`}>
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{item.label}</span>
                <span className={`block font-bold text-slate-800 ${item.color || ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-4 border border-slate-100">
          <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">Verifique todas as informações antes de enviar. Após o envio, você receberá um ID de protocolo.</p>
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
    <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in duration-500 max-w-lg mx-auto">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
        <CheckCircle className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-3xl font-black text-slate-900 mb-2">Solicitação Enviada!</h2>
      <p className="text-slate-500 mb-10 text-center font-medium">Seu pedido foi registrado e entrará em análise.</p>
      
      <div className="w-full bg-white rounded-[2.5rem] p-10 mb-10 shadow-2xl shadow-primary/10 border border-slate-50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
        <p className="text-[10px] uppercase font-black text-slate-300 tracking-[0.3em] mb-4">Código do Protocolo</p>
        <div className="flex items-center justify-center gap-4">
          <span className="text-3xl md:text-4xl font-mono font-black text-slate-900 tracking-tighter">{generatedId}</span>
          <button onClick={() => { navigator.clipboard.writeText(generatedId); setIsIdCopied(true); setTimeout(() => setIsIdCopied(false), 2000); }} className={`p-3 rounded-2xl transition-all ${isIdCopied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary'}`}>
            <Copy className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full">
        <Button onClick={resetForm} fullWidth size="lg" className="rounded-2xl shadow-xl py-5 font-black uppercase tracking-widest">Voltar ao Início</Button>
        <Button variant="ghost" onClick={() => setView('track')} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Acompanhar Status</Button>
      </div>
    </div>
  );

  if (view === 'welcome') return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 overflow-x-hidden">
      <BackgroundAnimation />
      <header className="relative z-30">
        <div className="bg-primary py-3 px-6 flex justify-center shadow-lg">
          <button onClick={() => setView('login')} className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-80 transition-opacity"><Lock className="w-4 h-4" /> Acesso Administrativo</button>
        </div>
      </header>
      <div className="max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center p-8 relative z-10 text-center">
        <img src="/logo.png" alt="Logo" className="h-20 md:h-28 mb-12 drop-shadow-2xl animate-fade-up" />
        <div className="space-y-6 max-w-3xl mb-14 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none px-4">Sua plataforma de <span className="text-primary italic">pagamentos.</span></h1>
          <p className="text-lg md:text-xl text-slate-500 font-medium px-8 leading-relaxed">Envie suas solicitações de forma guiada, segura e acompanhe o processamento em tempo real.</p>
        </div>
        <div className="flex flex-col gap-5 w-full max-w-sm animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Button size="lg" onClick={() => setView('form')} className="relative w-full rounded-2xl py-6 text-xl font-black shadow-2xl">Criar Solicitação</Button>
          </div>
          <Button variant="outline" size="lg" onClick={() => setView('track')} className="rounded-2xl py-6 bg-white border-slate-200 text-slate-600 font-bold hover:border-primary/50">Acompanhar Pedido</Button>
          {hasSavedDraft && <button onClick={() => { setFormData(JSON.parse(localStorage.getItem('csp_draft')!)); setView('form'); }} className="text-xs text-slate-400 font-bold flex items-center gap-2 justify-center hover:text-primary transition-colors mt-2"><RefreshCw className="w-3 h-3" /> Continuar preenchimento salvo</button>}
        </div>
      </div>
    </div>
  );

  if (view === 'login') return <LoginAdmin onLoginSuccess={() => setView('admin')} onBack={() => setView('welcome')} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('welcome')} />;
  if (view === 'track') return <div className="min-h-screen relative bg-slate-50 flex items-center justify-center p-6"><BackgroundAnimation />{renderHeader()}<RequestTracker initialProtocol={generatedId} onBack={() => setView('welcome')} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16 selection:bg-primary/10">
      <BackgroundAnimation />
      {renderHeader()}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {!isSuccess ? (
          <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 duration-700">
            {/* Top Navigation */}
            <div className="flex justify-between items-center mb-10">
              <button onClick={() => setView('welcome')} className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest"><Home className="w-4 h-4" /> Voltar ao Início</button>
              <div className="flex gap-4">
                <button onClick={clearDraft} className="flex items-center gap-1.5 text-danger hover:opacity-80 transition-opacity text-[10px] font-bold uppercase"><Trash2 className="w-3.5 h-3.5" /> Limpar rascunho</button>
                <button onClick={saveDraft} className="flex items-center gap-1.5 text-primary border border-primary/20 bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-[10px] font-bold uppercase"><Save className="w-3.5 h-3.5" /> Salvar rascunho</button>
              </div>
            </div>

            {/* Title Section */}
            <div className="mb-12">
               <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 block">Financeiro</span>
               <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-2">Nova Solicitação</h1>
               <p className="text-slate-500 font-medium">Preencha os dados abaixo para registrar um novo pagamento.</p>
            </div>

            <Stepper currentStep={step} />

            <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-50 mb-10">
              {step === 0 && renderStep1()}
              {step === 1 && renderStep2()}
              {step === 2 && renderStep3()}
              {step === 3 && renderStep4()}
              {step === 4 && renderReview()}
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-slate-200">
              <button onClick={prevStep} className={`flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-sm transition-all ${step === 0 ? 'invisible' : ''}`}><ChevronLeft className="w-5 h-5" /> Voltar</button>
              {step < 4 ? (
                <Button onClick={nextStep} size="lg" className="rounded-xl px-10 py-4 shadow-xl">Próximo <ChevronRight className="w-5 h-5 ml-2" /></Button>
              ) : (
                <Button onClick={handleSubmit} size="lg" disabled={isSubmitting} className="rounded-xl px-10 py-4 shadow-xl bg-primaryDark">
                  {isSubmitting ? 'Enviando...' : <span className="flex items-center gap-2">Confirmar Envio <CheckCircle className="w-5 h-5" /></span>}
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