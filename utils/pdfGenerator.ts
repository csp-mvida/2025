import { jsPDF } from 'jspdf';
import { CSPFormData, Department } from '../types';
import { formatCurrency } from './formatters';

export const generatePDF = (data: CSPFormData, departments: Department[]) => {
  const doc = new jsPDF();
  const deptName = departments.find(d => d.id === data.departmentId)?.name || 'N/A';
  const currentDate = new Date().toLocaleDateString('pt-BR');
  const currentTime = new Date().toLocaleTimeString('pt-BR');

  // Configuration constants
  const margin = 20;
  let cursorY = 20;
  const lineHeight = 10;
  const pageHeight = doc.internal.pageSize.height;

  // --- HEADER ---
  // Accent Bar
  doc.setFillColor(0, 139, 90); // Brand Primary Color (approximate for #008b5a)
  doc.rect(0, 0, 10, pageHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text('Protocolo de Solicitação CSP', margin + 5, cursorY);
  
  cursorY += 8;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(`Gerado em ${currentDate} às ${currentTime}`, margin + 5, cursorY);

  cursorY += 15;
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(margin, cursorY, 190, cursorY);
  cursorY += 15;

  // --- CONTENT HELPER ---
  const printField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Label Color
    doc.text(label.toUpperCase(), margin + 5, cursorY);

    cursorY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59); // Value Color
    
    // Handle text wrapping for Description
    const splitText = doc.splitTextToSize(value, 160);
    doc.text(splitText, margin + 5, cursorY);
    
    cursorY += (splitText.length * 6) + 8; // Adjust spacing based on lines
  };

  // --- SECTIONS ---

  // Identification
  printField('Responsável', data.requesterName);
  printField('Departamento / Núcleo', deptName);

  // Payment Details
  printField('Fornecedor', data.supplierName);
  
  // Custom logic for Value to make it pop
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('VALOR', margin + 5, cursorY);
  cursorY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 139, 90); // Primary color for money
  doc.text(formatCurrency(data.value), margin + 5, cursorY);
  cursorY += 14;

  const formattedDate = data.dueDate ? new Date(data.dueDate).toLocaleString('pt-BR') : 'N/A';
  printField('Vencimento', formattedDate);
  
  printField('Forma de Pagamento', data.paymentMethod || 'N/A');

  // Description
  printField('Descrição do Pagamento', data.description);

  // Footer / Disclaimer
  const footerY = pageHeight - 30;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, 190, footerY);
  
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Este documento é um resumo da solicitação preenchida no sistema CSP.', margin + 5, footerY + 10);
  doc.text('Ele não substitui o comprovante de pagamento bancário.', margin + 5, footerY + 15);

  // Save
  const safeName = data.supplierName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'solicitacao';
  doc.save(`csp_resumo_${safeName}.pdf`);
};