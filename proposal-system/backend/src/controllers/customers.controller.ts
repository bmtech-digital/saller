import { Request, Response } from 'express';
import { createUserClient } from '../utils/supabase.js';
import type { CreateCustomerRequest } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

const isDevMode = process.env.DEV_MODE === 'true';

// In-memory store for dev mode - exported for use in other controllers
export const devCustomers: any[] = [
  {
    id: 'cust-001',
    owner_id: 'dev-user-001',
    full_name: 'ישראל ישראלי',
    doc_number: '123456789',
    phone: '0501234567',
    email: 'israel@example.com',
    created_at: new Date().toISOString()
  },
  {
    id: 'cust-002',
    owner_id: 'dev-user-001',
    full_name: 'שרה כהן',
    doc_number: '987654321',
    phone: '0529876543',
    email: 'sara@example.com',
    created_at: new Date().toISOString()
  }
];

export class CustomersController {
  // Get all customers for current user
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      // Dev mode - return mock data
      if (isDevMode) {
        const userCustomers = devCustomers.filter(c => c.owner_id === req.user!.id);
        res.json(userCustomers);
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Get single customer
  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Dev mode
      if (isDevMode) {
        const customer = devCustomers.find(c => c.id === id && c.owner_id === req.user!.id);
        if (!customer) {
          res.status(404).json({ error: 'לקוח לא נמצא' });
          return;
        }
        res.json(customer);
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        res.status(404).json({ error: 'לקוח לא נמצא' });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Create new customer
  async create(req: Request, res: Response): Promise<void> {
    try {
      const body: CreateCustomerRequest = req.body;

      // Validation
      if (!body.full_name?.trim()) {
        res.status(400).json({ error: 'שם לקוח הוא שדה חובה' });
        return;
      }
      if (!body.phone?.trim()) {
        res.status(400).json({ error: 'טלפון הוא שדה חובה' });
        return;
      }
      if (!body.email?.trim()) {
        res.status(400).json({ error: 'דוא"ל הוא שדה חובה' });
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        res.status(400).json({ error: 'כתובת דוא"ל לא תקינה' });
        return;
      }

      // Basic phone validation (Israeli format)
      const phoneRegex = /^0[0-9]{8,9}$/;
      const cleanPhone = body.phone.replace(/[^0-9]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        res.status(400).json({ error: 'מספר טלפון לא תקין' });
        return;
      }

      // Dev mode
      if (isDevMode) {
        const newCustomer = {
          id: uuidv4(),
          owner_id: req.user!.id,
          full_name: body.full_name.trim(),
          doc_number: body.doc_number?.trim() || null,
          phone: cleanPhone,
          email: body.email.trim().toLowerCase(),
          created_at: new Date().toISOString()
        };
        devCustomers.push(newCustomer);
        res.status(201).json(newCustomer);
        return;
      }

      const supabase = createUserClient(req.accessToken!);
      const { data, error } = await supabase
        .from('customers')
        .insert({
          owner_id: req.user!.id,
          full_name: body.full_name.trim(),
          doc_number: body.doc_number?.trim() || null,
          phone: cleanPhone,
          email: body.email.trim().toLowerCase()
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Update customer
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body: Partial<CreateCustomerRequest> = req.body;

      const updateData: Record<string, any> = {};

      if (body.full_name !== undefined) {
        updateData.full_name = body.full_name.trim();
      }
      if (body.doc_number !== undefined) {
        updateData.doc_number = body.doc_number?.trim() || null;
      }
      if (body.phone !== undefined) {
        const cleanPhone = body.phone.replace(/[^0-9]/g, '');
        const phoneRegex = /^0[0-9]{8,9}$/;
        if (!phoneRegex.test(cleanPhone)) {
          res.status(400).json({ error: 'מספר טלפון לא תקין' });
          return;
        }
        updateData.phone = cleanPhone;
      }
      if (body.email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          res.status(400).json({ error: 'כתובת דוא"ל לא תקינה' });
          return;
        }
        updateData.email = body.email.trim().toLowerCase();
      }

      // Dev mode
      if (isDevMode) {
        const index = devCustomers.findIndex(c => c.id === id && c.owner_id === req.user!.id);
        if (index === -1) {
          res.status(404).json({ error: 'לקוח לא נמצא' });
          return;
        }
        devCustomers[index] = { ...devCustomers[index], ...updateData };
        res.json(devCustomers[index]);
        return;
      }

      const supabase = createUserClient(req.accessToken!);
      const { data, error } = await supabase
        .from('customers')
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
      console.error('Update customer error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Delete customer
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Dev mode
      if (isDevMode) {
        const index = devCustomers.findIndex(c => c.id === id && c.owner_id === req.user!.id);
        if (index === -1) {
          res.status(404).json({ error: 'לקוח לא נמצא' });
          return;
        }
        devCustomers.splice(index, 1);
        res.json({ message: 'הלקוח נמחק בהצלחה' });
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      // Check if customer has proposals
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id')
        .eq('customer_id', id)
        .limit(1);

      if (proposals && proposals.length > 0) {
        res.status(400).json({ error: 'לא ניתן למחוק לקוח עם הצעות מחיר קיימות' });
        return;
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ message: 'הלקוח נמחק בהצלחה' });
    } catch (error) {
      console.error('Delete customer error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Search customers
  async search(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'חסר פרמטר חיפוש' });
        return;
      }

      // Dev mode
      if (isDevMode) {
        const searchTerm = q.toLowerCase();
        const results = devCustomers.filter(c =>
          c.owner_id === req.user!.id && (
            c.full_name.toLowerCase().includes(searchTerm) ||
            c.phone.includes(searchTerm) ||
            c.email.toLowerCase().includes(searchTerm)
          )
        );
        res.json(results);
        return;
      }

      const supabase = createUserClient(req.accessToken!);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .order('full_name')
        .limit(20);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Search customers error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
}

export const customersController = new CustomersController();
