import { useState, useEffect } from 'react';
import { CheckCircle2, ClipboardList, Plus, User, Truck, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/format';
import { formatPhoneMask } from '@/components/logistics/Common';
import { useLogisticsPricing } from '@/lib/useLogisticsPricing';
import { GruzchikCalculator } from '@/components/logistics/GruzchikCalculator';
import { KranCalculator } from '@/components/logistics/KranCalculator';
import { MusirCalculator } from '@/components/logistics/MusirCalculator';
import { LoadingSpinner, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { callTelegramBot } from '@/lib/telegram';
import type { LogisticsService } from '@/types/logistics';

const services: { id: LogisticsService; labelKey: 'serviceGruzchik' | 'serviceKran' | 'serviceMusir'; icon: typeof User }[] = [
  { id: 'gruzchik', labelKey: 'serviceGruzchik', icon: User },
  { id: 'kran', labelKey: 'serviceKran', icon: Truck },
  { id: 'musir', labelKey: 'serviceMusir', icon: Wrench },
];

export function CreateLogisticsOrderModal({ open, initialService, onClose, onCreated }: { open: boolean; initialService?: LogisticsService; onClose: () => void; onCreated: () => void }) {
  const { t } = useApp();
  const { staff } = useAuth();
  const { data: pricing, loading, error, reload } = useLogisticsPricing();
  const [service, setService] = useState<LogisticsService>(initialService || 'gruzchik');
  const [details, setDetails] = useState<Record<string, unknown>>({});
  
  useEffect(() => {
    if (initialService) setService(initialService);
  }, [initialService, open]);
  const [price, setPrice] = useState(0);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [datetime, setDatetime] = useState('');
  const [note, setNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedOrder, setSavedOrder] = useState<{ order_number: string; estimated_price: number } | null>(null);

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  const validate = (): string | null => {
    if (!name.trim()) return t('fieldRequired') + ': ' + t('loCustomerName');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return t('phoneInvalid2');
    if (!address.trim()) return t('fieldRequired') + ': ' + t('loAddress');
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError('');

    const { data, error: insertError } = await supabase.from('logistics_orders').insert({
      service,
      customer_name: name.trim(),
      customer_phone: formatPhoneMask(phone),
      address: address.trim(),
      datetime: datetime || null,
      note: note.trim(),
      details,
      estimated_price: price,
      seller_name: staff?.full_name ?? '',
    }).select('id, order_number, estimated_price').single();

    if (insertError) {
      setFormError(insertError.message);
      setSaving(false);
      return;
    }

    setSavedOrder(data as { order_number: string; estimated_price: number });
    setSaving(false);
    callTelegramBot('notify_logistics_order', { order_id: (data as { id: string }).id }).catch(() => {});
    onCreated?.();
  };

  const reset = () => {
    setSavedOrder(null);
    setName(''); setPhone(''); setAddress(''); setDatetime(''); setNote('');
    setDetails({}); setPrice(0); setFormError('');
  };

  if (savedOrder) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">{t('orderSaved')}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('orderNum')}: <span className="font-mono font-semibold">{savedOrder.order_number}</span></p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('estimatedSum')}: <span className="font-semibold">{formatCurrency(savedOrder.estimated_price)}</span></p>
        <button onClick={reset} className="btn-primary mt-6"><Plus className="h-4 w-4" /> {t('newOrderAgain')}</button>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('newOrderTitle')} size="xl">
      <div className="space-y-6 pb-20">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('chooseService')}</p>
          <div className="grid grid-cols-3 gap-2">
            {services.map(s => {
              const Icon = s.icon;
              const active = service === s.id;
              return (
                <button key={s.id} onClick={() => { setService(s.id); setDetails({}); setPrice(0); }}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all ${active ? 'border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-900/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
                  <Icon className={`h-5 w-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}>{t(s.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          {service === 'gruzchik' && <GruzchikCalculator pricing={pricing} onChange={(d, p) => { setDetails(d); setPrice(p); }} />}
          {service === 'kran' && <KranCalculator pricing={pricing} onChange={(d, p) => { setDetails(d); setPrice(p); }} />}
          {service === 'musir' && <MusirCalculator pricing={pricing} onChange={(d, p) => { setDetails(d); setPrice(p); }} />}
        </div>

        <div className="card space-y-4 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><ClipboardList className="h-4 w-4" /> {t('customerInfo')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('loCustomerName')}</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder={t('loCustomerName')} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('loCustomerPhone')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className="input-field" placeholder="+998 90 123-45-67" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('loAddress')}</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className="input-field" placeholder={t('loAddress')} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('loDateTime')}</label>
              <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('loNote')}</label>
              <input value={note} onChange={e => setNote(e.target.value)} className="input-field" placeholder={t('loNote')} />
            </div>
          </div>
          {formError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">{formError}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('estimatedPrice')}</p>
            <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(price)}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost">{t('cancel')}</button>
            <button onClick={save} disabled={saving || price <= 0} className="btn-primary min-w-40 justify-center disabled:opacity-50">
              {saving ? t('loading') : t('saveOrder')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
