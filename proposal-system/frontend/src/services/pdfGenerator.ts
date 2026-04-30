import jsPDF from 'jspdf';
import {
  PDF_COORDINATES,
  VIDEOS_COORDINATES,
  AGENTS_COORDINATES,
  PDF_FONT,
  PLATFORM_OPTIONS,
  BRAND_ORANGE
} from '../config/pdfCoordinates';
import type { ContractData, AgentPackageId, ProjectType } from '../types';

interface ClientSignData {
  date: string;
  phoneContact: string;
  accountingContact: string;
  companyNumber: string;
  invoiceEmail: string;
  signature: string; // base64 image
}

// Ensure font is loaded before rendering
const ensureFontLoaded = async (): Promise<void> => {
  if (document.fonts) {
    await document.fonts.ready;
    await document.fonts.load(`400 16px ${PDF_FONT.family}`);
    await document.fonts.load(`700 16px ${PDF_FONT.family}`);
  }
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('data:') || src.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error(`Image loaded but has invalid dimensions: ${src}`));
        return;
      }
      resolve(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load image:', src, e);
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
};

const formatHebrewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL');
};

const getPlatformLabels = (platformIds: string[]): string => {
  return platformIds
    .map(id => PLATFORM_OPTIONS.find(p => p.id === id)?.label || id)
    .join(', ');
};

const fixHebrewText = (text: string): string => '‏' + text;

// Format a number with locale separators ("3,800")
const formatNumber = (n: number): string => n.toLocaleString('he-IL');

// Cover an existing region of the template with white before drawing new text.
// Used when the rasterized template still has the example values baked in.
function drawWhiteMask(ctx: CanvasRenderingContext2D, mask: { x: number; y: number; w: number; h: number }) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mask.x, mask.y, mask.w, mask.h);
  ctx.restore();
}

// Reset to the default RTL/right-aligned text settings used across pages.
function resetTextDefaults(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillStyle = PDF_FONT.color;
}

