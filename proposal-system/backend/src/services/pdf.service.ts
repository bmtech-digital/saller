import puppeteer, { type Browser } from 'puppeteer';
import { supabaseAdmin } from '../utils/supabase.js';
import type { ProposalWithDetails } from '../types/index.js';
import fs from 'fs';
import path from 'path';

export class PDFService {
  private browser: Browser | null = null;

  private getLogoBase64(): string {
    const candidates = [
      path.resolve(process.cwd(), '../frontend/public/logo/logo.png'),
      path.resolve(process.cwd(), 'frontend/public/logo/logo.png'),
      path.resolve(process.cwd(), 'logo.png'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p);
          return `data:image/png;base64,${buf.toString('base64')}`;
        }
      } catch {
        /* try next */
      }
    }
    return '';
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    });
    return this.browser;
  }

  async generateProposalPDF(
    proposal: ProposalWithDetails,
    includeSignature: boolean = false,
  ): Promise<Buffer> {
    const html = this.renderProposalHTML(proposal, includeSignature);
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: ['load', 'networkidle0'] });
      // Make sure all webfonts are ready before printing.
      // The arrow runs in the browser context — `document` is the page's document.
      await page.evaluate(
        // @ts-expect-error - runs in the page (DOM) context, not Node
        () => (document.fonts ? document.fonts.ready : null),
      );
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  private renderProposalHTML(p: ProposalWithDetails, includeSignature: boolean): string {
    const logo = this.getLogoBase64();
    const customer = p.customer || ({} as ProposalWithDetails['customer']);
    const blocks = p.blocks || [];
    const proposalDate = new Date(p.proposal_date).toLocaleDateString('he-IL');
    const vatPercent = Math.round((p.vat_rate || 0) * 100);

    const sigData =
      includeSignature && p.signature?.signature_payload
        ? (p.signature.signature_payload as { dataUrl?: string }).dataUrl || ''
        : '';
    const signedAt =
      includeSignature && p.signature?.signed_at
        ? new Date(p.signature.signed_at).toLocaleDateString('he-IL')
        : '';

    const blockRows = blocks
      .map((b, i) => {
        const items = (b.text_items || [])
          .map((it) => `<li>${escapeHtml(it.content)}</li>`)
          .join('');
        return `
          <article class="block">
            <header class="block__head">
              <span class="block__index">${i + 1}.</span>
              <h3 class="block__title">${escapeHtml(b.title || '')}</h3>
              <span class="block__total">${formatCurrency(b.line_total)}</span>
            </header>
            <div class="block__meta">
              ${formatCurrency(b.unit_price)} × ${b.quantity}
            </div>
            ${items ? `<ul class="block__items">${items}</ul>` : ''}
          </article>`;
      })
      .join('');

    const termsBlock = p.terms_text
      ? `
        <section class="terms">
          <h2 class="section-title">תנאים כלליים</h2>
          <div class="terms__body">${escapeHtml(p.terms_text).replace(/\n/g, '<br/>')}</div>
        </section>`
      : '';

    const signatureBlock = sigData
      ? `
        <section class="signature">
          <h2 class="section-title signature__title">חתימת הלקוח</h2>
          <img class="signature__img" src="${sigData}" alt="חתימה"/>
          ${signedAt ? `<div class="signature__date">נחתם בתאריך: ${signedAt}</div>` : ''}
        </section>`
      : `
        <section class="signature signature--blank">
          <h2 class="section-title signature__title">חתימת הלקוח</h2>
          <div class="signature__line"></div>
          <div class="signature__hint">חתימה</div>
        </section>`;

    return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>הצעת מחיר ${p.order_number}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  /* @page margins apply on every printed page (incl. page 2+),
     so top/right padding is consistent across the whole document. */
  @page { size: A4; margin: 22mm 20mm 18mm 20mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Heebo', 'Arial Hebrew', 'Tahoma', sans-serif;
    color: #1f2937;
    background: #ffffff;
    direction: rtl;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-size: 11pt;
    line-height: 1.55;
  }
  .page { width: 100%; }

  /* ---------- Header (centered) ---------- */
  .header {
    text-align: center;
    margin-bottom: 14mm;
  }
  .header__logo {
    height: 54px;
    width: auto;
    margin: 0 auto 8mm;
    display: block;
  }
  .header__title {
    font-size: 30pt;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #111827;
    margin: 0 0 4mm 0;
  }
  .header__meta {
    display: flex;
    justify-content: center;
    gap: 18mm;
    color: #6b7280;
    font-size: 10.5pt;
    font-weight: 500;
  }
  .header__meta strong { color: #111827; font-weight: 600; }

  /* ---------- Section title (no harsh divider) ---------- */
  .section-title {
    font-size: 13pt;
    font-weight: 700;
    color: #111827;
    margin: 0 0 4mm 0;
    padding: 0;
    border: 0;
    position: relative;
  }
  .section-title::after {
    content: '';
    display: block;
    width: 28mm;
    height: 2px;
    background: #f59e0b;
    border-radius: 2px;
    margin-top: 2mm;
  }

  /* ---------- Customer card ---------- */
  .customer {
    background: #f9fafb;
    border-radius: 6px;
    padding: 6mm 7mm;
    margin-bottom: 9mm;
  }
  .customer__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 3mm;
    column-gap: 10mm;
  }
  .customer__row { font-size: 10.5pt; }
  .customer__label {
    color: #6b7280;
    font-weight: 500;
    margin-left: 6px;
  }
  .customer__value { color: #111827; font-weight: 500; }

  /* ---------- Items ---------- */
  .items { margin-bottom: 9mm; }
  .block {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 5mm 6mm;
    margin-bottom: 4mm;
    page-break-inside: avoid;
  }
  .block__head {
    display: flex;
    align-items: baseline;
    gap: 4mm;
    margin-bottom: 2mm;
  }
  .block__index {
    color: #9ca3af;
    font-weight: 600;
    font-size: 11pt;
    min-width: 8mm;
  }
  .block__title {
    flex: 1;
    margin: 0;
    font-size: 12pt;
    font-weight: 600;
    color: #111827;
  }
  .block__total {
    font-weight: 700;
    font-size: 12pt;
    color: #111827;
    white-space: nowrap;
  }
  .block__meta {
    color: #6b7280;
    font-size: 10pt;
    margin-bottom: 3mm;
    padding-right: 10mm;
  }
  .block__items {
    margin: 0;
    padding-right: 10mm;
    color: #374151;
    font-size: 10pt;
  }
  .block__items li {
    margin-bottom: 1.2mm;
    line-height: 1.5;
  }

  /* ---------- Totals ---------- */
  .totals {
    margin: 4mm 0 9mm 0;
    padding: 6mm 7mm;
    background: #111827;
    color: #ffffff;
    border-radius: 6px;
    page-break-inside: avoid;
  }
  .totals__row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 1.5mm 0;
    font-size: 11pt;
  }
  .totals__row + .totals__row { border-top: 1px solid rgba(255,255,255,0.08); }
  .totals__row--grand {
    margin-top: 2mm;
    padding-top: 4mm;
    border-top: 1px solid rgba(245, 158, 11, 0.6) !important;
    font-size: 14pt;
    font-weight: 700;
    color: #fbbf24;
  }
  .totals__label { font-weight: 500; color: #d1d5db; }
  .totals__row--grand .totals__label { color: #fbbf24; font-weight: 700; }
  .totals__value { font-variant-numeric: tabular-nums; }

  /* ---------- Terms ---------- */
  .terms {
    margin-bottom: 9mm;
    page-break-inside: avoid;
  }
  .terms__body {
    background: #f9fafb;
    border-radius: 6px;
    padding: 5mm 6mm;
    color: #374151;
    font-size: 9.5pt;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  /* ---------- Signature ---------- */
  .signature {
    margin-top: 4mm;
    padding: 6mm 6mm 5mm 6mm;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    text-align: center;
    page-break-inside: avoid;
  }
  .signature__title { text-align: center; }
  .signature__title::after { margin-left: auto; margin-right: auto; }
  .signature__img {
    max-width: 60mm;
    max-height: 24mm;
    margin: 4mm auto 3mm;
    display: block;
  }
  .signature__date { color: #6b7280; font-size: 9.5pt; }
  .signature--blank { padding-bottom: 8mm; }
  .signature__line {
    width: 70mm;
    height: 1px;
    background: #9ca3af;
    margin: 14mm auto 2mm;
  }
  .signature__hint { color: #9ca3af; font-size: 9.5pt; }
</style>
</head>
<body>
  <div class="page">
    <header class="header">
      ${logo ? `<img class="header__logo" src="${logo}" alt="logo"/>` : ''}
      <h1 class="header__title">הצעת מחיר</h1>
      <div class="header__meta">
        <span><strong>מספר הזמנה:</strong> ${escapeHtml(String(p.order_number ?? ''))}</span>
        <span><strong>תאריך:</strong> ${proposalDate}</span>
      </div>
    </header>

    <section class="customer-section">
      <h2 class="section-title">פרטי הלקוח</h2>
      <div class="customer">
        <div class="customer__grid">
          <div class="customer__row"><span class="customer__label">שם:</span><span class="customer__value">${escapeHtml(customer?.full_name || '-')}</span></div>
          <div class="customer__row"><span class="customer__label">ת.ז / ח.פ:</span><span class="customer__value">${escapeHtml(customer?.doc_number || '-')}</span></div>
          <div class="customer__row"><span class="customer__label">טלפון:</span><span class="customer__value">${escapeHtml(customer?.phone || '-')}</span></div>
          <div class="customer__row"><span class="customer__label">דוא״ל:</span><span class="customer__value">${escapeHtml(customer?.email || '-')}</span></div>
        </div>
      </div>
    </section>

    ${
      blocks.length > 0
        ? `<section class="items">
             <h2 class="section-title">פירוט השירותים</h2>
             ${blockRows}
           </section>`
        : ''
    }

    <section class="totals">
      <div class="totals__row">
        <span class="totals__label">סה״כ לפני מע״מ</span>
        <span class="totals__value">${formatCurrency(p.subtotal)}</span>
      </div>
      <div class="totals__row">
        <span class="totals__label">מע״מ (${vatPercent}%)</span>
        <span class="totals__value">${formatCurrency(p.vat_amount)}</span>
      </div>
      <div class="totals__row totals__row--grand">
        <span class="totals__label">סה״כ לתשלום</span>
        <span class="totals__value">${formatCurrency(p.total)}</span>
      </div>
    </section>

    ${termsBlock}
    ${signatureBlock}
  </div>
</body>
</html>`;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async uploadToStorage(
    pdfBuffer: Buffer,
    proposalId: string,
    kind: 'unsigned_pdf' | 'signed_pdf',
  ): Promise<string> {
    const filename = `${proposalId}/${kind}_${Date.now()}.pdf`;
    const bucket = 'proposal-pdfs';

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    await supabaseAdmin.from('documents').upsert(
      {
        proposal_id: proposalId,
        kind,
        storage_bucket: bucket,
        storage_path: filename,
      },
      { onConflict: 'proposal_id,kind' },
    );

    return filename;
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from('proposal-pdfs')
      .createSignedUrl(storagePath, 3600);

    if (error) {
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }
    return data.signedUrl;
  }
}

function formatCurrency(amount: number): string {
  const n = Number(amount || 0);
  return `₪${n.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const pdfService = new PDFService();
