/**
 * Commerce 관련 타입 정의
 */

export interface Product {
    id: number;
    seller_id: number;
    name: string;
    slug: string;
    description: string;
    short_desc: string;
    product_type: 'digital' | 'physical';
    price: number;
    original_price?: number;
    currency: string;
    stock_quantity?: number;
    stock_status: string;
    download_limit?: number;
    download_expiry?: number;
    status: 'draft' | 'published' | 'archived';
    visibility: string;
    featured_image: string;
    sales_count: number;
    view_count: number;
    created_at: string;
    updated_at: string;
}

export interface Order {
    id: number;
    order_number: string;
    user_id: number;
    subtotal: number;
    discount: number;
    shipping_fee: number;
    total: number;
    currency: string;
    status: OrderStatus;
    shipping_name?: string;
    shipping_phone?: string;
    shipping_address?: string;
    shipping_postal?: string;
    shipping_memo?: string;
    carrier_code?: string;
    tracking_number?: string;
    paid_at?: string;
    shipped_at?: string;
    delivered_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    created_at: string;
    updated_at: string;
    items?: OrderItem[];
}

export type OrderStatus =
    | 'pending'
    | 'paid'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'refunded';

export interface OrderItem {
    id: number;
    order_id: number;
    product_id: number;
    product_name: string;
    product_type: string;
    price: number;
    quantity: number;
    subtotal: number;
    created_at: string;
}

export interface Settlement {
    id: number;
    seller_id: number;
    period_start: string;
    period_end: string;
    total_sales: number;
    total_orders: number;
    pg_fee: number;
    platform_fee: number;
    net_amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed_at?: string;
    created_at: string;
}

export interface Coupon {
    id: number;
    code: string;
    name: string;
    description: string;
    discount_type: 'fixed' | 'percentage' | 'free_shipping';
    discount_value: number;
    min_order_amount?: number;
    max_discount_amount?: number;
    usage_limit?: number;
    usage_count: number;
    start_date?: string;
    end_date?: string;
    is_active: boolean;
    is_public: boolean;
    created_at: string;
}

export interface Review {
    id: number;
    product_id: number;
    user_id: number;
    order_item_id: number;
    rating: number;
    title: string;
    content: string;
    images?: string[];
    helpful_count: number;
    seller_reply?: string;
    seller_reply_at?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    updated_at: string;
    product?: Product;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

export interface CommerceDashboard {
    total_products: number;
    total_orders: number;
    total_revenue: number;
    pending_orders: number;
    pending_settlements: number;
    recent_orders: Order[];
    top_products: Product[];
}
