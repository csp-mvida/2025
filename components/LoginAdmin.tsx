import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Lock, ChevronLeft, AlertTriangle } from './ui/Icons';
import { BackgroundAnimation } from './BackgroundAnimation';
import { signIn } from '../services/api';

interface LoginAdminProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export const LoginAdmin: React.FC<LoginAdminProps> = ({ onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <BackgroundAnimation />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="w-full max-w-md relative z-10">
        <button onClick={onBack} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-medium"><ChevronLeft className="w-4 h-4" /> Voltar</button>
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4"><Lock className="w-8 h-8 text-primary" /></div>
            <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
            <p className="text-slate-500 text-sm mt-1">Identifique-se para gerenciar as solicitações</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input label="E-mail Administrativo" type="email" placeholder="admin@missaovida.org.br" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Senha Administrativa" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required error={error} />
            {error && (
              <div className="flex items-center gap-2 text-danger bg-red-50 p-3 rounded-lg border border-red-100 animate-in shake"><AlertTriangle className="w-4 h-4 shrink-0" /><span className="text-xs font-medium">{error}</span></div>
            )}
            <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'Autenticando...' : 'Entrar no Painel'}</Button>
          </form>
          <div className="mt-8 pt-6 border-t border-slate-50 text-center"><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Segurança Financeira Missão Vida</p></div>
        </div>
      </div>
    </div>
  );
};