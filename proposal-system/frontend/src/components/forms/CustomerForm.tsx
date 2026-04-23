import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { CustomerFormData } from '../../types';

interface CustomerFormProps {
  initialData?: Partial<CustomerFormData>;
  onSubmit: (data: CustomerFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function CustomerForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'שמור',
}: CustomerFormProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    full_name: initialData?.full_name || '',
    doc_number: initialData?.doc_number || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerFormData, string>> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'שם לקוח הוא שדה חובה';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'מספר טלפון הוא שדה חובה';
    } else {
      const phoneRegex = /^0[0-9]{8,9}$/;
      const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        newErrors.phone = 'מספר טלפון לא תקין';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'דוא״ל הוא שדה חובה';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'כתובת דוא״ל לא תקינה';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="שם לקוח *"
        value={formData.full_name}
        onChange={(e) => handleChange('full_name', e.target.value)}
        error={errors.full_name}
        placeholder="שם מלא"
      />

      <Input
        label="ת.ז / ח.פ"
        value={formData.doc_number}
        onChange={(e) => handleChange('doc_number', e.target.value)}
        placeholder="מספר זהות או ח.פ"
        dir="ltr"
      />

      <Input
        label="טלפון *"
        type="tel"
        value={formData.phone}
        onChange={(e) => handleChange('phone', e.target.value)}
        error={errors.phone}
        placeholder="050-1234567"
        dir="ltr"
      />

      <Input
        label="דוא״ל *"
        type="email"
        value={formData.email}
        onChange={(e) => handleChange('email', e.target.value)}
        error={errors.email}
        placeholder="email@example.com"
        dir="ltr"
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            ביטול
          </Button>
        )}
      </div>
    </form>
  );
}
