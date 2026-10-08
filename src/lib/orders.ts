import { supabase } from '@/lib/supabase';
import type { TranslationKey } from '@/lib/i18n';
import type { Order, OrderItem, OrderPayment, ProductItem, ProductModel, ServiceOrder, UserRole } from '@/types';

export const ITEM_QR_PREFIX = 'ITM:';
export const MODEL_QR_PREFIX = 'MDL:';

export function itemQrValue(serial: string): string {
  return `${ITEM_QR_PREFIX}${serial}`;
}

export function modelQrValue(model: Pick<ProductModel, 'id' | 'model_code'>): string {
  return `${MODEL_QR_PREFIX}${model.model_code || model.id}`;
}

export type ScanResult = { kind: 'item'; serial: string } | { kind: 'model'; code: string };

export function parseScan(raw: string): ScanResult {
  const value = raw.trim();
  const upper = value.toUpperCase();
  if (upper.startsWith(MODEL_QR_PREFIX)) return { kind: 'model', code: value.slice(MODEL_QR_PREFIX.length).trim() };
  if (upper.startsWith(ITEM_QR_PREFIX)) return { kind: 'item', serial: value.slice(ITEM_QR_PREFIX.length).trim() };
  return { kind: 'item', serial: value };
}

export function canSell(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'seller' || role === 'cashier';
}

export function canEditPrices(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'manager';
}

export function canEditCatalog(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'warehouse';
}

export function rentDiscountPct(model: Pick<ProductModel, 'weekly_discount_pct' | 'monthly_discount_pct'>, days: number): number {
  const monthly = Number(model.monthly_discount_pct) || 0;
  const weekly = Number(model.weekly_discount_pct) || 0;
  if (days >= 30 && monthly > 0) return monthly;
  if (days >= 7 && weekly > 0) return weekly;
  return 0;
}

export function rentLineTotal(model: Pick<ProductModel, 'daily_price' | 'weekly_discount_pct' | 'monthly_discount_pct'>, days: number): number {
  return Math.round(Number(model.daily_price) * days * (100 - rentDiscountPct(model, days)) / 100);
}

export function residualValue(item: Pick<ProductItem, 'purchase_price' | 'depreciation_total'>): number {
  return Math.max(Number(item.purchase_price) - Number(item.depreciation_total), 0);
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isValidImage(file: File): boolean {
  return IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES;
}

export async function uploadImage(bucket: 'model-images' | 'customer-docs', file: File): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export function modelImageUrl(path: string): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from('model-images').getPublicUrl(path).data.publicUrl;
}

const errorMap: [string, TranslationKey][] = [
  ['PRICE_FORBIDDEN', 'catAdminOnly'],
  ['FORBIDDEN', 'errForbidden'],
  ['duplicate key', 'catDuplicate'],
  ['row-level security', 'errForbidden'],
  ['ITEM_UNAVAILABLE', 'errItemUnavailable'],
  ['CUSTOMER_REQUIRED', 'errCustomerRequired'],
  ['EMPTY_ORDER', 'errEmptyOrder'],
  ['OVERPAYMENT', 'errOverpayment'],
  ['INVALID_AMOUNT', 'errInvalidAmount'],
  ['INVALID_DAYS', 'errInvalidDays'],
  ['REGISTER_NOT_FOUND', 'errRegisterNotFound'],
  ['INVALID_TRANSITION', 'errInvalidTransition'],
  ['mime type', 'catImageTooLarge'],
  ['exceeded the maximum', 'catImageTooLarge'],
  ['foreign key', 'errInUse'],
];

export function ordersErrorKey(err: unknown): TranslationKey {
  const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
  return errorMap.find(([needle]) => message.includes(needle))?.[1] ?? 'errGeneric';
}

export interface OrderBundle {
  order: Order;
  items: OrderItem[];
  services: ServiceOrder[];
  payments: OrderPayment[];
  partnerNames: Record<string, string>;
  passport: string;
}

export async function loadOrderBundle(orderId: string): Promise<OrderBundle> {
  const [orderRes, itemsRes, servicesRes, paymentsRes] = await Promise.all([
    supabase.from('erp_orders').select('*').eq('id', orderId).maybeSingle(),
    supabase.from('erp_order_items').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('erp_service_orders').select('*').eq('order_id', orderId).order('order_number'),
    supabase.from('erp_order_payments').select('*').eq('order_id', orderId).order('created_at'),
  ]);
  if (orderRes.error) throw orderRes.error;
  if (!orderRes.data) throw new Error('NOT_FOUND');
  if (itemsRes.error) throw itemsRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  const order = orderRes.data as Order;
  const services = (servicesRes.data || []) as ServiceOrder[];

  const partnerIds = [...new Set(services.map(s => s.assigned_partner_id).filter((x): x is string => !!x))];
  const [partnersRes, customerRes] = await Promise.all([
    partnerIds.length
      ? supabase.from('erp_service_partners').select('id, company_name').in('id', partnerIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[], error: null }),
    order.customer_id
      ? supabase.from('erp_customers').select('passport_series, passport_number').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const passport = customerRes.data ? `${customerRes.data.passport_series ?? ''} ${customerRes.data.passport_number ?? ''}`.trim() : '';

  return {
    order,
    items: (itemsRes.data || []) as OrderItem[],
    services,
    payments: (paymentsRes.data || []) as OrderPayment[],
    partnerNames: Object.fromEntries((partnersRes.data || []).map(p => [p.id, p.company_name])),
    passport,
  };
}

export const SERVICE_CATEGORIES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'avtokran', labelKey: 'crane' },
  { value: 'musor', labelKey: 'truck' },
  { value: 'gruzchik', labelKey: 'movers' },
];
