/**
 * Commerce Plugin API 클라이언트
 *
 * Admin에서 Commerce 플러그인의 데이터를 관리합니다.
 */

// Backend API 기본 URL (환경변수로 설정 가능)
const BACKEND_API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8081';
const COMMERCE_API_URL = `${BACKEND_API_BASE_URL}/api/plugins/commerce`;

// ============================================
// 타입 정의
// ============================================

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

// ============================================
// 상품 API
// ============================================

/**
 * 상품 목록 조회 (관리자용)
 */
export async function getProducts(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Product>> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });
        if (status) params.append('status', status);

        const response = await fetch(`${COMMERCE_API_URL}/admin/products?${params}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('상품 목록 조회 실패:', error);
        throw error;
    }
}

/**
 * 상품 상세 조회
 */
export async function getProduct(id: number): Promise<Product> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/products/${id}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('상품 상세 조회 실패:', error);
        throw error;
    }
}

/**
 * 상품 상태 변경 (관리자)
 */
export async function updateProductStatus(id: number, status: string): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/products/${id}`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('상품 상태 변경 실패:', error);
        throw error;
    }
}

// ============================================
// 주문 API
// ============================================

/**
 * 주문 목록 조회 (관리자용)
 */
export async function getOrders(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Order>> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });
        if (status) params.append('status', status);

        const response = await fetch(`${COMMERCE_API_URL}/admin/orders?${params}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('주문 목록 조회 실패:', error);
        throw error;
    }
}

/**
 * 주문 상세 조회
 */
export async function getOrder(id: number): Promise<Order> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/orders/${id}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('주문 상세 조회 실패:', error);
        throw error;
    }
}

/**
 * 주문 상태 변경 (관리자)
 */
export async function updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/orders/${id}/status`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('주문 상태 변경 실패:', error);
        throw error;
    }
}

// ============================================
// 정산 API
// ============================================

/**
 * 정산 목록 조회 (관리자용)
 */
export async function getSettlements(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Settlement>> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });
        if (status) params.append('status', status);

        const response = await fetch(`${COMMERCE_API_URL}/admin/settlements?${params}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('정산 목록 조회 실패:', error);
        throw error;
    }
}

/**
 * 정산 처리
 */
export async function processSettlement(id: number): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/settlements/${id}/process`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('정산 처리 실패:', error);
        throw error;
    }
}

// ============================================
// 쿠폰 API
// ============================================

/**
 * 쿠폰 목록 조회 (관리자용)
 */
export async function getCoupons(page = 1, limit = 20): Promise<PaginatedResponse<Coupon>> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });

        const response = await fetch(`${COMMERCE_API_URL}/admin/coupons?${params}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('쿠폰 목록 조회 실패:', error);
        throw error;
    }
}

/**
 * 쿠폰 생성
 */
export async function createCoupon(coupon: Partial<Coupon>): Promise<Coupon> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/coupons`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(coupon)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('쿠폰 생성 실패:', error);
        throw error;
    }
}

/**
 * 쿠폰 수정
 */
export async function updateCoupon(id: number, coupon: Partial<Coupon>): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/coupons/${id}`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(coupon)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('쿠폰 수정 실패:', error);
        throw error;
    }
}

/**
 * 쿠폰 삭제
 */
export async function deleteCoupon(id: number): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/coupons/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('쿠폰 삭제 실패:', error);
        throw error;
    }
}

// ============================================
// 리뷰 API
// ============================================

/**
 * 리뷰 목록 조회 (관리자용)
 */
export async function getReviews(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Review>> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });
        if (status) params.append('status', status);

        const response = await fetch(`${COMMERCE_API_URL}/admin/reviews?${params}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('리뷰 목록 조회 실패:', error);
        throw error;
    }
}

/**
 * 리뷰 상태 변경 (승인/거부)
 */
export async function updateReviewStatus(
    id: number,
    status: 'approved' | 'rejected'
): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/reviews/${id}/status`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('리뷰 상태 변경 실패:', error);
        throw error;
    }
}

/**
 * 리뷰 삭제
 */
export async function deleteReview(id: number): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/reviews/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('리뷰 삭제 실패:', error);
        throw error;
    }
}

// ============================================
// 대시보드 API
// ============================================

export interface CommerceDashboard {
    total_products: number;
    total_orders: number;
    total_revenue: number;
    pending_orders: number;
    pending_settlements: number;
    recent_orders: Order[];
    top_products: Product[];
}

/**
 * 대시보드 데이터 조회
 */
export async function getDashboard(): Promise<CommerceDashboard> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/dashboard`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('대시보드 조회 실패:', error);
        throw error;
    }
}

// ============================================
// 유틸리티
// ============================================

/**
 * 인증 헤더 가져오기
 */
function getAuthHeaders(): Record<string, string> {
    // TODO: 실제 인증 토큰 구현 필요
    const token = localStorage.getItem('admin_token');
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

/**
 * 금액 포맷 (원화)
 */
export function formatCurrency(amount: number, currency = 'KRW'): string {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency
    }).format(amount);
}

/**
 * 날짜 포맷
 */
export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 주문 상태 한글 변환
 */
export function getOrderStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
        pending: '결제 대기',
        paid: '결제 완료',
        processing: '처리 중',
        shipped: '배송 중',
        delivered: '배송 완료',
        completed: '구매 확정',
        cancelled: '취소됨',
        refunded: '환불됨'
    };
    return labels[status] || status;
}

/**
 * 주문 상태별 색상
 */
export function getOrderStatusVariant(
    status: OrderStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'paid':
        case 'completed':
            return 'default';
        case 'pending':
        case 'processing':
            return 'secondary';
        case 'cancelled':
        case 'refunded':
            return 'destructive';
        default:
            return 'outline';
    }
}
