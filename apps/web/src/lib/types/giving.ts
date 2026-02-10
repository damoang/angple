/**
 * 나눔 게시판 타입 정의
 * PHP g5_giving_bid 테이블 + wr_1~wr_10 매핑
 */
import type { FreePost } from '$lib/api/types.js';

/** 나눔 상태 */
export type GivingStatus = 'waiting' | 'active' | 'paused' | 'ended';

/** 나눔 게시글 (extra 필드 파싱 결과) */
export interface GivingPost extends FreePost {
	giving: {
		pointsPerNumber: number; // extra_2
		itemName: string; // extra_3
		startTime: string; // extra_4
		endTime: string; // extra_5
		deliveryType: string; // extra_6
		status: GivingStatus;
		participantCount: number;
		isUrgent: boolean;
	};
}

/** 나눔 응모 정보 */
export interface GivingBid {
	bid_id: number;
	mb_id: string;
	mb_nick: string;
	bid_numbers: string; // "1,3,5-10"
	bid_count: number;
	bid_points: number;
	bid_datetime: string;
}

/** 나눔 목록 아이템 (API 응답용) */
export interface GivingItem {
	id: number;
	title: string;
	thumbnail: string;
	link: string;
	participants: number;
	end_time: string;
	start_time: string;
	is_urgent: boolean;
	status: GivingStatus;
	item_name?: string;
	points_per_number?: number;
}

/** 나눔 상세 정보 */
export interface GivingDetail {
	post: GivingPost;
	bids: GivingBid[];
	myBids?: GivingBid[];
	totalParticipants: number;
	totalBidCount: number;
	winner?: {
		mb_id: string;
		mb_nick: string;
		winning_number: number;
	};
}

/** extra 필드에서 나눔 상태 파싱 */
export function parseGivingStatus(
	extra_4?: string,
	extra_5?: string,
	extra_7?: string
): GivingStatus {
	// 강제종료
	if (extra_7 === '2') return 'ended';
	// 일시정지
	if (extra_7 === '1') return 'paused';

	const now = new Date();
	const start = extra_4 ? new Date(extra_4) : null;
	const end = extra_5 ? new Date(extra_5) : null;

	// 종료시간 지남
	if (end && end <= now) return 'ended';
	// 시작 전
	if (start && start > now) return 'waiting';

	return 'active';
}

/** 긴급 여부 (24시간 이내 종료) */
export function isGivingUrgent(endTime?: string): boolean {
	if (!endTime) return false;
	const end = new Date(endTime);
	const now = new Date();
	const diff = end.getTime() - now.getTime();
	return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}

/** 번호 문자열 파싱: "1,3,5-10,15~20" → [1,3,5,6,7,8,9,10,15,16,17,18,19,20] */
export function parseBidNumbers(input: string): number[] {
	const numbers: Set<number> = new Set();
	const parts = input
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	for (const part of parts) {
		// 범위: 5-10 또는 5~10
		const rangeMatch = part.match(/^(\d+)\s*[-~]\s*(\d+)$/);
		if (rangeMatch) {
			const start = parseInt(rangeMatch[1], 10);
			const end = parseInt(rangeMatch[2], 10);
			const [min, max] = start <= end ? [start, end] : [end, start];
			for (let i = min; i <= max; i++) {
				numbers.add(i);
			}
		} else {
			const num = parseInt(part, 10);
			if (!isNaN(num) && num > 0) {
				numbers.add(num);
			}
		}
	}

	return Array.from(numbers).sort((a, b) => a - b);
}
