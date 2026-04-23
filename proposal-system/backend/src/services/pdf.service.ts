import { jsPDF } from 'jspdf';
import { supabaseAdmin } from '../utils/supabase.js';
import type { ProposalWithDetails } from '../types/index.js';
import fs from 'fs';
import path from 'path';

export class PDFService {
  private getLogoBase64(): string {
    try {
      const logoPath = path.resolve(process.cwd(), '../frontend/public/logo/logo.png');
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
      return '';
    }
  }

  async generateProposalPDF(
    proposal: ProposalWithDetails,
    includeSignature: boolean = false
  ): Promise<Buffer> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Helper function for RTL text
    const rtlText = (text: string) => text.split('').reverse().join('');

    // Header background
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo
    const logoBase64 = this.getLogoBase64();
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', pageWidth - margin - 30, 8, 25, 25);
      } catch (e) {
        // Skip logo if it fails
      }
    }

    // Title
    doc.setTextColor(249, 115, 22); // Orange
    doc.setFontSize(24);
    doc.text(rtlText('הצעת מחיר'), pageWidth - margin, 22, { align: 'right' });

    // Order number and date
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`${proposal.order_number} :${rtlText('מספר הזמנה')}`, pageWidth - margin, 32, { align: 'right' });
    doc.text(`${new Date(proposal.proposal_date).toLocaleDateString('he-IL')} :${rtlText('תאריך')}`, pageWidth - margin, 38, { align: 'right' });

    y = 55;

    // Customer section
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, y, pageWidth - margin * 2, 35, 'F');

    doc.setTextColor(249, 115, 22);
    doc.setFontSize(14);
    doc.text(rtlText('פרטי הלקוח'), pageWidth - margin - 5, y + 8, { align: 'right' });

    // Draw line under title
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.5);
    doc.line(margin + 5, y + 11, pageWidth - margin - 5, y + 11);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);

    const customerY = y + 18;
    const customer = proposal.customer || { full_name: '-', phone: '-', doc_number: '-', email: '-' };
    doc.text(`${customer.full_name || '-'} :${rtlText('שם')}`, pageWidth - margin - 5, customerY, { align: 'right' });
    doc.text(`${customer.phone || '-'} :${rtlText('טלפון')}`, pageWidth - margin - 5, customerY + 7, { align: 'right' });
    doc.text(`${customer.doc_number || '-'} :${rtlText('ת.ז/ח.פ')}`, pageWidth / 2, customerY, { align: 'right' });
    doc.text(`${customer.email || '-'} :${rtlText('דוא"ל')}`, pageWidth / 2, customerY + 7, { align: 'right' });

    y += 45;

    // Items section
    doc.setTextColor(26, 26, 26);
    doc.setFontSize(14);
    doc.text(rtlText('פירוט השירותים'), pageWidth - margin, y, { align: 'right' });

    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 3, pageWidth - margin, y + 3);

    y += 12;

    // Items (with null check)
    const blocks = proposal.blocks || [];
    blocks.forEach((block, index) => {
      // Check if we need a new page
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }

      // Block container
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 25, 2, 2, 'S');

      // Block title and total
      doc.setTextColor(26, 26, 26);
      doc.setFontSize(11);
      doc.text(`${block.title} .${index + 1}`, pageWidth - margin - 5, y + 8, { align: 'right' });

      doc.setTextColor(249, 115, 22);
      doc.setFontSize(12);
      doc.text(`${this.formatCurrency(block.line_total)}`, margin + 5, y + 8, { align: 'left' });

      // Quantity and unit price
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(9);
      doc.text(`${this.formatCurrency(block.unit_price)} × ${block.quantity}`, margin + 5, y + 15, { align: 'left' });

      // Text items
      if (block.text_items && block.text_items.length > 0) {
        doc.setTextColor(75, 85, 99);
        doc.setFontSize(9);
        block.text_items.forEach((item, i) => {
          if (i < 2) { // Limit to 2 items
            doc.text(rtlText(item.content.substring(0, 50)), pageWidth - margin - 10, y + 15 + (i * 5), { align: 'right' });
          }
        });
      }

      y += 30;
    });

    // Check if we need a new page for totals
    if (y > pageHeight - 55) {
      doc.addPage();
      y = margin;
    }

    y += 5;

    // Totals section
    doc.setFillColor(26, 26, 26);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);

    const totalsY = y + 12;
    doc.text(rtlText('סה"כ לפני מע"מ'), pageWidth - margin - 10, totalsY, { align: 'right' });
    doc.text(this.formatCurrency(proposal.subtotal), margin + 10, totalsY, { align: 'left' });

    doc.text(`(${(proposal.vat_rate * 100).toFixed(0)}%) ${rtlText('מע"מ')}`, pageWidth - margin - 10, totalsY + 8, { align: 'right' });
    doc.text(this.formatCurrency(proposal.vat_amount), margin + 10, totalsY + 8, { align: 'left' });

    // Total line
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.5);
    doc.line(margin + 10, totalsY + 13, pageWidth - margin - 10, totalsY + 13);

    doc.setTextColor(249, 115, 22);
    doc.setFontSize(14);
    doc.text(rtlText('סה"כ לתשלום'), pageWidth - margin - 10, totalsY + 22, { align: 'right' });
    doc.text(this.formatCurrency(proposal.total), margin + 10, totalsY + 22, { align: 'left' });

    y += 50;

    // Terms section (if exists)
    if (proposal.terms_text) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = margin;
      }

      doc.setFillColor(248, 249, 250);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 25, 2, 2, 'F');

      doc.setTextColor(26, 26, 26);
      doc.setFontSize(11);
      doc.text(rtlText('תנאים כלליים'), pageWidth - margin - 5, y + 8, { align: 'right' });

      doc.setTextColor(75, 85, 99);
      doc.setFontSize(8);
      const termsLines = proposal.terms_text.substring(0, 200).split('\n').slice(0, 2);
      termsLines.forEach((line, i) => {
        doc.text(rtlText(line.substring(0, 80)), pageWidth - margin - 5, y + 15 + (i * 4), { align: 'right' });
      });

      y += 30;
    }

    // Signature section (if signed)
    if (includeSignature && proposal.signature?.signature_payload) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = margin;
      }

      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 2, 2, 'S');

      doc.setTextColor(26, 26, 26);
      doc.setFontSize(12);
      doc.text(rtlText('חתימת הלקוח'), pageWidth / 2, y + 8, { align: 'center' });

      try {
        const sigData = (proposal.signature.signature_payload as any).dataUrl;
        if (sigData) {
          doc.addImage(sigData, 'PNG', pageWidth / 2 - 25, y + 12, 50, 20);
        }
      } catch (e) {
        // Skip signature if it fails
      }

      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`${new Date(proposal.signature.signed_at!).toLocaleDateString('he-IL')} :${rtlText('נחתם בתאריך')}`, pageWidth / 2, y + 36, { align: 'center' });
    }

    // Footer
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.text(rtlText('מסמך זה הופק באופן אוטומטי ממערכת הצעות המחיר'), pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Get the PDF as buffer
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  }

  private formatCurrency(amount: number): string {
    return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      draft: 'טיוטה',
      sent: 'נשלח',
      signed: 'נחתם',
      void: 'בוטל'
    };
    return statusMap[status] || status;
  }

  async uploadToStorage(
    pdfBuffer: Buffer,
    proposalId: string,
    kind: 'unsigned_pdf' | 'signed_pdf'
  ): Promise<string> {
    const filename = `${proposalId}/${kind}_${Date.now()}.pdf`;
    const bucket = 'proposal-pdfs';

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    // Save document record
    await supabaseAdmin.from('documents').upsert({
      proposal_id: proposalId,
      kind,
      storage_bucket: bucket,
      storage_path: filename
    }, {
      onConflict: 'proposal_id,kind'
    });

    return filename;
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from('proposal-pdfs')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) {
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }
}

export const pdfService = new PDFService();
