import { CSPRequest, RequestStatus } from '../types';

export interface RequestFlags {
  missing_pix_key: boolean;
  missing_boleto_info: boolean;
  missing_transfer_data: boolean;
  needs_invoice_attachment: boolean;
  invalid_amount: boolean;
  critical_blockers: boolean;
  blocker_messages: string[];
}

/**
 * Calcula pendências lógicas de uma solicitação baseado no método de pagamento e status.
 */
export const computeRequestFlags = (request: Partial<CSPRequest>): RequestFlags => {
  const method = request.paymentMethod?.toLowerCase() || '';
  const messages: string[] = [];

  const flags = {
    missing_pix_key: method === 'pix' && !request.pixKey,
    missing_boleto_info: method === 'boleto' && !request.boletoUrl, // Checa o anexo
    missing_transfer_data: method === 'transferencia' && (
      !request.transferBankName || 
      !request.transferAccountType || 
      !request.transferAgency || 
      !request.transferAccount || 
      !request.transferCpfCnpj || 
      !request.transferBeneficiaryName
    ),
    needs_invoice_attachment: request.hasInvoice === 'yes' && (!request.invoiceUrl || request.invoiceUrl === 'Pendente via WhatsApp'),
    invalid_amount: (request.status !== 'draft') && (!request.value || parseInt(request.value) <= 0),
  };

  if (flags.invalid_amount) messages.push("Valor inválido ou zerado.");
  if (flags.missing_pix_key) messages.push("Chave PIX não informada.");
  if (flags.missing_boleto_info) messages.push("Anexo do boleto obrigatório.");
  if (flags.missing_transfer_data) messages.push("Dados bancários incompletos.");
  if (flags.needs_invoice_attachment) messages.push("Anexo da Nota Fiscal obrigatório.");

  return {
    ...flags,
    critical_blockers: flags.invalid_amount || flags.missing_pix_key || flags.missing_boleto_info || flags.missing_transfer_data,
    blocker_messages: messages
  };
};

/**
 * Valida se uma solicitação está apta para sair de Draft para Pending.
 */
export const validateSubmission = (request: Partial<CSPRequest>): { valid: boolean; error?: string } => {
  const flags = computeRequestFlags(request);
  if (!request.paymentMethod) return { valid: false, error: "Forma de pagamento não selecionada." };
  if (flags.critical_blockers) return { valid: false, error: flags.blocker_messages[0] };
  return { valid: true };
};