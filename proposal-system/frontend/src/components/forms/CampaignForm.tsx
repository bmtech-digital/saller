import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { CampaignFormData } from '../../types';
import { PROJECT_TYPES, DEFAULT_PROJECT_TYPE, type ProjectTypeId } from '../../config/projectTypes';

interface CampaignFormProps {
  initialData?: Partial<CampaignFormData>;
  onSubmit: (data: CampaignFormData) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export function CampaignForm({ initialData, onSubmit, onCancel, submitLabel = 'שמור', isLoading = false }: CampaignFormProps) {
  const [formData, setFormData] = useState<CampaignFormData>({
    campaign_name: initialData?.campaign_name || '',
    influencers: initialData?.influencers || '',
    invoice_file: null,
    bank_details: initialData?.bank_details || '',
    cost: initialData?.cost || 0,
    is_paid: initialData?.is_paid || false,
    project_type: initialData?.project_type || DEFAULT_PROJECT_TYPE
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignFormData, string>>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, invoice_file: 'יש להעלות תמונה או PDF בלבד' }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, invoice_file: 'גודל הקובץ חייב להיות עד 5MB' }));
        return;
      }

      setFormData(prev => ({ ...prev, invoice_file: file }));
      setErrors(prev => ({ ...prev, invoice_file: undefined }));

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const removeFile = () => {
    setFormData(prev => ({ ...prev, invoice_file: null }));
    setPreviewUrl(null);
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CampaignFormData, string>> = {};

    if (!formData.campaign_name.trim()) {
      newErrors.campaign_name = 'שם הקמפיין נדרש';
    }

    if (!formData.influencers.trim()) {
      newErrors.influencers = 'שם המשפיען/ים נדרש';
    }

    if (formData.cost <= 0) {
      newErrors.cost = 'יש להזין עלות';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Project Type */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-1.5">
          סוג פרוייקט <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.project_type}
          onChange={(e) =>
            setFormData(prev => ({ ...prev, project_type: e.target.value as ProjectTypeId }))
          }
          className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {PROJECT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Campaign Name */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-1.5">
          שם הקמפיין <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.campaign_name}
          onChange={(e) => setFormData(prev => ({ ...prev, campaign_name: e.target.value }))}
          placeholder="לדוגמה: קמפיין קיץ 2026"
          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.campaign_name ? 'border-red-500' : 'border-dark-300'
          }`}
        />
        {errors.campaign_name && (
          <p className="text-red-500 text-sm mt-1">{errors.campaign_name}</p>
        )}
      </div>

      {/* Influencers */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-1.5">
          משפיענים <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.influencers}
          onChange={(e) => setFormData(prev => ({ ...prev, influencers: e.target.value }))}
          placeholder="שמות המשפיענים"
          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.influencers ? 'border-red-500' : 'border-dark-300'
          }`}
        />
        {errors.influencers && (
          <p className="text-red-500 text-sm mt-1">{errors.influencers}</p>
        )}
      </div>

      {/* Invoice Upload */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-1.5">
          העלאת חשבונית (תמונה או PDF)
        </label>
        {formData.invoice_file ? (
          <div className="border border-dark-300 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center">
                    <span className="text-red-600 text-xs font-bold">PDF</span>
                  </div>
                )}
                <span className="text-sm text-dark-700">{formData.invoice_file.name}</span>
              </div>
              <button
                type="button"
                onClick={removeFile}
                className="p-1 hover:bg-dark-100 rounded"
              >
                <X className="w-5 h-5 text-dark-500" />
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-dark-300 rounded-lg cursor-pointer hover:bg-dark-50 transition-colors">
            <Upload className="w-8 h-8 text-dark-400 mb-2" />
            <span className="text-sm text-dark-500">לחץ להעלאת קובץ</span>
            <span className="text-xs text-dark-400 mt-1">תמונה או PDF עד 5MB</span>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
        {errors.invoice_file && (
          <p className="text-red-500 text-sm mt-1">{errors.invoice_file}</p>
        )}
      </div>

      {/* Bank Details */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-1.5">
          פרטי חשבון בנק
        </label>
        <textarea
          value={formData.bank_details}
          onChange={(e) => setFormData(prev => ({ ...prev, bank_details: e.target.value }))}
          placeholder="בנק לאומי מס חשבון 123456..."
          rows={2}
          className="w-full px-4 py-2.5 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {/* Cost */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-1.5">
          עלות <span className="text-red-500">*</span>
        </label>
        <div className="relative">
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
            className={`w-full pr-8 pl-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.cost ? 'border-red-500' : 'border-dark-300'
            }`}
            dir="ltr"
          />
        </div>
        {errors.cost && (
          <p className="text-red-500 text-sm mt-1">{errors.cost}</p>
        )}
      </div>

      {/* Is Paid */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_paid}
            onChange={(e) => setFormData(prev => ({ ...prev, is_paid: e.target.checked }))}
            className="w-5 h-5 rounded border-dark-300 text-green-500 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-dark-700">שולם</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>שומר...</span>
            </div>
          ) : (
            submitLabel
          )}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1" disabled={isLoading}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
