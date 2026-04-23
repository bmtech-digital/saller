import { useState, useEffect, useRef } from 'react';
import { PLATFORM_OPTIONS, type PlatformId } from '../config/pdfCoordinates';

interface ContractFormData {
  customerName: string;
  date: string;
  forText: string;
  platforms: PlatformId[];
  whatYouGet: string;
  cost: number;
}

interface ContractFormProps {
  initialData?: Partial<ContractFormData>;
  customerName: string;
  onChange: (data: ContractFormData) => void;
}

export function ContractForm({ initialData, customerName, onChange }: ContractFormProps) {
  const [formData, setFormData] = useState<ContractFormData>({
    customerName: initialData?.customerName || customerName,
    date: initialData?.date || new Date().toISOString().split('T')[0],
    forText: initialData?.forText || '',
    platforms: initialData?.platforms || [],
    whatYouGet: initialData?.whatYouGet || '',
    cost: initialData?.cost || 0
  });

  const isInitialized = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Update form when initialData changes (e.g., when loading existing proposal)
  useEffect(() => {
    if (!isInitialized.current && initialData && (initialData.forText || initialData.whatYouGet || initialData.cost || (initialData.platforms && initialData.platforms.length > 0))) {
      setFormData({
        customerName: initialData.customerName || customerName,
        date: initialData.date || new Date().toISOString().split('T')[0],
        forText: initialData.forText || '',
        platforms: initialData.platforms || [],
        whatYouGet: initialData.whatYouGet || '',
        cost: initialData.cost || 0
      });
      isInitialized.current = true;
    }
  }, [initialData, customerName]);

  // Debounced onChange to prevent re-render loops
  useEffect(() => {
    const timeout = setTimeout(() => {
      onChangeRef.current(formData);
    }, 100);
    return () => clearTimeout(timeout);
  }, [formData]);

  const handlePlatformToggle = (platformId: PlatformId) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter(p => p !== platformId)
        : [...prev.platforms, platformId]
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Page 1 Fields */}
      <div className="bg-white border border-dark-200 rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-dark-900 mb-4 pb-2 border-b border-dark-200">
          פרטי ההסכם
        </h3>

        {/* לכבוד - Customer Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-1.5">
            לכבוד
          </label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
            placeholder="שם הלקוח"
            className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* תאריך - Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-1.5">
            תאריך
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* עבור - For */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-1.5">
            עבור
          </label>
          <input
            type="text"
            value={formData.forText}
            onChange={(e) => setFormData(prev => ({ ...prev, forText: e.target.value }))}
            placeholder="לדוגמה: קמפיין שיווקי לחודש מרץ"
            className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* פלטפורמות פרסום - Advertising Platforms */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-3">
            פלטפורמות פרסום
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLATFORM_OPTIONS.map((platform) => (
              <label
                key={platform.id}
                className={`
                  flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${formData.platforms.includes(platform.id)
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-dark-200 hover:border-dark-300 text-dark-600'
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={formData.platforms.includes(platform.id)}
                  onChange={() => handlePlatformToggle(platform.id)}
                  className="sr-only"
                />
                <span className="font-medium text-sm">{platform.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Page 2 Fields */}
      <div className="bg-white border border-dark-200 rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-dark-900 mb-4 pb-2 border-b border-dark-200">
          פרטי החבילה
        </h3>

        {/* מה מקבלים - What You Get */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-1.5">
            מה מקבלים
          </label>
          <textarea
            value={formData.whatYouGet}
            onChange={(e) => setFormData(prev => ({ ...prev, whatYouGet: e.target.value }))}
            placeholder="תאר את מה שהלקוח מקבל בחבילה..."
            rows={4}
            className="w-full px-4 py-2.5 border border-dark-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* עלות - Cost */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-1.5">
            עלות הקמפיין <span className="text-dark-500">(+ מע״מ)</span>
          </label>
          <div className="relative max-w-xs">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500">₪</span>
            <input
              type="text"
              inputMode="numeric"
              value={formData.cost || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setFormData(prev => ({ ...prev, cost: parseFloat(val) || 0 }));
              }}
              placeholder="0"
              className="w-full pr-8 pl-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
        </div>

        {/* Total Display */}
        <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-lg space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-dark-600">עלות לפני מע״מ:</span>
            <span className="text-dark-700">{formatCurrency(formData.cost)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-dark-600">מע״מ (18%):</span>
            <span className="text-dark-700">{formatCurrency(formData.cost * 0.18)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-primary-200">
            <span className="text-primary-700 font-medium">סה״כ לתשלום:</span>
            <span className="text-2xl font-bold text-primary-600">
              {formatCurrency(formData.cost * 1.18)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
