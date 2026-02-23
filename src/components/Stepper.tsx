"use client";

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { uploadFileToSupabase } from '../services/api';

const Stepper = ({ currentStep, setCurrentStep, draft, setDraft }) => {
  const [selectedBoletoFile, setSelectedBoletoFile] = useState<File | null>(null);
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState<File | null>(null);
  const [selectedTransferFile, setSelectedTransferFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'boleto' | 'invoice' | 'transfer') => {
    const file = e.target.files?.[0];
    if (file) {
      switch (type) {
        case 'boleto':
          setSelectedBoletoFile(file);
          break;
        case 'invoice':
          setSelectedInvoiceFile(file);
          break;
        case 'transfer':
          setSelectedTransferFile(file);
          break;
      }
    }
  };

  const handleUpload = async (file: File | null, type: 'boleto' | 'invoice' | 'transfer') => {
    if (!file) return;

    try {
      const { path } = await uploadFileToSupabase(file, type);
      setDraft((prevDraft) => ({
        ...prevDraft,
        [`${type}_attachment_path`]: path,
      }));
      toast.success(`${type} enviado com sucesso!`);
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error(`Erro ao enviar ${type}. Tente novamente.`);
    }
  };

  const handleRemove = (type: 'boleto' | 'invoice' | 'transfer') => {
    switch (type) {
      case 'boleto':
        setSelectedBoletoFile(null);
        setDraft((prevDraft) => ({
          ...prevDraft,
          boleto_attachment_path: '',
        }));
        break;
      case 'invoice':
        setSelectedInvoiceFile(null);
        setDraft((prevDraft) => ({
          ...prevDraft,
          invoice_attachment_path: '',
        }));
        break;
      case 'transfer':
        setSelectedTransferFile(null);
        setDraft((prevDraft) => ({
          ...prevDraft,
          transfer_attachment_path: '',
        }));
        break;
    }
  };

  const validateAndProceed = () => {
    if (draft.method === 'boleto' && selectedBoletoFile && !draft.boleto_attachment_path) {
      toast.error('Clique em "Enviar anexo" para concluir o envio do arquivo.');
      return false;
    }
    if (draft.invoice && selectedInvoiceFile && !draft.invoice_attachment_path) {
      toast.error('Clique em "Enviar anexo" para concluir o envio do arquivo.');
      return false;
    }
    if (draft.transfer && selectedTransferFile && !draft.transfer_attachment_path) {
      toast.error('Clique em "Enviar anexo" para concluir o envio do arquivo.');
      return false;
    }
    setCurrentStep(currentStep + 1);
    return true;
  };

  const renderStep2 = () => (
    <div>
      <h2 className="text-xl font-bold mb-4">Anexos</h2>
      <div className="mb-4">
        <label htmlFor="boleto" className="block text-sm font-medium text-gray-700">
          Boleto
        </label>
        <input
          type="file"
          id="boleto"
          onChange={(e) => handleFileChange(e, 'boleto')}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        {selectedBoletoFile && (
          <div className="text-sm text-gray-600 mt-1">
            {selectedBoletoFile.name} - Selecionado (não enviado)
          </div>
        )}
        {selectedBoletoFile && !draft.boleto_attachment_path && (
          <button
            onClick={() => handleUpload(selectedBoletoFile, 'boleto')}
            className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Enviar anexo
          </button>
        )}
        {selectedBoletoFile && draft.boleto_attachment_path && (
          <button
            onClick={() => handleRemove('boleto')}
            className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Remover
          </button>
        )}
      </div>
      <div className="mb-4">
        <label htmlFor="invoice" className="block text-sm font-medium text-gray-700">
          Nota Fiscal
        </label>
        <input
          type="file"
          id="invoice"
          onChange={(e) => handleFileChange(e, 'invoice')}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        {selectedInvoiceFile && (
          <div className="text-sm text-gray-600 mt-1">
            {selectedInvoiceFile.name} - Selecionado (não enviado)
          </div>
        )}
        {selectedInvoiceFile && !draft.invoice_attachment_path && (
          <button
            onClick={() => handleUpload(selectedInvoiceFile, 'invoice')}
            className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Enviar anexo
          </button>
        )}
        {selectedInvoiceFile && draft.invoice_attachment_path && (
          <button
            onClick={() => handleRemove('invoice')}
            className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Remover
          </button>
        )}
      </div>
      <div className="mb-4">
        <label htmlFor="transfer" className="block text-sm font-medium text-gray-700">
          Transferência
        </label>
        <input
          type="file"
          id="transfer"
          onChange={(e) => handleFileChange(e, 'transfer')}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        {selectedTransferFile && (
          <div className="text-sm text-gray-600 mt-1">
            {selectedTransferFile.name} - Selecionado (não enviado)
          </div>
        )}
        {selectedTransferFile && !draft.transfer_attachment_path && (
          <button
            onClick={() => handleUpload(selectedTransferFile, 'transfer')}
            className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Enviar anexo
          </button>
        )}
        {selectedTransferFile && draft.transfer_attachment_path && (
          <button
            onClick={() => handleRemove('transfer')}
            className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4">
      {currentStep === 1 && <h1 className="text-2xl font-bold mb-4">Etapa 1</h1>}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && <h1 className="text-2xl font-bold mb-4">Etapa 3</h1>}

      <div className="mt-6 flex justify-end">
        {currentStep > 1 && (
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-500 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Voltar
          </button>
        )}
        {currentStep < 3 && (
          <button
            onClick={validateAndProceed}
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Próximo
          </button>
        )}
      </div>
    </div>
  );
};

export default Stepper;