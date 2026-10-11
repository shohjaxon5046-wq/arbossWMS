import type { PurchaseOrder, UserRole } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

export const SHELF_QR_PREFIX = 'LOC:';

export function canManageInbound(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'warehouse';
}

export function buildShelfCode(sector: string, rack: string, shelf: string): string {
  return [sector, rack, shelf].map(p => p.trim().toUpperCase()).join('-');
}

export function parseScannedShelf(raw: string): string {
  const value = raw.trim().toUpperCase();
  return value.startsWith(SHELF_QR_PREFIX) ? value.slice(SHELF_QR_PREFIX.length).trim() : value;
}

export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function generateDocNumber(prefix: string): string {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(2)}${padNumber(d.getMonth() + 1, 2)}${padNumber(d.getDate(), 2)}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

export function orderTotals(o: PurchaseOrder) {
  const lines = Array.isArray(o?.erp_purchase_order_lines) ? o.erp_purchase_order_lines : [];
  return {
    ordered: lines.reduce((s, l) => s + (Number(l.quantity_ordered) || 0), 0),
    received: lines.reduce((s, l) => s + (Number(l.quantity_received) || 0), 0),
    sum: lines.reduce((s, l) => s + (Number(l.quantity_ordered) || 0) * (Number(l.unit_price) || 0), 0),
  };
}

const errorMap: [string, TranslationKey][] = [
  ['FORBIDDEN', 'errForbidden'],
  ['row-level security', 'errForbidden'],
  ['TOO_MANY', 'errTooMany'],
  ['DUPLICATE_SERIAL', 'errDuplicateSerial'],
  ['uq_pi_serial', 'errDuplicateSerial'],
  ['SERIAL_REQUIRED', 'errSerialRequired'],
  ['LOCATION_NOT_FOUND', 'errLocationNotFound'],
  ['NOT_AWAITING_PUTAWAY', 'errNotAwaiting'],
  ['ORDER_CLOSED', 'errOrderClosed'],
  ['NOTHING_TO_RECEIVE', 'errNothing'],
  ['ITEM_NOT_RETURNABLE', 'errNotReturnable'],
  ['INVALID_TRANSITION', 'errInvalidTransition'],
  ['uq_wh_loc_code', 'errDuplicateCode'],
  ['foreign key', 'errInUse'],
];

export function inboundErrorKey(err: unknown): TranslationKey {
  const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
  return errorMap.find(([needle]) => message.includes(needle))?.[1] ?? 'errGeneric';
}
