# מערכת הצעות מחיר וחתימה דיגיטלית

מערכת מלאה ליצירת הצעות מחיר ואיסוף חתימות דיגיטליות מלקוחות.

## תכונות עיקריות

- ✅ **התחברות מאובטחת** - Supabase Auth עם משתמש וסיסמה
- ✅ **דשבורד טבלאי** - צפייה וניהול כל ההצעות
- ✅ **יצירת הצעות** - טופס פרטי לקוח ובניית בלוקים דינמיים
- ✅ **חישוב אוטומטי** - סכומים, מע"מ וסה"כ בזמן אמת
- ✅ **יצירת PDF** - הפקת מסמך PDF מעוצב
- ✅ **חתימה דיגיטלית** - לקוח חותם באמצעות קישור ייחודי
- ✅ **שליחה רב-ערוצית** - WhatsApp, SMS, Email
- ✅ **רספונסיבי** - עיצוב מותאם למובייל
- ✅ **RTL מלא** - תמיכה מלאה בעברית

## דרישות מקדימות

- Node.js 20+
- Docker & Docker Compose
- חשבון Supabase (חינמי)

## התקנה מהירה

### 1. הקמת Supabase

1. צור פרויקט חדש ב-[Supabase](https://supabase.com)
2. העתק את ה-URL וה-Keys מ-Settings > API
3. הרץ את סקריפט ה-SQL מ-`database/schema.sql` ב-SQL Editor
4. צור Storage Bucket בשם `proposal-pdfs`

### 2. הגדרת משתני סביבה

```bash
cp .env.example .env
```

ערוך את `.env` עם הפרטים של Supabase:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
FRONTEND_URL=http://localhost
```

### 3. הרצה עם Docker

**Production:**
```bash
docker-compose up -d --build
```

**Development (עם Hot Reload):**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### 4. הרצה ללא Docker (פיתוח מקומי)

**Backend:**
```bash
cd backend
cp .env.example .env
# ערוך את .env עם פרטי Supabase
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## גישה למערכת

- **Frontend:** http://localhost (או http://localhost:5173 בפיתוח)
- **Backend API:** http://localhost:3001/api
- **Health Check:** http://localhost:3001/api/health

### יצירת משתמש ראשון

הרץ בקונסול של Supabase או דרך ה-API:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}'
```

## מבנה הפרויקט

```
proposal-system/
├── backend/                 # שרת Node.js + Express
│   ├── src/
│   │   ├── controllers/    # בקרים
│   │   ├── routes/         # נתיבי API
│   │   ├── middleware/     # Middleware (אימות)
│   │   ├── services/       # שירותים (PDF, Email)
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # כלי עזר
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/    # קומפוננטות
│   │   ├── pages/         # עמודים
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # שירותי API
│   │   ├── store/         # Zustand state
│   │   ├── types/         # TypeScript types
│   │   └── styles/        # CSS/Tailwind
│   ├── Dockerfile
│   └── package.json
├── database/
│   └── schema.sql         # SQL Migration
├── docker-compose.yml     # Production
├── docker-compose.dev.yml # Development
└── README.md
```

## API Routes

### Authentication
| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/auth/login` | התחברות |
| POST | `/api/auth/register` | רישום (Admin) |
| POST | `/api/auth/refresh` | רענון טוקן |
| GET | `/api/auth/me` | מידע משתמש נוכחי |

### Customers
| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/customers` | כל הלקוחות |
| GET | `/api/customers/:id` | לקוח בודד |
| GET | `/api/customers/search?q=` | חיפוש |
| POST | `/api/customers` | יצירת לקוח |
| PUT | `/api/customers/:id` | עדכון |
| DELETE | `/api/customers/:id` | מחיקה |

### Proposals
| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/proposals` | כל ההצעות |
| GET | `/api/proposals/:id` | הצעה בודדת |
| POST | `/api/proposals` | יצירת הצעה |
| PUT | `/api/proposals/:id` | עדכון |
| DELETE | `/api/proposals/:id` | מחיקה |
| POST | `/api/proposals/:id/blocks` | הוספת בלוק |
| PUT | `/api/proposals/:id/blocks/:blockId` | עדכון בלוק |
| DELETE | `/api/proposals/:id/blocks/:blockId` | מחיקת בלוק |
| POST | `/api/proposals/:id/generate-pdf` | יצירת PDF |
| POST | `/api/proposals/:id/send` | שליחה ללקוח |

### Client (Public)
| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/client/:token` | צפייה בהצעה |
| GET | `/api/client/:token/pdf` | הורדת PDF |
| POST | `/api/client/:token/sign` | שליחת חתימה |

## מסכי המערכת

1. **Login** - התחברות למערכת
2. **Dashboard** - טבלת הצעות ראשית
3. **New Proposal** - אשף יצירת הצעה חדשה
4. **Proposal Editor** - עריכת בלוקים ומחירים
5. **Customers** - ניהול לקוחות
6. **Client Sign Page** - עמוד חתימת לקוח (ציבורי)

## אבטחה

- **RLS (Row Level Security)** - כל משתמש רואה רק את הנתונים שלו
- **Tokenized Links** - קישורי לקוח עם תוקף (72 שעות)
- **Helmet.js** - הגנות HTTP headers
- **CORS** - הגבלת מקורות מורשים

## הגדרות אופציונליות

### שליחת Email
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### WhatsApp Business API
```env
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/YOUR_PHONE_ID/messages
WHATSAPP_API_TOKEN=your-token
```

## תמיכה טכנית

לשאלות ותמיכה, פנה למפתח.

## רישיון

MIT License
