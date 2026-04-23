// PDF Template Coordinates
// These coordinates map to the template images in /public/contr/

// Font configuration
export const PDF_FONT = {
  family: 'Heebo', // שנה לפי הפונט בתבנית
  color: '#333333'
} as const;

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

// Platform options for checkboxes
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
