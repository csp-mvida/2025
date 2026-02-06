import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { INITIAL_DATA, CSPFormData, Department } from './types';
import { supabase } from './src/integrations/supabase/client';
import { fetchDepartments, fetchAuthorizers, fetchPaymentAccounts, subscribeToRequests } from './services/api';

// Components
import { LoginAdmin } from './components/LoginAdmin';
import { AdminDashboard } from './components/AdminDashboard';
import { RequestTracker } from './components/RequestTracker';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { FormFlow } from './components/FormFlow'; // Vou extrair o fluxo do form para manter limpo

function App() {
  const [view, setView] = useState<'welcome' | 'form' | 'login' | 'admin' | 'track'>('welcome');
  const [session, setSession] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [authorizers, setAuthorizers] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));

    const loadData = async () => {
      const [depts, auths, accounts] = await Promise.all([fetchDepartments(), fetchAuthorizers(), fetchPaymentAccounts()]);
      setDepartments(depts); setAuthorizers(auths); setPaymentAccounts(accounts);
    };
    loadData();

    return () => subscription.unsubscribe();
  }, []);

  // Se o usuário estiver na rota de login ou admin e logado, vai pro dashboard
  useEffect(() => {
    if (session && view === 'login') setView('admin');
    if (!session && view === 'admin') setView('login');
  }, [session, view]);

  const renderContent = () => {
    if (view === 'login') return <LoginAdmin onBack={() => setView('welcome')} />;
    if (view === 'admin') return <AdminDashboard onBack={() => { supabase.auth.signOut(); setView('welcome'); }} />;
    if (view === 'track') return (
      <div className="min-h-screen relative flex flex-col bg-slate-50 items-center justify-center">
        <BackgroundAnimation />
        <RequestTracker onBack={() => setView('welcome')} departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} />
      </div>
    );
    // Fluxo Público (Welcome e Form)
    return <FormFlow view={view} setView={setView} departments={departments} authorizers={authorizers} paymentAccounts={paymentAccounts} />;
  };

  return (
    <>
      <Toaster position="top-right" />
      {renderContent()}
    </>
  );
}

export default App;