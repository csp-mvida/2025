import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Lock, ChevronLeft, AlertTriangle } from './ui/Icons';
import { BackgroundAnimation } from './BackgroundAnimation';

interface LoginAdminProps {
  onLoginSuccess: () => void;
  onBack: () => void;
  onForgotPassword: () => void;
}

export const LoginAdmin: React.FC<LoginAdminProps> = ({ onLoginSuccess, onBack, onForgotPassword }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Senha definida conforme solicitado
  const ADMIN_PASSWORD = 'CSP@2025';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulação de delay para segurança (evitar brute force)
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        onLoginSuccess();
      } else {
        setError('Senha administrativa incorreta.');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <BackgroundAnimation />
      
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar para o Início
        </button>

        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 ring-4 ring-primary/5">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
            <p className="text-slate-500 text-sm mt-1">Identifique-se para gerenciar as solicitações</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input 
                label="Senha Administrativa"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                error={error}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-danger bg-red-50 p-3 rounded-lg border border-red-100 animate-in shake duration-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <Button 
                type="submit" 
                fullWidth 
                size="lg" 
                disabled={loading}
                className="shadow-xl shadow-primary/20"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Autenticando...
                  </span>
                ) : 'Entrar no Painel'}
              </Button>

              <button 
                type="button"
                onClick={onForgotPassword}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-primary transition-colors py-2"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Segurança Financeira Missão Vida
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};