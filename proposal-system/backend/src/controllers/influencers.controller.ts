import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import path from 'path';
import type {
  Influencer,
  CreateInfluencerRequest,
  UpdateInfluencerRequest,
} from '../types/index.js';

const isDevMode = process.env.DEV_MODE === 'true';
const RECEIPT_BUCKET = 'influencer-receipts';
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['application/pdf', 'image/'];

// In-memory dev store
export const devInfluencers: Influencer[] = [];

/* ---------- helpers ---------- */

function sanitizeFilenameSegment(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'influencer';
}

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? mime.startsWith(prefix) : mime === prefix,
  );
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- controller ---------- */

export class InfluencersController {
  // GET /api/customers/:customerId/influencers
  async listForCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;

      if (isDevMode) {
        const rows = devInfluencers
          .filter((i) => i.customer_id === customerId)
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'));
        res.json(rows);
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('influencers')
        .select('*')
        .eq('customer_id', customerId)
        .order('full_name', { ascending: true });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('List influencers error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // POST /api/customers/:customerId/influencers
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const body = req.body as CreateInfluencerRequest;

      if (!body.full_name?.trim()) {
        res.status(400).json({ error: 'שם המשפיענ/ית הוא שדה חובה' });
        return;
      }

      const row = {
        owner_id: req.user!.id,
        customer_id: customerId,
        full_name: body.full_name.trim(),
        phone: body.phone?.trim() || null,
        instagram_handle: body.instagram_handle?.trim() || null,
        payment_amount: typeof body.payment_amount === 'number' ? body.payment_amount : 0,
        notes: body.notes?.trim() || null,
      };

      if (isDevMode) {
        const newRow: Influencer = {
          id: uuidv4(),
          ...row,
          paid: false,
          paid_at: null,
          receipt_storage_path: null,
          receipt_mime_type: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        devInfluencers.push(newRow);
        res.status(201).json(newRow);
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('influencers')
        .insert(row)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('Create influencer error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // PATCH /api/influencers/:id
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body as UpdateInfluencerRequest;
      const updateData: Record<string, unknown> = {};

      if (body.full_name !== undefined) {
        if (!body.full_name.trim()) {
          res.status(400).json({ error: 'שם לא יכול להיות ריק' });
          return;
        }
        updateData.full_name = body.full_name.trim();
      }
      if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
      if (body.instagram_handle !== undefined)
        updateData.instagram_handle = body.instagram_handle?.trim() || null;
      if (body.payment_amount !== undefined) updateData.payment_amount = body.payment_amount;
      if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;

      if (isDevMode) {
        const i = devInfluencers.findIndex((x) => x.id === id);
        if (i === -1) {
          res.status(404).json({ error: 'משפיענ/ית לא נמצאו' });
          return;
        }
        devInfluencers[i] = {
          ...devInfluencers[i],
          ...(updateData as Partial<Influencer>),
          updated_at: new Date().toISOString(),
        };
        res.json(devInfluencers[i]);
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('influencers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Update influencer error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // PATCH /api/influencers/:id/paid  body: { paid: boolean }
  async setPaid(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const paid = !!req.body.paid;
      const paid_at = paid ? new Date().toISOString() : null;

      if (isDevMode) {
        const i = devInfluencers.findIndex((x) => x.id === id);
        if (i === -1) {
          res.status(404).json({ error: 'משפיענ/ית לא נמצאו' });
          return;
        }
        devInfluencers[i] = {
          ...devInfluencers[i],
          paid,
          paid_at,
          updated_at: new Date().toISOString(),
        };
        res.json(devInfluencers[i]);
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('influencers')
        .update({ paid, paid_at })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Set paid error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // DELETE /api/influencers/:id
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (isDevMode) {
        const i = devInfluencers.findIndex((x) => x.id === id);
        if (i === -1) {
          res.status(404).json({ error: 'משפיענ/ית לא נמצאו' });
          return;
        }
        devInfluencers.splice(i, 1);
        res.json({ message: 'נמחק בהצלחה' });
        return;
      }

      // Best-effort: remove the receipt object from storage too
      const { data: existing } = await supabaseAdmin
        .from('influencers')
        .select('receipt_storage_path')
        .eq('id', id)
        .maybeSingle();

      if (existing?.receipt_storage_path) {
        await supabaseAdmin.storage
          .from(RECEIPT_BUCKET)
          .remove([existing.receipt_storage_path]);
      }

      const { error } = await supabaseAdmin.from('influencers').delete().eq('id', id);
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ message: 'נמחק בהצלחה' });
    } catch (error) {
      console.error('Delete influencer error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // POST /api/influencers/:id/receipt  multipart: file
  async uploadReceipt(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const file = (req as Request & { file?: Express.Multer.File }).file;

      if (!file) {
        res.status(400).json({ error: 'לא נשלח קובץ' });
        return;
      }
      if (file.size > MAX_RECEIPT_BYTES) {
        res.status(400).json({ error: 'הקובץ גדול מדי (מקסימום 10MB)' });
        return;
      }
      if (!isAllowedMime(file.mimetype)) {
        res.status(400).json({ error: 'סוג קובץ לא נתמך — PDF או תמונה בלבד' });
        return;
      }

      // Look up influencer to get customer_id (used for storage path)
      let influencer: Pick<Influencer, 'customer_id' | 'receipt_storage_path'> | null = null;
      if (isDevMode) {
        const found = devInfluencers.find((x) => x.id === id);
        if (found) influencer = { customer_id: found.customer_id, receipt_storage_path: found.receipt_storage_path };
      } else {
        const { data } = await supabaseAdmin
          .from('influencers')
          .select('customer_id, receipt_storage_path')
          .eq('id', id)
          .maybeSingle();
        influencer = data;
      }

      if (!influencer) {
        res.status(404).json({ error: 'משפיענ/ית לא נמצאו' });
        return;
      }

      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      const safeName = sanitizeFilenameSegment(path.basename(file.originalname, ext));
      const storagePath = `${influencer.customer_id}/${id}/${Date.now()}-${safeName}${ext}`;

      if (isDevMode) {
        // No actual storage in dev — just record the path
        const i = devInfluencers.findIndex((x) => x.id === id);
        devInfluencers[i] = {
          ...devInfluencers[i],
          receipt_storage_path: storagePath,
          receipt_mime_type: file.mimetype,
          updated_at: new Date().toISOString(),
        };
        res.json(devInfluencers[i]);
        return;
      }

      // Remove previous receipt if any
      if (influencer.receipt_storage_path) {
        await supabaseAdmin.storage
          .from(RECEIPT_BUCKET)
          .remove([influencer.receipt_storage_path]);
      }

      const { error: upErr } = await supabaseAdmin.storage
        .from(RECEIPT_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (upErr) {
        res.status(500).json({ error: `שגיאה בהעלאת הקובץ: ${upErr.message}` });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('influencers')
        .update({
          receipt_storage_path: storagePath,
          receipt_mime_type: file.mimetype,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Upload receipt error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // GET /api/influencers/:id/receipt -> { url }
  async getReceiptUrl(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (isDevMode) {
        const found = devInfluencers.find((x) => x.id === id);
        if (!found?.receipt_storage_path) {
          res.status(404).json({ error: 'אין קבלה' });
          return;
        }
        res.json({ url: `data:${found.receipt_mime_type || 'application/octet-stream'},DEV-PLACEHOLDER` });
        return;
      }

      const { data: row, error: rowErr } = await supabaseAdmin
        .from('influencers')
        .select('receipt_storage_path')
        .eq('id', id)
        .maybeSingle();

      if (rowErr || !row?.receipt_storage_path) {
        res.status(404).json({ error: 'אין קבלה' });
        return;
      }

      const { data, error } = await supabaseAdmin.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(row.receipt_storage_path, 3600);

      if (error || !data) {
        res.status(500).json({ error: error?.message || 'שגיאה בהפקת קישור' });
        return;
      }

      res.json({ url: data.signedUrl });
    } catch (error) {
      console.error('Get receipt url error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // DELETE /api/influencers/:id/receipt
  async deleteReceipt(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (isDevMode) {
        const i = devInfluencers.findIndex((x) => x.id === id);
        if (i === -1) {
          res.status(404).json({ error: 'משפיענ/ית לא נמצאו' });
          return;
        }
        devInfluencers[i] = {
          ...devInfluencers[i],
          receipt_storage_path: null,
          receipt_mime_type: null,
          updated_at: new Date().toISOString(),
        };
        res.json(devInfluencers[i]);
        return;
      }

      const { data: existing } = await supabaseAdmin
        .from('influencers')
        .select('receipt_storage_path')
        .eq('id', id)
        .maybeSingle();

      if (existing?.receipt_storage_path) {
        await supabaseAdmin.storage
          .from(RECEIPT_BUCKET)
          .remove([existing.receipt_storage_path]);
      }

      const { data, error } = await supabaseAdmin
        .from('influencers')
        .update({ receipt_storage_path: null, receipt_mime_type: null })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Delete receipt error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // GET /api/customers/:customerId/influencers/receipts.zip
  async exportReceiptsZip(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;

      let rows: Influencer[];
      if (isDevMode) {
        rows = devInfluencers.filter((x) => x.customer_id === customerId && x.receipt_storage_path);
      } else {
        const { data, error } = await supabaseAdmin
          .from('influencers')
          .select('*')
          .eq('customer_id', customerId)
          .not('receipt_storage_path', 'is', null);
        if (error) {
          res.status(400).json({ error: error.message });
          return;
        }
        rows = (data || []) as Influencer[];
      }

      if (rows.length === 0) {
        res.status(404).json({ error: 'אין קבלות לייצוא' });
        return;
      }

      const zipName = `receipts__${customerId}__${todayStamp()}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('warning', (err) => console.warn('archiver warning:', err));
      archive.on('error', (err) => {
        console.error('archiver error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'שגיאה בייצוא' });
        } else {
          res.end();
        }
      });
      archive.pipe(res);

      // Track filenames to disambiguate duplicates
      const used = new Set<string>();

      for (const inf of rows) {
        if (!inf.receipt_storage_path) continue;

        const ext = path.extname(inf.receipt_storage_path) || '.bin';
        const status = inf.paid ? 'paid' : 'unpaid';
        let base = `${sanitizeFilenameSegment(inf.full_name)}__${status}`;
        let candidate = `${base}${ext}`;
        let n = 2;
        while (used.has(candidate)) {
          candidate = `${base}-${n}${ext}`;
          n += 1;
        }
        used.add(candidate);

        if (isDevMode) {
          archive.append(`(dev placeholder for ${inf.receipt_storage_path})`, { name: candidate });
          continue;
        }

        const { data: dl, error: dlErr } = await supabaseAdmin.storage
          .from(RECEIPT_BUCKET)
          .download(inf.receipt_storage_path);

        if (dlErr || !dl) {
          console.warn(`skip ${inf.id}: ${dlErr?.message || 'no data'}`);
          continue;
        }

        const ab = await dl.arrayBuffer();
        archive.append(Buffer.from(ab), { name: candidate });
      }

      await archive.finalize();
    } catch (error) {
      console.error('Export receipts zip error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'שגיאת שרת' });
      }
    }
  }
}

export const influencersController = new InfluencersController();
