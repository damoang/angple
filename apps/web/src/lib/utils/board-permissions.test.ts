import { describe, it, expect } from 'vitest';
import {
    getPermissionMessage,
    buildGradeDeniedMessage,
    getPromotionHint,
    BADGE_GRADE_NOTE
} from './board-permissions';
import type { DamoangUser } from '$lib/api/types.js';

/** 테스트용 최소 사용자 객체 (mb_level 만 의미 있음) */
function makeUser(mbLevel: number): DamoangUser {
    return { mb_id: 'tester', mb_name: '테스터', mb_level: mbLevel } as DamoangUser;
}

describe('getPromotionHint — 승급 경로 안내 (hello/27814)', () => {
    it('필요 등급 3(앙님💛), 현재 1 → 출석 7일 안내를 반환한다', () => {
        expect(getPromotionHint(3, 1)).toContain('매일 출석 7일');
        expect(getPromotionHint(3, 1)).toContain('앙님💛');
    });

    it('필요 등급 2, 현재 1 → 자동 승급으로 도달 가능하므로 안내를 반환한다', () => {
        expect(getPromotionHint(2, 1)).toContain('매일 출석 7일');
    });

    it('필요 등급 4 이상 → 출석만으로 도달 불가하므로 null', () => {
        expect(getPromotionHint(4, 3)).toBeNull();
        expect(getPromotionHint(10, 1)).toBeNull();
    });

    it('이미 충족(현재 ≥ 필요) → null', () => {
        expect(getPromotionHint(3, 3)).toBeNull();
        expect(getPromotionHint(2, 5)).toBeNull();
    });
});

describe('buildGradeDeniedMessage — 등급 부족 거부 문구', () => {
    it('앙님💛 필요·현재 1 → 등급명 + 승급 경로 + 배지≠등급 안내를 모두 담는다', () => {
        const msg = buildGradeDeniedMessage('글쓰기', 3, 1);
        expect(msg).toContain('앙님💛');
        expect(msg).toContain('매일 출석 7일');
        expect(msg).toContain(BADGE_GRADE_NOTE);
        // 옛 문구("레벨 N 이상")로 회귀하지 않는다 — 숫자 레벨 표기가 착시의 원인
        expect(msg).not.toContain('레벨 3 이상');
    });

    it('출석 승급으로 도달 불가한 등급 → 승급 경로 없이 현재 등급만 안내한다', () => {
        const msg = buildGradeDeniedMessage('글쓰기', 6, 3);
        expect(msg).toContain('운영자');
        expect(msg).toContain('현재 등급: 앙님💛');
        expect(msg).not.toContain('매일 출석 7일');
        expect(msg).toContain(BADGE_GRADE_NOTE);
    });
});

describe('getPermissionMessage', () => {
    const board = { write_level: 3, comment_level: 3 };

    it('비로그인 → 로그인 안내 (기존 동작 유지)', () => {
        expect(getPermissionMessage(board, 'can_write', null)).toBe(
            '글쓰기을(를) 하려면 로그인이 필요합니다.'
        );
    });

    it('레벨 부족 → 승급 경로 안내 문구로 교체된다', () => {
        const msg = getPermissionMessage(board, 'can_write', makeUser(1));
        expect(msg).toContain('글쓰기');
        expect(msg).toContain('앙님💛 등급부터 가능해요');
        expect(msg).toContain('매일 출석 7일');
        expect(msg).toContain(BADGE_GRADE_NOTE);
    });

    it('댓글 액션도 동일한 안내를 사용한다', () => {
        const msg = getPermissionMessage(board, 'can_comment', makeUser(2));
        expect(msg).toContain('댓글 작성');
        expect(msg).toContain('매일 출석 7일');
    });
});
