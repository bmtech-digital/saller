// PDF Template Coordinates
// These coordinates map to the template images in /public/contr/
//
// Templates are rasterized PDFs (1241×1754). Per project type:
//   /contr/page-00001.jpg + /contr/page-0002.jpg            — influencers
//   /contr/videos/page-1.jpg + /contr/videos/page-2.jpg     — videos
//   /contr/agents/page-1.jpg + /contr/agents/page-2.jpg     — agents
//
// Variable text overlays draw on top of the template image. For positions
// where the rasterized template already shows example data, a white-rectangle
// "mask" is drawn first (see `mask` keys) so the overlay covers it cleanly.

// Font configuration
export const PDF_FONT = {
  family: 'Heebo', // שנה לפי הפונט בתבנית
  color: '#333333'
} as const;

// ============================================================
// Influencers (existing template — unchanged)
// ============================================================
export const PDF_COORDINATES = {
  page1: {
    לכבוד: { x: 1150, y: 256, fontSize: 32 },
    תאריך: { x: 196, y: 226, fontSize: 27 },
    עבור: { x: 1118, y: 310, fontSize: 27 },
    פלטפורמות: { x: 1186, y: 960, fontSize: 26 }
  },
  page2: {
    מה_מקבלים: { x: 1196, y: 339, fontSize: 27 },
    עלות: { x: 1175, y: 487, fontSize: 32 },
    // Client sign fields
    clientSign: {
      תאריך: { x: 1059, y: 1334, fontSize: 18 },
      טלפון_איש_קשר: { x: 747, y: 1340, fontSize: 18 },
      איש_קשר_הנהלת_חשבונות: { x: 451, y: 1337, fontSize: 18 },
      מספר_חפ: { x: 1117, y: 1445, fontSize: 18 },
      מייל_חשבוניות: { x: 831, y: 1450, fontSize: 18 },
      חתימה: { x: 520, y: 1440, width: 200, height: 80 }
    }
  }
} as const;

// ============================================================
// Videos
// ============================================================
// Template: /contr/videos/page-{1,2}.jpg
// Variables on page 1: date, customerName, subject, packagePrice, finalPrice
// Page 2 has the same boxed sign-fields layout as influencers.
export const VIDEOS_COORDINATES = {
  page1: {
    תאריך: { x: 60, y: 215, fontSize: 22, align: 'left' as const, mask: { x: 30, y: 195, w: 220, h: 30 } },
    לכבוד: { x: 1180, y: 320, fontSize: 28, align: 'right' as const, mask: { x: 700, y: 295, w: 490, h: 38 } },
    title: {
      // "הפקת סרטוני Ai - עבור <subject>" — rendered as one centered string
      x: 620, y: 425, fontSize: 28, align: 'center' as const,
      mask: { x: 280, y: 395, w: 680, h: 45 },
      prefix: 'הפקת סרטוני Ai - עבור '
    },
    packagePrice: {
      // "עלות החבילה <packagePrice> ₪" right-aligned inside the cost box
      x: 1180, y: 985, fontSize: 22, align: 'right' as const,
      mask: { x: 850, y: 962, w: 340, h: 30 },
      template: 'עלות החבילה {value} ₪'
    },
    finalPrice: {
      // "מחיר לאחר הנחה: <finalPrice> ₪ + מע"מ" right-aligned in cost box
      x: 1180, y: 1020, fontSize: 22, align: 'right' as const,
      mask: { x: 770, y: 997, w: 420, h: 32 },
      template: 'מחיר לאחר הנחה: {value} ₪ + מע״מ'
    }
  },
  page2: {
    // Page 2 is the same sign-fields layout. Coordinates calibrated for the
    // videos page-2.jpg specifically (slight offset from influencers page 2).
    clientSign: {
      תאריך: { x: 1059, y: 460, fontSize: 18 },
      טלפון_איש_קשר: { x: 747, y: 466, fontSize: 18 },
      איש_קשר_הנהלת_חשבונות: { x: 451, y: 463, fontSize: 18 },
      מספר_חפ: { x: 1117, y: 575, fontSize: 18 },
      מייל_חשבוניות: { x: 831, y: 580, fontSize: 18 },
      חתימה: { x: 520, y: 570, width: 200, height: 80 }
    }
  }
} as const;

