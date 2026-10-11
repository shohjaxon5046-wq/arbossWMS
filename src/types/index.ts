export type UserRole = 'admin' | 'manager' | 'seller' | 'cashier' | 'warehouse';

export interface Staff {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string;
  telegram_chat_id: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WarehouseLocation {
  id: string;
  sector: string;
  rack: string;
  shelf: string;
  code: string;
  capacity: number;
  is_active: boolean;
  description: string;
  created_at: string;
}

export interface ProductModel {
  id: string;
  name: string;
  brand: string;
  category: string;
  daily_price: number;
  hourly_price: number;
  deposit_amount: number;
  description: string;
  image_url: string;
  specs: Record<string, string>;
  kit_items: string[];
  consumables: string[];
  model_code: string;
  weekly_discount_pct: number;
  monthly_discount_pct: number;
  depreciation_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductItemStatus =
  | 'omborda_bosh' | 'ijarada' | 'tamirda' | 'yoqolgan' | 'sotildi'
  | 'joylashtirish_kutilmoqda' | 'qaytarish_kutilmoqda' | 'qaytarilmoqda' | 'qaytarildi';

export interface ProductItem {
  id: string;
  model_id: string;
  serial_number: string;
  barcode: string;
  status: ProductItemStatus;
  warehouse_location_id: string | null;
  warehouse_location_shelf: string;
  current_order_id: string | null;
  purchase_date: string | null;
  purchase_price: number;
  supplier_id: string | null;
  purchase_order_id: string | null;
  defect_reason: string;
  depreciation_pct: number | null;
  rental_count: number;
  rental_days_total: number;
  revenue_total: number;
  depreciation_total: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  notes: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export type SupplierTransactionType = 'payment' | 'purchase' | 'return' | 'adjustment';

export interface SupplierTransaction {
  id: string;
  supplier_id: string;
  transaction_type: SupplierTransactionType;
  amount: number;
  currency: string;
  reference_id: string | null;
  date: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export type PurchaseOrderStatus = 'yangi' | 'yuborildi' | 'qisman_qabul' | 'qabul_qilindi' | 'bekor';

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  model_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  expected_date: string | null;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  erp_purchase_order_lines: PurchaseOrderLine[];
}

export type SupplierReturnStatus = 'yangi' | 'yuborildi' | 'almashtirildi' | 'pul_qaytarildi';

export interface SupplierReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  status: SupplierReturnStatus;
  reason: string;
  notes: string;
  sent_at: string | null;
  closed_at: string | null;
  created_by: string;
  created_at: string;
  erp_supplier_return_items: { product_item_id: string }[];
}

export interface InboundData {
  suppliers: Supplier[];
  models: ProductModel[];
  locations: WarehouseLocation[];
  items: ProductItem[];
  orders: PurchaseOrder[];
  returns: SupplierReturn[];
}

export interface Customer {
  id: string;
  full_name: string;
  phone_primary: string;
  phone_secondary: string;
  balance: number;
  debt: number;
  status: string;
  passport_series: string;
  passport_number: string;
  passport_photo_url: string;
  address: string;
  notes: string;
  rating: number;
  total_orders: number;
  total_spent: number;
  source: 'manual' | 'ibox';
  external_id: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'yangi' | 'yigilmoqda' | 'faol_ijarada' | 'kechikkan' | 'yakunlandi' | 'bekor';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  total_rent_amount: number;
  total_service_amount: number;
  discount_amount: number;
  paid_amount: number;
  debt_amount: number;
  total_deposit_amount: number;
  deposit_returned: number;
  start_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  delivery_type: string;
  delivery_address: string;
  notes: string;
  created_by: string;
  created_by_user_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_item_id: string | null;
  model_id: string | null;
  model_name: string;
  serial_number: string;
  rent_days: number;
  daily_price: number;
  deposit_amount: number;
  picking_status: string;
  return_status: string;
  discount_pct: number;
  line_total: number;
  depreciation_applied: number;
  created_at: string;
}

export interface CashRegister {
  id: string;
  name: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderPayment {
  id: string;
  order_id: string;
  amount: number;
  payment_type: string;
  cash_register_id: string | null;
  date: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  cash_register_id: string | null;
  date: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface PartnerSpecs {
  // Avtokran
  lifting_capacity?: string; // masalan 16t, 25t, 50t
  boom_length?: string; // masalan 21m, 28m, 35m
  min_hours?: string; // kamida 2 soat
  
  // Manipulyator
  body_capacity?: string; // 5t, 10t
  crane_capacity?: string; // 3t, 5t
  body_length?: string; // 6 metr
  
  // Avtolift (Fasad lifti)
  lift_height?: string; // 12-qavat / 35 metr
  basket_capacity?: string; // 400 kg
  
  // Musor mashina
  body_volume?: string; // 8 m³, 16 m³
  tonnage?: string; // 3t, 5t, 10t
  trip_price?: number | string; // 1 reys narxi (so'm)
  
  // Gruzchik
  worker_count?: string | number; // kishi
  rate_type?: string; // 'soatlik' | 'ogirlik'
  weight_rate?: string; // kg tarifi
  
  // Narxlar
  hourly_rate?: number | string; // so'm/soat
  custom_specs?: string; // Boshqa maxsus texnika tavsifi
  [key: string]: any;
}

export interface ServicePartner {
  id: string;
  company_name: string;
  service_category: string;
  custom_category_name?: string;
  license_plate?: string;
  driver_name?: string;
  phone_primary: string;
  phone_secondary: string;
  is_available: boolean;
  status: string;
  rating: number;
  notes: string;
  specs?: PartnerSpecs;
  created_at: string;
  updated_at: string;
}

export type ServiceOrderStatus = 'yangi' | 'hamkor_qabul_qildi' | 'hamkor_yolda' | 'bajarilmoqda' | 'bajarildi' | 'bekor';

export interface ServiceOrder {
  id: string;
  order_id: string | null;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  assigned_partner_id: string | null;
  service_category: string;
  service_details: string;
  order_status: ServiceOrderStatus;
  customer_total_price: number;
  partner_cost: number;
  net_profit: number;
  address: string;
  scheduled_time: string;
  completed_at: string | null;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ServicePricing {
  id: string;
  partner_id: string;
  service_type_detail: string;
  selling_price: number;
  cost_price: number;
  unit: string;
  min_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export type MaintenanceKind = 'inspection' | 'repair' | 'replacement';

export interface MaintenanceLog {
  id: string;
  item_id: string;
  log_date: string;
  kind: MaintenanceKind;
  works: string;
  cost: number;
  master: string;
  created_at: string;
}

export interface AiConversation {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
