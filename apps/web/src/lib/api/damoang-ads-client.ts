/**
 * damoang-ads API 클라이언트
 *
 * ads.damoang.net (포트 9090)의 프로모션 설정 API와 연동합니다.
 * SvelteKit SSR 프록시를 통해 호출됩니다.
 */

const ADS_API_BASE = '/api/v1/promotion';

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
    };
}

/** 전역 프로모션 설정 */
export interface PromotionGlobalSettings {
    board_exception: string; // 콤마 구분 게시판 ID
    insert_index: number;
    min_cnt_for_insert_index: number;
    how_many_to_display: number;
}

/** 광고주 정보 */
export interface Advertiser {
    id: number;
    name: string;
    member_id: string;
    level: number;
    is_active: boolean;
    created_at: string;
}

/**
 * 전역 프로모션 설정 조회
 */
export async function getPromotionSettings(): Promise<PromotionGlobalSettings> {
    try {
        const response = await fetch(`${ADS_API_BASE}/settings`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<PromotionGlobalSettings> = await response.json();
        return (
            result.data ?? {
                board_exception: '',
                insert_index: 15,
                min_cnt_for_insert_index: 20,
                how_many_to_display: 2
            }
        );
    } catch {
        // 프로모션 API 미연결 시 기본값 반환
        return {
            board_exception: '',
            insert_index: 15,
            min_cnt_for_insert_index: 20,
            how_many_to_display: 2
        };
    }
}

/**
 * 전역 프로모션 설정 수정
 */
export async function updatePromotionSettings(
    settings: Partial<PromotionGlobalSettings>
): Promise<PromotionGlobalSettings> {
    const response = await fetch(`${ADS_API_BASE}/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.error?.message || `HTTP ${response.status}`);
    }
    const result: APIResponse<PromotionGlobalSettings> = await response.json();
    return result.data;
}

/**
 * 게시판을 프로모션 제외 목록에 추가/제거
 */
export async function toggleBoardException(
    boardId: string,
    exclude: boolean,
    currentExceptions: string
): Promise<string> {
    const exceptions = currentExceptions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    if (exclude && !exceptions.includes(boardId)) {
        exceptions.push(boardId);
    } else if (!exclude) {
        const idx = exceptions.indexOf(boardId);
        if (idx >= 0) exceptions.splice(idx, 1);
    }

    const newExceptions = exceptions.join(',');
    await updatePromotionSettings({ board_exception: newExceptions });
    return newExceptions;
}

/**
 * 광고주 목록 조회
 */
export async function listAdvertisers(): Promise<Advertiser[]> {
    try {
        const response = await fetch(`${ADS_API_BASE}/advertisers`, {
            credentials: 'include'
        });
        if (!response.ok) return [];
        const result: APIResponse<Advertiser[]> = await response.json();
        return result.data ?? [];
    } catch {
        return [];
    }
}
