import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import {
  Search,
  ChevronLeft,
  Clock,
  CheckCircle,
  X,
  AlertTriangle,
  FileText,
  RefreshCw,
  Download,
  Eye,
} from "./ui/Icons";

import { cspGetSolicitacao, cspCreateSignedUrl } from "../services/api";
import { CSPRequest, RequestStatus, Department } from "../types";
import { formatCurrency } from "../utils/formatters";

interface RequestTrackerProps {
  initialProtocol?: string;
  onBack: () => void;
  departments: Department[];
  authorizers: { id: string; name: string }[];
  paymentAccounts: { id: string; label: string }[];
}

const STATUS_MAP: Record<
  RequestStatus,
  { label: string; color: string; icon: React.ReactNode; desc: string }
> = {
  pending: {
    label: "Em análise",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <Clock className="w-5 h-5" />,
    desc: "Sua solicitação foi recebida e está aguardando análise do setor financeiro.",
  },
  approved: {
    label: "Aprovado para pagamento",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <CheckCircle className="w-5 h-5" />,
    desc: "Tudo certo! Sua solicitação foi aprovada e entrará na fila de pagamentos.",
  },
  paid: {
    label: "Pago",
    color: "bg-primary/10 text-primary border-primary/20",
    icon: <CheckCircle className="w-5 h-5" />,
    desc: "Pagamento realizado com sucesso.",
  },
  rejected: {
    label: "Rejeitado",
    color: "bg-danger/10 text-danger border-danger/20",
    icon: <X className="w-5 h-5" />,
    desc: "Houve um problema com sua solicitação. Verifique o motivo abaixo.",
  },
  draft: {
    label: "Rascunho",
    color: "bg-slate-200 text-slate-600 border-slate-300",
    icon: <FileText className="w-5 h-5" />,
    desc: "Esta solicitação ainda está em rascunho e não foi enviada para análise.",
  },
};

// Tenta extrair um id_protocolo inteiro de formatos tipo:
// "CSP-20260310-1234" ou "1234"
function parseProtocolToInt(raw: string): number | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  // pega o último bloco numérico após "-" se existir; senão pega todos os dígitos
  const parts = trimmed.split("-").filter(Boolean);
  const last = parts[parts.length - 1] ?? trimmed;

  const lastDigits = last.replace(/\D/g, "");
  if (lastDigits) return Number(lastDigits);

  const allDigits = trimmed.replace(/\D/g, "");
  if (allDigits) return Number(allDigits);

  return null;
}

