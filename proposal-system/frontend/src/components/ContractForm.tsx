import { useState, useEffect, useRef } from 'react';
import { PLATFORM_OPTIONS, AGENT_PACKAGES, type PlatformId } from '../config/pdfCoordinates';
import type { ContractData, AgentPackageId, ProjectType } from '../types';

interface ContractFormProps {
  initialData?: Partial<ContractData>;
  customerName: string;
  projectType: ProjectType;
  onChange: (data: ContractData) => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];

// Build a complete ContractData with sensible defaults per project type.
function withDefaults(initial: Partial<ContractData>, customerName: string, projectType: ProjectType): ContractData {
  const base: ContractData = {
    customerName: initial.customerName || customerName,
    date: initial.date || todayISO(),
  };

  if (projectType === 'influencers') {
    return {
      ...base,
      forText: initial.forText || '',
      platforms: (initial.platforms as PlatformId[] | undefined) || [],
      whatYouGet: initial.whatYouGet || '',
      cost: initial.cost || 0,
    };
  }

  if (projectType === 'videos') {
    return {
      ...base,
      subject: initial.subject || customerName,
      packagePrice: initial.packagePrice ?? 6000,
      finalPrice: initial.finalPrice ?? 3800,
    };
  }

  // agents
  return {
    ...base,
    websiteName: initial.websiteName || '',
    recommendedPackage: initial.recommendedPackage || 'advanced',
  };
}

