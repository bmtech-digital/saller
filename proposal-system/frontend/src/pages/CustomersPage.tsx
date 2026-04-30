import { useState, useEffect, Fragment, useRef } from 'react';
import Swal from 'sweetalert2';
import { Plus, Search, Edit2, Trash2, Phone, Mail, ChevronDown, ChevronUp, FileUp, Eye, Users } from 'lucide-react';
import { api } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { CustomerForm } from '../components/forms/CustomerForm';
import { CampaignForm } from '../components/forms/CampaignForm';
import { InfluencersModal } from '../components/InfluencersModal';
import { Loading } from '../components/ui/Loading';
import { useToast } from '../components/ui/Toast';
import type { Customer, CustomerFormData, Campaign, CampaignFormData } from '../types';
import {
  PROJECT_TYPES,
  getProjectTypeLabel,
  type ProjectTypeId,
  DEFAULT_PROJECT_TYPE
} from '../config/projectTypes';

export function CustomersPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Campaign states
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedCustomerForCampaign, setSelectedCustomerForCampaign] = useState<Customer | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Record<string, Campaign[]>>({});
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  // Influencers modal
  const [showInfluencersModal, setShowInfluencersModal] = useState(false);
  const [selectedCustomerForInfluencers, setSelectedCustomerForInfluencers] = useState<Customer | null>(null);

  // Project type filter ('all' shows everyone)
  const [typeFilter, setTypeFilter] = useState<ProjectTypeId | 'all'>('all');

  // Hidden file input for one-shot invoice upload
  const invoiceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingInvoiceUploadRef = useRef<{ campaignId: string; customerId: string } | null>(null);

  const openInfluencersModal = (customer: Customer) => {
    setSelectedCustomerForInfluencers(customer);
    setShowInfluencersModal(true);
  };

  const closeInfluencersModal = () => {
    setShowInfluencersModal(false);
    setSelectedCustomerForInfluencers(null);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchCustomers(searchQuery);
      } else {
        loadCustomers();
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const data = await api.getCustomers() as Customer[];
      setCustomers(data);
      // Load campaigns for all customers
      for (const customer of data) {
        loadCampaigns(customer.id);
      }
    } catch (error) {
      showToast('error', 'שגיאה בטעינת לקוחות');
    } finally {
      setIsLoading(false);
    }
  };

  const searchCustomers = async (query: string) => {
    try {
      const data = await api.searchCustomers(query) as Customer[];
      setCustomers(data);
    } catch (error) {
      showToast('error', 'שגיאה בחיפוש');
    }
  };

  const handleCreateCustomer = async (data: CustomerFormData) => {
    try {
      const newCustomer = await api.createCustomer(data) as Customer;
      setCustomers((prev) => [newCustomer, ...prev]);
      setShowModal(false);
      showToast('success', 'הלקוח נוצר בהצלחה');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'שגיאה ביצירת לקוח');
    }
  };

  const handleUpdateCustomer = async (data: CustomerFormData) => {
    if (!editingCustomer) return;

    try {
      const updatedCustomer = await api.updateCustomer(editingCustomer.id, data) as Customer;
      setCustomers((prev) =>
        prev.map((c) => (c.id === editingCustomer.id ? updatedCustomer : c))
      );
      setEditingCustomer(null);
      setShowModal(false);
      showToast('success', 'הלקוח עודכן בהצלחה');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'שגיאה בעדכון לקוח');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'מחיקת לקוח',
      text: 'האם אתה בטוח שברצונך למחוק לקוח זה?',
      showCancelButton: true,
      confirmButtonText: 'מחק',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await api.deleteCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      showToast('success', 'הלקוח נמחק בהצלחה');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'שגיאה במחיקת לקוח');
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
  };

  // Campaign handlers
  const openCampaignModal = (customer: Customer) => {
    setSelectedCustomerForCampaign(customer);
    setShowCampaignModal(true);
  };

  const closeCampaignModal = () => {
    setShowCampaignModal(false);
    setSelectedCustomerForCampaign(null);
  };

  const openInvoice = (dataUrl: string) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      if (dataUrl.startsWith('data:application/pdf')) {
        newWindow.document.write(`<iframe src="${dataUrl}" style="width:100%;height:100%;border:none;"></iframe>`);
      } else {
        newWindow.document.write(`<img src="${dataUrl}" style="max-width:100%;height:auto;" />`);
      }
      newWindow.document.title = 'חשבונית';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteCampaign = async (campaign: Campaign, customerId: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'מחיקת קמפיין',
      text: `האם למחוק את הקמפיין "${campaign.campaign_name}"?`,
      showCancelButton: true,
      confirmButtonText: 'מחק',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await api.deleteCampaign(campaign.id);
      setCampaigns(prev => ({
        ...prev,
        [customerId]: (prev[customerId] || []).filter(c => c.id !== campaign.id)
      }));
      showToast('success', 'הקמפיין נמחק בהצלחה');
    } catch (err) {
      showToast('error', 'שגיאה במחיקת הקמפיין');
    }
  };

  const handleCreateCampaign = async (data: CampaignFormData) => {
    if (!selectedCustomerForCampaign) return;

    try {
      setIsSavingCampaign(true);
      const customerId = selectedCustomerForCampaign.id;
      let invoiceUrl: string | null = null;
      if (data.invoice_file) {
        invoiceUrl = await fileToBase64(data.invoice_file);
      }

      const newCampaign = await api.createCampaign(customerId, {
        campaign_name: data.campaign_name,
        influencers: data.influencers,
        invoice_url: invoiceUrl,
        bank_details: data.bank_details,
        cost: data.cost,
        is_paid: data.is_paid,
        project_type: data.project_type
      }) as Campaign;

      setCampaigns(prev => ({
        ...prev,
        [customerId]: [...(prev[customerId] || []), newCampaign]
      }));

      closeCampaignModal();
      showToast('success', 'הקמפיין נוסף בהצלחה');
      setExpandedCustomerId(customerId);
      // Reload campaigns from server to ensure consistency
      loadCampaigns(customerId);
    } catch (err) {
      showToast('error', 'שגיאה ביצירת הקמפיין');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const toggleExpand = (customerId: string) => {
    const newId = expandedCustomerId === customerId ? null : customerId;
    setExpandedCustomerId(newId);
    if (newId && !campaigns[newId]) {
      loadCampaigns(newId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getCustomerCampaigns = (customerId: string): Campaign[] => {
    return campaigns[customerId] || [];
  };

  const getCustomerProjectTypes = (customerId: string): ProjectTypeId[] => {
    const seen = new Set<ProjectTypeId>();
    for (const c of getCustomerCampaigns(customerId)) {
      seen.add((c.project_type ?? DEFAULT_PROJECT_TYPE) as ProjectTypeId);
    }
    return Array.from(seen);
  };

  const getCustomerProjectTypesLabel = (customerId: string): string => {
    const ids = getCustomerProjectTypes(customerId);
    if (ids.length === 0) return '—';
    return ids.map(id => getProjectTypeLabel(id)).join(', ');
  };

  // Filter customers shown in the table based on selected project type
  const visibleCustomers = customers.filter((c) => {
    if (typeFilter === 'all') return true;
    return getCustomerProjectTypes(c.id).includes(typeFilter);
  });

  const triggerInvoiceUpload = (campaign: Campaign, customerId: string) => {
    pendingInvoiceUploadRef.current = { campaignId: campaign.id, customerId };
    invoiceUploadInputRef.current?.click();
  };

  const handleInvoiceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pending = pendingInvoiceUploadRef.current;
    // reset the input so the same file can be re-picked later
    if (invoiceUploadInputRef.current) invoiceUploadInputRef.current.value = '';
    if (!file || !pending) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      showToast('error', 'יש להעלות תמונה או PDF בלבד');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'גודל הקובץ חייב להיות עד 5MB');
      return;
    }

    try {
      const dataUrl = await fileToBase64(file);
      const updated = await api.updateCampaign(pending.campaignId, { invoice_url: dataUrl }) as Campaign;
      setCampaigns(prev => ({
        ...prev,
        [pending.customerId]: (prev[pending.customerId] || []).map(c =>
          c.id === pending.campaignId ? { ...c, ...updated } : c
        )
      }));
      showToast('success', 'החשבונית הועלתה בהצלחה');
    } catch (err) {
      showToast('error', 'שגיאה בהעלאת החשבונית');
    } finally {
      pendingInvoiceUploadRef.current = null;
    }
  };

  const loadCampaigns = async (customerId: string) => {
    try {
      const data = await api.getCampaigns(customerId) as Campaign[];
      setCampaigns(prev => ({ ...prev, [customerId]: data }));
    } catch (err) {
      console.error('Load campaigns error:', err);
    }
  };

  const handleTogglePaymentStatus = async (campaign: Campaign, customerId: string) => {
    const newStatus = !campaign.is_paid;
    const statusText = newStatus ? 'שולם' : 'לא שולם';

    const result = await Swal.fire({
      icon: 'question',
      title: 'שינוי סטטוס תשלום',
      text: `האם לשנות את הסטטוס ל"${statusText}"?`,
      showCancelButton: true,
      confirmButtonText: 'אישור',
      cancelButtonText: 'ביטול',
      confirmButtonColor: newStatus ? '#22c55e' : '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await api.updateCampaign(campaign.id, { is_paid: newStatus });

      setCampaigns(prev => ({
        ...prev,
        [customerId]: (prev[customerId] || []).map(c =>
          c.id === campaign.id ? { ...c, is_paid: newStatus } : c
        )
      }));

      showToast('success', `סטטוס התשלום שונה ל"${statusText}"`);
    } catch (err) {
      showToast('error', 'שגיאה בעדכון סטטוס התשלום');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark-900">לקוחות</h1>
            <p className="text-dark-500 mt-1">ניהול רשימת הלקוחות</p>
          </div>
          <Button size="lg" onClick={() => setShowModal(true)} className="w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            לקוח חדש
          </Button>
        </div>

        {/* Search + Type Filter */}
        <Card>
          <CardBody className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, טלפון או מייל..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-dark-500 ml-2">סוג פרוייקט:</span>
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-100 text-dark-700 hover:bg-dark-200'
                }`}
              >
                הכל
              </button>
              {PROJECT_TYPES.map((t) => {
                const Icon = t.icon;
                const active = typeFilter === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTypeFilter(t.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                      active
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-100 text-dark-700 hover:bg-dark-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Customers List */}
        <Card>
          {isLoading ? (
            <CardBody className="py-12">
              <Loading text="טוען לקוחות..." />
            </CardBody>
          ) : visibleCustomers.length === 0 ? (
            <CardBody className="py-12 text-center">
              <p className="text-dark-500 mb-4">
                {searchQuery
                  ? 'לא נמצאו לקוחות התואמים לחיפוש'
                  : typeFilter !== 'all'
                    ? `אין לקוחות עם פרוייקט מסוג "${getProjectTypeLabel(typeFilter)}"`
                    : 'אין לקוחות עדיין'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowModal(true)}>
                  <Plus className="w-5 h-5" />
                  הוסף לקוח ראשון
                </Button>
              )}
            </CardBody>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto" dir="rtl">
                <table className="w-full text-right">
                  <thead className="bg-dark-50 border-b border-dark-200">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">שם לקוח</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">ת.ז / ח.פ</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">טלפון</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">דוא״ל</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">הצעה</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-200">
                    {visibleCustomers.map((customer) => {
                      const customerCampaigns = getCustomerCampaigns(customer.id);
                      const isExpanded = expandedCustomerId === customer.id;

                      return (
                        <Fragment key={customer.id}>
                          <tr className="hover:bg-dark-50">
                            <td className="px-6 py-4 font-medium text-dark-900">
                              {customer.full_name}
                            </td>
                            <td className="px-6 py-4 text-dark-600">
                              {customer.doc_number || '-'}
                            </td>
                            <td className="px-6 py-4 text-dark-600">
                              <span dir="ltr">{customer.phone}</span>
                            </td>
                            <td className="px-6 py-4 text-dark-600">
                              <span dir="ltr">{customer.email}</span>
                            </td>
                            <td className="px-6 py-4 text-dark-600">
                              {getCustomerProjectTypesLabel(customer.id)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEditModal(customer)}
                                  className="p-2 rounded-lg hover:bg-dark-100 text-dark-600 hover:text-dark-900"
                                  title="עריכה"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomer(customer.id)}
                                  className="p-2 rounded-lg hover:bg-red-100 text-dark-600 hover:text-red-600"
                                  title="מחק"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openCampaignModal(customer)}
                                  className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
                                  title="העלאת פרטים"
                                >
                                  <FileUp className="w-4 h-4" />
                                  העלאת פרטים
                                </button>
                                <button
                                  onClick={() => openInfluencersModal(customer)}
                                  className="px-3 py-1.5 text-sm bg-dark-100 text-dark-700 rounded-lg hover:bg-dark-200 transition-colors flex items-center gap-1"
                                  title="משפיענים"
                                >
                                  <Users className="w-4 h-4" />
                                  משפיענים
                                </button>
                                {customerCampaigns.length > 0 && (
                                  <button
                                    onClick={() => toggleExpand(customer.id)}
                                    className="px-3 py-1.5 text-sm bg-dark-100 text-dark-700 rounded-lg hover:bg-dark-200 transition-colors flex items-center gap-1"
                                  >
                                    פרטים נוספים
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Campaigns Row */}
                          {isExpanded && customerCampaigns.length > 0 && (
                            <tr key={`${customer.id}-campaigns`}>
                              <td colSpan={6} className="px-6 py-4 bg-dark-50">
                                <div className="overflow-x-auto">
                                  <table className="w-full border border-dark-200 rounded-lg overflow-hidden">
                                    <thead className="bg-dark-100">
                                      <tr>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-dark-700">שם הקמפיין</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-dark-700">משפיענים</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-dark-700">חשבוניות</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-dark-700">פרטי חשבון</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-dark-700">עלות</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-dark-700">שולם</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-dark-700"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-dark-200">
                                      {customerCampaigns.map((campaign) => (
                                        <tr key={campaign.id}>
                                          <td className="px-4 py-3 text-dark-900 font-medium">
                                            {campaign.campaign_name}
                                          </td>
                                          <td className="px-4 py-3 text-dark-600">
                                            {campaign.influencers}
                                          </td>
                                          <td className="px-4 py-3">
                                            {campaign.invoice_url ? (
                                              <button
                                                onClick={() => openInvoice(campaign.invoice_url!)}
                                                className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                              >
                                                <Eye className="w-4 h-4" />
                                                קישור
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => triggerInvoiceUpload(campaign, customer.id)}
                                                className="px-2.5 py-1 text-xs bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors flex items-center gap-1"
                                                title="העלאת חשבונית"
                                              >
                                                <FileUp className="w-3.5 h-3.5" />
                                                העלאת חשבונית
                                              </button>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-dark-600 text-sm">
                                            {campaign.bank_details || '-'}
                                          </td>
                                          <td className="px-4 py-3 text-dark-900 font-medium">
                                            {formatCurrency(campaign.cost)}
                                          </td>
                                          <td className="px-4 py-3">
                                            <button
                                              onClick={() => handleTogglePaymentStatus(campaign, customer.id)}
                                              className={`w-5 h-5 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-2 transition-all ${
                                                campaign.is_paid ? 'bg-green-500 hover:ring-green-300' : 'bg-red-500 hover:ring-red-300'
                                              }`}
                                              title={campaign.is_paid ? 'לחץ לשינוי ללא שולם' : 'לחץ לשינוי לשולם'}
                                            ></button>
                                          </td>
                                          <td className="px-4 py-3">
                                            <button
                                              onClick={() => handleDeleteCampaign(campaign, customer.id)}
                                              className="text-red-400 hover:text-red-600 transition"
                                              title="מחק קמפיין"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-dark-200">
                {visibleCustomers.map((customer) => {
                  const customerCampaigns = getCustomerCampaigns(customer.id);
                  const isExpanded = expandedCustomerId === customer.id;

                  return (
                    <div key={customer.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-dark-900">{customer.full_name}</p>
                          {customer.doc_number && (
                            <p className="text-sm text-dark-500">{customer.doc_number}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-2 rounded-lg hover:bg-dark-100"
                          >
                            <Edit2 className="w-4 h-4 text-dark-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="p-2 rounded-lg hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm mb-3">
                        <a
                          href={`tel:${customer.phone}`}
                          className="flex items-center gap-1 text-dark-600 hover:text-primary-600"
                        >
                          <Phone className="w-4 h-4" />
                          <span dir="ltr">{customer.phone}</span>
                        </a>
                        <a
                          href={`mailto:${customer.email}`}
                          className="flex items-center gap-1 text-dark-600 hover:text-primary-600"
                        >
                          <Mail className="w-4 h-4" />
                          <span dir="ltr" className="truncate max-w-[150px]">{customer.email}</span>
                        </a>
                      </div>

                      {/* Mobile Actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => openCampaignModal(customer)}
                          className="flex-1 px-3 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-1"
                        >
                          <FileUp className="w-4 h-4" />
                          העלאת פרטים
                        </button>
                        <button
                          onClick={() => openInfluencersModal(customer)}
                          className="flex-1 px-3 py-2 text-sm bg-dark-100 text-dark-700 rounded-lg hover:bg-dark-200 transition-colors flex items-center justify-center gap-1"
                        >
                          <Users className="w-4 h-4" />
                          משפיענים
                        </button>
                        {customerCampaigns.length > 0 && (
                          <button
                            onClick={() => toggleExpand(customer.id)}
                            className="flex-1 px-3 py-2 text-sm bg-dark-100 text-dark-700 rounded-lg hover:bg-dark-200 transition-colors flex items-center justify-center gap-1"
                          >
                            פרטים נוספים
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Mobile Expanded Campaigns */}
                      {isExpanded && customerCampaigns.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {customerCampaigns.map((campaign) => (
                            <div key={campaign.id} className="bg-dark-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <p className="font-medium text-dark-900">{campaign.campaign_name}</p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleTogglePaymentStatus(campaign, customer.id)}
                                    className={`w-5 h-5 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-2 transition-all ${
                                      campaign.is_paid ? 'bg-green-500 hover:ring-green-300' : 'bg-red-500 hover:ring-red-300'
                                    }`}
                                    title={campaign.is_paid ? 'לחץ לשינוי ללא שולם' : 'לחץ לשינוי לשולם'}
                                  ></button>
                                  <button
                                    onClick={() => handleDeleteCampaign(campaign, customer.id)}
                                    className="text-red-400 hover:text-red-600 transition"
                                    title="מחק קמפיין"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-sm space-y-1">
                                <p><span className="text-dark-500">משפיענים:</span> {campaign.influencers}</p>
                                <p><span className="text-dark-500">עלות:</span> ₪{formatCurrency(campaign.cost)}</p>
                                {campaign.bank_details && (
                                  <p><span className="text-dark-500">פרטי חשבון:</span> {campaign.bank_details}</p>
                                )}
                                {campaign.invoice_url ? (
                                  <button
                                    onClick={() => openInvoice(campaign.invoice_url!)}
                                    className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                  >
                                    <Eye className="w-4 h-4" />
                                    צפה בחשבונית
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => triggerInvoiceUpload(campaign, customer.id)}
                                    className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                  >
                                    <FileUp className="w-4 h-4" />
                                    העלאת חשבונית
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Create/Edit Customer Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingCustomer ? 'עריכת לקוח' : 'הוספת לקוח חדש'}
        size="md"
      >
        <div className="p-6">
          <CustomerForm
            initialData={editingCustomer ? {
              full_name: editingCustomer.full_name,
              doc_number: editingCustomer.doc_number || '',
              phone: editingCustomer.phone,
              email: editingCustomer.email
            } : undefined}
            onSubmit={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
            onCancel={closeModal}
            submitLabel={editingCustomer ? 'עדכן' : 'הוסף'}
          />
        </div>
      </Modal>

      {/* Campaign Modal */}
      <Modal
        isOpen={showCampaignModal}
        onClose={closeCampaignModal}
        title={`העלאת פרטים - ${selectedCustomerForCampaign?.full_name || ''}`}
        size="md"
      >
        <div className="p-6">
          <CampaignForm
            initialData={typeFilter !== 'all' ? { project_type: typeFilter } : undefined}
            onSubmit={handleCreateCampaign}
            onCancel={closeCampaignModal}
            submitLabel="שמור"
            isLoading={isSavingCampaign}
          />
        </div>
      </Modal>

      {/* Influencers Modal */}
      <InfluencersModal
        customer={selectedCustomerForInfluencers}
        isOpen={showInfluencersModal}
        onClose={closeInfluencersModal}
      />

      {/* Hidden file input for one-shot invoice upload */}
      <input
        ref={invoiceUploadInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleInvoiceFileSelected}
      />
    </Layout>
  );
}
