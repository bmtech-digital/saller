/**
 * PDF visual-verification harness.
 *
 * Renders 3 sample PDFs to ./pdf-verify-output/ so a human can open them
 * in Preview and confirm the layout is professional:
 *   - real-empty.pdf       — a real proposal from the prod dump (no blocks)
 *   - real-priced.pdf      — a real proposal with a populated subtotal/total
 *   - synthetic-rich.pdf   — synthetic proposal with multiple blocks,
 *                            text items, terms, and a signature
 *
 * Run:  npx tsx src/scripts/verify-pdf.ts
 */

import fs from 'fs';
import path from 'path';
import { PDFService } from '../services/pdf.service.js';
import type { ProposalWithDetails } from '../types/index.js';

const DUMP_DIR = '/Users/roihala/projects/bemtech/saller-prod-dump/proposals_full';
const OUT_DIR = path.resolve(process.cwd(), 'pdf-verify-output');

type RawDumpProposal = ProposalWithDetails & {
  blocks?: ProposalWithDetails['blocks'];
};

function loadDump(filename: string): RawDumpProposal {
  const raw = fs.readFileSync(path.join(DUMP_DIR, filename), 'utf8');
  const obj = JSON.parse(raw);
  obj.blocks = obj.blocks || [];
  return obj as RawDumpProposal;
}

function syntheticProposal(): ProposalWithDetails {
  const subtotal = 18500;
  const vatRate = 0.17;
  const vat = +(subtotal * vatRate).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);


  return {
    id: 'synthetic-1',
    owner_id: 'synthetic-owner',
    customer_id: 'synthetic-customer',
    proposal_date: '2026-04-26',
    row_number: 999,
    order_number: 1099,
    currency: 'ILS',
    vat_rate: vatRate,
    subtotal,
    vat_amount: vat,
    total,
    terms_text: `תנאים כלליים

1. תוקף ההצעה
ההצעה תקפה ל-30 יום ממועד הנפקתה. לאחר מועד זה, החברה שומרת לעצמה את הזכות לעדכן את המחירים.

2. תנאי תשלום
התשלום יבוצע בהתאם לתנאים המפורטים בהצעה. איחור בתשלום יגרור ריבית פיגורים בהתאם לחוק.

3. ביטול עסקה
ביטול העסקה יתאפשר תוך 14 יום מיום אישור ההצעה, בכפוף לתנאי חוק הגנת הצרכן.`,
    status: 'sent',
    project_type: 'influencers',
    client_token: null,
    client_token_expires_at: null,
    created_at: '2026-04-26T08:00:00.000Z',
    updated_at: '2026-04-26T08:00:00.000Z',
    customer: {
      id: 'synthetic-customer',
      owner_id: 'synthetic-owner',
      full_name: 'ענבר - קורס איפור',
      doc_number: '514892731',
      phone: '052-1234567',
      email: 'inbar@example.co.il',
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    },
    blocks: [
      {
        id: 'b1',
        proposal_id: 'synthetic-1',
        sort_order: 1,
        title: 'קמפיין לידים בפייסבוק ובאינסטגרם',
        unit_price: 4500,
        quantity: 2,
        line_total: 9000,
        created_at: '',
        updated_at: '',
        text_items: [
          {
            id: 't1',
            block_id: 'b1',
            sort_order: 1,
            content: 'עיצוב 4 קריאייטיבים מותאמים לפלטפורמה (סטטי + וידאו קצר)',
            created_at: '',
            updated_at: '',
          },
          {
            id: 't2',
            block_id: 'b1',
            sort_order: 2,
            content: 'בניית קהלי יעד מותאמים, פיקסל ותתי-קמפיינים לבדיקות A/B',
            created_at: '',
            updated_at: '',
          },
          {
            id: 't3',
            block_id: 'b1',
            sort_order: 3,
            content: 'אופטימיזציה שבועית ודוח ביצועים חודשי בעברית',
            created_at: '',
            updated_at: '',
          },
        ],
      },
      {
        id: 'b2',
        proposal_id: 'synthetic-1',
        sort_order: 2,
        title: 'בניית דף נחיתה כולל אינטגרציה ל-CRM',
        unit_price: 3500,
        quantity: 1,
        line_total: 3500,
        created_at: '',
        updated_at: '',
        text_items: [
          {
            id: 't4',
            block_id: 'b2',
            sort_order: 1,
            content: 'דף נחיתה רספונסיבי בעברית RTL, עיצוב קסטומי',
            created_at: '',
            updated_at: '',
          },
          {
            id: 't5',
            block_id: 'b2',
            sort_order: 2,
            content: 'חיבור ל-Google Tag Manager, Meta Pixel ו-CRM',
            created_at: '',
            updated_at: '',
          },
        ],
      },
      {
        id: 'b3',
        proposal_id: 'synthetic-1',
        sort_order: 3,
        title: 'ניהול שוטף — חבילת חודש',
        unit_price: 6000,
        quantity: 1,
        line_total: 6000,
        created_at: '',
        updated_at: '',
        text_items: [
          {
            id: 't6',
            block_id: 'b3',
            sort_order: 1,
            content: 'ניהול קמפיינים יומי, שיחת זום שבועית, דוח ביצועים',
            created_at: '',
            updated_at: '',
          },
        ],
      },
    ],
    signature: undefined,
    documents: [],
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const svc = new PDFService();

  const realEmpty = loadDump('8f7119e7-bd19-4b0b-8a70-168a70cdba02.json'); // total 0
  const realPriced = loadDump('e3c2cf51-4548-4666-bcfd-f08a53a52bee.json'); // total 21000
  const synth = syntheticProposal();

  const cases: Array<{ name: string; data: ProposalWithDetails; signed: boolean }> = [
    { name: 'real-empty.pdf', data: realEmpty, signed: false },
    { name: 'real-priced.pdf', data: realPriced, signed: false },
    { name: 'synthetic-rich.pdf', data: synth, signed: false },
  ];

  for (const c of cases) {
    const t0 = Date.now();
    const buf = await svc.generateProposalPDF(c.data, c.signed);
    const out = path.join(OUT_DIR, c.name);
    fs.writeFileSync(out, buf);
    console.log(
      `✓ ${c.name.padEnd(22)} ${(buf.length / 1024).toFixed(1)} KB  (${Date.now() - t0}ms)  ->  ${out}`,
    );
  }

  await svc.closeBrowser();
  console.log(`\nDone. Open the PDFs in:\n  ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