// ==========================================================================
// Influencers (existing template)
// ==========================================================================
async function renderInfluencersPDF(
  contractData: ContractData,
  clientSignData: ClientSignData | undefined
): Promise<Blob> {
  const [page1Img, page2Img] = await Promise.all([
    loadImage('/contr/page-00001.jpg'),
    loadImage('/contr/page-0002.jpg')
  ]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const templateWidth = page1Img.naturalWidth;
  const templateHeight = page1Img.naturalHeight;
  canvas.width = templateWidth;
  canvas.height = templateHeight;

  const pdf = new jsPDF({
    orientation: templateWidth > templateHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [templateWidth, templateHeight]
  });

  // ===== PAGE 1 =====
  ctx.drawImage(page1Img, 0, 0);
  resetTextDefaults(ctx);

  const lekavod = PDF_COORDINATES.page1.לכבוד;
  ctx.font = `${lekavod.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(fixHebrewText(contractData.customerName), lekavod.x, lekavod.y);

  const dateCoords = PDF_COORDINATES.page1.תאריך;
  ctx.font = `${dateCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(formatHebrewDate(contractData.date), dateCoords.x, dateCoords.y);

  // עבור (centered)
  const forCoords = PDF_COORDINATES.page1.עבור;
  ctx.font = `${forCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.textAlign = 'center';
  ctx.fillText(`קמפיין עבור "${contractData.forText ?? ''}"`, canvas.width / 2, forCoords.y);
  ctx.textAlign = 'right';

  const platformsCoords = PDF_COORDINATES.page1.פלטפורמות;
  ctx.font = `${platformsCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(getPlatformLabels(contractData.platforms ?? []), platformsCoords.x, platformsCoords.y);

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, templateWidth, templateHeight);

  // ===== PAGE 2 =====
  pdf.addPage([templateWidth, templateHeight]);
  canvas.width = page2Img.naturalWidth;
  canvas.height = page2Img.naturalHeight;
  ctx.drawImage(page2Img, 0, 0);
  resetTextDefaults(ctx);

  const wyg = PDF_COORDINATES.page2.מה_מקבלים;
  ctx.font = `${wyg.fontSize}px ${PDF_FONT.family}`;
  const lines = (contractData.whatYouGet ?? '').split('\n');
  const lineHeight = wyg.fontSize * 1.5;
  lines.forEach((line, i) => ctx.fillText(line, wyg.x, wyg.y + i * lineHeight));

  const cost = PDF_COORDINATES.page2.עלות;
  ctx.font = `bold ${cost.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(formatNumber(contractData.cost ?? 0) + ' + מע״מ', cost.x, cost.y);

  await drawClientSignature(ctx, PDF_COORDINATES.page2.clientSign, clientSignData);

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

// ==========================================================================
// Videos
// ==========================================================================
async function renderVideosPDF(
  contractData: ContractData,
  clientSignData: ClientSignData | undefined
): Promise<Blob> {
  const [page1Img, page2Img] = await Promise.all([
    loadImage('/contr/videos/page-1.jpg'),
    loadImage('/contr/videos/page-2.jpg')
  ]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const templateWidth = page1Img.naturalWidth;
  const templateHeight = page1Img.naturalHeight;
  canvas.width = templateWidth;
  canvas.height = templateHeight;

  const pdf = new jsPDF({
    orientation: templateWidth > templateHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [templateWidth, templateHeight]
  });

  // ===== PAGE 1 =====
  ctx.drawImage(page1Img, 0, 0);
  resetTextDefaults(ctx);

  const c = VIDEOS_COORDINATES.page1;

  // Date (top-left)
  drawWhiteMask(ctx, c.תאריך.mask);
  ctx.textAlign = c.תאריך.align;
  ctx.font = `bold ${c.תאריך.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(formatHebrewDate(contractData.date), c.תאריך.x, c.תאריך.y);

  // לכבוד (right-aligned customer name; "לכבוד," label is in the template)
  drawWhiteMask(ctx, c.לכבוד.mask);
  ctx.textAlign = c.לכבוד.align;
  ctx.font = `${c.לכבוד.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(fixHebrewText(contractData.customerName), c.לכבוד.x, c.לכבוד.y);

  // Title: הפקת סרטוני Ai - עבור <subject>  (centered, bold)
  drawWhiteMask(ctx, c.title.mask);
  ctx.textAlign = c.title.align;
  ctx.font = `bold ${c.title.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(`${c.title.prefix}${contractData.subject ?? ''}`, c.title.x, c.title.y);

  // Package price line: "עלות החבילה {value} ₪"
  drawWhiteMask(ctx, c.packagePrice.mask);
  ctx.textAlign = c.packagePrice.align;
  ctx.font = `bold ${c.packagePrice.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(
    c.packagePrice.template.replace('{value}', formatNumber(contractData.packagePrice ?? 0)),
    c.packagePrice.x,
    c.packagePrice.y
  );

  // Final price line: "מחיר לאחר הנחה: {value} ₪ + מע״מ"
  drawWhiteMask(ctx, c.finalPrice.mask);
  ctx.textAlign = c.finalPrice.align;
  ctx.font = `bold ${c.finalPrice.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(
    c.finalPrice.template.replace('{value}', formatNumber(contractData.finalPrice ?? 0)),
    c.finalPrice.x,
    c.finalPrice.y
  );

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, templateWidth, templateHeight);

  // ===== PAGE 2 =====
  pdf.addPage([templateWidth, templateHeight]);
  canvas.width = page2Img.naturalWidth;
  canvas.height = page2Img.naturalHeight;
  ctx.drawImage(page2Img, 0, 0);
  resetTextDefaults(ctx);

  await drawClientSignature(ctx, VIDEOS_COORDINATES.page2.clientSign, clientSignData);

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

// ==========================================================================
// Agents
// ==========================================================================
async function renderAgentsPDF(
  contractData: ContractData,
  clientSignData: ClientSignData | undefined
): Promise<Blob> {
  const [page1Img, page2Img] = await Promise.all([
    loadImage('/contr/agents/page-1.jpg'),
    loadImage('/contr/agents/page-2.jpg')
  ]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const templateWidth = page1Img.naturalWidth;
  const templateHeight = page1Img.naturalHeight;
  canvas.width = templateWidth;
  canvas.height = templateHeight;

  const pdf = new jsPDF({
    orientation: templateWidth > templateHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [templateWidth, templateHeight]
  });

  // ===== PAGE 1 =====
  ctx.drawImage(page1Img, 0, 0);
  resetTextDefaults(ctx);

  const c = AGENTS_COORDINATES.page1;

  // Date
  drawWhiteMask(ctx, c.תאריך.mask);
  ctx.textAlign = c.תאריך.align;
  ctx.font = `bold ${c.תאריך.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(formatHebrewDate(contractData.date), c.תאריך.x, c.תאריך.y);

  // Customer
  drawWhiteMask(ctx, c.לכבוד.mask);
  ctx.textAlign = c.לכבוד.align;
  ctx.font = `${c.לכבוד.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(fixHebrewText(contractData.customerName), c.לכבוד.x, c.לכבוד.y);

  // Title: הטמעת אייגנט באתר - <websiteName>
  drawWhiteMask(ctx, c.title.mask);
  ctx.textAlign = c.title.align;
  ctx.font = `bold ${c.title.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(`${c.title.prefix}${contractData.websiteName ?? ''}`, c.title.x, c.title.y);

  // Package recommendation: white-out all four boxes, then fill the chosen one.
  const recommended: AgentPackageId | undefined = contractData.recommendedPackage;
  (Object.keys(c.packages) as AgentPackageId[]).forEach((id) => {
    const box = c.packages[id];
    drawWhiteMask(ctx, { x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 });
    // Re-draw the empty box outline (same as template)
    ctx.save();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();
  });

  if (recommended && c.packages[recommended]) {
    const box = c.packages[recommended];
    ctx.save();
    ctx.fillStyle = BRAND_ORANGE;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
  }

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, templateWidth, templateHeight);

  // ===== PAGE 2 =====
  pdf.addPage([templateWidth, templateHeight]);
  canvas.width = page2Img.naturalWidth;
  canvas.height = page2Img.naturalHeight;
  ctx.drawImage(page2Img, 0, 0);
  resetTextDefaults(ctx);

  await drawClientSignature(ctx, AGENTS_COORDINATES.page2.clientSign, clientSignData);

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

// ==========================================================================
// Shared helper: client signature block on page 2
// ==========================================================================
type ClientSignCoords = {
  תאריך: { x: number; y: number; fontSize: number };
  טלפון_איש_קשר: { x: number; y: number; fontSize: number };
  איש_קשר_הנהלת_חשבונות: { x: number; y: number; fontSize: number };
  מספר_חפ: { x: number; y: number; fontSize: number };
  מייל_חשבוניות: { x: number; y: number; fontSize: number };
  חתימה: { x: number; y: number; width: number; height: number };
};

async function drawClientSignature(
  ctx: CanvasRenderingContext2D,
  coords: ClientSignCoords,
  data: ClientSignData | undefined
): Promise<void> {
  if (!data) return;

  ctx.font = `${coords.תאריך.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(formatHebrewDate(data.date), coords.תאריך.x, coords.תאריך.y);

  ctx.font = `${coords.טלפון_איש_קשר.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(data.phoneContact, coords.טלפון_איש_קשר.x, coords.טלפון_איש_קשר.y);

  ctx.font = `${coords.איש_קשר_הנהלת_חשבונות.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(data.accountingContact, coords.איש_קשר_הנהלת_חשבונות.x, coords.איש_קשר_הנהלת_חשבונות.y);

  ctx.font = `${coords.מספר_חפ.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(data.companyNumber, coords.מספר_חפ.x, coords.מספר_חפ.y);

  ctx.font = `${coords.מייל_חשבוניות.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(data.invoiceEmail, coords.מייל_חשבוניות.x, coords.מייל_חשבוניות.y);

  if (data.signature) {
    const signatureImg = await loadImage(data.signature);
    const sig = coords.חתימה;
    ctx.drawImage(signatureImg, sig.x - sig.width, sig.y - sig.height / 2, sig.width, sig.height);
  }
}

// ==========================================================================
// Public API — dispatches on project type
// ==========================================================================
export async function generateContractPDF(
  contractData: ContractData,
  clientSignData?: ClientSignData,
  projectType: ProjectType = 'influencers'
): Promise<Blob> {
  await ensureFontLoaded();

  switch (projectType) {
    case 'videos':
      return renderVideosPDF(contractData, clientSignData);
    case 'agents':
      return renderAgentsPDF(contractData, clientSignData);
    case 'influencers':
    default:
      return renderInfluencersPDF(contractData, clientSignData);
  }
}

export async function downloadContractPDF(
  contractData: ContractData,
  clientSignData?: ClientSignData,
  filename: string = 'contract.pdf',
  projectType: ProjectType = 'influencers'
): Promise<void> {
  const blob = await generateContractPDF(contractData, clientSignData, projectType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function openContractPDF(
  contractData: ContractData,
  clientSignData?: ClientSignData,
  projectType: ProjectType = 'influencers'
): Promise<void> {
  const blob = await generateContractPDF(contractData, clientSignData, projectType);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export async function getContractPDFBase64(
  contractData: ContractData,
  clientSignData?: ClientSignData,
  projectType: ProjectType = 'influencers'
): Promise<string> {
  const blob = await generateContractPDF(contractData, clientSignData, projectType);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
