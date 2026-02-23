"use client";

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { uploadFilesToSupabase } from '../services/api';

const Stepper = ({ currentStep, setCurrentStep, draft, setDraft }) => {
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [boletoFiles, setBoletoFiles] = useState<File[]>([]);
  const [transferFiles, setTransferFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = Array.from(e.target.files || []);
    switch (type) {
      case 'invoice':
        setInvoiceFiles(files);
        break;
      case 'boleto':
        setBoletoFiles(files);
        break;
      case 'transfer':
        setTransferFiles(files);
        break;
    }
  };

  const handleRemoveFile = (file: File, type: 'invoice' | 'boleto' | 'transfer') => {
    switch (type) {
      case 'invoice':
        setInvoiceFiles(invoiceFiles.filter(f => f !== file));
        break;
      case 'boleto':
        setBoletoFiles(boletoFiles.filter(f => f !== file));
        break;
      case 'transfer':
        setTransferFiles(transferFiles.filter(f => f !== file));
        break;
    }
  };

  const validateAndProceed = async () => {
    if (draft.invoice && invoiceFiles.length === 0) {
      toast.error('Selecione pelo menos um arquivo de nota fiscal.');
      return false;
    }
    if (draft.method === 'boleto' && boletoFiles.length === 0) {
      toast.error('Selecione pelo menos um arquivo de boleto.');
      return false;
    }

    try {
      const { invoicePaths, boletoPaths, transferPaths } = await uploadFilesToSupabase({
        invoiceFiles,
        boletoFiles,
        transferFiles,
        draftId: draft.id,
      });

      setDraft((prevDraft) => ({
        ...prevDraft,
        invoice_attachment_path: JSON.stringify(invoicePaths),
        boleto_attachment_path: JSON.stringify(boletoPaths),
        transfer_attachment_path: JSON.stringify(transferPaths),
      }));

      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Erro ao enviar arquivos:', error);
      toast.error('Erro ao enviar arquivos. Tente novamente.');
    }
  };

  const renderStep2 = () => (
    <div>
      <h2 className="text-xl font-bold mb-4">Anexos</h2>
      <div className="mb-4">
        <label htmlFor="invoice" className="block text-sm font-medium text-gray-700">
          Nota Fiscal
        </label>
        <input
          type="file"
          id="invoice"
          onChange={(e) => handleFileChange(e, 'invoice')}
          multiple
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <div className="text-sm text-gray-600 mt-1">
          {invoiceFiles.length} / 0 arquivos selecionados
        </div>
        <ul className="mt-2 space-y-1">
          {invoiceFiles.map((file, index) => (
            <li key={index} className="flex items-center justify-between">
              <span>{file.name}</span>
              <button
                onClick={() => handleRemoveFile(file, 'invoice')}
                className="text-red-600 hover:text-red-900"
              >
                X
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-4">
        <label htmlFor="boleto" className="block text-sm font-medium text-gray-700">
          Boleto
        </label>
        <input
          type="file"
          id="boleto"
          onChange={(e) => handleFileChange(e, 'boleto')}
          multiple
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <div className="text-sm text-gray-600 mt-1">
          {boletoFiles.length} / 0 arquivos selecionados
        </div>
        <ul className="mt-2 space-y-1">
          {boletoFiles.map((file, index) => (
            <li key={index} className="flex items-center justify-between">
              <span>{file.name}</span>
              <button
                onClick={() => handleRemoveFile(file, 'boleto')}
                className="text-red-600 hover:text-red-900"
              >
                X
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-4">
        <label htmlFor="transfer" className="block text-sm font-medium text-gray-700">
          Transferência
        </label>
        <input
          type="file"
          id="transfer"
          onChange={(e) => handleFileChange(e, 'transfer')}
          multiple
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <div className="text-sm text-gray-600 mt-1">
          {transferFiles.length} / 0 arquivos selecionados
        </div>
        <ul className="mt-2 space-y-1">
          {transferFiles.map((file, index) => (
            <li key={index} className="flex items-center justify-between">
              <span>{file.name}</span>
              <button
                onClick={() => handleRemoveFile(file, 'transfer')}
                className="text-red-600 hover:text-red-900"
              >
                X
              </button>
            </li>
          ))}
        </ul>
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