// ============================================================
// Agents
// ============================================================
// Template: /contr/agents/page-{1,2}.jpg
// Variables on page 1: date, customerName, websiteName (in title),
//   recommendedPackage (which checkbox to fill).
// All four package boxes are baked into the template image with their
// fixed prices. We only draw a filled square on the recommended one.
export const AGENT_PACKAGES = {
  basic:    { id: 'basic',    label: 'Basic'    },
  advanced: { id: 'advanced', label: 'Advanced' },
  pro:      { id: 'pro',      label: 'Pro'      },
  pro_max:  { id: 'pro_max',  label: 'Pro Max'  }
} as const;

export const AGENTS_COORDINATES = {
  page1: {
    תאריך: { x: 60, y: 215, fontSize: 22, align: 'left' as const, mask: { x: 30, y: 195, w: 220, h: 30 } },
    לכבוד: { x: 1180, y: 320, fontSize: 28, align: 'right' as const, mask: { x: 700, y: 295, w: 490, h: 38 } },
    title: {
      // "הטמעת אייגנט באתר - <websiteName>"
      x: 620, y: 415, fontSize: 28, align: 'center' as const,
      mask: { x: 280, y: 385, w: 680, h: 45 },
      prefix: 'הטמעת אייגנט באתר - '
    },
    // Package recommendation checkboxes. Coordinates point to the small
    // square next to each package title. We white-out all four first,
    // then fill only the recommended one with the brand orange.
    packages: {
      basic:    { x: 1130, y: 1090, w: 22, h: 22 },
      pro:      { x: 705,  y: 1090, w: 22, h: 22 },
      advanced: { x: 1130, y: 1295, w: 22, h: 22 },
      pro_max:  { x: 705,  y: 1295, w: 22, h: 22 }
    }
  },
  page2: {
    // Sign field layout on agents page 2 is at the upper-mid section.
    clientSign: {
      תאריך: { x: 1059, y: 700, fontSize: 18 },
      טלפון_איש_קשר: { x: 747, y: 706, fontSize: 18 },
      איש_קשר_הנהלת_חשבונות: { x: 451, y: 703, fontSize: 18 },
      מספר_חפ: { x: 1117, y: 815, fontSize: 18 },
      מייל_חשבוניות: { x: 831, y: 820, fontSize: 18 },
      חתימה: { x: 520, y: 810, width: 200, height: 80 }
    }
  }
} as const;

// Brand orange used for the package selection indicator on the agents template.
export const BRAND_ORANGE = '#F39200';

// Platform options for checkboxes (influencers only)
export const PLATFORM_OPTIONS = [
  { id: 'instagram', label: 'אינסטגרם' },
  { id: 'reels', label: 'רילס' },
  { id: 'story', label: 'סטורי' },
  { id: 'tiktok', label: 'טיקטוק' }
] as const;

// Client signing fields
export const CLIENT_SIGN_FIELDS = {
  תאריך: { type: 'date', label: 'תאריך', required: true },
  טלפון_איש_קשר: { type: 'tel', label: 'טלפון איש קשר', required: true },
  איש_קשר_הנהלת_חשבונות: { type: 'text', label: 'איש קשר להנהלת חשבונות', required: true },
  מספר_חפ: { type: 'text', label: 'מספר ח.פ', required: true },
  מייל_חשבוניות: { type: 'email', label: 'מייל לשליחת חשבוניות', required: true }
} as const;

export type PlatformId = typeof PLATFORM_OPTIONS[number]['id'];
