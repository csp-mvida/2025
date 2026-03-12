import React, { useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { supabase } from '../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BackgroundAnimation } from '../../components/BackgroundAnimation';
import { CheckCircle, Lock, AlertTriangle } from '../../components/ui/Icons';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const hashParams = useMemo(() => {
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;

    return new URLSearchParams(rawHash);
  }, []);

  useEffect(() => {
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    async function prepareRecoverySession() {
      if (!accessToken || !refreshToken || type !== 'recovery') {
        toast.error('Link de redefinição inválido ou expirado.');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        toast.error('Não foi possível validar o link de redefinição.');
        return;
      }

      setIsReady(true);
    }

    prepareRecoverySession();
  }, [hashParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReady) {
      toast.error('O link ainda não foi validado.');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      toast.error(error.message || 'Não foi possível atualizar a senha.');
      setIsSaving(false);
      return;
    }

    setIsSuccess(true);
    setIsSaving(false);
    toast.success('Senha redefinida com sucesso.');
  };

  const goToHome = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen relative bg-slate-50 flex items-center justify-center p-6">
      <Toaster position="top-right" />
      <BackgroundAnimation />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8">
          {!isSuccess ? (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
              </div>

              <h1 className="text-2xl font-black text-slate-900 text-center mb-2">
                Redefinir senha
              </h1>

              <p className="text-sm text-slate-500 text-center mb-8">
                Digite sua nova senha para concluir o acesso ao CSP.
              </p>

              {!isReady && (
                <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    Validando o link de recuperação...
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Nova senha"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  disabled={!isReady || isSaving}
                />

                <Input
                  label="Confirmar nova senha"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  disabled={!isReady || isSaving}
                />

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  disabled={!isReady || isSaving}
                >
                  {isSaving ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Senha atualizada
              </h2>
              <p className="text-slate-500 mb-8">
                Sua senha foi redefinida com sucesso.
              </p>
              <Button onClick={goToHome} fullWidth size="lg">
                Voltar ao início
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}