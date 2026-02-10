/**
 * 중고게시판 타입 정의
 */
import type { FreePost } from '$lib/api/types.js';

/** 중고 판매 상태 */
export type MarketStatus = 'selling' | 'reserved' | 'sold';

/** 중고 물품 상태 */
export type ItemCondition = 'new' | 'like-new' | 'good' | 'fair';

/** 중고게시판 게시글 */
export interface UsedMarketPost extends FreePost {
	market: {
		price: number; // extra_1
		status: MarketStatus; // extra_2
		condition: ItemCondition; // extra_3
		location: string; // extra_4
		shippingAvailable: boolean; // extra_5
	};
}

/** 판매 상태 라벨 */
export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
	selling: '판매중',
	reserved: '예약중',
	sold: '판매완료'
};

/** 물품 상태 라벨 */
export const ITEM_CONDITION_LABELS: Record<ItemCondition, string> = {
	new: '새상품',
	'like-new': '거의새것',
	good: '양호',
	fair: '사용감있음'
};

/** extra 필드에서 중고 정보 파싱 */
export function parseMarketInfo(post: FreePost): UsedMarketPost['market'] {
	return {
		price: parseInt(post.extra_1 || '0', 10) || 0,
		status: (post.extra_2 as MarketStatus) || 'selling',
		condition: (post.extra_3 as ItemCondition) || 'good',
		location: post.extra_4 || '',
		shippingAvailable: post.extra_5 === '1' || post.extra_5 === 'true'
	};
}

/** 가격 포맷 (원화) */
export function formatPrice(price: number): string {
	if (price === 0) return '무료나눔';
	return `${price.toLocaleString()}원`;
}
