import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { X, Lock, Mail, ChevronRight, AlertCircle, CheckCircle } from '../../components/ui/Icons';

interface RequesterAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

type Mode = 'login' | 'first-access' | 'forgot-password';

export const RequesterAccessModal: React.FC<RequesterAccessModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast.error('E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }
    
    toast.success('Bem-vindo!');
    setLoading(false);
    onLoginSuccess();
    onClose();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://csp-mv-app.vercel.app/reset-password',
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Link enviado! Verifique seu e-mail.');
      setMode('login');
    }
    setLoading(false);
  };

  const renderContent = () => {
    if (mode === 'login') {
      return (
        <form onSubmit={handleLogin} className="space-y-4">
          <Input 
            label="E-mail" 
            type="email" 
            placeholder="seu@email.com" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          <Input 
            label="Senha" 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          <div className="flex justify-between items-center px-1">
            <button type="button" onClick={() => setMode('forgot-password')} className="text-[10px] font-bold text-slate-400 hover:text-primary uppercase tracking-wider">Esqueci minha senha</button>
            <button type="button" onClick={() => setMode('first-access')} className="text-[10px] font-bold text-primary hover:text-primaryDark uppercase tracking-wider">Primeiro acesso?</button>
          </div>
          <Button type="submit" fullWidth disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
        </form>
      );
    }

    const isFirstAccess = mode === 'first-access';
    return (
      <form onSubmit={handleResetPassword} className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
           <p className="text-xs text-slate-500 leading-relaxed">
             {isFirstAccess 
               ? 'Se o seu cadastro já foi realizado pelo administrador, informe seu e-mail para definir sua senha de acesso.' 
               : 'Informe seu e-mail cadastrado para receber o link de redefinição de senha.'}
           </p>
        </div>
        <Input 
          label="E-mail Cadastrado" 
          type="email" 
          placeholder="seu@email.com" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          required 
        />
        <div className="space-y-3">
          <Button type="submit" fullWidth disabled={loading}>{loading ? 'Enviando...' : 'Enviar Link'}</Button>
          <button type="button" onClick={() => setMode('login')} className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-[0.2em]">Voltar para o Login</button>
        </div>
      </form>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'Acesso Requisitante' : mode === 'first-access' ? 'Primeiro Acesso' : 'Recuperar Senha'}
            </h2>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">CSP | Área Segura</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-danger rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          {renderContent()}
        </div>

        <div className="px-8 pb-8 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            Segurança Financeira Missão Vida
          </p>
        </div>
      </div>
    </div>
  );
};