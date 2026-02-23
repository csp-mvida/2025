"use client";

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { uploadFilesToSupabase } from '../services/api';

const Stepper = ({ currentStep, setCurrentStep, draft, setDraft }) => {
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [boletoFiles, setBoletoFiles] = useState<File[]>([]);
  const [transferFiles, setTransferFiles] = useState<File[]>([]);
  
  const [isUploading, setIsUploading] = useState({
    invoice: false,
    boleto: false,
    transfer: false
  });

  const [uploadStatus, setUploadStatus] = useState({
    invoice: false,
    boleto: false,
    transfer: false
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'boleto' | 'transfer') => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadStatus(prev => ({ ...prev, [type]: false }));
      switch (type) {
        case 'invoice': setInvoiceFiles(files); break;
        case 'boleto': setBoletoFiles(files); break;
        case 'transfer': setTransferFiles(files); break;
      }
    }
  };

  const handleRemoveFile = (file: File, type: 'invoice' | 'boleto' | 'transfer') => {
    setUploadStatus(prev => ({ ...prev, [type]: false }));
    switch (type) {
      case 'invoice': setInvoiceFiles(invoiceFiles.filter(f => f !== file)); break;
      case 'boleto': setBoletoFiles(boletoFiles.filter(f => f !== file)); break;
      case 'transfer': setTransferFiles(transferFiles.filter(f => f !== file)); break;
    }
  };

  const handleSectionUpload = async (type: 'invoice' | 'boleto' | 'transfer') => {
    const files = type === 'invoice' ? invoiceFiles : type === 'boleto' ? boletoFiles : transferFiles;
    
    if (files.length === 0) {
      toast.error('Nenhum arquivo selecionado.');
      return;
    }

    setIsUploading(prev => ({ ...prev, [type]: true }));
    const loadingToast = toast.loading(`Enviando ${type === 'invoice' ? 'Nota Fiscal' : type === 'boleto' ? 'Boleto' : 'Comprovante'}...`);

    try {
      const payload = {
        invoiceFiles: type === 'invoice' ? invoiceFiles : [],
        boletoFiles: type === 'boleto' ? boletoFiles : [],
        transferFiles: type === 'transfer' ? transferFiles : [],
        draftId: draft.id
      };

      const result = await uploadFilesToSupabase(payload);
      
      const fieldName = `${type}_attachment_path`;
      const paths = type === 'invoice' ? result.invoicePaths : type === 'boleto' ? result.boletoPaths : result.transferPaths;

      setDraft(prev => ({
        ...prev,
        [fieldName]: JSON.stringify(paths)
      }));

      setUploadStatus(prev => ({ ...prev, [type]: true }));
      toast.success('Arquivo enviado com sucesso!', { id: loadingToast });
    } catch (error) {
      toast.error('Erro ao enviar arquivo.', { id: loadingToast });
    } finally {
      setIsUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const validateAndProceed = () => {
    if (invoiceFiles.length > 0 && !uploadStatus.invoice) {
      toast.error("Clique em 'Enviar anexo' para concluir o envio da Nota Fiscal.");
      return;
    }
    if (boletoFiles.length > 0 && !uploadStatus.boleto) {
      toast.error("Clique em 'Enviar anexo' para concluir o envio do Boleto.");
      return;
    }
    if (transferFiles.length > 0 && !uploadStatus.transfer) {
      toast.error("Clique em 'Enviar anexo' para concluir o envio da Transferência.");
      return;
    }
    
    setCurrentStep(currentStep + 1);
  };

  const renderFileList = (files: File[], type: 'invoice' | 'boleto' | 'transfer') => (
    <div className="mt-2 space-y-2">
      {files.map((file, index) => (
        <div key={index} className="flex flex-col p-2 bg-gray-50 rounded border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate max-w-[80%]">{file.name}</span>
            <button onClick={() => handleRemoveFile(file, type)} className="text-red-500 hover:text-red-700 text-xs font-bold">X</button>
          </div>
          <div className="mt-1">
            {uploadStatus[type] ? (
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Enviado ✅</span>
            ) : (
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Selecionado (ainda não enviado)</span>
                <span className="text-[9px] text-gray-400">Clique em 'Enviar anexo' para concluir o envio.</span>
              </div>
            )}
          </div>
        </div>
      ))}
      {files.length > 0 && !uploadStatus[type] && (
        <button
          onClick={() => handleSectionUpload(type)}
          disabled={isUploading[type]}
          className="w-full mt-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded shadow-sm disabled:opacity-50 transition-colors"
        >
          {isUploading[type] ? 'Enviando...' : 'Enviar anexo'}
        </button>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Anexos de Pagamento</h2>
      
      <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-2">Nota Fiscal</label>
        <input type="file" multiple onChange={(e) => handleFileChange(e, 'invoice')} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
        {renderFileList(invoiceFiles, 'invoice')}
      </div>

      <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-2">Boleto</label>
        <input type="file" multiple onChange={(e) => handleFileChange(e, 'boleto')} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
        {renderFileList(boletoFiles, 'boleto')}
      </div>

      <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-2">Comprovante de Transferência</label>
        <input type="file" multiple onChange={(e) => handleFileChange(e, 'transfer')} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
        {renderFileList(transferFiles, 'transfer')}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {currentStep === 1 && <div className="p-8 text-center text-gray-400 font-medium">Etapa 1: Dados de Identificação</div>}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && <div className="p-8 text-center text-gray-400 font-medium">Etapa 3: Revisão Final</div>}

      <div className="mt-10 flex justify-between items-center border-t pt-6">
        <button
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={currentStep === 1}
          className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={validateAndProceed}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          {currentStep === 3 ? 'Finalizar' : 'Próximo'}
        </button>
      </div>
    </div>
  );
};

export default Stepper;