export function ContractForm({ initialData, customerName, projectType, onChange }: ContractFormProps) {
  const [formData, setFormData] = useState<ContractData>(() =>
    withDefaults(initialData || {}, customerName, projectType)
  );

  const isInitialized = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Re-hydrate when an existing proposal loads (initialData arrives async).
  useEffect(() => {
    if (!isInitialized.current && initialData && hasRealContent(initialData)) {
      setFormData(withDefaults(initialData, customerName, projectType));
      isInitialized.current = true;
    }
  }, [initialData, customerName, projectType]);

  // Reset defaults if projectType ever changes (rare, but defensive)
  useEffect(() => {
    setFormData((prev) => withDefaults(prev, customerName, projectType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  // Debounced upward notify
  useEffect(() => {
    const timeout = setTimeout(() => onChangeRef.current(formData), 100);
    return () => clearTimeout(timeout);
  }, [formData]);

  const update = <K extends keyof ContractData>(key: K, value: ContractData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handlePlatformToggle = (platformId: PlatformId) => {
    const current = (formData.platforms as PlatformId[] | undefined) || [];
    update(
      'platforms',
      current.includes(platformId)
        ? current.filter((p) => p !== platformId)
        : [...current, platformId]
    );
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount);

  return (
    <div className="space-y-6">
      {/* ============ Common fields ============ */}
      <div className="bg-white border border-dark-200 rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-dark-900 mb-4 pb-2 border-b border-dark-200">
          פרטי ההסכם
        </h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-1.5">לכבוד</label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => update('customerName', e.target.value)}
            placeholder="שם הלקוח"
            className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-700 mb-1.5">תאריך</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => update('date', e.target.value)}
            className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* ===== Influencers ===== */}
        {projectType === 'influencers' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-dark-700 mb-1.5">עבור</label>
              <input
                type="text"
                value={formData.forText || ''}
                onChange={(e) => update('forText', e.target.value)}
                placeholder="לדוגמה: קמפיין שיווקי לחודש מרץ"
                className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-dark-700 mb-3">פלטפורמות פרסום</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PLATFORM_OPTIONS.map((platform) => {
                  const checked = ((formData.platforms as PlatformId[] | undefined) || []).includes(platform.id);
                  return (
                    <label
                      key={platform.id}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-dark-200 hover:border-dark-300 text-dark-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handlePlatformToggle(platform.id)}
                        className="sr-only"
                      />
                      <span className="font-medium text-sm">{platform.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ===== Videos ===== */}
        {projectType === 'videos' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1.5">עבור (נושא ההצעה)</label>
            <input
              type="text"
              value={formData.subject || ''}
              onChange={(e) => update('subject', e.target.value)}
              placeholder="לדוגמה: עמרם דיזיין"
              className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-dark-500 mt-1">
              יופיע בכותרת: <span className="font-medium">"הפקת סרטוני Ai - עבור {formData.subject || '...'}"</span>
            </p>
          </div>
        )}

        {/* ===== Agents ===== */}
        {projectType === 'agents' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1.5">שם האתר</label>
            <input
              type="text"
              value={formData.websiteName || ''}
              onChange={(e) => update('websiteName', e.target.value)}
              placeholder="לדוגמה: Ahouse.co.il"
              dir="ltr"
              className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-dark-500 mt-1">
              יופיע בכותרת: <span className="font-medium">"הטמעת אייגנט באתר - {formData.websiteName || '...'}"</span>
            </p>
          </div>
        )}
      </div>

      {/* ============ Per-type pricing/package section ============ */}
      {projectType === 'influencers' && (
        <div className="bg-white border border-dark-200 rounded-xl p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-dark-900 mb-4 pb-2 border-b border-dark-200">פרטי החבילה</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1.5">מה מקבלים</label>
            <textarea
              value={formData.whatYouGet || ''}
              onChange={(e) => update('whatYouGet', e.target.value)}
              placeholder="תאר את מה שהלקוח מקבל בחבילה..."
              rows={4}
              className="w-full px-4 py-2.5 border border-dark-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

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
                  update('cost', parseFloat(val) || 0);
                }}
                placeholder="0"
                className="w-full pr-8 pl-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                dir="ltr"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-lg space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-dark-600">עלות לפני מע״מ:</span>
              <span className="text-dark-700">{formatCurrency(formData.cost || 0)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-dark-600">מע״מ (18%):</span>
              <span className="text-dark-700">{formatCurrency((formData.cost || 0) * 0.18)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-primary-200">
              <span className="text-primary-700 font-medium">סה״כ לתשלום:</span>
              <span className="text-2xl font-bold text-primary-600">
                {formatCurrency((formData.cost || 0) * 1.18)}
              </span>
            </div>
          </div>
        </div>
      )}

      {projectType === 'videos' && (
        <div className="bg-white border border-dark-200 rounded-xl p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-dark-900 mb-4 pb-2 border-b border-dark-200">עלויות</h3>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">עלות חבילה (₪)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.packagePrice || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  update('packagePrice', parseFloat(val) || 0);
                }}
                placeholder="6000"
                dir="ltr"
                className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-dark-500 mt-1">המחיר המקורי של החבילה</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">
                מחיר לאחר הנחה (₪) <span className="text-dark-500">(+ מע״מ)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.finalPrice || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  update('finalPrice', parseFloat(val) || 0);
                }}
                placeholder="3800"
                dir="ltr"
                className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-dark-500 mt-1">המחיר שהלקוח ישלם בפועל</p>
            </div>
          </div>

          <div className="mt-2 p-4 bg-primary-50 border border-primary-200 rounded-lg flex justify-between items-center">
            <span className="text-primary-700 font-medium">לתשלום (כולל מע״מ):</span>
            <span className="text-2xl font-bold text-primary-600">
              {formatCurrency((formData.finalPrice || 0) * 1.18)}
            </span>
          </div>
        </div>
      )}

      {projectType === 'agents' && (
        <div className="bg-white border border-dark-200 rounded-xl p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-dark-900 mb-4 pb-2 border-b border-dark-200">חבילה מומלצת</h3>
          <p className="text-sm text-dark-500 mb-4">
            חבילות האייגנט מופיעות בקובץ ההצעה כקבועות. בחר/י את החבילה המומלצת — היא תסומן בכתום בקובץ.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(AGENT_PACKAGES) as AgentPackageId[]).map((id) => {
              const pkg = AGENT_PACKAGES[id];
              const selected = formData.recommendedPackage === id;
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => update('recommendedPackage', id)}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    selected
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-dark-200 hover:border-dark-300 text-dark-600'
                  }`}
                >
                  <span className="font-semibold">{pkg.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Heuristic: do we have actual content from a saved proposal vs. just defaults?
function hasRealContent(d: Partial<ContractData>): boolean {
  return !!(
    d.forText ||
    d.whatYouGet ||
    d.cost ||
    (d.platforms && d.platforms.length > 0) ||
    d.subject ||
    d.packagePrice ||
    d.finalPrice ||
    d.websiteName ||
    d.recommendedPackage
  );
}
