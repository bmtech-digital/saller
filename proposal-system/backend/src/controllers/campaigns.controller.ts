import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { v4 as uuidv4 } from 'uuid';

const isDevMode = process.env.DEV_MODE === 'true';

// In-memory store for dev mode
export const devCampaigns: any[] = [];

export class CampaignsController {
  // Get campaigns for a customer
  async getByCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;

      if (isDevMode) {
        const campaigns = devCampaigns.filter(
          c => c.customer_id === customerId && c.owner_id === req.user!.id
        );
        res.json(campaigns);
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('customer_id', customerId)
        .eq('owner_id', req.user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Get campaigns error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Create campaign
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { campaign_name, influencers, invoice_url, bank_details, cost, is_paid } = req.body;

      if (!campaign_name?.trim()) {
        res.status(400).json({ error: 'שם הקמפיין נדרש' });
        return;
      }
      if (!influencers?.trim()) {
        res.status(400).json({ error: 'שם המשפיען/ים נדרש' });
        return;
      }
      if (!cost || cost <= 0) {
        res.status(400).json({ error: 'יש להזין עלות' });
        return;
      }

      if (isDevMode) {
        const newCampaign = {
          id: uuidv4(),
          owner_id: req.user!.id,
          customer_id: customerId,
          campaign_name: campaign_name.trim(),
          influencers: influencers.trim(),
          invoice_url: invoice_url || null,
          bank_details: bank_details?.trim() || '',
          cost,
          is_paid: is_paid || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        devCampaigns.push(newCampaign);
        res.status(201).json(newCampaign);
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .insert({
          owner_id: req.user!.id,
          customer_id: customerId,
          campaign_name: campaign_name.trim(),
          influencers: influencers.trim(),
          invoice_url: invoice_url || null,
          bank_details: bank_details?.trim() || '',
          cost,
          is_paid: is_paid || false
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('Create campaign error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Update campaign
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: Record<string, any> = {};

      if (req.body.campaign_name !== undefined) updateData.campaign_name = req.body.campaign_name.trim();
      if (req.body.influencers !== undefined) updateData.influencers = req.body.influencers.trim();
      if (req.body.invoice_url !== undefined) updateData.invoice_url = req.body.invoice_url;
      if (req.body.bank_details !== undefined) updateData.bank_details = req.body.bank_details.trim();
      if (req.body.cost !== undefined) updateData.cost = req.body.cost;
      if (req.body.is_paid !== undefined) updateData.is_paid = req.body.is_paid;

      if (isDevMode) {
        const index = devCampaigns.findIndex(c => c.id === id && c.owner_id === req.user!.id);
        if (index === -1) {
          res.status(404).json({ error: 'קמפיין לא נמצא' });
          return;
        }
        devCampaigns[index] = { ...devCampaigns[index], ...updateData, updated_at: new Date().toISOString() };
        res.json(devCampaigns[index]);
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .update(updateData)
        .eq('id', id)
        .eq('owner_id', req.user!.id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Update campaign error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Delete campaign
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (isDevMode) {
        const index = devCampaigns.findIndex(c => c.id === id && c.owner_id === req.user!.id);
        if (index === -1) {
          res.status(404).json({ error: 'קמפיין לא נמצא' });
          return;
        }
        devCampaigns.splice(index, 1);
        res.json({ message: 'הקמפיין נמחק בהצלחה' });
        return;
      }

      const { error } = await supabaseAdmin
        .from('campaigns')
        .delete()
        .eq('id', id)
        .eq('owner_id', req.user!.id);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ message: 'הקמפיין נמחק בהצלחה' });
    } catch (error) {
      console.error('Delete campaign error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
}

export const campaignsController = new CampaignsController();
