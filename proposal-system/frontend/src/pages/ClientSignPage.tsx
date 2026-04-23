import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Download, CheckCircle, AlertCircle, Clock, Share2, MessageCircle, Mail, Phone, Eye, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { SignaturePad } from '../components/signature/SignaturePad';
import { Loading } from '../components/ui/Loading';
import { CLIENT_SIGN_FIELDS } from '../config/pdfCoordinates';
import { generateContractPDF } from '../services/pdfGenerator';
import type { ProposalWithDetails } from '../types';

interface ClientSignFormData {
  date: string;
  phoneContact: string;
  accountingContact: string;
  companyNumber: string;
  invoiceEmail: string;
}

// Helper to get signature data from proposal (handles both array and object formats)
const getSignatureData = (proposal: ProposalWithDetails | null) => {
  if (!proposal?.signature) return null;
  // Supabase may return signature as array or single object
  const sig = Array.isArray(proposal.signature) ? proposal.signature[0] : proposal.signature;
  return sig || null;
};

const getSignatureDataUrl = (proposal: ProposalWithDetails | null): string => {
  const sig = getSignatureData(proposal);
  if (!sig?.signature_payload) return '';
  const payload = sig.signature_payload as { dataUrl?: string };
  return payload.dataUrl || '';
};

export function ClientSignPage() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<ProposalWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [showPdfView, setShowPdfView] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Client form data
  const [formData, setFormData] = useState<ClientSignFormData>({
    date: new Date().toISOString().split('T')[0],
    phoneContact: '',
    accountingContact: '',
    companyNumber: '',
    invoiceEmail: ''
  });

  const [formErrors, setFormErrors] = useState<Partial<ClientSignFormData>>({});

  useEffect(() => {
    if (token) loadProposal();
  }, [token]);

  // Pre-fill form with customer data or signed data
  useEffect(() => {
    if (proposal) {
      // Check if already signed - try to get client data from signature payload
      const sigData = getSignatureData(proposal);
      if (sigData?.signature_payload) {
        const payload = sigData.signature_payload as { clientData?: ClientSignFormData };
        if (payload.clientData) {
          setFormData({
            date: payload.clientData.date || new Date().toISOString().split('T')[0],
            phoneContact: payload.clientData.phoneContact || proposal.customer?.phone || '',
            accountingContact: payload.clientData.accountingContact || '',
            companyNumber: payload.clientData.companyNumber || proposal.customer?.doc_number || '',
            invoiceEmail: payload.clientData.invoiceEmail || proposal.customer?.email || ''
          });
          return;
        }
      }
      // Fallback to customer data
      if (proposal.customer) {
        setFormData(prev => ({
          ...prev,
          phoneContact: proposal.customer.phone || '',
          invoiceEmail: proposal.customer.email || '',
          companyNumber: proposal.customer.doc_number || ''
        }));
      }
    }
  }, [proposal]);

  const loadProposal = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getClientProposal(token!) as ProposalWithDetails;
      setProposal(data);

      const sigData = getSignatureData(data);
      if (sigData?.signed_at) {
        setIsSigned(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת ההצעה');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<ClientSignFormData> = {};

    if (!formData.phoneContact.trim()) {
      errors.phoneContact = 'שדה חובה';
    }
    if (!formData.accountingContact.trim()) {
      errors.accountingContact = 'שדה חובה';
    }
    if (!formData.companyNumber.trim()) {
      errors.companyNumber = 'שדה חובה';
    }
    if (!formData.invoiceEmail.trim()) {
      errors.invoiceEmail = 'שדה חובה';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.invoiceEmail)) {
      errors.invoiceEmail = 'כתובת מייל לא תקינה';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDownloadPDF = async () => {
    if (!proposal) return;

    try {
      // Get contract data
      const savedContractData = (proposal as any).contract_data;
      const contractData = savedContractData || {
        customerName: proposal.customer?.full_name || '',
        date: proposal.proposal_date,
        forText: proposal.customer?.full_name || '',
        platforms: ['instagram', 'reels', 'story', 'tiktok'],
        whatYouGet: 'ניהול רשתות חברתיות\nיצירת תוכן\nפרסום ממומן',
        cost: proposal.total || 0
      };

      // Get client sign data if signed
      let clientSignData = undefined;
      if (isSigned) {
        // Get signature - try sessionStorage first (after fresh sign), then from proposal
        const storedSig = sessionStorage.getItem('lastSignatureDataUrl');
        const signatureDataUrl = storedSig || getSignatureDataUrl(proposal);

        clientSignData = {
          date: formData.date || new Date().toISOString().split('T')[0],
          phoneContact: formData.phoneContact || proposal.customer?.phone || '',
          accountingContact: formData.accountingContact || '',
          companyNumber: formData.companyNumber || proposal.customer?.doc_number || '',
          invoiceEmail: formData.invoiceEmail || proposal.customer?.email || '',
          signature: signatureDataUrl
        };
      }

      // Generate PDF with client data
      const blob = await generateContractPDF(contractData, clientSignData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${proposal?.order_number || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      Swal.fire({
        icon: 'error',
        title: 'שגיאה',
        text: 'שגיאה בהורדת המסמך',
        confirmButtonText: 'הבנתי',
        confirmButtonColor: '#f97316'
      });
    }
  };

  const handleSign = async (signatureData: { dataUrl: string; timestamp: string }) => {
    if (!token) return;

    if (!validateForm()) {
      Swal.fire({
        icon: 'warning',
        title: 'שדות חסרים',
        text: 'אנא מלא את כל השדות הנדרשים לפני החתימה',
        confirmButtonText: 'הבנתי',
        confirmButtonColor: '#f97316'
      });
      return;
    }

    try {
      setIsSigning(true);
      await api.submitSignature(token, {
        ...signatureData,
        clientData: formData
      });
      // Store signature in sessionStorage for PDF generation (persists across refreshes)
      sessionStorage.setItem('lastSignatureDataUrl', signatureData.dataUrl);
      setIsSigned(true);
      setShowSharePopup(true);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'שגיאה',
        text: err instanceof Error ? err.message : 'שגיאה בשליחת החתימה',
        confirmButtonText: 'הבנתי',
        confirmButtonColor: '#f97316'
      });
    } finally {
      setIsSigning(false);
    }
  };

  // Get the current page URL for sharing
  const getShareUrl = () => window.location.href;

  const handleShareWhatsApp = () => {
    const shareUrl = getShareUrl();
    const message = encodeURIComponent(
      `שלום, הנה ההסכם החתום עבור הצעה מספר ${proposal?.order_number}\n\nלצפייה והורדת ההסכם:\n${shareUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleShareEmail = () => {
    const shareUrl = getShareUrl();
    const subject = encodeURIComponent(`הסכם חתום - הצעה מספר ${proposal?.order_number}`);
    const body = encodeURIComponent(
      `שלום,\n\nההסכם נחתם בהצלחה עבור הצעה מספר ${proposal?.order_number}.\n\nלצפייה והורדת ההסכם החתום:\n${shareUrl}\n\nתודה רבה.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleShareSMS = () => {
    const shareUrl = getShareUrl();
    const message = encodeURIComponent(
      `ההסכם נחתם בהצלחה - הצעה מספר ${proposal?.order_number}\nלצפייה: ${shareUrl}`
    );
    window.open(`sms:?body=${message}`, '_blank');
  };

  const handleViewPdf = async () => {
    if (!proposal) return;

    try {
      setLoadingPdf(true);

      // Use saved contract data if available, otherwise build from proposal
      const savedContractData = (proposal as any).contract_data;
      const contractData = savedContractData || {
        customerName: proposal.customer?.full_name || '',
        date: proposal.proposal_date,
        forText: proposal.customer?.full_name || '',
        platforms: ['instagram', 'reels', 'story', 'tiktok'],
        whatYouGet: 'ניהול רשתות חברתיות\nיצירת תוכן\nפרסום ממומן',
        cost: proposal.total || 0
      };

      // If already signed, include client sign data in PDF
      let clientSignData = undefined;
      if (isSigned) {
        const storedSig = sessionStorage.getItem('lastSignatureDataUrl');
        const signatureDataUrl = storedSig || getSignatureDataUrl(proposal);

        clientSignData = {
          date: formData.date || new Date().toISOString().split('T')[0],
          phoneContact: formData.phoneContact || proposal.customer?.phone || '',
          accountingContact: formData.accountingContact || '',
          companyNumber: formData.companyNumber || proposal.customer?.doc_number || '',
          invoiceEmail: formData.invoiceEmail || proposal.customer?.email || '',
          signature: signatureDataUrl
        };
      }

      // Generate PDF using frontend generator (with template images)
      const blob = await generateContractPDF(contractData, clientSignData);
      const url = URL.createObjectURL(blob);

      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      const a = document.createElement('a');
      a.href = url;

      if (isMobile) {
        // On mobile - download the PDF directly (most reliable method)
        a.download = `הסכם-${proposal?.order_number || 'document'}.pdf`;
      } else {
        // On desktop - open in new tab
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Don't revoke URL immediately on mobile to allow download to complete
      if (!isMobile) {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      Swal.fire({
        icon: 'error',
        title: 'שגיאה',
        text: 'שגיאה בטעינת המסמך',
        confirmButtonText: 'הבנתי',
        confirmButtonColor: '#f97316'
      });
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleBackToSign = () => {
    setShowPdfView(false);
    setShowSharePopup(isSigned); // Return to share popup if signed
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  const handleViewSignedPdf = async () => {
    if (!proposal) return;

    try {
      setLoadingPdf(true);

      // Get contract data
      const savedContractData = (proposal as any).contract_data;
      const contractData = savedContractData || {
        customerName: proposal.customer?.full_name || '',
        date: proposal.proposal_date,
        forText: proposal.customer?.full_name || '',
        platforms: ['instagram', 'reels', 'story', 'tiktok'],
        whatYouGet: 'ניהול רשתות חברתיות\nיצירת תוכן\nפרסום ממומן',
        cost: proposal.total || 0
      };

      // Get client sign data - try sessionStorage first, then from proposal
      const storedSig = sessionStorage.getItem('lastSignatureDataUrl');
      const signatureDataUrl = storedSig || getSignatureDataUrl(proposal);

      const clientSignData = {
        date: formData.date || new Date().toISOString().split('T')[0],
        phoneContact: formData.phoneContact || proposal.customer?.phone || '',
        accountingContact: formData.accountingContact || '',
        companyNumber: formData.companyNumber || proposal.customer?.doc_number || '',
        invoiceEmail: formData.invoiceEmail || proposal.customer?.email || '',
        signature: signatureDataUrl
      };

      // Generate signed PDF
      const blob = await generateContractPDF(contractData, clientSignData);
      const url = URL.createObjectURL(blob);
      // Use link click instead of window.open to avoid popup blocker
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('PDF generation error:', err);
      Swal.fire({
        icon: 'error',
        title: 'שגיאה',
        text: 'שגיאה בטעינת המסמך',
        confirmButtonText: 'הבנתי',
        confirmButtonColor: '#f97316'
      });
    } finally {
      setLoadingPdf(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading size="lg" text="טוען מסמך..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            {error.includes('פג תוקף') ? (
              <Clock className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            ) : (
              <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            )}
            <h1 className="text-xl font-bold text-dark-900 mb-2">
              {error.includes('פג תוקף') ? 'הקישור פג תוקף' : 'שגיאה'}
            </h1>
            <p className="text-dark-500">{error}</p>
            <p className="text-sm text-dark-400 mt-4">
              אם אתה צריך גישה למסמך, אנא פנה לשולח.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Share popup after signing
  if (isSigned && showSharePopup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardBody className="py-8">
            <div className="text-center mb-8">
              <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-4" />
              <h1 className="text-2xl font-bold text-dark-900 mb-2">
                תודה! ההצעה נחתמה בהצלחה
              </h1>
              <p className="text-dark-500">
                ניתן לשתף את ההסכם החתום או להוריד עותק
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-dark-700 flex items-center gap-2 mb-4">
                <Share2 className="w-5 h-5 text-primary-500" />
                שתף את ההסכם
              </h3>

              <button
                onClick={handleShareWhatsApp}
                className="w-full flex items-center gap-4 p-4 bg-green-500 hover:bg-green-600 text-white rounded-xl transition"
              >
                <MessageCircle className="w-6 h-6" />
                <span className="font-medium">שתף בוואטסאפ</span>
              </button>

              <button
                onClick={handleShareEmail}
                className="w-full flex items-center gap-4 p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition"
              >
                <Mail className="w-6 h-6" />
                <span className="font-medium">שלח במייל</span>
              </button>

              <button
                onClick={handleShareSMS}
                className="w-full flex items-center gap-4 p-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition"
              >
                <Phone className="w-6 h-6" />
                <span className="font-medium">שלח ב-SMS</span>
              </button>

              <div className="pt-4 border-t border-dark-200 mt-4 space-y-3">
                <button
                  onClick={handleViewSignedPdf}
                  disabled={loadingPdf}
                  className="w-full flex items-center gap-4 p-4 bg-dark-100 hover:bg-dark-200 text-dark-800 rounded-xl transition"
                >
                  {loadingPdf ? (
                    <div className="w-6 h-6 border-2 border-dark-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Eye className="w-6 h-6" />
                  )}
                  <span className="font-medium">הצג PDF</span>
                </button>
                <Button variant="outline" onClick={handleDownloadPDF} className="w-full">
                  <Download className="w-5 h-5" />
                  הורד עותק PDF
                </Button>
              </div>

              <button
                onClick={() => setShowSharePopup(false)}
                className="w-full text-dark-500 hover:text-dark-700 text-sm mt-4"
              >
                סגור
              </button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!proposal) return null;

  // PDF View - must be checked before isSigned view
  if (showPdfView && pdfUrl) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto pb-20">
          <iframe
            src={pdfUrl}
            className="w-full h-full min-h-screen"
            title="הסכם"
          />
        </div>

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-dark-200 shadow-lg p-4">
          <button
            onClick={handleBackToSign}
            className="w-full flex items-center justify-center gap-3 p-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition font-medium"
          >
            <ArrowRight className="w-5 h-5" />
            <span>{isSigned ? 'חזור' : 'חזור לחתימה'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Already signed view
  if (isSigned) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h1 className="text-xl font-bold text-dark-900 mb-2">
              ההצעה כבר נחתמה
            </h1>
            <p className="text-dark-500">
              ההסכם החתום נשלח. ניצור איתך קשר בהקדם.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleViewSignedPdf} disabled={loadingPdf}>
                  <Eye className="w-5 h-5" />
                  הצג PDF
                </Button>
                <Button variant="outline" onClick={handleDownloadPDF}>
                  <Download className="w-5 h-5" />
                  הורד PDF
                </Button>
              </div>
              <Button variant="primary" onClick={() => setShowSharePopup(true)} className="w-full max-w-xs mx-auto">
                <Share2 className="w-5 h-5" />
                שתף
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-dark-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo/logo.png" alt="לוגו" className="h-12 sm:h-14" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-primary-400">הסכם לחתימה</h1>
                <p className="text-dark-300 text-sm sm:text-base">
                  מספר {proposal.order_number} • {formatDate(proposal.proposal_date)}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleDownloadPDF} className="!border-dark-600 !text-white hover:!bg-dark-800">
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">הורד PDF</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Contract Preview */}
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-primary-600 mb-4 pb-2 border-b-2 border-primary-500">
              פרטי ההסכם
            </h2>
            {(() => {
              const contractData = (proposal as any).contract_data;
              const customerName = contractData?.customerName || proposal.customer.full_name;
              const date = contractData?.date || proposal.proposal_date;
              const forText = contractData?.forText || proposal.customer.full_name;
              const platforms = contractData?.platforms || [];
              const whatYouGet = contractData?.whatYouGet || '';
              const cost = contractData?.cost ?? proposal.total;

              const platformLabels: Record<string, string> = {
                instagram: 'אינסטגרם',
                facebook: 'פייסבוק',
                tiktok: 'טיקטוק',
                reels: 'Reels',
                story: 'Stories',
                linkedin: 'לינקדאין',
                twitter: 'טוויטר'
              };

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-dark-500">לכבוד</p>
                      <p className="font-medium">{customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-dark-500">תאריך</p>
                      <p className="font-medium">{formatDate(date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-dark-500">עבור</p>
                      <p className="font-medium">{forText}</p>
                    </div>
                    {platforms.length > 0 && (
                      <div>
                        <p className="text-sm text-dark-500">פלטפורמות</p>
                        <p className="font-medium">
                          {platforms.map((p: string) => platformLabels[p] || p).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>

                  {whatYouGet && (
                    <div className="mt-4">
                      <p className="text-sm text-dark-500 mb-1">מה מקבלים</p>
                      <div className="bg-dark-50 p-3 rounded-lg">
                        {whatYouGet.split('\n').map((line: string, i: number) => (
                          <p key={i} className="font-medium text-dark-700">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total with VAT */}
                  <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-lg space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-dark-600">עלות לפני מע״מ:</span>
                      <span className="text-dark-700">{formatCurrency(cost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-dark-600">מע״מ (18%):</span>
                      <span className="text-dark-700">{formatCurrency(cost * 0.18)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-primary-200">
                      <span className="text-primary-700 font-medium">סה״כ לתשלום:</span>
                      <span className="text-2xl font-bold text-primary-600">
                        {formatCurrency(cost * 1.18)}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardBody>
        </Card>

        {/* Client Details Form */}
        <Card className="border-2 border-primary-300">
          <CardBody>
            <h2 className="text-lg font-semibold text-dark-900 mb-4 pb-2 border-b border-dark-200">
              פרטי הלקוח להסכם
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">
                  {CLIENT_SIGN_FIELDS.תאריך.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Phone Contact */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">
                  {CLIENT_SIGN_FIELDS.טלפון_איש_קשר.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneContact: e.target.value }))}
                  placeholder="050-1234567"
                  dir="ltr"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    formErrors.phoneContact ? 'border-red-500' : 'border-dark-300'
                  }`}
                />
                {formErrors.phoneContact && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.phoneContact}</p>
                )}
              </div>

              {/* Accounting Contact */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">
                  {CLIENT_SIGN_FIELDS.איש_קשר_הנהלת_חשבונות.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountingContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, accountingContact: e.target.value }))}
                  placeholder="שם איש הקשר"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    formErrors.accountingContact ? 'border-red-500' : 'border-dark-300'
                  }`}
                />
                {formErrors.accountingContact && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.accountingContact}</p>
                )}
              </div>

              {/* Company Number */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">
                  {CLIENT_SIGN_FIELDS.מספר_חפ.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyNumber: e.target.value }))}
                  placeholder="מספר חברה / ת.ז"
                  dir="ltr"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    formErrors.companyNumber ? 'border-red-500' : 'border-dark-300'
                  }`}
                />
                {formErrors.companyNumber && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.companyNumber}</p>
                )}
              </div>

              {/* Invoice Email */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-dark-700 mb-1.5">
                  {CLIENT_SIGN_FIELDS.מייל_חשבוניות.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.invoiceEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceEmail: e.target.value }))}
                  placeholder="email@example.com"
                  dir="ltr"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    formErrors.invoiceEmail ? 'border-red-500' : 'border-dark-300'
                  }`}
                />
                {formErrors.invoiceEmail && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.invoiceEmail}</p>
                )}
              </div>

              {/* View Agreement Button - inside the form grid */}
              <div className="sm:col-span-2 mt-2">
                <button
                  onClick={handleViewPdf}
                  disabled={loadingPdf}
                  className="w-full flex items-center justify-center gap-3 p-3 bg-dark-100 hover:bg-dark-200 text-dark-800 rounded-lg transition font-medium border border-dark-200"
                >
                  {loadingPdf ? (
                    <>
                      <div className="w-5 h-5 border-2 border-dark-400 border-t-transparent rounded-full animate-spin" />
                      <span>טוען הסכם...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      <span>צפה בהסכם המלא</span>
                    </>
                  )}
                </button>
                {isSigned && (
                  <p className="text-red-500 text-center text-sm font-medium mt-2">
                    הסכם זה כבר נחתם
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Signature - only show if not signed yet */}
        {!isSigned && (
          <Card className="border-2 border-primary-500">
            <CardBody>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-dark-900 mb-2">
                  חתימה דיגיטלית
                </h2>
                <p className="text-dark-500">
                  בחתימתי אני מאשר/ת כי קראתי והבנתי את תנאי ההסכם והסכמתי להם
                </p>
              </div>

              <SignaturePad onSign={handleSign} isLoading={isSigning} />
            </CardBody>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-dark-400">
        <p>מסמך זה הופק באופן אוטומטי ממערכת ההצעות</p>
      </footer>
    </div>
  );
}
