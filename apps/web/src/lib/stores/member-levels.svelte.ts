/**
 * 회원 레벨 배치 조회 스토어 (Svelte 5 Runes)
 *
 * 게시글/댓글 작성자의 나리야 경험치 레벨(as_level)을 배치로 조회하고 캐시합니다.
 * /api/members/levels 엔드포인트를 사용합니다.
 */

class MemberLevelStore {
    /** mb_id → as_level 캐시 */
    private levels = $state<Map<string, number>>(new Map());

    /** 현재 로딩 중인 ID Set (중복 요청 방지) */
    private pendingIds = new Set<string>();

    /**
     * 레벨 배치 조회
     * 이미 캐시된 ID는 건너뛰고 새로운 ID만 요청
     */
    async fetchLevels(ids: string[]): Promise<void> {
        const newIds = ids.filter((id) => id && !this.levels.has(id) && !this.pendingIds.has(id));

        if (newIds.length === 0) return;

        for (const id of newIds) {
            this.pendingIds.add(id);
        }

        try {
            const response = await fetch(`/api/members/levels?ids=${newIds.join(',')}`);

            if (!response.ok) return;

            const data: Record<string, number> = await response.json();

            // 기존 맵 복사 + 새 데이터 병합 (반응성 트리거)
            const updated = new Map(this.levels);
            for (const [mbId, level] of Object.entries(data)) {
                updated.set(mbId, level);
            }
            this.levels = updated;
        } catch (err) {
            console.error('회원 레벨 조회 실패:', err);
        } finally {
            for (const id of newIds) {
                this.pendingIds.delete(id);
            }
        }
    }

    /**
     * 특정 회원의 레벨 반환
     */
    getLevel(mbId: string): number | undefined {
        return this.levels.get(mbId);
    }

    /**
     * 전체 캐시 클리어
     */
    clear(): void {
        this.levels = new Map();
        this.pendingIds.clear();
    }
}

export const memberLevelStore = new MemberLevelStore();
