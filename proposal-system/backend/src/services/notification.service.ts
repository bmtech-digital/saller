import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../utils/supabase.js';
import type { SendChannel, Proposal, Customer } from '../types/index.js';

export class NotificationService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  async sendProposalLink(
    proposal: Proposal,
    customer: Customer,
    channel: SendChannel,
    signUrl: string
  ): Promise<void> {
    const destination = channel === 'email' ? customer.email : customer.phone;

    switch (channel) {
      case 'email':
        await this.sendEmail(customer, signUrl, proposal);
        break;
      case 'whatsapp':
        await this.sendWhatsApp(customer.phone, signUrl, proposal);
        break;
      case 'sms':
        await this.sendSMS(customer.phone, signUrl, proposal);
        break;
    }

    // Log the send
    await supabaseAdmin.from('send_logs').insert({
      proposal_id: proposal.id,
      channel,
      destination,
      meta: { sign_url: signUrl }
    });
  }

  private async sendEmail(
    customer: Customer,
    signUrl: string,
    proposal: Proposal
  ): Promise<void> {
    if (!this.transporter) {
      console.warn('Email not configured, logging instead');
      console.log(`Would send email to ${customer.email}: ${signUrl}`);
      return;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: customer.email,
      subject: `הצעת מחיר מספר ${proposal.order_number} מחכה לחתימתך`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              direction: rtl;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: #1a1a1a;
              border-bottom: 3px solid #f97316;
              padding-bottom: 15px;
            }
            .info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .button {
              display: inline-block;
              background: #f97316;
              color: white;
              padding: 15px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              font-size: 18px;
              margin: 20px 0;
            }
            .footer {
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>שלום ${customer.full_name},</h1>
            <p>קיבלת הצעת מחיר חדשה לאישור וחתימה.</p>

            <div class="info">
              <p><strong>מספר הזמנה:</strong> ${proposal.order_number}</p>
              <p><strong>סכום לתשלום:</strong> ₪${proposal.total.toFixed(2)}</p>
              <p><strong>תאריך:</strong> ${new Date(proposal.proposal_date).toLocaleDateString('he-IL')}</p>
            </div>

            <p>לצפייה בהצעה ולחתימה, לחץ/י על הכפתור:</p>

            <a href="${signUrl}" class="button">צפייה וחתימה על ההצעה</a>

            <div class="footer">
              <p>קישור זה תקף ל-72 שעות.</p>
              <p>אם לא ביקשת הצעה זו, אנא התעלם/י מהודעה זו.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  private async sendWhatsApp(
    phone: string,
    signUrl: string,
    proposal: Proposal
  ): Promise<void> {
    // WhatsApp Business API integration
    const message = `שלום! קיבלת הצעת מחיר מספר ${proposal.order_number}. לצפייה ולחתימה: ${signUrl}`;

    const waUrl = process.env.WHATSAPP_API_URL;
    const waToken = process.env.WHATSAPP_API_TOKEN;

    // Check if WhatsApp is properly configured (not placeholder values)
    const isConfigured = waUrl && waToken &&
      !waUrl.includes('YOUR_PHONE_ID') &&
      !waToken.includes('your-');

    if (isConfigured) {
      try {
        const response = await fetch(waUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${waToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone.replace(/[^0-9]/g, ''),
            type: 'text',
            text: { body: message }
          })
        });

        if (!response.ok) {
          throw new Error(`WhatsApp API error: ${response.statusText}`);
        }
      } catch (error) {
        console.error('WhatsApp send error:', error);
        throw error;
      }
    } else {
      // Fallback: Just log - don't throw error
      console.log(`WhatsApp not configured, would send to ${phone}: ${message}`);
      console.log(`WhatsApp link: https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`);
    }
  }

  private async sendSMS(
    phone: string,
    signUrl: string,
    proposal: Proposal
  ): Promise<void> {
    // SMS API integration placeholder
    const message = `הצעת מחיר ${proposal.order_number} - ₪${proposal.total.toFixed(2)}. לחתימה: ${signUrl}`;

    const smsUrl = process.env.SMS_API_URL;
    const smsKey = process.env.SMS_API_KEY;

    // Check if SMS is properly configured (not placeholder values)
    const isConfigured = smsUrl && smsKey &&
      !smsUrl.includes('sms-provider.com') &&
      !smsKey.includes('your-') &&
      smsKey !== 'your-sms-api-key';

    if (isConfigured) {
      try {
        const response = await fetch(smsUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${smsKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: phone,
            message
          })
        });

        if (!response.ok) {
          throw new Error(`SMS API error: ${response.statusText}`);
        }
      } catch (error) {
        console.error('SMS send error:', error);
        throw error;
      }
    } else {
      console.log(`SMS not configured, would send to ${phone}: ${message}`);
      // Don't throw error - just log and continue
    }
  }

  // Generate WhatsApp web link for manual sending
  generateWhatsAppLink(phone: string, signUrl: string, proposal: Proposal): string {
    const message = `שלום! קיבלת הצעת מחיר מספר ${proposal.order_number}. לצפייה ולחתימה: ${signUrl}`;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
}

export const notificationService = new NotificationService();
