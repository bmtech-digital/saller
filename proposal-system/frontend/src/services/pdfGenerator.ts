import jsPDF from 'jspdf';
import { PDF_COORDINATES, PDF_FONT, PLATFORM_OPTIONS } from '../config/pdfCoordinates';

interface ContractData {
  customerName: string;
  date: string;
  forText: string;
  platforms: string[];
  whatYouGet: string;
  cost: number;
}

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
    // Load specific font weights we need
    await document.fonts.load(`400 16px ${PDF_FONT.family}`);
    await document.fonts.load(`700 16px ${PDF_FONT.family}`);
  }
};

// Load image and return as HTMLImageElement
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set crossOrigin for external URLs or data URLs
    // For same-origin resources, don't set crossOrigin to avoid CORS issues
    if (src.startsWith('data:') || src.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      // Verify the image loaded with valid dimensions
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

// Format date to Hebrew format
const formatHebrewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL');
};

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
  }).format(amount);
};

// Get platform labels from IDs
const getPlatformLabels = (platformIds: string[]): string => {
  return platformIds
    .map(id => PLATFORM_OPTIONS.find(p => p.id === id)?.label || id)
    .join(', ');
};

// Fix Hebrew text for canvas rendering (add RTL mark)
const fixHebrewText = (text: string): string => {
  return '\u200F' + text;
};

