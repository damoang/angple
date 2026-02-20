/**
 * Commerce Plugin API 클라이언트
 */

import type {
    Product,
    Order,
    OrderStatus,
    Settlement,
    Coupon,
    Review,
    PaginatedResponse,
    CommerceDashboard
} from '$lib/types/admin-commerce';

const BACKEND_API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8090';
const COMMERCE_API_URL = `${BACKEND_API_BASE_URL}/api/plugins/commerce`;

// Re-export types for convenience
export type {
    Product,
    Order,
    OrderStatus,
    Settlement,
    Coupon,
    Review,
    PaginatedResponse,
    CommerceDashboard
};

export async function getProducts(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Product>> {
    try {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
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

export async function updateProductStatus(id: number, status: string): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/products/${id}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('상품 상태 변경 실패:', error);
        throw error;
    }
}

export async function getOrders(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Order>> {
    try {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
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

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/orders/${id}/status`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('주문 상태 변경 실패:', error);
        throw error;
    }
}

export async function getSettlements(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Settlement>> {
    try {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
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

export async function getCoupons(page = 1, limit = 20): Promise<PaginatedResponse<Coupon>> {
    try {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
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

export async function createCoupon(coupon: Partial<Coupon>): Promise<Coupon> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/coupons`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
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

export async function updateCoupon(id: number, coupon: Partial<Coupon>): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/coupons/${id}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(coupon)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('쿠폰 수정 실패:', error);
        throw error;
    }
}

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

export async function getReviews(
    page = 1,
    limit = 20,
    status?: string
): Promise<PaginatedResponse<Review>> {
    try {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
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

export async function updateReviewStatus(
    id: number,
    status: 'approved' | 'rejected'
): Promise<void> {
    try {
        const response = await fetch(`${COMMERCE_API_URL}/admin/reviews/${id}/status`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('리뷰 상태 변경 실패:', error);
        throw error;
    }
}

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

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('admin_token');
    if (token) {
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

export function formatCurrency(amount: number, currency = 'KRW'): string {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount);
}

export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

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
