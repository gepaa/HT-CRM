// Shopify webhook payload types (placeholders for future integration)

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  addresses: ShopifyAddress[];
  created_at: string;
  updated_at: string;
  tags: string;
  note: string | null;
}

export interface ShopifyAddress {
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string | null;
  company: string | null;
}

export interface ShopifyOrder {
  id: number;
  email: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: ShopifyCustomer;
  line_items: ShopifyLineItem[];
  note: string | null;
  tags: string;
  landing_site: string | null;
  referring_site: string | null;
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
  product_id: number;
  variant_id: number;
}

export interface ShopifyDraftOrder {
  id: number;
  email: string;
  created_at: string;
  total_price: string;
  currency: string;
  customer: ShopifyCustomer;
  line_items: ShopifyLineItem[];
  note: string | null;
  tags: string;
  status: string;
}

export type ShopifyWebhookTopic =
  | 'customers/create'
  | 'orders/create'
  | 'draft_orders/create'
  | 'checkouts/create'
  | 'carts/create';
