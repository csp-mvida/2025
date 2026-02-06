import React, { useRef } from 'react';
import { UploadCloud, FileText, Trash2, RefreshCw, AlertTriangle } from './ui/Icons';
import { AttachmentMeta } from '../types';
import { toast } from 'react-hot-toast';

interface MultiFileUploadProps {
  attachments: AttachmentMeta[];
  onUpload: (file: File, type: 'invoice' | 'boleto' | 'other') => Promise<void>;
  onRemove: (url: string) => void;
  error?: string;
  isUploading: boolean;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({ 
  attachments, 
  onUpload, 
  onRemove, 
  error, 
  isUploading 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesToProcess = Array.from(files);
    
    if (attachments.length + filesToProcess.length > MAX_FILES) {
      toast.error(`Limite de ${MAX_FILES} arquivos atingido.`);
      return;
    }

    for (const file of filesToProcess) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`O arquivo "${file.name}" excede o limite de ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }

      // Determinar o tipo de arquivo (simplificado para fins de UI/DB)
      let type: 'invoice' | 'boleto' | 'other' = 'other';
      const fileNameLower = file.name.toLowerCase();
      if (fileNameLower.includes('nf') || fileNameLower.includes('nota')) {
        type = 'invoice';
      } else if (fileNameLower.includes('boleto')) {
        type = 'boleto';
      }

      await onUpload(file, type);
    }

    // Limpar o input para permitir o upload do mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone / Input */}
      <div 
        className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center transition-colors cursor-pointer relative group 
          ${error ? 'border-danger/50 bg-red-50' : 'border-slate-200 hover:border-primary/50 bg-white'}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          className="absolute inset-0 opacity-0 cursor-pointer" 
          onChange={handleFileChange} 
          multiple
          disabled={isUploading || attachments.length >= MAX_FILES}
        />
        <div className="flex flex-col items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-16 md:h-16 bg-primary/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            {isUploading ? <RefreshCw className="w-6 h-6 md:w-8 md:h-8 text-primary animate-spin" /> : <UploadCloud className="w-6 h-6 md:w-8 md:h-8 text-primary" />}
          </div>
          <div className="space-y-1">
            <p className="font-bold text-primary text-xs md:text-base">
              {isUploading ? 'Enviando arquivos...' : attachments.length >= MAX_FILES ? 'Limite de anexos atingido' : 'Clique ou arraste para anexar'}
            </p>
            <p className="text-[10px] md:text-xs text-slate-400">
              Máximo de {MAX_FILES} arquivos, até {MAX_FILE_SIZE_MB}MB cada.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-danger text-sm animate-in shake">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Lista de Anexos */}
      {attachments.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Anexos ({attachments.length}/{MAX_FILES})</h4>
          {attachments.map((attachment, index) => (
            <div key={attachment.url} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 truncate">
                <FileText className={`w-5 h-5 shrink-0 ${attachment.type === 'boleto' ? 'text-accent' : 'text-primary'}`} />
                <div className="truncate">
                  <p className="text-sm font-medium text-slate-800 truncate">{attachment.name}</p>
                  <p className="text-[10px] text-slate-400">{formatBytes(attachment.size)}</p>
                </div>
              </div>
              <button 
                onClick={() => onRemove(attachment.url)}
                className="p-1 text-slate-400 hover:text-danger transition-colors shrink-0"
                title="Remover anexo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};