import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { X, CheckCircle } from '../../components/ui/Icons';
import { createRequester } from '../services/api';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsSuccess(false);
    setName('');
    setEmail('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const fullName = name.trim();
    const emailAddr = email.trim();

    if (!fullName || !emailAddr) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    
    try {
      const result = await createRequester(fullName, emailAddr);

      // Verificação rigorosa do retorno de sucesso da Edge Function
      if (result && result.success) {
        setIsSuccess(true);
        setName('');
        setEmail('');
        toast.success('Requisitante cadastrado com sucesso!', {
          duration: 5000,
          icon: '✅'
        });
      } else {
        // Exibe erro retornado pela função ou mensagem genérica
        const errorMsg = result?.error?.message || 'Não foi possível cadastrar o requisitante.';
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('[UserManagement] Erro na chamada:', err);
      toast.error('Erro de conexão ao tentar cadastrar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Cadastrar Requisitante</h2>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Gestão de Acessos</p>
          </div>
          <button type="button" onClick={handleClose} className="p-2 text-slate-400 hover:text-danger rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          {!isSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input 
                label="Nome Completo" 
                placeholder="Digite o nome do requisitante"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input 
                label="E-mail" 
                type="email" 
                placeholder="exemplo@missaovida.org.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="pt-4 flex gap-3">
                <Button variant="outline" fullWidth onClick={handleClose} type="button">Cancelar</Button>
                <Button variant="primary" fullWidth type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4 space-y-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-sm text-slate-600 font-medium leading-relaxed px-2">
                Requisitante cadastrado com sucesso. Oriente-o a clicar em ‘Criar solicitação’ na tela inicial para realizar o primeiro acesso e definir sua senha.
              </p>
              <Button variant="primary" fullWidth onClick={handleClose}>Concluir</Button>
            </div>
          )}
        </div>

        {!isSuccess && (
          <div className="px-8 pb-8 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Após o cadastro, o requisitante deverá clicar em ‘Criar solicitação’ na tela inicial para realizar o primeiro acesso e definir sua senha.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};