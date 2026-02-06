import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department, ValidationErrors, FileMeta } from './types';
import { URGENCY_THRESHOLD_HOURS, SPECIFIC_BUDGET_OPTIONS } from './constants';
import { formatCurrency, parseCurrency, formatPhone, isValidPhone, checkUrgency, generateId } from './utils/formatters';
import { 
  fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, 
  submitRequest, uploadInvoice 
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
  const [tempId] = useState(() => Math.random().toString(36).substring(7));

  const isUrgent = checkUrgency(formData.dueDate);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const isInvoice = type === 'invoice';
    if (isInvoice) setIsUploading(true);
    else setIsUploadingBoleto(true);

    const toastId = toast.loading(`Enviando ${files.length} arquivo(s)...`);

    try {
      const currentUrls = isInvoice ? [...(formData.invoiceUrls || [])] : [...(formData.boletoUrls || [])];
      const currentMeta = isInvoice ? [...(formData.invoiceFilesMeta || [])] : [...(formData.boletoFilesMeta || [])];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 100 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} muito grande (máx 100MB)`);
          continue;
        }
        const url = await uploadInvoice(file, type, tempId);
        currentUrls.push(url);
        currentMeta.push({ name: file.name, size: file.size, url });
      }

      const serialized = JSON.stringify(currentUrls);
      if (isInvoice) {
        setFormData(prev => ({ ...prev, invoiceUrls: currentUrls, invoiceFilesMeta: currentMeta, invoiceUrl: serialized }));
      } else {
        setFormData(prev => ({ ...prev, boletoUrls: currentUrls, boletoFilesMeta: currentMeta, boletoUrl: serialized }));
      }
      toast.success('Arquivos enviados!', { id: toastId });
    } catch (err) {
      toast.error('Erro no upload.', { id: toastId });
    } finally {
      if (isInvoice) setIsUploading(false);
      else setIsUploadingBoleto(false);
    }
  };

  const handleRemoveFile = (idx: number, type: 'invoice' | 'boleto') => {
    const isInvoice = type === 'invoice';
    const urls = [...(isInvoice ? (formData.invoiceUrls || []) : (formData.boletoUrls || []))];
    const meta = [...(isInvoice ? (formData.invoiceFilesMeta || []) : (formData.boletoFilesMeta || []))];
    urls.splice(idx, 1);
    meta.splice(idx, 1);
    const serialized = urls.length > 0 ? JSON.stringify(urls) : '';
    if (isInvoice) setFormData(prev => ({ ...prev, invoiceUrls: urls, invoiceFilesMeta: meta, invoiceUrl: serialized }));
    else setFormData(prev => ({ ...prev, boletoUrls: urls, boletoFilesMeta: meta, boletoUrl: serialized }));
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
    const auth = authorizers.find(a => a.name === formData.authorizer);
    const acc = paymentAccounts.find(p => p.label === formData.paymentAccount);
    if (!auth || !acc) {
      toast.error('Erro nos dados.');
      setIsSubmitting(false);
      return;
    }
    const protocol = await submitRequest(formData, auth.id, acc.id, isUrgent);
    if (protocol) {
      setGeneratedId(protocol);
      setIsSuccess(true);
      toast.success('Solicitação enviada!');
    } else {
      toast.error('Erro ao enviar.');
    }
    setIsSubmitting(false);
  };

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in duration-500">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-3xl font-bold text-slate-900 mb-2">Solicitação Enviada!</h2>
      <p className="text-slate-500 mb-8">Seu pedido foi registrado com sucesso.</p>
      <div className="bg-white rounded-3xl p-8 mb-8 shadow-xl border border-slate-100 text-center w-full max-w-md">
        <p className="text-xs uppercase font-bold text-slate-400 mb-2">Seu Protocolo</p>
        <div className="flex items-center justify-center gap-4">
          <span className="text-2xl font-mono font-black text-slate-900">{generatedId}</span>
          <button onClick={() => { navigator.clipboard.writeText(generatedId); setIsIdCopied(true); setTimeout(() => setIsIdCopied(false), 2000); toast.success('Copiado!'); }} className="p-2 bg-slate-100 rounded-lg">
            <Copy className={`w-5 h-5 ${isIdCopied ? 'text-primary' : 'text-slate-400'}`} />
          </button>
        </div>
      </div>
      <Button onClick={() => { setView('welcome'); setStep(0); setIsSuccess(false); setFormData({...INITIAL_DATA}); }} size="lg" className="rounded-xl px-12">Voltar ao Início</Button>
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
      <RequestTracker departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} onBack={() => setView('welcome')} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-16">
      <Toaster position="top-right" />
      <BackgroundAnimation />
      <header className="bg-white border-b border-slate-100 py-3 px-6 flex justify-center fixed top-0 w-full z-50">
        <div className="text-[12px] font-medium text-slate-400 uppercase tracking-widest">CSP | Central de Pagamento</div>
      </header>
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
        {!isSuccess ? (
          <>
            <div className="flex justify-between mb-8">
              <button onClick={() => setView('welcome')} className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1"><Home className="w-4 h-4" /> Início</button>
              <div className="flex gap-4">
                <button onClick={() => setFormData({...INITIAL_DATA})} className="text-danger font-bold uppercase text-[10px]">Limpar</button>
                <button onClick={() => { localStorage.setItem('csp_draft', JSON.stringify(formData)); toast.success('Salvo!'); }} className="text-primary font-bold uppercase text-[10px]">Salvar</button>
              </div>
            </div>
            <Stepper currentStep={step} />
            <div className="bg-white rounded-3xl p-8 shadow-2xl mb-8">
              {step === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Responsável" value={formData.requesterName} onChange={e => handleChange('requesterName', e.target.value)} required error={errors.requesterName} />
                  <Input label="WhatsApp" value={formData.whatsapp} onChange={e => handleChange('whatsapp', formatPhone(e.target.value))} required error={errors.whatsapp} />
                  <Select label="Departamento" value={formData.departmentId} onChange={e => handleChange('departmentId', e.target.value)} required error={errors.departmentId}>
                    <option value="">Selecione...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                  <Select label="Autorizador" value={formData.authorizer} onChange={e => handleChange('authorizer', e.target.value)} required error={errors.authorizer}>
                    <option value="">Selecione...</option>
                    {authorizers.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </Select>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Vencimento</label>
                    <div className="flex gap-4">
                      <input type="date" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none" value={formData.dueDate.split('T')[0]} onChange={e => handleChange('dueDate', `${e.target.value}T${formData.dueDate.split('T')[1] || '12:00'}`)} />
                      <button onClick={() => setShowTimeInput(!showTimeInput)} className="p-3 border border-dashed rounded-xl text-slate-400"><Clock className="w-5 h-5" /></button>
                    </div>
                    {showTimeInput && <input type="time" className="w-full mt-4 px-4 py-3 rounded-xl border border-primary/30 outline-none" value={formData.dueDate.split('T')[1]?.substring(0,5)} onChange={e => handleChange('dueDate', `${formData.dueDate.split('T')[0]}T${e.target.value}`)} />}
                    <UrgencyAlert isUrgent={isUrgent} />
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select label="Conta" value={formData.paymentAccount} onChange={e => handleChange('paymentAccount', e.target.value)} required error={errors.paymentAccount}>
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
                  <Input label="Fornecedor" value={formData.supplierName} onChange={e => handleChange('supplierName', e.target.value)} required error={errors.supplierName} />
                  <Input label="Valor" value={formatCurrency(formData.value)} onChange={e => handleChange('value', parseCurrency(e.target.value))} required error={errors.value} />
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
                      <label className="block text-sm font-medium text-slate-700">Anexos do Boleto (Lote)</label>
                      <div className="border-2 border-dashed border-primary/20 bg-primary/5 rounded-2xl p-6 text-center cursor-pointer relative">
                        <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'boleto')} />
                        <UploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
                        <p className="text-xs font-bold text-primary">Anexar boletos</p>
                      </div>
                      <div className="space-y-2">
                        {formData.boletoFilesMeta?.map((f, i) => (
                          <div key={i} className="flex justify-between p-2 bg-slate-50 rounded-lg text-[10px] font-bold">
                            <span className="truncate max-w-[200px]">{f.name}</span>
                            <button onClick={() => handleRemoveFile(i, 'boleto')} className="text-danger"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                      {errors.boletoFile && <p className="text-xs text-danger">{errors.boletoFile}</p>}
                    </div>
                  )}
                </div>
              )}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { handleChange('hasInvoice', 'yes'); }} className={`p-6 rounded-2xl border-2 ${formData.hasInvoice === 'yes' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-400'}`}>
                      <FileText className="w-8 h-8 mx-auto mb-2" />
                      <span className="font-bold text-xs">Tenho Nota</span>
                    </button>
                    <button onClick={() => { handleChange('hasInvoice', 'no'); setShowInvoiceCommitmentModal(true); }} className={`p-6 rounded-2xl border-2 ${formData.hasInvoice === 'no' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-400'}`}>
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                      <span className="font-bold text-xs">Não tenho</span>
                    </button>
                  </div>
                  {formData.hasInvoice === 'yes' && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center relative cursor-pointer">
                        <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'invoice')} />
                        <UploadCloud className="w-10 h-10 text-primary mx-auto mb-2" />
                        <p className="font-bold text-primary">Anexar Notas</p>
                      </div>
                      <div className="space-y-2">
                        {formData.invoiceFilesMeta?.map((f, i) => (
                          <div key={i} className="flex justify-between p-2 bg-slate-50 rounded-lg text-[10px] font-bold">
                            <span className="truncate max-w-[200px]">{f.name}</span>
                            <button onClick={() => handleRemoveFile(i, 'invoice')} className="text-danger"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                      {errors.invoiceFile && <p className="text-xs text-danger">{errors.invoiceFile}</p>}
                    </div>
                  )}
                  {showInvoiceCommitmentModal && formData.hasInvoice === 'no' && (
                    <div className="p-4 bg-amber-50 rounded-xl text-center">
                      <p className="text-xs text-amber-800 mb-4">Me comprometo a enviar a nota via WhatsApp.</p>
                      <Button size="sm" onClick={() => { handleChange('invoiceSentViaWhatsapp', true); setShowInvoiceCommitmentModal(false); }}>Aceitar</Button>
                    </div>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-6">
                  <Textarea label="Descrição" required value={formData.description} onChange={e => handleChange('description', e.target.value)} error={errors.description} rows={4} />
                  <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded text-primary" checked={formData.termsAccepted} onChange={e => handleChange('termsAccepted', e.target.checked)} />
                    <span className="text-xs font-bold text-slate-700">Concordo com as regras e prazos.</span>
                  </label>
                  {errors.termsAccepted && <p className="text-xs text-danger">{errors.termsAccepted}</p>}
                </div>
              )}
              {step === 4 && (
                <div className="bg-slate-50 rounded-2xl p-6 space-y-4 text-xs">
                  <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Revisão Final</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-slate-400">Responsável:</span> <p className="font-bold">{formData.requesterName}</p></div>
                    <div><span className="text-slate-400">Valor:</span> <p className="font-bold text-primary">{formatCurrency(formData.value)}</p></div>
                    <div><span className="text-slate-400">Fornecedor:</span> <p className="font-bold">{formData.supplierName}</p></div>
                    <div><span className="text-slate-400">Vencimento:</span> <p className="font-bold">{new Date(formData.dueDate).toLocaleString('pt-BR')}</p></div>
                  </div>
                </div>
              )}
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