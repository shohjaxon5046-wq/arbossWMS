import { itemQrValue, modelQrValue } from '@/lib/orders';
import type { Label } from '@/lib/labels';
import type { TranslationKey } from '@/lib/i18n';
import type { ProductItem, ProductModel } from '@/types';

export const SPEC_FIELDS: { key: string; labelKey: TranslationKey; placeholder: string }[] = [
  { key: 'power', labelKey: 'catSpecPower', placeholder: '800 W' },
  { key: 'impact', labelKey: 'catSpecImpact', placeholder: '2.7 J' },
  { key: 'chuck', labelKey: 'catSpecChuck', placeholder: 'SDS-plus' },
  { key: 'weight', labelKey: 'catSpecWeight', placeholder: '2.9 kg' },
  { key: 'source', labelKey: 'catSpecSource', placeholder: '220 V' },
  { key: 'extra', labelKey: 'catSpecExtra', placeholder: '' },
];

export interface ModelForm {
  name: string;
  brand: string;
  model_code: string;
  category: string;
  image_url: string;
  description: string;
  specs: Record<string, string>;
  daily_price: string;
  deposit_amount: string;
  weekly_discount_pct: string;
  monthly_discount_pct: string;
  depreciation_pct: string;
  is_active: boolean;
  kit_items: string[];
  consumables: string[];
}

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function toForm(m: ProductModel | null): ModelForm {
  return {
    name: m?.name ?? '',
    brand: m?.brand ?? '',
    model_code: m?.model_code ?? '',
    category: m?.category ?? '',
    image_url: m?.image_url ?? '',
    description: m?.description ?? '',
    specs: { ...(m?.specs ?? {}) },
    daily_price: m ? String(m.daily_price || '') : '',
    deposit_amount: m ? String(m.deposit_amount || '') : '',
    weekly_discount_pct: m ? String(m.weekly_discount_pct || '') : '',
    monthly_discount_pct: m ? String(m.monthly_discount_pct || '') : '',
    depreciation_pct: m ? String(m.depreciation_pct ?? 2) : '2',
    is_active: m?.is_active ?? true,
    kit_items: asList(m?.kit_items),
    consumables: asList(m?.consumables),
  };
}

const pct = (v: string) => Math.min(100, Math.max(0, Number(v) || 0));
const money = (v: string) => Math.max(0, Math.round(Number(v) || 0));

export function toPayload(f: ModelForm, includePrices: boolean) {
  const specs = Object.fromEntries(Object.entries(f.specs).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  const base = {
    name: f.name.trim(),
    brand: f.brand.trim(),
    model_code: f.model_code.trim(),
    category: f.category.trim(),
    image_url: f.image_url,
    description: f.description.trim(),
    specs,
    kit_items: f.kit_items,
    consumables: f.consumables,
  };
  if (!includePrices) return base;
  return {
    ...base,
    daily_price: money(f.daily_price),
    deposit_amount: money(f.deposit_amount),
    weekly_discount_pct: pct(f.weekly_discount_pct),
    monthly_discount_pct: pct(f.monthly_discount_pct),
    depreciation_pct: pct(f.depreciation_pct),
    is_active: f.is_active,
  };
}

export function modelLabel(m: ProductModel): Label {
  return { qrValue: modelQrValue(m), title: m.name, subtitle: m.model_code || m.brand || undefined };
}

export function unitLabels(model: ProductModel, items: ProductItem[]): Label[] {
  return items.map(i => ({ qrValue: itemQrValue(i.serial_number), title: i.serial_number, subtitle: model.name }));
}
