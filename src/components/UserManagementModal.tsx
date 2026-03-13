import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { X, CheckCircle, AlertTriangle } from '../../components/ui/Icons';
import { createRequester } from '../services/api';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error('Preencha todos os campos.');
      return;
    }

    setIsSaving(true);
    const result = await createRequester(name, email);

    if (result.success) {
      toast.success('Requisitante cadastrado com sucesso!');
      setName('');
      setEmail('');
      onClose();
    } else {
      toast.error('Erro ao cadastrar. Verifique os dados ou permissões.');
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Cadastrar Requisitante</h2>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Gestão de Acessos</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-danger rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
            <Button variant="outline" fullWidth onClick={onClose} type="button">Cancelar</Button>
            <Button variant="primary" fullWidth disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Requisitante'}
            </Button>
          </div>
        </form>

        <div className="px-8 pb-8 text-center">
          <p className="text-[9px] text-slate-400 uppercase tracking-widest leading-relaxed">
            O novo requisitante receberá instruções de acesso via e-mail.
          </p>
        </div>
      </div>
    </div>
  );
};