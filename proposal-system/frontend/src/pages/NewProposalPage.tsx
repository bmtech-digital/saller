import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, Check } from 'lucide-react';
import { api } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { CustomerForm } from '../components/forms/CustomerForm';
import { Loading } from '../components/ui/Loading';
import { useToast } from '../components/ui/Toast';
import type { Customer, CustomerFormData } from '../types';

export function NewProposalPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [proposalDate, setProposalDate] = useState(new Date().toISOString().split('T')[0]);

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
      setIsSearching(true);
      const data = await api.getCustomers() as Customer[];
      setCustomers(data);
    } catch (error) {
      showToast('error', 'שגיאה בטעינת לקוחות');
    } finally {
      setIsSearching(false);
    }
  };

  const searchCustomers = async (query: string) => {
    try {
      setIsSearching(true);
      const data = await api.searchCustomers(query) as Customer[];
      setCustomers(data);
    } catch (error) {
      showToast('error', 'שגיאה בחיפוש');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateCustomer = async (data: CustomerFormData) => {
    try {
      const newCustomer = await api.createCustomer(data) as Customer;
      setCustomers((prev) => [newCustomer, ...prev]);
      setSelectedCustomer(newCustomer);
      setShowNewCustomerModal(false);
      showToast('success', 'הלקוח נוצר בהצלחה');
      setStep(2);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'שגיאה ביצירת לקוח');
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setStep(2);
  };

  const handleCreateProposal = async () => {
    if (!selectedCustomer) return;

    try {
      setIsLoading(true);
      const proposal = await api.createProposal({
        customer_id: selectedCustomer.id,
        proposal_date: proposalDate,
      }) as { id: string };

      showToast('success', 'ההצעה נוצרה בהצלחה');
      navigate(`/proposals/${proposal.id}`);
    } catch (error) {
      showToast('error', 'שגיאה ביצירת ההצעה');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-dark-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-dark-900">יצירת הצעה חדשה</h1>
            <p className="text-dark-500">בחר לקוח והזן את פרטי ההצעה</p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-600' : 'text-dark-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-primary-500 text-white' : 'bg-dark-200'
            }`}>
              {step > 1 ? <Check className="w-5 h-5" /> : '1'}
            </div>
            <span className="hidden sm:inline font-medium">בחירת לקוח</span>
          </div>
          <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-primary-500' : 'bg-dark-200'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-600' : 'text-dark-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-primary-500 text-white' : 'bg-dark-200'
            }`}>
              2
            </div>
            <span className="hidden sm:inline font-medium">פרטי הצעה</span>
          </div>
        </div>

        {/* Step 1: Select Customer */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-semibold">בחירת לקוח</h2>
                <Button
                  variant="outline"
                  onClick={() => setShowNewCustomerModal(true)}
                >
                  <UserPlus className="w-5 h-5" />
                  לקוח חדש
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  placeholder="חיפוש לפי שם, טלפון או מייל..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Customer List */}
              {isSearching ? (
                <div className="py-8">
                  <Loading text="מחפש..." />
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark-500 mb-4">לא נמצאו לקוחות</p>
                  <Button onClick={() => setShowNewCustomerModal(true)}>
                    <UserPlus className="w-5 h-5" />
                    הוסף לקוח חדש
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-dark-200 max-h-96 overflow-y-auto">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full flex items-center justify-between p-4 hover:bg-dark-50 transition-colors text-right"
                    >
                      <div>
                        <p className="font-medium text-dark-900">{customer.full_name}</p>
                        <p className="text-sm text-dark-500" dir="ltr">
                          {customer.phone} • {customer.email}
                        </p>
                      </div>
                      <div className="text-primary-500">
                        <ArrowLeft className="w-5 h-5 rotate-180" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Step 2: Proposal Details */}
        {step === 2 && selectedCustomer && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">פרטי ההצעה</h2>
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-primary-600 hover:underline"
                >
                  שנה לקוח
                </button>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Selected Customer Info */}
              <div className="p-4 bg-dark-50 rounded-lg">
                <p className="text-sm text-dark-500 mb-1">לקוח נבחר</p>
                <p className="font-semibold text-dark-900">{selectedCustomer.full_name}</p>
                <p className="text-sm text-dark-600" dir="ltr">
                  {selectedCustomer.phone} • {selectedCustomer.email}
                </p>
              </div>

              {/* Proposal Date */}
              <Input
                label="תאריך הצעה"
                type="date"
                value={proposalDate}
                onChange={(e) => setProposalDate(e.target.value)}
                dir="ltr"
              />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={handleCreateProposal}
                  isLoading={isLoading}
                  className="flex-1"
                  size="lg"
                >
                  צור הצעה והמשך לעריכה
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="sm:w-auto"
                >
                  חזור
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* New Customer Modal */}
        <Modal
          isOpen={showNewCustomerModal}
          onClose={() => setShowNewCustomerModal(false)}
          title="הוספת לקוח חדש"
          size="md"
        >
          <div className="p-6">
            <CustomerForm
              onSubmit={handleCreateCustomer}
              onCancel={() => setShowNewCustomerModal(false)}
              submitLabel="הוסף לקוח"
            />
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
