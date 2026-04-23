const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const token = this.getToken();
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'שגיאה בבקשה');
    }

    return data;
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async register(email: string, password: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: { email, password },
    });
  }

  async refreshToken(refresh_token: string) {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: { refresh_token },
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Customers
  async getCustomers() {
    return this.request('/customers');
  }

  async getCustomer(id: string) {
    return this.request(`/customers/${id}`);
  }

  async searchCustomers(query: string) {
    return this.request(`/customers/search?q=${encodeURIComponent(query)}`);
  }

  async createCustomer(data: {
    full_name: string;
    doc_number?: string;
    phone: string;
    email: string;
  }) {
    return this.request('/customers', {
      method: 'POST',
      body: data,
    });
  }

  async updateCustomer(id: string, data: Partial<{
    full_name: string;
    doc_number: string;
    phone: string;
    email: string;
  }>) {
    return this.request(`/customers/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteCustomer(id: string) {
    return this.request(`/customers/${id}`, {
      method: 'DELETE',
    });
  }

  // Proposals
  async getProposals(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const queryString = searchParams.toString();
    return this.request(`/proposals${queryString ? `?${queryString}` : ''}`);
  }

  async getProposal(id: string) {
    return this.request(`/proposals/${id}`);
  }

  async createProposal(data: {
    customer_id: string;
    proposal_date?: string;
    vat_rate?: number;
    terms_text?: string;
  }) {
    return this.request('/proposals', {
      method: 'POST',
      body: data,
    });
  }

  async updateProposal(id: string, data: Partial<{
    proposal_date: string;
    vat_rate: number;
    terms_text: string;
  }>) {
    return this.request(`/proposals/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteProposal(id: string) {
    return this.request(`/proposals/${id}`, {
      method: 'DELETE',
    });
  }

  // Blocks
  async addBlock(proposalId: string, data: {
    title: string;
    unit_price: number;
    quantity: number;
    text_items?: string[];
  }) {
    return this.request(`/proposals/${proposalId}/blocks`, {
      method: 'POST',
      body: data,
    });
  }

  async updateBlock(proposalId: string, blockId: string, data: Partial<{
    title: string;
    unit_price: number;
    quantity: number;
    sort_order: number;
  }>) {
    return this.request(`/proposals/${proposalId}/blocks/${blockId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteBlock(proposalId: string, blockId: string) {
    return this.request(`/proposals/${proposalId}/blocks/${blockId}`, {
      method: 'DELETE',
    });
  }

  // Text items
  async addTextItem(proposalId: string, blockId: string, content: string) {
    return this.request(`/proposals/${proposalId}/blocks/${blockId}/text-items`, {
      method: 'POST',
      body: { content },
    });
  }

  async updateTextItem(proposalId: string, textItemId: string, data: { content?: string; sort_order?: number }) {
    return this.request(`/proposals/${proposalId}/text-items/${textItemId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteTextItem(proposalId: string, textItemId: string) {
    return this.request(`/proposals/${proposalId}/text-items/${textItemId}`, {
      method: 'DELETE',
    });
  }

  // Actions
  async generatePDF(proposalId: string) {
    return this.request(`/proposals/${proposalId}/generate-pdf`, {
      method: 'POST',
    });
  }

  async sendProposal(proposalId: string, channel: 'whatsapp' | 'sms' | 'email', contractData?: {
    customerName: string;
    date: string;
    forText: string;
    platforms: string[];
    whatYouGet: string;
    cost: number;
  }) {
    return this.request(`/proposals/${proposalId}/send`, {
      method: 'POST',
      body: { channel, contractData },
    });
  }

  // Client (public)
  async getClientProposal(token: string) {
    return this.request(`/client/${token}`);
  }

  async getClientPDF(token: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/client/${token}/pdf`);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'שגיאה בהורדת PDF');
    }
    return response.blob();
  }

  async submitSignature(token: string, signaturePayload: {
    dataUrl: string;
    timestamp: string;
    clientData?: {
      date: string;
      phoneContact: string;
      accountingContact: string;
      companyNumber: string;
      invoiceEmail: string;
    };
  }) {
    return this.request(`/client/${token}/sign`, {
      method: 'POST',
      body: {
        signature_payload: signaturePayload,
        client_data: signaturePayload.clientData
      },
    });
  }
  // Campaigns
  async getCampaigns(customerId: string) {
    return this.request(`/campaigns/customer/${customerId}`);
  }

  async createCampaign(customerId: string, data: {
    campaign_name: string;
    influencers: string;
    invoice_url?: string | null;
    bank_details?: string;
    cost: number;
    is_paid?: boolean;
  }) {
    return this.request(`/campaigns/customer/${customerId}`, {
      method: 'POST',
      body: data,
    });
  }

  async updateCampaign(id: string, data: Partial<{
    campaign_name: string;
    influencers: string;
    invoice_url: string | null;
    bank_details: string;
    cost: number;
    is_paid: boolean;
  }>) {
    return this.request(`/campaigns/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteCampaign(id: string) {
    return this.request(`/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  // Error Logs (Admin)
  async logsAuth(password: string): Promise<{ success: boolean; token?: string; message?: string }> {
    return this.request('/logs/auth', {
      method: 'POST',
      body: { password },
    });
  }

  async getLogs(token: string, params?: { severity?: string; resolved?: string; limit?: number; offset?: number }): Promise<{ logs: unknown[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.resolved) searchParams.set('resolved', params.resolved);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const queryString = searchParams.toString();
    return this.request(`/logs${queryString ? `?${queryString}` : ''}`, {
      headers: { 'x-logs-token': token }
    });
  }

  async resolveLog(token: string, logId: string): Promise<{ success: boolean }> {
    return this.request(`/logs/${logId}/resolve`, {
      method: 'PATCH',
      headers: { 'x-logs-token': token }
    });
  }

  async logError(data: {
    severity?: 'info' | 'warning' | 'error' | 'critical';
    source: string;
    message: string;
    stack_trace?: string;
    url?: string;
    meta?: Record<string, unknown>;
  }): Promise<{ success: boolean; logId?: string }> {
    return this.request('/logs/log', {
      method: 'POST',
      body: data,
    });
  }
}

export const api = new ApiService();
