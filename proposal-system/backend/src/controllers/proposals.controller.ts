import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createUserClient, supabaseAdmin } from '../utils/supabase.js';
import { pdfService } from '../services/pdf.service.js';
import { notificationService } from '../services/notification.service.js';
import { DEFAULT_TERMS_TEXT, TOKEN_EXPIRY_HOURS } from '../utils/constants.js';
import { devCustomers } from './customers.controller.js';
import type {
  CreateProposalRequest,
  CreateBlockRequest,
  UpdateBlockRequest,
  SendChannel,
  ProposalWithDetails
} from '../types/index.js';

const isDevMode = process.env.DEV_MODE === 'true';

// In-memory store for dev mode (exported for client controller)
export const devProposals: any[] = [];
const devBlocks: any[] = [];
const devTextItems: any[] = [];

export class ProposalsController {
  // Get all proposals for dashboard
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      // Dev mode
      if (isDevMode) {
        const userProposals = devProposals
          .filter(p => p.owner_id === req.user!.id)
          .map(p => ({
            ...p,
            customer: devCustomers.find(c => c.id === p.customer_id)
          }));
        res.json({ data: userProposals, count: userProposals.length });
        return;
      }

      const supabase = createUserClient(req.accessToken!);
      const { status, search, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .from('proposals')
        .select(`
          *,
          customer:customers(*)
        `)
        .order('row_number', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ data, count });
    } catch (error) {
      console.error('Get proposals error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Get single proposal with all details
  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }
        const blocks = devBlocks
          .filter(b => b.proposal_id === id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(b => ({
            ...b,
            text_items: devTextItems.filter(t => t.block_id === b.id).sort((a, b) => a.sort_order - b.sort_order)
          }));
        res.json({
          ...proposal,
          customer: devCustomers.find(c => c.id === proposal.customer_id),
          blocks,
          signature: null,
          documents: []
        });
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      const { data: proposal, error } = await supabase
        .from('proposals')
        .select(`
          *,
          customer:customers(*),
          blocks:proposal_blocks(
            *,
            text_items:block_text_items(*)
          ),
          signature:signatures(*),
          documents(*)
        `)
        .eq('id', id)
        .order('sort_order', { referencedTable: 'proposal_blocks', ascending: true })
        .single();

      if (error) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      // Sort text items within each block
      if (proposal.blocks) {
        proposal.blocks.forEach((block: any) => {
          if (block.text_items) {
            block.text_items.sort((a: any, b: any) => a.sort_order - b.sort_order);
          }
        });
      }

      res.json(proposal);
    } catch (error) {
      console.error('Get proposal error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Create new proposal
  async create(req: Request, res: Response): Promise<void> {
    try {
      const body: CreateProposalRequest = req.body;

      if (!body.customer_id) {
        res.status(400).json({ error: 'יש לבחור לקוח' });
        return;
      }

      // Dev mode
      if (isDevMode) {
        const customer = devCustomers.find(c => c.id === body.customer_id && c.owner_id === req.user!.id);
        if (!customer) {
          res.status(400).json({ error: 'לקוח לא נמצא' });
          return;
        }
        const newProposal = {
          id: uuidv4(),
          row_number: devProposals.length + 1,
          owner_id: req.user!.id,
          customer_id: body.customer_id,
          proposal_date: body.proposal_date || new Date().toISOString().split('T')[0],
          vat_rate: body.vat_rate ?? 0.17,
          terms_text: body.terms_text ?? DEFAULT_TERMS_TEXT,
          status: 'draft',
          subtotal: 0,
          vat_amount: 0,
          total: 0,
          created_at: new Date().toISOString()
        };
        devProposals.push(newProposal);
        res.status(201).json(newProposal);
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      // Verify customer exists and belongs to user
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('id', body.customer_id)
        .single();

      if (customerError || !customer) {
        res.status(400).json({ error: 'לקוח לא נמצא' });
        return;
      }

      const { data, error } = await supabase
        .from('proposals')
        .insert({
          owner_id: req.user!.id,
          customer_id: body.customer_id,
          proposal_date: body.proposal_date || new Date().toISOString().split('T')[0],
          vat_rate: body.vat_rate ?? 0.17,
          terms_text: body.terms_text ?? DEFAULT_TERMS_TEXT,
          status: 'draft'
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('Create proposal error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Update proposal
  async update(req: Request, res: Response): Promise<void> {
    try {
      const supabase = createUserClient(req.accessToken!);
      const { id } = req.params;
      const body = req.body;

      const updateData: Record<string, any> = {};

      if (body.proposal_date !== undefined) updateData.proposal_date = body.proposal_date;
      if (body.vat_rate !== undefined) updateData.vat_rate = body.vat_rate;
      if (body.terms_text !== undefined) updateData.terms_text = body.terms_text;

      const { data, error } = await supabase
        .from('proposals')
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
      console.error('Update proposal error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Delete proposal
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Dev mode
      if (isDevMode) {
        const proposalIndex = devProposals.findIndex(p => p.id === id && p.owner_id === req.user!.id);
        if (proposalIndex === -1) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        // Remove associated blocks and text items
        const blocksToRemove = devBlocks.filter(b => b.proposal_id === id);
        blocksToRemove.forEach(block => {
          // Remove text items for this block
          const textItemsToRemove = devTextItems.filter(t => t.block_id === block.id);
          textItemsToRemove.forEach(t => {
            const idx = devTextItems.indexOf(t);
            if (idx > -1) devTextItems.splice(idx, 1);
          });
          // Remove block
          const blockIdx = devBlocks.indexOf(block);
          if (blockIdx > -1) devBlocks.splice(blockIdx, 1);
        });

        // Remove proposal
        devProposals.splice(proposalIndex, 1);

        res.json({ message: 'ההצעה נמחקה בהצלחה' });
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', id);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ message: 'ההצעה נמחקה בהצלחה' });
    } catch (error) {
      console.error('Delete proposal error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Add block to proposal
  async addBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body: CreateBlockRequest = req.body;

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        const existingBlocks = devBlocks.filter(b => b.proposal_id === id);
        const nextSortOrder = existingBlocks.length > 0
          ? Math.max(...existingBlocks.map(b => b.sort_order)) + 1
          : 1;

        const lineTotal = (body.unit_price || 0) * (body.quantity || 1);

        const newBlock = {
          id: uuidv4(),
          proposal_id: id,
          title: body.title.trim(),
          unit_price: body.unit_price || 0,
          quantity: body.quantity || 1,
          line_total: lineTotal,
          sort_order: nextSortOrder,
          created_at: new Date().toISOString()
        };
        devBlocks.push(newBlock);

        // Add text items if provided
        if (body.text_items && body.text_items.length > 0) {
          body.text_items.forEach((content, index) => {
            devTextItems.push({
              id: uuidv4(),
              block_id: newBlock.id,
              content,
              sort_order: index + 1
            });
          });
        }

        // Recalculate totals
        this.recalculateDevTotals(id);

        res.status(201).json({
          ...newBlock,
          text_items: devTextItems.filter(t => t.block_id === newBlock.id)
        });
        return;
      }

      // Verify proposal belongs to user
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from('proposals')
        .select('id')
        .eq('id', id)
        .eq('owner_id', req.user!.id)
        .single();

      if (proposalError || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      // Get max sort order
      const { data: existingBlocks } = await supabaseAdmin
        .from('proposal_blocks')
        .select('sort_order')
        .eq('proposal_id', id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingBlocks && existingBlocks.length > 0
        ? existingBlocks[0].sort_order + 1
        : 1;

      const lineTotal = (body.unit_price || 0) * (body.quantity || 1);

      const { data: block, error } = await supabaseAdmin
        .from('proposal_blocks')
        .insert({
          proposal_id: id,
          title: body.title.trim(),
          unit_price: body.unit_price || 0,
          quantity: body.quantity || 1,
          line_total: lineTotal,
          sort_order: nextSortOrder
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase addBlock error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          proposalId: id,
          body
        });
        res.status(400).json({ error: `שגיאה בהוספת בלוק: ${error.message}` });
        return;
      }

      // Add text items if provided
      if (body.text_items && body.text_items.length > 0) {
        const textItems = body.text_items.map((content, index) => ({
          block_id: block.id,
          content,
          sort_order: index + 1
        }));

        await supabaseAdmin.from('block_text_items').insert(textItems);
      }

      // Recalculate totals
      await this.recalculateTotals(id, supabaseAdmin);

      // Fetch block with text items
      const { data: fullBlock } = await supabaseAdmin
        .from('proposal_blocks')
        .select('*, text_items:block_text_items(*)')
        .eq('id', block.id)
        .single();

      res.status(201).json(fullBlock);
    } catch (error) {
      console.error('Add block error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Update block
  async updateBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id, blockId } = req.params;
      const body: UpdateBlockRequest = req.body;

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        const blockIndex = devBlocks.findIndex(b => b.id === blockId && b.proposal_id === id);
        if (blockIndex === -1) {
          res.status(404).json({ error: 'בלוק לא נמצא' });
          return;
        }

        const block = devBlocks[blockIndex];
        if (body.title !== undefined) block.title = body.title.trim();
        if (body.unit_price !== undefined) block.unit_price = body.unit_price;
        if (body.quantity !== undefined) block.quantity = body.quantity;
        if (body.sort_order !== undefined) block.sort_order = body.sort_order;

        // Recalculate line_total
        block.line_total = block.unit_price * block.quantity;

        // Recalculate proposal totals
        this.recalculateDevTotals(id);

        res.json({
          ...block,
          text_items: devTextItems.filter(t => t.block_id === block.id)
        });
        return;
      }

      // Verify proposal belongs to user
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from('proposals')
        .select('id')
        .eq('id', id)
        .eq('owner_id', req.user!.id)
        .single();

      if (proposalError || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      const updateData: Record<string, any> = {};

      if (body.title !== undefined) updateData.title = body.title.trim();
      if (body.unit_price !== undefined) updateData.unit_price = body.unit_price;
      if (body.quantity !== undefined) updateData.quantity = body.quantity;
      if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

      // Calculate line total if price or quantity changed
      if (body.unit_price !== undefined || body.quantity !== undefined) {
        const { data: currentBlock } = await supabaseAdmin
          .from('proposal_blocks')
          .select('unit_price, quantity')
          .eq('id', blockId)
          .single();

        if (currentBlock) {
          const price = body.unit_price ?? currentBlock.unit_price;
          const qty = body.quantity ?? currentBlock.quantity;
          updateData.line_total = price * qty;
        }
      }

      const { data, error } = await supabaseAdmin
        .from('proposal_blocks')
        .update(updateData)
        .eq('id', blockId)
        .eq('proposal_id', id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Recalculate totals
      await this.recalculateTotals(id, supabaseAdmin);

      res.json(data);
    } catch (error) {
      console.error('Update block error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Delete block
  async deleteBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id, blockId } = req.params;

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        const blockIndex = devBlocks.findIndex(b => b.id === blockId && b.proposal_id === id);
        if (blockIndex === -1) {
          res.status(404).json({ error: 'בלוק לא נמצא' });
          return;
        }

        // Remove text items for this block
        const textItemsToRemove = devTextItems.filter(t => t.block_id === blockId);
        textItemsToRemove.forEach(t => {
          const idx = devTextItems.indexOf(t);
          if (idx > -1) devTextItems.splice(idx, 1);
        });

        // Remove block
        devBlocks.splice(blockIndex, 1);

        // Recalculate totals
        this.recalculateDevTotals(id);

        res.json({ message: 'הבלוק נמחק בהצלחה' });
        return;
      }

      // Verify proposal belongs to user
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from('proposals')
        .select('id')
        .eq('id', id)
        .eq('owner_id', req.user!.id)
        .single();

      if (proposalError || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      const { error } = await supabaseAdmin
        .from('proposal_blocks')
        .delete()
        .eq('id', blockId)
        .eq('proposal_id', id);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Recalculate totals
      await this.recalculateTotals(id, supabaseAdmin);

      res.json({ message: 'הבלוק נמחק בהצלחה' });
    } catch (error) {
      console.error('Delete block error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Add text item to block
  async addTextItem(req: Request, res: Response): Promise<void> {
    try {
      const { id, blockId } = req.params;
      const { content } = req.body;

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        const block = devBlocks.find(b => b.id === blockId && b.proposal_id === id);
        if (!block) {
          res.status(404).json({ error: 'בלוק לא נמצא' });
          return;
        }

        if (!content?.trim()) {
          res.status(400).json({ error: 'תוכן הוא שדה חובה' });
          return;
        }

        const existingItems = devTextItems.filter(t => t.block_id === blockId);
        const nextSortOrder = existingItems.length > 0
          ? Math.max(...existingItems.map(t => t.sort_order)) + 1
          : 1;

        const newItem = {
          id: uuidv4(),
          block_id: blockId,
          content: content.trim(),
          sort_order: nextSortOrder
        };
        devTextItems.push(newItem);

        res.status(201).json(newItem);
        return;
      }

      // Verify proposal belongs to user
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from('proposals')
        .select('id')
        .eq('id', id)
        .eq('owner_id', req.user!.id)
        .single();

      if (proposalError || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      if (!content?.trim()) {
        res.status(400).json({ error: 'תוכן הוא שדה חובה' });
        return;
      }

      // Get max sort order
      const { data: existingItems } = await supabaseAdmin
        .from('block_text_items')
        .select('sort_order')
        .eq('block_id', blockId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingItems && existingItems.length > 0
        ? existingItems[0].sort_order + 1
        : 1;

      const { data, error } = await supabaseAdmin
        .from('block_text_items')
        .insert({
          block_id: blockId,
          content: content.trim(),
          sort_order: nextSortOrder
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('Add text item error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Update text item
  async updateTextItem(req: Request, res: Response): Promise<void> {
    try {
      const { id, textItemId } = req.params;
      const { content, sort_order } = req.body;

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        const itemIndex = devTextItems.findIndex(t => t.id === textItemId);
        if (itemIndex === -1) {
          res.status(404).json({ error: 'פריט לא נמצא' });
          return;
        }

        const item = devTextItems[itemIndex];
        if (content !== undefined) item.content = content.trim();
        if (sort_order !== undefined) item.sort_order = sort_order;

        res.json(item);
        return;
      }

      // Verify proposal belongs to user
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from('proposals')
        .select('id')
        .eq('id', id)
        .eq('owner_id', req.user!.id)
        .single();

      if (proposalError || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      const updateData: Record<string, any> = {};
      if (content !== undefined) updateData.content = content.trim();
      if (sort_order !== undefined) updateData.sort_order = sort_order;

      const { data, error } = await supabaseAdmin
        .from('block_text_items')
        .update(updateData)
        .eq('id', textItemId)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Update text item error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Delete text item
  async deleteTextItem(req: Request, res: Response): Promise<void> {
    try {
      const { id, textItemId } = req.params;

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        const itemIndex = devTextItems.findIndex(t => t.id === textItemId);
        if (itemIndex === -1) {
          res.status(404).json({ error: 'פריט לא נמצא' });
          return;
        }

        devTextItems.splice(itemIndex, 1);
        res.json({ message: 'הפריט נמחק בהצלחה' });
        return;
      }

      // Verify proposal belongs to user
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from('proposals')
        .select('id')
        .eq('id', id)
        .eq('owner_id', req.user!.id)
        .single();

      if (proposalError || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      const { error } = await supabaseAdmin
        .from('block_text_items')
        .delete()
        .eq('id', textItemId);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ message: 'הפריט נמחק בהצלחה' });
    } catch (error) {
      console.error('Delete text item error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Generate PDF (unsigned)
  async generatePDF(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Dev mode - generate PDF and return as data URL
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        // Build full proposal object for PDF generation
        const blocks = devBlocks
          .filter(b => b.proposal_id === id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(b => ({
            ...b,
            text_items: devTextItems.filter(t => t.block_id === b.id).sort((a, b) => a.sort_order - b.sort_order)
          }));

        const customer = devCustomers.find(c => c.id === proposal.customer_id);

        const fullProposal = {
          ...proposal,
          customer,
          blocks,
          signature: null,
          documents: []
        } as ProposalWithDetails;

        const pdfBuffer = await pdfService.generateProposalPDF(fullProposal, false);

        // Return as base64 data URL
        const base64 = pdfBuffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${base64}`;

        res.json({ url: dataUrl, storage_path: null });
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      const proposal = await this.getProposalWithDetails(id, supabase);
      if (!proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      const pdfBuffer = await pdfService.generateProposalPDF(proposal, false);

      // Return as base64 data URL (no storage upload needed)
      const base64 = pdfBuffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64}`;

      res.json({ url: dataUrl, storage_path: null });
    } catch (error) {
      console.error('Generate PDF error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Send proposal to client
  async sendToClient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { channel, contractData } = req.body as {
        channel: SendChannel;
        contractData?: {
          customerName: string;
          date: string;
          forText: string;
          platforms: string[];
          whatYouGet: string;
          cost: number;
        };
      };

      if (!['whatsapp', 'sms', 'email'].includes(channel)) {
        res.status(400).json({ error: 'ערוץ שליחה לא תקין' });
        return;
      }

      // Dev mode
      if (isDevMode) {
        const proposal = devProposals.find(p => p.id === id && p.owner_id === req.user!.id);
        if (!proposal) {
          res.status(404).json({ error: 'הצעה לא נמצאה' });
          return;
        }

        const customer = devCustomers.find(c => c.id === proposal.customer_id);
        if (!customer) {
          res.status(404).json({ error: 'לקוח לא נמצא' });
          return;
        }

        // Generate client token
        const clientToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

        proposal.client_token = clientToken;
        proposal.status = 'sent';

        // Save contract data for PDF generation
        console.log('=== contractData received:', JSON.stringify(contractData));
        if (contractData) {
          (proposal as any).contract_data = contractData;
          console.log('=== contract_data saved');
        }

        // Save token and contract_data to Supabase (even in dev mode)
        const devUpdateData: Record<string, any> = {
          client_token: clientToken,
          client_token_expires_at: expiresAt.toISOString(),
          status: 'sent',
          contract_data: contractData || null
        };

        // If contract_data has cost, update the total field
        if (contractData?.cost) {
          devUpdateData.subtotal = contractData.cost;
          devUpdateData.vat_amount = 0;
          devUpdateData.total = contractData.cost;
        }

        await supabaseAdmin
          .from('proposals')
          .update(devUpdateData)
          .eq('id', id);

        // Build sign URL
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const signUrl = `${baseUrl}/sign/${clientToken}`;

        // Generate WhatsApp link for manual sending
        let whatsappLink: string | undefined;
        if (channel === 'whatsapp') {
          const message = `שלום ${customer.full_name}, מצורף קישור להצעת המחיר שלך: ${signUrl}`;
          whatsappLink = `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        }

        res.json({
          message: 'ההצעה נשלחה בהצלחה (מצב פיתוח)',
          sign_url: signUrl,
          whatsapp_link: whatsappLink
        });
        return;
      }

      const supabase = createUserClient(req.accessToken!);

      const proposal = await this.getProposalWithDetails(id, supabase);
      if (!proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      // Generate client token
      const clientToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

      // Update proposal with token, status, contract_data and total from cost
      const updateData: Record<string, any> = {
        client_token: clientToken,
        client_token_expires_at: expiresAt.toISOString(),
        status: 'sent',
        contract_data: contractData || null
      };

      // If contract_data has cost, update the total field
      if (contractData?.cost) {
        updateData.subtotal = contractData.cost;
        updateData.vat_amount = 0;
        updateData.total = contractData.cost;
      }

      await supabase
        .from('proposals')
        .update(updateData)
        .eq('id', id);

      // Build sign URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const signUrl = `${baseUrl}/sign/${clientToken}`;

      // Send notification
      await notificationService.sendProposalLink(proposal, proposal.customer, channel, signUrl);

      // If WhatsApp, also return the link for manual fallback
      let whatsappLink: string | undefined;
      if (channel === 'whatsapp') {
        whatsappLink = notificationService.generateWhatsAppLink(
          proposal.customer.phone,
          signUrl,
          proposal
        );
      }

      res.json({
        message: 'ההצעה נשלחה בהצלחה',
        sign_url: signUrl,
        whatsapp_link: whatsappLink
      });
    } catch (error) {
      console.error('Send to client error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Helper: Recalculate proposal totals
  private async recalculateTotals(proposalId: string, supabase: any): Promise<void> {
    const { data: blocks } = await supabase
      .from('proposal_blocks')
      .select('line_total')
      .eq('proposal_id', proposalId);

    const subtotal = blocks?.reduce((sum: number, b: any) => sum + Number(b.line_total), 0) || 0;

    const { data: proposal } = await supabase
      .from('proposals')
      .select('vat_rate')
      .eq('id', proposalId)
      .single();

    const vatRate = proposal?.vat_rate || 0.17;
    const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    await supabase
      .from('proposals')
      .update({ subtotal, vat_amount: vatAmount, total })
      .eq('id', proposalId);
  }

  // Helper: Recalculate totals for dev mode
  private recalculateDevTotals(proposalId: string): void {
    const blocks = devBlocks.filter(b => b.proposal_id === proposalId);
    const subtotal = blocks.reduce((sum, b) => sum + Number(b.line_total), 0);

    const proposalIndex = devProposals.findIndex(p => p.id === proposalId);
    if (proposalIndex === -1) return;

    const vatRate = devProposals[proposalIndex].vat_rate || 0.17;
    const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    devProposals[proposalIndex].subtotal = subtotal;
    devProposals[proposalIndex].vat_amount = vatAmount;
    devProposals[proposalIndex].total = total;
  }

  // Helper: Get proposal with all details
  private async getProposalWithDetails(proposalId: string, supabase: any): Promise<ProposalWithDetails | null> {
    const { data, error } = await supabase
      .from('proposals')
      .select(`
        *,
        customer:customers(*),
        blocks:proposal_blocks(
          *,
          text_items:block_text_items(*)
        ),
        signature:signatures(*),
        documents(*)
      `)
      .eq('id', proposalId)
      .single();

    if (error) return null;

    // Sort blocks and text items
    if (data.blocks) {
      data.blocks.sort((a: any, b: any) => a.sort_order - b.sort_order);
      data.blocks.forEach((block: any) => {
        if (block.text_items) {
          block.text_items.sort((a: any, b: any) => a.sort_order - b.sort_order);
        }
      });
    }

    return data;
  }
}

export const proposalsController = new ProposalsController();
