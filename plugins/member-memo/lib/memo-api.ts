/**
 * 회원 메모 API 래퍼
 * Go 백엔드 v1 API와 통신
 */

export interface MemoData {
    target_id: string;
    content: string;
    memo_detail: string;
    color: string;
    _token?: string;
    updated_at?: string;
}

/**
 * 특정 회원에 대한 메모 조회
 * GET /api/v1/members/{id}/memo
 */
export async function fetchMemo(targetMemberId: string): Promise<MemoData | null> {
    try {
        const res = await fetch(`/api/v1/members/${encodeURIComponent(targetMemberId)}/memo`, {
            credentials: 'include'
        });

        if (!res.ok) {
            if (res.status === 403) return null; // 비로그인
            return null;
        }

        const json = await res.json();
        const data = json.data;

        if (!data || !data.content) return null;

        return {
            target_id: data.target_id ?? targetMemberId,
            content: data.content ?? '',
            memo_detail: data.memo_detail ?? '',
            color: data.color ?? 'yellow',
            _token: data._token,
            updated_at: data.updated_at
        };
    } catch {
        return null;
    }
}

/**
 * 메모 저장 (생성/수정)
 * POST /api/v1/members/{id}/memo
 */
export async function saveMemo(
    targetMemberId: string,
    data: { content: string; memo_detail?: string; color?: string }
): Promise<MemoData> {
    const res = await fetch(`/api/v1/members/${encodeURIComponent(targetMemberId)}/memo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            target_id: targetMemberId,
            content: data.content,
            memo_detail: data.memo_detail ?? '',
            color: data.color ?? 'yellow'
        })
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message ?? '메모 저장에 실패했습니다.');
    }

    const json = await res.json();
    return {
        target_id: json.data.target_id ?? targetMemberId,
        content: json.data.content ?? data.content,
        memo_detail: json.data.memo_detail ?? data.memo_detail ?? '',
        color: json.data.color ?? data.color ?? 'yellow',
        updated_at: json.data.updated_at
    };
}

/**
 * 메모 삭제
 * DELETE /api/v1/members/{id}/memo
 */
export async function deleteMemo(targetMemberId: string): Promise<void> {
    const res = await fetch(`/api/v1/members/${encodeURIComponent(targetMemberId)}/memo`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message ?? '메모 삭제에 실패했습니다.');
    }
}
