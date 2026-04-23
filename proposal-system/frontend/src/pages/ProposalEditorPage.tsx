import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  ArrowLeft,
  FileText,
  Send,
  Mail,
  MessageCircle,
  Smartphone,
  Eye,
  Save,
  Loader2,
  Check,
  Link2
} from 'lucide-react';
import { api } from '../services/api';
import { openContractPDF } from '../services/pdfGenerator';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ContractForm } from '../components/ContractForm';
import type { PlatformId } from '../config/pdfCoordinates';
import { Loading, LoadingOverlay } from '../components/ui/Loading';
import { useToast } from '../components/ui/Toast';
import type { ProposalWithDetails, ProposalBlock as BlockType, SendChannel, BlockTextItem } from '../types';

export function ProposalEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [proposal, setProposal] = useState<ProposalWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<SendChannel | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [showWhatsappOptions, setShowWhatsappOptions] = useState(false);
  const [showManualPhoneInput, setShowManualPhoneInput] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [contractData, setContractData] = useState({
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    forText: '',
    platforms: [] as PlatformId[],
    whatYouGet: '',
    cost: 0
  });

  const handleContractChange = (data: typeof contractData) => {
    setContractData(data);
  };

  useEffect(() => {
    if (id) loadProposal();
  }, [id]);

  const loadProposal = async () => {
    try {
      setIsLoading(true);
      const data = await api.getProposal(id!) as ProposalWithDetails;
      setProposal(data);

      // Populate contract form with existing data if available
      if (data.contract_data) {
        setContractData({
          customerName: data.contract_data.customerName || data.customer.full_name,
          date: data.contract_data.date || new Date().toISOString().split('T')[0],
          forText: data.contract_data.forText || '',
          platforms: (data.contract_data.platforms || []) as PlatformId[],
          whatYouGet: data.contract_data.whatYouGet || '',
          cost: data.contract_data.cost || 0
        });
      }
    } catch (error) {
      showToast('error', 'שגיאה בטעינת ההצעה');
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBlock = async (blockId: string, data: Partial<BlockType>) => {
    if (!proposal) return;

    try {
      await api.updateBlock(proposal.id, blockId, data);

      // Calculate new line_total and update totals locally
      setProposal((prev) => {
        if (!prev) return prev;

        const updatedBlocks = prev.blocks.map((b): BlockType => {
          if (b.id !== blockId) return b;
          const newUnitPrice = data.unit_price ?? b.unit_price;
          const newQuantity = data.quantity ?? b.quantity;
          return {
            ...b,
            ...data,
            unit_price: newUnitPrice,
            quantity: newQuantity,
            line_total: newUnitPrice * newQuantity
          };
        });

        // Recalculate totals locally
        const subtotal = updatedBlocks.reduce((sum, b) => sum + b.line_total, 0);
        const vatAmount = Math.round(subtotal * prev.vat_rate * 100) / 100;
        const total = Math.round((subtotal + vatAmount) * 100) / 100;

        return {
          ...prev,
          blocks: updatedBlocks,
          subtotal,
          vat_amount: vatAmount,
          total,
        };
      });
    } catch (error) {
      showToast('error', 'שגיאה בעדכון הבלוק');
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!proposal) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'מחיקת פריט',
      text: 'האם למחוק את הפריט?',
      showCancelButton: true,
      confirmButtonText: 'מחק',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await api.deleteBlock(proposal.id, blockId);
      setProposal((prev) => {
        if (!prev) return prev;
        const updatedBlocks = prev.blocks.filter((b) => b.id !== blockId);
        const subtotal = updatedBlocks.reduce((sum, b) => sum + b.line_total, 0);
        const vatAmount = Math.round(subtotal * prev.vat_rate * 100) / 100;
        const total = Math.round((subtotal + vatAmount) * 100) / 100;
        return {
          ...prev,
          blocks: updatedBlocks,
          subtotal,
          vat_amount: vatAmount,
          total,
        };
      });
      showToast('success', 'הבלוק נמחק');
    } catch (error) {
      showToast('error', 'שגיאה במחיקת הבלוק');
    }
  };

  const handleAddTextItem = async (blockId: string, content: string) => {
    if (!proposal) return;

    try {
      const newItem = await api.addTextItem(proposal.id, blockId, content) as BlockTextItem;
      setProposal((prev) => ({
        ...prev!,
        blocks: prev!.blocks.map((b) =>
          b.id === blockId
            ? { ...b, text_items: [...(b.text_items || []), newItem] }
            : b
        ),
      }));
    } catch (error) {
      showToast('error', 'שגיאה בהוספת טקסט');
    }
  };

  const handleUpdateTextItem = async (textItemId: string, content: string) => {
    if (!proposal) return;

    try {
      await api.updateTextItem(proposal.id, textItemId, { content });
      setProposal((prev) => ({
        ...prev!,
        blocks: prev!.blocks.map((b) => ({
          ...b,
          text_items: b.text_items?.map((t) =>
            t.id === textItemId ? { ...t, content } : t
          ),
        })),
      }));
    } catch (error) {
      showToast('error', 'שגיאה בעדכון טקסט');
    }
  };

  const handleDeleteTextItem = async (textItemId: string) => {
    if (!proposal) return;

    try {
      await api.deleteTextItem(proposal.id, textItemId);
      setProposal((prev) => ({
        ...prev!,
        blocks: prev!.blocks.map((b) => ({
          ...b,
          text_items: b.text_items?.filter((t) => t.id !== textItemId),
        })),
      }));
    } catch (error) {
      showToast('error', 'שגיאה במחיקת טקסט');
    }
  };

  const handleGeneratePDF = async () => {
    if (!proposal) return;

    try {
      setIsSaving(true);
      await openContractPDF({
        customerName: contractData.customerName || proposal.customer.full_name,
        date: contractData.date,
        forText: contractData.forText,
        platforms: contractData.platforms,
        whatYouGet: contractData.whatYouGet,
        cost: contractData.cost
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast('error', 'שגיאה ביצירת PDF');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendProposal = async (channel: SendChannel) => {
    if (!proposal) return;

    try {
      setSendingChannel(channel);
      const response = await api.sendProposal(proposal.id, channel, {
        customerName: contractData.customerName || proposal.customer.full_name,
        date: contractData.date,
        forText: contractData.forText,
        platforms: contractData.platforms,
        whatYouGet: contractData.whatYouGet,
        cost: contractData.cost
      }) as {
        message: string;
        sign_url: string;
        whatsapp_link?: string;
      };

      if (channel === 'whatsapp' && response.whatsapp_link) {
        setWhatsappLink(response.whatsapp_link);
      } else {
        showToast('success', response.message);
        setShowSendModal(false);
        loadProposal();
      }
    } catch (error) {
      showToast('error', 'שגיאה בשליחת ההצעה');
    } finally {
      setSendingChannel(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loading size="lg" text="טוען הצעה..." />
        </div>
      </Layout>
    );
  }

  if (!proposal) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-dark-500">ההצעה לא נמצאה</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            חזור לדשבורד
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-32">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-dark-100 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <img src="/logo/logo.png" alt="Logo" className="h-10 sm:h-12 w-auto hidden sm:block" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold text-dark-900">
                  הצעת מחיר #{String(proposal.row_number).padStart(4, '0')}
                </h1>
                <StatusBadge status={proposal.status} />
              </div>
              <p className="text-dark-500 text-xs sm:text-base truncate">
                {proposal.customer.full_name} • {new Date(proposal.proposal_date).toLocaleDateString('he-IL')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/')} className="!w-full sm:!w-auto">
              <Check className="w-5 h-5" />
              <span className="hidden sm:inline">בוצע</span>
            </Button>
            <Button variant="outline" onClick={handleGeneratePDF} disabled={isSaving} className="!w-full sm:!w-auto">
              <Eye className="w-5 h-5" />
              <span className="hidden sm:inline">הצג PDF</span>
            </Button>
            <Button onClick={() => setShowSendModal(true)} className="!w-full sm:!w-auto">
              <Send className="w-5 h-5" />
              <span className="hidden sm:inline">שלח ללקוח</span>
            </Button>
          </div>
        </div>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">פרטי לקוח</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-dark-500">שם</p>
                <p className="font-medium">{proposal.customer.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">ת.ז / ח.פ</p>
                <p className="font-medium">{proposal.customer.doc_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">טלפון</p>
                <p className="font-medium" dir="ltr">{proposal.customer.phone}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">דוא״ל</p>
                <p className="font-medium" dir="ltr">{proposal.customer.email}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Contract Form */}
        <ContractForm
          customerName={proposal.customer.full_name}
          initialData={contractData}
          onChange={handleContractChange}
        />
      </div>

      {/* Fixed Totals Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:right-64 bg-dark-900 text-white shadow-lg z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 sm:gap-8">
              <div className="text-center sm:text-right">
                <p className="text-dark-400 text-[10px] sm:text-sm">לפני מע״מ</p>
                <p className="text-sm sm:text-xl font-semibold">{formatCurrency(proposal.subtotal)}</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-dark-400 text-[10px] sm:text-sm">מע״מ ({(proposal.vat_rate * 100).toFixed(0)}%)</p>
                <p className="text-sm sm:text-xl font-semibold">{formatCurrency(proposal.vat_amount)}</p>
              </div>
              <div className="text-center sm:text-right sm:border-r sm:border-dark-700 sm:pr-8">
                <p className="text-primary-400 text-[10px] sm:text-sm">סה״כ</p>
                <p className="text-base sm:text-2xl font-bold text-primary-400">{formatCurrency(proposal.total)}</p>
              </div>
            </div>
            <Button onClick={() => setShowSendModal(true)} size="lg" className="w-full sm:w-auto">
              <Send className="w-5 h-5" />
              צור הצעה ושלח
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="תצוגה מקדימה של ההצעה"
        size="lg"
      >
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="text-center border-b border-dark-200 pb-4">
            <img src="/logo/logo.png" alt="Logo" className="h-12 sm:h-16 w-auto mx-auto mb-3" />
            <h2 className="text-xl sm:text-2xl font-bold text-dark-900">הצעת מחיר #{String(proposal.row_number).padStart(4, '0')}</h2>
            <p className="text-dark-500 text-sm sm:text-base">{new Date(proposal.proposal_date).toLocaleDateString('he-IL')}</p>
          </div>

          {/* Customer Info */}
          <div className="bg-dark-50 rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold text-dark-700 mb-2 text-sm sm:text-base">פרטי לקוח</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
              <div><span className="text-dark-500">שם:</span> {proposal.customer.full_name}</div>
              <div><span className="text-dark-500">טלפון:</span> <span dir="ltr">{proposal.customer.phone}</span></div>
              <div><span className="text-dark-500">ת.ז/ח.פ:</span> {proposal.customer.doc_number || '-'}</div>
              <div className="break-all"><span className="text-dark-500">דוא״ל:</span> <span dir="ltr">{proposal.customer.email}</span></div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-dark-700 mb-3 text-sm sm:text-base">פריטים</h3>
            <div className="space-y-2 sm:space-y-3">
              {proposal.blocks.map((block, index) => (
                <div key={block.id} className="border border-dark-200 rounded-lg p-2.5 sm:p-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base">{index + 1}. {block.title}</p>
                      {block.text_items?.map((item) => (
                        <p key={item.id} className="text-xs sm:text-sm text-dark-500 mr-4">{item.content}</p>
                      ))}
                    </div>
                    <div className="flex justify-between sm:block sm:text-left flex-shrink-0">
                      <p className="text-xs sm:text-sm text-dark-500">{block.quantity} × {formatCurrency(block.unit_price)}</p>
                      <p className="font-semibold text-primary-600 text-sm sm:text-base">{formatCurrency(block.line_total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-dark-900 text-white rounded-lg p-3 sm:p-4">
            <div className="flex justify-between mb-2 text-sm sm:text-base">
              <span>סה״כ לפני מע״מ</span>
              <span>{formatCurrency(proposal.subtotal)}</span>
            </div>
            <div className="flex justify-between mb-2 text-sm sm:text-base">
              <span>מע״מ ({(proposal.vat_rate * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(proposal.vat_amount)}</span>
            </div>
            <div className="flex justify-between text-lg sm:text-xl font-bold text-primary-400 pt-2 border-t border-dark-700">
              <span>סה״כ לתשלום</span>
              <span>{formatCurrency(proposal.total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-dark-200">
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(false)}
              className="flex-1 !w-full"
            >
              חזור לעריכה
            </Button>
            <Button
              onClick={() => {
                setShowPreviewModal(false);
                setShowSendModal(true);
              }}
              className="flex-1 !w-full"
            >
              <Send className="w-5 h-5" />
              אשר ושלח ללקוח
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => {
          setShowSendModal(false);
          setWhatsappLink(null);
          setShowWhatsappOptions(false);
          setShowManualPhoneInput(false);
          setManualPhone('');
        }}
        title="שליחת הצעה ללקוח"
        size="md"
      >
        <div className="p-4 sm:p-6 space-y-4">
          {whatsappLink ? (
            <div className="space-y-4">
              <p className="text-dark-600 text-sm sm:text-base">
                לחץ על הכפתור לפתיחת וואטסאפ עם ההודעה המוכנה:
              </p>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-lg w-full bg-green-500 text-white hover:bg-green-600 justify-center"
              >
                <MessageCircle className="w-5 h-5" />
                פתח וואטסאפ
              </a>
              <Button
                variant="outline"
                onClick={() => {
                  setWhatsappLink(null);
                  setShowSendModal(false);
                  loadProposal();
                }}
                className="w-full"
              >
                סיום
              </Button>
            </div>
          ) : (
            <>
              <p className="text-dark-600 mb-4 text-sm sm:text-base">
                בחר אמצעי לשליחת ההצעה אל {proposal.customer.full_name}:
              </p>

              <button
                onClick={handleGeneratePDF}
                disabled={isSaving}
                className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-dark-200 rounded-xl hover:bg-dark-50 transition-colors disabled:opacity-50 mb-4"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-red-500 flex-shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0" />
                )}
                <div className="text-right min-w-0">
                  <p className="font-medium text-sm sm:text-base">הצגת ההסכם ב-PDF</p>
                  <p className="text-xs sm:text-sm text-dark-500">צפה בהצעה לפני השליחה</p>
                </div>
              </button>

              <div className="space-y-2 sm:space-y-3">
                {!showWhatsappOptions ? (
                  <button
                    onClick={() => setShowWhatsappOptions(true)}
                    disabled={sendingChannel !== null}
                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-dark-200 rounded-xl hover:bg-dark-50 transition-colors disabled:opacity-50"
                  >
                    <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                    <div className="text-right min-w-0">
                      <p className="font-medium text-sm sm:text-base">וואטסאפ</p>
                      <p className="text-xs sm:text-sm text-dark-500" dir="ltr">{proposal.customer.phone}</p>
                    </div>
                  </button>
                ) : (
                  <div className="border border-green-300 rounded-xl p-2.5 sm:p-3 bg-green-50 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-green-700 text-sm sm:text-base">בחר אופציה לשליחה בוואטסאפ:</span>
                    </div>
                    <button
                      onClick={() => handleSendProposal('whatsapp')}
                      disabled={sendingChannel !== null}
                      className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border border-green-200 rounded-lg bg-white hover:bg-green-50 transition-colors disabled:opacity-50"
                    >
                      {sendingChannel === 'whatsapp' ? (
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-green-500 flex-shrink-0" />
                      ) : (
                        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      )}
                      <div className="text-right min-w-0">
                        <p className="font-medium text-xs sm:text-sm">שליחה לאנשי קשר בטלפון</p>
                        <p className="text-xs text-dark-500">פותח את אפליקציית וואטסאפ</p>
                      </div>
                    </button>
                    {!showManualPhoneInput ? (
                      <button
                        onClick={() => setShowManualPhoneInput(true)}
                        disabled={sendingChannel !== null}
                        className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border border-green-200 rounded-lg bg-white hover:bg-green-50 transition-colors disabled:opacity-50"
                      >
                        <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                        <div className="text-right min-w-0">
                          <p className="font-medium text-xs sm:text-sm">שליחה למספר טלפון אחר</p>
                          <p className="text-xs text-dark-500">הזן מספר טלפון ידנית</p>
                        </div>
                      </button>
                    ) : (
                      <div className="p-2.5 sm:p-3 border border-green-200 rounded-lg bg-white space-y-2">
                        <p className="font-medium text-xs sm:text-sm">הזן מספר טלפון:</p>
                        <input
                          type="tel"
                          value={manualPhone}
                          onChange={(e) => setManualPhone(e.target.value)}
                          placeholder="050-0000000"
                          className="w-full p-2 text-sm border border-dark-200 rounded-lg text-left"
                          dir="ltr"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (!manualPhone.trim()) return;
                              try {
                                setSendingChannel('whatsapp');
                                const response = await api.sendProposal(proposal.id, 'whatsapp', {
                                  customerName: contractData.customerName || proposal.customer.full_name,
                                  date: contractData.date,
                                  forText: contractData.forText,
                                  platforms: contractData.platforms,
                                  whatYouGet: contractData.whatYouGet,
                                  cost: contractData.cost
                                }) as {
                                  message: string;
                                  sign_url: string;
                                  whatsapp_link?: string;
                                };
                                const phone = manualPhone.replace(/[^0-9]/g, '');
                                const phoneFormatted = phone.startsWith('0') ? '972' + phone.slice(1) : phone;
                                const message = `שלום, מצורף קישור להצעת המחיר שלך:\n${response.sign_url}`;
                                const encodedMessage = encodeURIComponent(message);
                                window.open(`https://wa.me/${phoneFormatted}?text=${encodedMessage}`, '_blank');
                              } catch (error) {
                                showToast('error', 'שגיאה ביצירת הקישור');
                              } finally {
                                setSendingChannel(null);
                              }
                            }}
                            disabled={!manualPhone.trim() || sendingChannel !== null}
                            className="flex-1 flex items-center justify-center gap-2 p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                          >
                            {sendingChannel === 'whatsapp' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MessageCircle className="w-4 h-4" />
                            )}
                            שלח
                          </button>
                          <button
                            onClick={() => {
                              setShowManualPhoneInput(false);
                              setManualPhone('');
                            }}
                            className="px-3 p-2 border border-dark-200 rounded-lg hover:bg-dark-50 transition-colors"
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setShowWhatsappOptions(false)}
                      className="w-full text-center text-sm text-dark-500 hover:text-dark-700 py-1"
                    >
                      ביטול
                    </button>
                  </div>
                )}

                <button
                  onClick={async () => {
                    try {
                      setSendingChannel('sms');
                      const response = await api.sendProposal(proposal.id, 'sms', {
                        customerName: contractData.customerName || proposal.customer.full_name,
                        date: contractData.date,
                        forText: contractData.forText,
                        platforms: contractData.platforms,
                        whatYouGet: contractData.whatYouGet,
                        cost: contractData.cost
                      }) as {
                        message: string;
                        sign_url: string;
                      };
                      const smsMessage = `הצעת מחיר ${proposal.order_number}\n\nלצפייה והורדת ההסכם:\n${response.sign_url}`;
                      window.open(`sms:${proposal.customer.phone}?body=${encodeURIComponent(smsMessage)}`, '_blank');
                    } catch (error) {
                      showToast('error', 'שגיאה בשליחת SMS');
                    } finally {
                      setSendingChannel(null);
                    }
                  }}
                  disabled={sendingChannel !== null}
                  className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-dark-200 rounded-xl hover:bg-dark-50 transition-colors disabled:opacity-50"
                >
                  {sendingChannel === 'sms' ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-blue-500 flex-shrink-0" />
                  ) : (
                    <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 flex-shrink-0" />
                  )}
                  <div className="text-right flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base">SMS עם קישור להצעה</p>
                    <p className="text-xs sm:text-sm text-dark-500" dir="ltr">{proposal.customer.phone}</p>
                  </div>
                </button>

                <button
                  onClick={async () => {
                    try {
                      setSendingChannel('email');
                      const response = await api.sendProposal(proposal.id, 'email', {
                        customerName: contractData.customerName || proposal.customer.full_name,
                        date: contractData.date,
                        forText: contractData.forText,
                        platforms: contractData.platforms,
                        whatYouGet: contractData.whatYouGet,
                        cost: contractData.cost
                      }) as {
                        message: string;
                        sign_url: string;
                      };
                      const subject = `הצעת מחיר מספר ${proposal.order_number}`;
                      const body = `שלום ${proposal.customer.full_name},\n\nמצורף קישור להצעת המחיר שלך:\n${response.sign_url}\n\nלצפייה, הורדה וחתימה על ההסכם.\n\nבברכה`;
                      window.open(`mailto:${proposal.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                    } catch (error) {
                      showToast('error', 'שגיאה בשליחת מייל');
                    } finally {
                      setSendingChannel(null);
                    }
                  }}
                  disabled={sendingChannel !== null}
                  className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-dark-200 rounded-xl hover:bg-dark-50 transition-colors disabled:opacity-50"
                >
                  {sendingChannel === 'email' ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary-500 flex-shrink-0" />
                  ) : (
                    <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-primary-500 flex-shrink-0" />
                  )}
                  <div className="text-right flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base">דוא״ל עם קישור להצעה</p>
                    <p className="text-xs sm:text-sm text-dark-500 truncate" dir="ltr">{proposal.customer.email}</p>
                  </div>
                </button>

                <button
                  onClick={async () => {
                    try {
                      setSendingChannel('sms');
                      const response = await api.sendProposal(proposal.id, 'sms', {
                        customerName: contractData.customerName || proposal.customer.full_name,
                        date: contractData.date,
                        forText: contractData.forText,
                        platforms: contractData.platforms,
                        whatYouGet: contractData.whatYouGet,
                        cost: contractData.cost
                      }) as {
                        message: string;
                        sign_url: string;
                      };
                      await navigator.clipboard.writeText(response.sign_url);
                      showToast('success', 'הקישור הועתק ללוח');
                    } catch (error) {
                      showToast('error', 'שגיאה בהעתקת הקישור');
                    } finally {
                      setSendingChannel(null);
                    }
                  }}
                  disabled={sendingChannel !== null}
                  className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-dark-200 rounded-xl hover:bg-dark-50 transition-colors disabled:opacity-50"
                >
                  {sendingChannel === 'sms' ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-purple-500 flex-shrink-0" />
                  ) : (
                    <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500 flex-shrink-0" />
                  )}
                  <div className="text-right flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base">העתק קישור</p>
                    <p className="text-xs sm:text-sm text-dark-500">העתק את הקישור ללוח</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
