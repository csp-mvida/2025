import React, { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { supabase } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BackgroundAnimation } from '../../components/BackgroundAnimation';
import { ChevronLeft, AlertTriangle, CheckCircle, FileText } from '../../components/ui/Icons';

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://csp-mv-app.vercel.app/reset-password',
    });

    if (error) {
      toast.error(error.message || 'Erro ao enviar e-mail de recuperação.');
      setLoading(false);
      return;
    }

    setIsSuccess(true);
    setLoading(false);
    toast.success('E-mail enviado com sucesso!');
  };

  return (
    <div className="min-h-screen relative bg-slate-50 flex flex-col items-center justify-center p-6 overflow-hidden">
      <Toaster position="top-right" />
      <BackgroundAnimation />

      <div className="w-full max-w-md relative z-10">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar para o Login
        </button>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8 md:p-10">
          {!isSuccess ? (
            <>
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 ring-4 ring-primary/5">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Recuperar Senha</h2>
                <p className="text-slate-500 text-sm mt-1">Informe seu e-mail para receber o link de acesso</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <Input 
                  label="E-mail Cadastrado"
                  type="email"
                  placeholder="exemplo@missaovida.org.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />

                <Button 
                  type="submit" 
                  fullWidth 
                  size="lg" 
                  disabled={loading}
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">E-mail Enviado!</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </p>
              <Button onClick={onBack} fullWidth variant="secondary">
                Voltar para o Login
              </Button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Segurança Financeira Missão Vida
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}