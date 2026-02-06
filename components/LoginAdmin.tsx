import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../src/integrations/supabase/client';
import { Lock, ChevronLeft } from './ui/Icons';
import { BackgroundAnimation } from './BackgroundAnimation';

interface LoginAdminProps {
  onBack: () => void;
}

export const LoginAdmin: React.FC<LoginAdminProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <BackgroundAnimation />
      <div className="w-full max-w-md relative z-10">
        <button onClick={onBack} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
            <p className="text-slate-500 text-sm mt-1">Identifique-se para gerenciar as solicitações</p>
          </div>

          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: '#008b5a', brandAccent: '#03c17e' } } } }}
            localization={{ variables: { sign_in: { email_label: 'E-mail', password_label: 'Senha', button_label: 'Entrar' } } }}
          />
        </div>
      </div>
    </div>
  );
};