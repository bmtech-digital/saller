import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { pdfService } from '../services/pdf.service.js';
import { devProposals } from './proposals.controller.js';
import { devCustomers } from './customers.controller.js';
import type { ProposalWithDetails, SignProposalRequest } from '../types/index.js';

const isDevMode = process.env.DEV_MODE === 'true';

export class ClientController {
  // Get proposal by client token (public access)
  async getProposal(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      // Dev mode - check in-memory store
      if (isDevMode) {
        const proposal = devProposals.find(p => p.client_token === token);
        if (proposal) {
          const customer = devCustomers.find(c => c.id === proposal.customer_id);
          res.json({
            ...proposal,
            customer: customer || null,
            blocks: proposal.blocks || [],
            signature: proposal.signature || null
          });
          return;
        }
      }

      // Fetch proposal with all details using admin client (bypasses RLS)
      const { data: proposal, error } = await supabaseAdmin
        .from('proposals')
        .select(`
          id,
          proposal_date,
          row_number,
          order_number,
          subtotal,
          vat_rate,
          vat_amount,
          total,
          terms_text,
          status,
          contract_data,
          customer:customers(
            full_name,
            doc_number,
            phone,
            email
          ),
          blocks:proposal_blocks(
            id,
            title,
            unit_price,
            quantity,
            line_total,
            sort_order,
            text_items:block_text_items(
              id,
              content,
              sort_order
            )
          ),
          signature:signatures(
            signed_at,
            signature_payload
          )
        `)
        .eq('client_token', token)
        .single();

      if (error || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      // Check expiration
      const { data: tokenData } = await supabaseAdmin
        .from('proposals')
        .select('client_token_expires_at')
        .eq('client_token', token)
        .single();

      if (tokenData?.client_token_expires_at) {
        const expiryDate = new Date(tokenData.client_token_expires_at);
        if (expiryDate < new Date()) {
          res.status(410).json({ error: 'הקישור פג תוקף' });
          return;
        }
      }

      // Sort blocks and text items
      if (proposal.blocks) {
        (proposal.blocks as any[]).sort((a, b) => a.sort_order - b.sort_order);
        (proposal.blocks as any[]).forEach(block => {
          if (block.text_items) {
            block.text_items.sort((a: any, b: any) => a.sort_order - b.sort_order);
          }
        });
      }

      res.json(proposal);
    } catch (error) {
      console.error('Get client proposal error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Submit signature
  async submitSignature(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const body: SignProposalRequest = req.body;

      if (!body.signature_payload) {
        res.status(400).json({ error: 'חתימה נדרשת' });
        return;
      }

      // Dev mode - handle in-memory
      if (isDevMode) {
        const devProposal = devProposals.find(p => p.client_token === token);
        if (devProposal) {
          if (devProposal.status === 'signed') {
            res.status(400).json({ error: 'ההצעה כבר נחתמה' });
            return;
          }
          devProposal.status = 'signed';
          devProposal.signature = {
            signed_at: new Date().toISOString(),
            signature_payload: body.signature_payload
          };
          // Update client data if provided
          if (body.client_data) {
            devProposal.client_data = {
              ...devProposal.contract_data,
              ...body.client_data
            };
          }
          res.json({
            message: 'ההצעה נחתמה בהצלחה',
            signed_at: new Date().toISOString()
          });
          return;
        }
      }

      // Get proposal
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from('proposals')
        .select('id, status, client_token_expires_at')
        .eq('client_token', token)
        .single();

      if (proposalError || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      // Check expiration
      if (proposal.client_token_expires_at) {
        const expiryDate = new Date(proposal.client_token_expires_at);
        if (expiryDate < new Date()) {
          res.status(410).json({ error: 'הקישור פג תוקף' });
          return;
        }
      }

      // Check if already signed
      if (proposal.status === 'signed') {
        res.status(400).json({ error: 'ההצעה כבר נחתמה' });
        return;
      }

      // Get client IP and user agent (take only first IP from x-forwarded-for)
      const forwardedFor = req.headers['x-forwarded-for'] as string;
      const signerIp = forwardedFor
        ? forwardedFor.split(',')[0].trim()
        : req.socket.remoteAddress || null;
      const signerUserAgent = req.headers['user-agent'] || null;

      // Create or update signature
      const { error: sigError } = await supabaseAdmin
        .from('signatures')
        .upsert({
          proposal_id: proposal.id,
          signed_at: new Date().toISOString(),
          signer_ip: signerIp,
          signer_user_agent: signerUserAgent,
          signature_payload: body.signature_payload
        }, {
          onConflict: 'proposal_id'
        });

      if (sigError) {
        console.error('Signature save error:', sigError);
        res.status(500).json({ error: 'שגיאה בשמירת החתימה' });
        return;
      }

      // Update proposal status
      await supabaseAdmin
        .from('proposals')
        .update({ status: 'signed' })
        .eq('id', proposal.id);

      // Note: PDF storage upload skipped - bucket not configured
      // The signature is saved to the database and PDF can be generated on-demand

      res.json({
        message: 'ההצעה נחתמה בהצלחה',
        signed_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Submit signature error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }

  // Get unsigned PDF for preview
  async getPreviewPDF(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      // Dev mode - check in-memory store
      if (isDevMode) {
        const devProposal = devProposals.find(p => p.client_token === token);
        if (devProposal) {
          const customer = devCustomers.find(c => c.id === devProposal.customer_id);
          const proposalWithDetails = {
            ...devProposal,
            customer: customer || null,
            blocks: devProposal.blocks || [],
            signature: devProposal.signature || null
          } as ProposalWithDetails;

          const pdfBuffer = await pdfService.generateProposalPDF(proposalWithDetails, false);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="proposal-${devProposal.order_number}.pdf"`);
          res.send(pdfBuffer);
          return;
        }
      }

      // Get proposal
      const { data: proposal, error } = await supabaseAdmin
        .from('proposals')
        .select(`
          *,
          customer:customers(*),
          blocks:proposal_blocks(
            *,
            text_items:block_text_items(*)
          )
        `)
        .eq('client_token', token)
        .single();

      if (error || !proposal) {
        res.status(404).json({ error: 'הצעה לא נמצאה' });
        return;
      }

      // Sort blocks
      if (proposal.blocks) {
        (proposal.blocks as any[]).sort((a, b) => a.sort_order - b.sort_order);
        (proposal.blocks as any[]).forEach(block => {
          if (block.text_items) {
            block.text_items.sort((a: any, b: any) => a.sort_order - b.sort_order);
          }
        });
      }

      const pdfBuffer = await pdfService.generateProposalPDF(
        proposal as ProposalWithDetails,
        false
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="proposal-${proposal.order_number}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Get preview PDF error:', error);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
}

export const clientController = new ClientController();
