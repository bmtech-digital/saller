import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Plus, Trash2, Eye, Upload, Download, X, Check, Edit2 } from 'lucide-react';
import { api } from '../services/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Loading } from './ui/Loading';
import { useToast } from './ui/Toast';
import type { Customer, Influencer, InfluencerFormData } from '../types';

interface Props {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

const emptyForm: InfluencerFormData = {
  full_name: '',
  phone: '',
  instagram_handle: '',
  payment_amount: undefined,
  notes: '',
};

export function InfluencersModal({ customer, isOpen, onClose }: Props) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<InfluencerFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && customer) {
      void load();
    } else {
      setRows([]);
      setForm(emptyForm);
      setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, customer?.id]);

  const load = async () => {
    if (!customer) return;
    try {
      setLoading(true);
      const data = (await api.getInfluencers(customer.id)) as Influencer[];
      setRows(data);
    } catch {
      showToast('error', 'שגיאה בטעינת המשפיענים');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!form.full_name.trim()) {
      showToast('error', 'שם המשפיענ/ית הוא שדה חובה');
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        const updated = (await api.updateInfluencer(editingId, {
          full_name: form.full_name.trim(),
          phone: form.phone?.trim() || null,
          instagram_handle: form.instagram_handle?.trim() || null,
          payment_amount: Number(form.payment_amount) || 0,
          notes: form.notes?.trim() || null,
        })) as Influencer;
        setRows((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        showToast('success', 'עודכן בהצלחה');
      } else {
        const created = (await api.createInfluencer(customer.id, {
          full_name: form.full_name.trim(),
          phone: form.phone?.trim() || undefined,
          instagram_handle: form.instagram_handle?.trim() || undefined,
          payment_amount: Number(form.payment_amount) || 0,
          notes: form.notes?.trim() || undefined,
        })) as Influencer;
        setRows((prev) => [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name, 'he')));
        showToast('success', 'נוסף בהצלחה');
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (row: Influencer) => {
    setEditingId(row.id);
    setForm({
      full_name: row.full_name,
      phone: row.phone || '',
      instagram_handle: row.instagram_handle || '',
      payment_amount: row.payment_amount,
      notes: row.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (row: Influencer) => {
    const r = await Swal.fire({
      icon: 'warning',
      title: 'מחיקה',
      text: `למחוק את "${row.full_name}"?`,
      showCancelButton: true,
      confirmButtonText: 'מחק',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
    });
    if (!r.isConfirmed) return;
    try {
      await api.deleteInfluencer(row.id);
      setRows((prev) => prev.filter((x) => x.id !== row.id));
      showToast('success', 'נמחק בהצלחה');
    } catch {
      showToast('error', 'שגיאה במחיקה');
    }
  };

  const handleTogglePaid = async (row: Influencer) => {
    try {
      const updated = (await api.setInfluencerPaid(row.id, !row.paid)) as Influencer;
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch {
      showToast('error', 'שגיאה בעדכון סטטוס');
    }
  };

  const triggerUpload = (rowId: string) => {
    uploadTargetIdRef.current = rowId;
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = uploadTargetIdRef.current;
    uploadTargetIdRef.current = null;
    if (!file || !id) return;
    try {
      setUploadingId(id);
      const updated = (await api.uploadInfluencerReceipt(id, file)) as Influencer;
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      showToast('success', 'הקבלה הועלתה');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'שגיאה בהעלאת קובץ');
    } finally {
      setUploadingId(null);
    }
  };

  const handleViewReceipt = async (row: Influencer) => {
    try {
      const { url } = await api.getInfluencerReceiptUrl(row.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('error', 'שגיאה בפתיחת הקבלה');
    }
  };

  const handleRemoveReceipt = async (row: Influencer) => {
    const r = await Swal.fire({
      icon: 'warning',
      title: 'הסרת קבלה',
      text: `להסיר את הקבלה של "${row.full_name}"?`,
      showCancelButton: true,
      confirmButtonText: 'הסר',
      cancelButtonText: 'ביטול',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
    });
    if (!r.isConfirmed) return;
    try {
      const updated = (await api.deleteInfluencerReceipt(row.id)) as Influencer;
      setRows((prev) => prev.map((x) => (x.id === row.id ? updated : x)));
      showToast('success', 'הקבלה הוסרה');
    } catch {
      showToast('error', 'שגיאה בהסרת הקבלה');
    }
  };

  const handleExport = async () => {
    if (!customer) return;
    try {
      setExporting(true);
      const blob = await api.exportInfluencerReceiptsZip(customer.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `receipts__${customer.full_name}__${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'שגיאה בייצוא');
    } finally {
      setExporting(false);
    }
  };

  const receiptsCount = rows.filter((r) => r.receipt_storage_path).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`משפיענים — ${customer?.full_name || ''}`}
      size="xl"
    >
      <div className="p-6 space-y-5">
        {/* Header actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-dark-600">
            סה״כ: <strong>{rows.length}</strong> · קבלות: <strong>{receiptsCount}</strong>
          </div>
          <Button
            onClick={handleExport}
            disabled={receiptsCount === 0 || exporting}
            variant="secondary"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'מייצא…' : 'ייצא את כל הקבלות'}
          </Button>
        </div>

        {/* Add / Edit form */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border border-dark-200 rounded-lg bg-dark-50"
        >
          <Input
            label="שם"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="חובה"
            required
          />
          <Input
            label="טלפון"
            value={form.phone || ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            dir="ltr"
          />
          <Input
            label="אינסטגרם"
            value={form.instagram_handle || ''}
            onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })}
            placeholder="@handle"
            dir="ltr"
          />
          <Input
            label="תשלום (₪)"
            type="number"
            min={0}
            step={1}
            value={form.payment_amount ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                payment_amount: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'עדכן' : 'הוסף'}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>

        {/* Hidden file input — triggered by per-row upload buttons */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={handleFileChosen}
        />

        {/* Table */}
        {loading ? (
          <Loading text="טוען משפיענים…" />
        ) : rows.length === 0 ? (
          <div className="text-center text-dark-500 py-10">אין משפיענים עדיין</div>
        ) : (
          <div className="overflow-x-auto" dir="rtl">
            <table className="w-full text-right border border-dark-200 rounded-lg overflow-hidden">
              <thead className="bg-dark-100">
                <tr>
                  <th className="px-3 py-2 text-sm font-semibold text-dark-700">שם</th>
                  <th className="px-3 py-2 text-sm font-semibold text-dark-700">טלפון</th>
                  <th className="px-3 py-2 text-sm font-semibold text-dark-700">אינסטגרם</th>
                  <th className="px-3 py-2 text-sm font-semibold text-dark-700">תשלום</th>
                  <th className="px-3 py-2 text-sm font-semibold text-dark-700">קבלה</th>
                  <th className="px-3 py-2 text-sm font-semibold text-dark-700">שולם</th>
                  <th className="px-3 py-2 text-sm font-semibold text-dark-700"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-dark-200">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-dark-50">
                    <td className="px-3 py-2 font-medium text-dark-900">{row.full_name}</td>
                    <td className="px-3 py-2 text-dark-600" dir="ltr">{row.phone || '-'}</td>
                    <td className="px-3 py-2 text-dark-600" dir="ltr">{row.instagram_handle || '-'}</td>
                    <td className="px-3 py-2 text-dark-900">
                      ₪{Number(row.payment_amount).toLocaleString('he-IL')}
                    </td>
                    <td className="px-3 py-2">
                      {row.receipt_storage_path ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewReceipt(row)}
                            className="p-1.5 rounded hover:bg-dark-100 text-primary-600"
                            title="צפה בקבלה"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveReceipt(row)}
                            className="p-1.5 rounded hover:bg-red-100 text-red-500"
                            title="הסר קבלה"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => triggerUpload(row.id)}
                          disabled={uploadingId === row.id}
                          className="px-2 py-1 text-xs rounded bg-dark-100 hover:bg-dark-200 text-dark-700 inline-flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingId === row.id ? 'מעלה…' : 'העלאה'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleTogglePaid(row)}
                        className={`w-5 h-5 rounded-full transition-all hover:ring-2 hover:ring-offset-2 ${
                          row.paid
                            ? 'bg-green-500 hover:ring-green-300'
                            : 'bg-red-500 hover:ring-red-300'
                        }`}
                        title={row.paid ? 'שולם — לחץ לביטול' : 'לא שולם — לחץ לסימון'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(row)}
                          className="p-1.5 rounded hover:bg-dark-100 text-dark-600"
                          title="עריכה"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-500"
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
          </div>
        )}
      </div>
    </Modal>
  );
}