// Normaliza whatsapp para comparar/consultar (só dígitos)
function normalizeWhatsapp(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

// Faz uma adaptação do row do banco para o formato CSPRequest esperado no app.
// Como seu type CSPRequest pode ser diferente, eu mapeei o que é seguro e deixei
// o resto como fallback.
function mapDbRowToCSPRequest(row: any): CSPRequest {
  // Campos que vimos no Supabase:
  // id_protocolo, solicitante_nome, whatsapp_contato, id_nucleo, id_autorizador,
  // data_vencimento, conta_pagamento, verba_especifica, fornecedor_recebedor,
  // valor_total, forma_pagamento, possui_nf, url_anexo, ... (e closed_at existe no seu fluxo)
  const status: RequestStatus =
    (row?.status as RequestStatus) ||
    // heurística mínima (caso não tenha status na tabela):
    (row?.closed_at ? "paid" : "pending");

  return {
    // ids
    id: row?.id_protocolo ?? row?.id ?? row?.protocol ?? "",
    // campos usados no UI
    status,
    supplierName: row?.fornecedor_recebedor ?? row?.supplierName ?? "N/A",
    value: row?.valor_total ?? row?.value ?? 0,
    departmentId: String(row?.id_nucleo ?? row?.departmentId ?? ""),
    dueDate: row?.data_vencimento ?? row?.dueDate ?? new Date().toISOString(),
    closedAt: row?.closed_at ?? row?.closedAt ?? null,

    // campos extras usados no UI via "any"
    ...(row?.paid_at ? { paidAt: row.paid_at } : {}),
    ...(row?.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
    ...(row?.url_anexo ? { paymentReceiptUrl: row.url_anexo } : {}),
  } as any;
}

export const RequestTracker: React.FC<RequestTrackerProps> = ({
  initialProtocol = "",
  onBack,
  departments,
  authorizers,
  paymentAccounts,
}) => {
  const [protocol, setProtocol] = useState(initialProtocol);
  const [whatsapp, setWhatsapp] = useState("");
  const [request, setRequest] = useState<CSPRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [previewData, setPreviewData] = useState<{ url: string; title: string } | null>(null);

  const getDepartmentName = (id: string) =>
    departments.find((d) => String(d.id) === String(id))?.name || "N/A";

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(url, "_blank");
    }
  };

  const resolveReceiptUrlIfNeeded = async (maybePathOrUrl: string): Promise<string> => {
    if (!maybePathOrUrl) return "";

    // Se já for URL completa, usa direto
    if (maybePathOrUrl.startsWith("http://") || maybePathOrUrl.startsWith("https://")) {
      return maybePathOrUrl;
    }

    // Caso seja um path do Storage (bucket privado), gera Signed URL
    const signed = await cspCreateSignedUrl({
      path: maybePathOrUrl,
      bucket: "uploads",
      expiresIn: 120,
    });

    return signed;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const parsedId = parseProtocolToInt(protocol);
    const wpp = normalizeWhatsapp(whatsapp);

    if (!parsedId) {
      setError("Informe um protocolo válido.");
      return;
    }
    if (!wpp) {
      setError("Informe seu WhatsApp (com DDD) para validar a consulta.");
      return;
    }

    setLoading(true);
    setError("");
    setRequest(null);

    try {
      const rows = await cspGetSolicitacao({
        id_protocolo: parsedId,
        whatsapp_contato: wpp,
      });

      if (rows && Array.isArray(rows) && rows.length > 0) {
        const mapped = mapDbRowToCSPRequest(rows[0]);

        // Se tiver comprovante (url_anexo), pode ser path -> vira signed URL
        const receipt = (mapped as any).paymentReceiptUrl as string | undefined;
        if (receipt) {
          try {
            const resolved = await resolveReceiptUrlIfNeeded(receipt);
            (mapped as any).paymentReceiptUrl = resolved;
          } catch {
            // se falhar signed url, mantém como está
          }
        }

        setRequest(mapped);
      } else {
        setError("Protocolo não encontrado (ou WhatsApp não confere).");
      }
    } catch (err) {
      setError("Ocorreu um erro na busca.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialProtocol) {
      // tenta buscar automaticamente só se o usuário já tiver whatsapp preenchido
      // (evita consulta inválida)
      // você pode remover esta condição se preferir auto-buscar sempre.
      if (whatsapp) handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProtocol]);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-medium"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
          Acompanhar Solicitação
        </h1>
        <p className="text-slate-500 text-sm">Insira seu protocolo e WhatsApp (com DDD).</p>
      </div>

      <form onSubmit={handleSearch} className="mb-10">
        <div className="flex flex-col gap-3">
          <Input
            label=""
            placeholder="Protocolo (ex.: CSP-20260310-1234 ou 1234)"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value.toUpperCase())}
            className="text-lg font-mono uppercase"
          />

          <Input
            label=""
            placeholder="WhatsApp com DDD (ex.: 62 99999-9999)"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="text-lg"
          />

          <Button type="submit" size="lg" disabled={loading || !protocol} className="w-full">
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            <span className="ml-2">Buscar</span>
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-danger text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> {error}
          </div>
        )}
      </form>

      {request && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`p-8 text-center border-b ${STATUS_MAP[request.status].color}`}>
              <div className="inline-flex p-3 rounded-full bg-white/50 mb-4">
                {STATUS_MAP[request.status].icon}
              </div>
              <h2 className="text-2xl font-black uppercase tracking-widest leading-tight">
                {STATUS_MAP[request.status].label}
              </h2>
              <p className="text-sm font-medium mt-1">{STATUS_MAP[request.status].desc}</p>

              {(request as any).paidAt && (
                <div className="mt-4 p-3 bg-white/40 rounded-xl border border-emerald-200/50 inline-block">
                  <span className="text-xs font-bold text-emerald-700">
                    Confirmado em: {new Date((request as any).paidAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              )}

              {request.status === "rejected" && (request as any).rejectionReason && (
                <div className="mt-4 p-4 bg-white/60 rounded-2xl border border-red-200/50 text-left">
                  <span className="block text-[10px] uppercase font-black text-danger/60 mb-1">
                    Motivo da Rejeição:
                  </span>
                  <p className="text-sm font-bold text-danger leading-relaxed italic">
                    "{(request as any).rejectionReason}"
                  </p>
                </div>
              )}
            </div>

            <div className="p-8 grid grid-cols-2 gap-6">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Fornecedor</span>
                <p className="font-bold">{(request as any).supplierName}</p>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Valor</span>
                <p className="font-black text-primary text-xl">
                  {formatCurrency((request as any).value)}
                </p>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Núcleo</span>
                <p className="text-sm">{getDepartmentName((request as any).departmentId)}</p>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Vencimento</span>
                <p className="text-sm">
                  {new Date((request as any).dueDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </div>

          {(request as any).status === "paid" && (
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 animate-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Comprovante de Pagamento</h3>
                </div>

                {(request as any).closedAt && (
                  <div className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg animate-in zoom-in-95 duration-500">
                    Atendimento Encerrado
                  </div>
                )}
              </div>

              {(request as any).paymentReceiptUrl ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 font-medium flex items-center gap-2">
                    <span className="text-primary">✅</span> Comprovante disponível para download.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() =>
                        setPreviewData({
                          url: (request as any).paymentReceiptUrl,
                          title: `Comprovante - ${(request as any).id}`,
                        })
                      }
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                    >
                      <Eye className="w-5 h-5" /> Visualizar
                    </button>
                    <button
                      onClick={() =>
                        handleDownload((request as any).paymentReceiptUrl, `comprovante_${(request as any).id}.pdf`)
                      }
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primaryDark text-white font-bold rounded-2xl transition-all shadow-lg shadow-primary/20"
                    >
                      <Download className="w-5 h-5" /> Baixar Comprovante
                    </button>
                  </div>

                  {(request as any).closedAt && (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-xs text-slate-500 font-medium text-center">
                        Este atendimento foi concluído pelo setor financeiro.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-500 leading-relaxed italic">
                    <span className="text-primary mr-1">✅</span> Pagamento confirmado. O comprovante ficará
                    disponível aqui para download assim que for anexado pelo financeiro.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Preview de Arquivo */}
      {previewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-900 truncate">{previewData.title}</h3>
              <button
                onClick={() => setPreviewData(null)}
                className="p-2 text-slate-400 hover:text-danger hover:bg-red-50 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 overflow-hidden">
              {previewData.url.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={`${previewData.url}#toolbar=0&navpanes=0`}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6">
                  <img
                    src={previewData.url}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => handleDownload(previewData.url, `comprovante_${(request as any)?.id}.pdf`)}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-primary/20"
              >
                <Download className="w-5 h-5" /> Baixar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};