export async function generateContractPDF(
  contractData: ContractData,
  clientSignData?: ClientSignData
): Promise<Blob> {
  // Ensure font is loaded
  await ensureFontLoaded();

  // Load template images
  console.log('Loading PDF template images...');
  const [page1Img, page2Img] = await Promise.all([
    loadImage('/contr/page-00001.jpg'),
    loadImage('/contr/page-0002.jpg')
  ]);
  console.log('Template images loaded:', {
    page1: { width: page1Img.naturalWidth, height: page1Img.naturalHeight },
    page2: { width: page2Img.naturalWidth, height: page2Img.naturalHeight }
  });

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Set canvas size to match template
  const templateWidth = page1Img.naturalWidth;
  const templateHeight = page1Img.naturalHeight;
  canvas.width = templateWidth;
  canvas.height = templateHeight;

  // Create PDF with template dimensions
  const pdf = new jsPDF({
    orientation: templateWidth > templateHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [templateWidth, templateHeight]
  });

  // ===== PAGE 1 =====
  ctx.drawImage(page1Img, 0, 0);

  // Set font for Hebrew text
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillStyle = PDF_FONT.color;

  // לכבוד - Customer Name
  const lekavodCoords = PDF_COORDINATES.page1.לכבוד;
  ctx.font = `${lekavodCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(fixHebrewText(contractData.customerName), lekavodCoords.x, lekavodCoords.y);

  // תאריך - Date
  const dateCoords = PDF_COORDINATES.page1.תאריך;
  ctx.font = `${dateCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(formatHebrewDate(contractData.date), dateCoords.x, dateCoords.y);

  // עבור - For (centered)
  const forCoords = PDF_COORDINATES.page1.עבור;
  ctx.font = `${forCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.textAlign = 'center';
  ctx.fillText(`קמפיין עבור "${contractData.forText}"`, canvas.width / 2, forCoords.y);
  ctx.textAlign = 'right';

  // פלטפורמות - Platforms
  const platformsCoords = PDF_COORDINATES.page1.פלטפורמות;
  ctx.font = `${platformsCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(getPlatformLabels(contractData.platforms), platformsCoords.x, platformsCoords.y);

  // Add page 1 to PDF
  const page1DataUrl = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(page1DataUrl, 'JPEG', 0, 0, templateWidth, templateHeight);

  // ===== PAGE 2 =====
  pdf.addPage([templateWidth, templateHeight]);

  // Resize canvas if page 2 has different dimensions
  canvas.width = page2Img.naturalWidth;
  canvas.height = page2Img.naturalHeight;
  ctx.drawImage(page2Img, 0, 0);

  // Reset text settings
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillStyle = PDF_FONT.color;

  // מה מקבלים - What You Get (multiline)
  const whatYouGetCoords = PDF_COORDINATES.page2.מה_מקבלים;
  ctx.font = `${whatYouGetCoords.fontSize}px ${PDF_FONT.family}`;

  // Handle multiline text
  const lines = contractData.whatYouGet.split('\n');
  const lineHeight = whatYouGetCoords.fontSize * 1.5;
  lines.forEach((line, index) => {
    ctx.fillText(line, whatYouGetCoords.x, whatYouGetCoords.y + (index * lineHeight));
  });

  // עלות - Cost (+ VAT)
  const costCoords = PDF_COORDINATES.page2.עלות;
  ctx.font = `bold ${costCoords.fontSize}px ${PDF_FONT.family}`;
  ctx.fillText(contractData.cost.toLocaleString('he-IL') + ' + מע״מ', costCoords.x, costCoords.y);

  // ===== Client Signature Data on Page 2 (if provided) =====
  if (clientSignData) {
    const clientCoords = PDF_COORDINATES.page2.clientSign;

    // תאריך
    ctx.font = `${clientCoords.תאריך.fontSize}px ${PDF_FONT.family}`;
    ctx.fillText(formatHebrewDate(clientSignData.date), clientCoords.תאריך.x, clientCoords.תאריך.y);

    // טלפון איש קשר
    ctx.font = `${clientCoords.טלפון_איש_קשר.fontSize}px ${PDF_FONT.family}`;
    ctx.fillText(clientSignData.phoneContact, clientCoords.טלפון_איש_קשר.x, clientCoords.טלפון_איש_קשר.y);

    // איש קשר הנהלת חשבונות
    ctx.font = `${clientCoords.איש_קשר_הנהלת_חשבונות.fontSize}px ${PDF_FONT.family}`;
    ctx.fillText(clientSignData.accountingContact, clientCoords.איש_קשר_הנהלת_חשבונות.x, clientCoords.איש_קשר_הנהלת_חשבונות.y);

    // מספר ח.פ
    ctx.font = `${clientCoords.מספר_חפ.fontSize}px ${PDF_FONT.family}`;
    ctx.fillText(clientSignData.companyNumber, clientCoords.מספר_חפ.x, clientCoords.מספר_חפ.y);

    // מייל לשליחת חשבוניות
    ctx.font = `${clientCoords.מייל_חשבוניות.fontSize}px ${PDF_FONT.family}`;
    ctx.fillText(clientSignData.invoiceEmail, clientCoords.מייל_חשבוניות.x, clientCoords.מייל_חשבוניות.y);

    // חתימה
    if (clientSignData.signature) {
      const signatureImg = await loadImage(clientSignData.signature);
      const sigCoords = clientCoords.חתימה;
      const sigWidth = sigCoords.width;
      const sigHeight = sigCoords.height;
      // Draw signature centered in the box
      ctx.drawImage(signatureImg, sigCoords.x - sigWidth, sigCoords.y - sigHeight/2, sigWidth, sigHeight);
    }
  }

  // Add page 2 to PDF
  const page2DataUrl = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(page2DataUrl, 'JPEG', 0, 0, canvas.width, canvas.height);

  // Return as blob
  return pdf.output('blob');
}

// Download PDF
export async function downloadContractPDF(
  contractData: ContractData,
  clientSignData?: ClientSignData,
  filename: string = 'contract.pdf'
): Promise<void> {
  const blob = await generateContractPDF(contractData, clientSignData);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Open PDF in new tab
export async function openContractPDF(
  contractData: ContractData,
  clientSignData?: ClientSignData
): Promise<void> {
  const blob = await generateContractPDF(contractData, clientSignData);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// Get PDF as base64 for sharing
export async function getContractPDFBase64(
  contractData: ContractData,
  clientSignData?: ClientSignData
): Promise<string> {
  const blob = await generateContractPDF(contractData, clientSignData);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
