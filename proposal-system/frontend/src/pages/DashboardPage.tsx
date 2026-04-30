import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Plus, Download, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { api } from '../services/api';
import { openContractPDF } from '../services/pdfGenerator';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Loading } from '../components/ui/Loading';
import { useToast } from '../components/ui/Toast';
import type { Proposal, PaginatedResponse, ProposalStatus } from '../types';
import { isProjectType, getProjectTypeLabel } from '../config/projectTypes';

export function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const projectType = isProjectType(typeParam) ? typeParam : undefined;
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProposals();
  }, [statusFilter, projectType]);

  // Auto-refresh proposals every 10 seconds to catch status updates (e.g., when client signs)
  useEffect(() => {
    const interval = setInterval(() => {
      loadProposals(true); // silent refresh - no loading spinner
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [statusFilter, projectType]);

  const loadProposals = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await api.getProposals({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        project_type: projectType,
      }) as PaginatedResponse<Proposal>;
      setProposals(response.data);
    } catch (error) {
      if (!silent) showToast('error', 'שגיאה בטעינת הצעות');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'מחיקת הצעה',
      text: 'האם אתה בטוח שברצונך למחוק הצעה זו?',
      showCancelButton: true,
      confirmButtonText: 'מחק',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await api.deleteProposal(id);
      showToast('success', 'ההצעה נמחקה בהצלחה');
      loadProposals();
    } catch (error) {
      showToast('error', 'שגיאה במחיקת ההצעה');
    }
  };

  const handleDownloadPDF = async (proposal: Proposal) => {
    try {
      // First try to get proposal with contract_data
      const fullProposal = await api.getProposal(proposal.id) as any;

      if (fullProposal?.contract_data) {
        // Use frontend PDF generator with template images (supports Hebrew)
        await openContractPDF({
          customerName: fullProposal.contract_data.customerName || proposal.customer?.full_name || '',
          date: fullProposal.contract_data.date || proposal.proposal_date,
          forText: fullProposal.contract_data.forText || '',
          platforms: fullProposal.contract_data.platforms || [],
          whatYouGet: fullProposal.contract_data.whatYouGet || '',
          cost: fullProposal.contract_data.cost || proposal.total
        });
      } else {
        // Fallback: use contract data based on proposal info
        await openContractPDF({
          customerName: proposal.customer?.full_name || '',
          date: proposal.proposal_date,
          forText: proposal.customer?.full_name || '',
          platforms: [],
          whatYouGet: '',
          cost: proposal.total
        });
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast('error', 'שגיאה בהורדת PDF');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  const filteredProposals = proposals.filter((p) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      p.customer?.full_name?.toLowerCase().includes(search) ||
      p.customer?.phone?.includes(search) ||
      p.customer?.email?.toLowerCase().includes(search) ||
      p.order_number.toString().includes(search)
    );
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark-900">
              הצעות מחיר{projectType ? ` — ${getProjectTypeLabel(projectType)}` : ''}
            </h1>
            <p className="text-dark-500 mt-1">ניהול וצפייה בהצעות המחיר</p>
          </div>
          <Link to={projectType ? `/proposals/new?type=${projectType}` : '/proposals/new'}>
            <Button size="lg" className="w-full sm:w-auto">
              <Plus className="w-5 h-5" />
              הצעה חדשה
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  placeholder="חיפוש לפי שם, טלפון, מייל או מספר הזמנה..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-dark-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">כל הסטטוסים</option>
                  <option value="draft">טיוטה</option>
                  <option value="sent">נשלח</option>
                  <option value="signed">נחתם</option>
                  <option value="void">בוטל</option>
                </select>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Table */}
        <Card>
          {isLoading ? (
            <CardBody className="py-12">
              <Loading text="טוען הצעות..." />
            </CardBody>
          ) : filteredProposals.length === 0 ? (
            <CardBody className="py-12 text-center">
              <p className="text-dark-500">לא נמצאו הצעות</p>
              <Link to={projectType ? `/proposals/new?type=${projectType}` : '/proposals/new'}>
                <Button variant="outline" className="mt-4">
                  <Plus className="w-5 h-5" />
                  צור הצעה חדשה
                </Button>
              </Link>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop Table */}
              <table className="w-full hidden lg:table">
                <thead className="bg-dark-50 border-b border-dark-200">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">מס׳</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">שם לקוח</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">טלפון</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">דוא״ל</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">סכום</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">מס׳ הזמנה</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">תאריך</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">סטטוס</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-dark-700">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200">
                  {filteredProposals.map((proposal) => (
                    <tr key={proposal.id} className="hover:bg-dark-50">
                      <td className="px-6 py-4 text-sm text-dark-900 font-medium">
                        {proposal.row_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-900">
                        {proposal.customer?.full_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-600" dir="ltr">
                        {proposal.customer?.phone}
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-600" dir="ltr">
                        {proposal.customer?.email}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-primary-600">
                        {formatCurrency(proposal.total)}
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-600">
                        {proposal.order_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-600">
                        {formatDate(proposal.proposal_date)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={proposal.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/proposals/${proposal.id}`)}
                            className="p-2 rounded-lg hover:bg-dark-100 text-dark-600 hover:text-dark-900"
                            title="עריכה"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(proposal)}
                            className="p-2 rounded-lg hover:bg-dark-100 text-dark-600 hover:text-dark-900"
                            title="הורד PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(proposal.id)}
                            className="p-2 rounded-lg hover:bg-red-100 text-dark-600 hover:text-red-600"
                            title="מחק"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-dark-200">
                {filteredProposals.map((proposal) => (
                  <div key={proposal.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-dark-900">
                          {proposal.customer?.full_name}
                        </p>
                        <p className="text-sm text-dark-500">
                          מס׳ הזמנה: {proposal.order_number}
                        </p>
                      </div>
                      <StatusBadge status={proposal.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark-600">{formatDate(proposal.proposal_date)}</span>
                      <span className="font-semibold text-primary-600">
                        {formatCurrency(proposal.total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/proposals/${proposal.id}`)}
                        className="flex-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        עריכה
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPDF(proposal)}
                        className="flex-1"
                      >
                        <Download className="w-4 h-4" />
                        PDF
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(proposal.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
