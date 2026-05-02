/**
 * placement-phase2.test.ts — 자유 배치 전략(LayerFree / BboxFree) + 지지 규칙 단위 테스트.
 *
 * DB 호출 없음 — 순수 알고리즘 테스트.
 */

import { describe, it, expect } from 'vitest';
import {
    LayerFreeStrategy,
    BboxFreeStrategy,
    activeLayer,
    hasSupport,
    pickStrategy,
    validateFreePosition,
    posKey
} from '../server/placement.js';
import type { Building } from '../types/index.js';

function makeBuilding(overrides: Partial<Building> = {}): Building {
    return {
        id: 1,
        name: 'test',
        description: null,
        targetBricks: 100,
        currentBricks: 0,
        status: 'active',
        blueprintData: null,
        dimensionX: 5,
        dimensionY: 3,
        dimensionZ: 5,
        season: 1,
        createdAt: new Date(),
        completedAt: null,
        ...overrides
    };
}

describe('activeLayer', () => {
    it('빈 건물(currentBricks=0) → y=0', () => {
        expect(activeLayer(makeBuilding())).toBe(0);
    });

    it('1층 25개 채워진 5x5x3 → y=1', () => {
        const b = makeBuilding({ currentBricks: 25 });
        expect(activeLayer(b)).toBe(1);
    });

    it('1층 24개만 채워진 5x5x3 → y=0', () => {
        const b = makeBuilding({ currentBricks: 24 });
        expect(activeLayer(b)).toBe(0);
    });
});

describe('hasSupport (지지 규칙)', () => {
    it('y=0 (바닥) → 항상 OK', () => {
        expect(hasSupport({ x: 5, y: 0, z: 5 }, new Set())).toBe(true);
    });

    it('y>0 + 6방향 모두 비어있음 → reject', () => {
        expect(hasSupport({ x: 2, y: 2, z: 2 }, new Set())).toBe(false);
    });

    it('y>0 + 아래(-y) 점유 → OK', () => {
        const occupied = new Set([posKey(2, 1, 2)]);
        expect(hasSupport({ x: 2, y: 2, z: 2 }, occupied)).toBe(true);
    });

    it('y>0 + 옆(+x) 점유 → OK', () => {
        const occupied = new Set([posKey(3, 2, 2)]);
        expect(hasSupport({ x: 2, y: 2, z: 2 }, occupied)).toBe(true);
    });
});

describe('LayerFreeStrategy (은 등급)', () => {
    it('활성 층 안 + 바닥 → 통과', () => {
        const s = new LayerFreeStrategy();
        const b = makeBuilding();
        expect(s.validate(b, { x: 2, y: 0, z: 2 }, new Set())).toBeNull();
    });

    it('비활성 층(y=2) → 거절', () => {
        const s = new LayerFreeStrategy();
        const b = makeBuilding(); // active=0
        const reason = s.validate(b, { x: 2, y: 2, z: 2 }, new Set());
        expect(reason).toMatch(/active layer/);
    });

    it('bbox 밖 좌표 → 거절', () => {
        const s = new LayerFreeStrategy();
        const b = makeBuilding();
        expect(s.validate(b, { x: 99, y: 0, z: 0 }, new Set())).toMatch(/out of bounds/);
    });

    it('이미 occupied 좌표 → 거절', () => {
        const s = new LayerFreeStrategy();
        const b = makeBuilding();
        const occ = new Set([posKey(0, 0, 0)]);
        expect(s.validate(b, { x: 0, y: 0, z: 0 }, occ)).toMatch(/already occupied/);
    });

    it('1층 활성 시 y=1 좌표 + 아래 지지 있으면 통과', () => {
        const s = new LayerFreeStrategy();
        const b = makeBuilding({ currentBricks: 25 }); // active=1
        const occ = new Set([posKey(2, 0, 2)]);
        expect(s.validate(b, { x: 2, y: 1, z: 2 }, occ)).toBeNull();
    });

    it('1층 활성 시 지지 없으면 거절 (뜬 벽돌)', () => {
        const s = new LayerFreeStrategy();
        const b = makeBuilding({ currentBricks: 25 });
        // y=1 + 6방향 모두 비어있음
        const reason = s.validate(b, { x: 2, y: 1, z: 2 }, new Set());
        expect(reason).toMatch(/floating brick/);
    });
});

describe('BboxFreeStrategy (금/다이아 등급)', () => {
    it('bbox 안 + y=0 → 통과', () => {
        const s = new BboxFreeStrategy();
        expect(s.validate(makeBuilding(), { x: 2, y: 0, z: 3 }, new Set())).toBeNull();
    });

    it('bbox 밖 → 거절', () => {
        const s = new BboxFreeStrategy();
        expect(s.validate(makeBuilding(), { x: -1, y: 0, z: 0 }, new Set())).toMatch(
            /out of bounds/
        );
    });

    it('y>0 지지 없음 → 거절 (뜬 벽돌)', () => {
        const s = new BboxFreeStrategy();
        expect(s.validate(makeBuilding(), { x: 2, y: 2, z: 2 }, new Set())).toMatch(
            /floating brick/
        );
    });

    it('y>0 옆 지지 있음 → 통과', () => {
        const s = new BboxFreeStrategy();
        const occ = new Set([posKey(1, 2, 2)]);
        expect(s.validate(makeBuilding(), { x: 2, y: 2, z: 2 }, occ)).toBeNull();
    });

    it('hole 좌표 → 거절', () => {
        const s = new BboxFreeStrategy();
        const b = makeBuilding({
            blueprintData: {
                floors: [
                    { y: 0, pattern: 'full', holes: [{ x_start: 1, x_end: 1, z: 1, z_end: 1 }] }
                ]
            }
        });
        expect(s.validate(b, { x: 1, y: 0, z: 1 }, new Set())).toMatch(/hole/);
    });
});

describe('pickStrategy', () => {
    it('anonymous → auto', () => {
        expect(pickStrategy('anonymous').kind).toBe('auto');
    });
    it('normal → auto', () => {
        expect(pickStrategy('normal').kind).toBe('auto');
    });
    it('silver → free (Layer)', () => {
        const r = pickStrategy('silver');
        expect(r.kind).toBe('free');
        if (r.kind === 'free') expect(r.strategy).toBeInstanceOf(LayerFreeStrategy);
    });
    it('gold → free (Bbox)', () => {
        const r = pickStrategy('gold');
        expect(r.kind).toBe('free');
        if (r.kind === 'free') expect(r.strategy).toBeInstanceOf(BboxFreeStrategy);
    });
    it('diamond → free (Bbox)', () => {
        const r = pickStrategy('diamond');
        expect(r.kind).toBe('free');
        if (r.kind === 'free') expect(r.strategy).toBeInstanceOf(BboxFreeStrategy);
    });
});

describe('validateFreePosition (헬퍼)', () => {
    it('normal 등급은 자유 배치 거절', () => {
        const reason = validateFreePosition(
            'normal',
            makeBuilding(),
            { x: 0, y: 0, z: 0 },
            new Set()
        );
        expect(reason).toMatch(/free placement/);
    });

    it('silver 등급 + 활성 층 + 통과', () => {
        expect(
            validateFreePosition('silver', makeBuilding(), { x: 2, y: 0, z: 2 }, new Set())
        ).toBeNull();
    });

    it('diamond 등급 + 뜬 벽돌 → 거절', () => {
        const reason = validateFreePosition(
            'diamond',
            makeBuilding(),
            { x: 2, y: 2, z: 2 },
            new Set()
        );
        expect(reason).toMatch(/floating/);
    });
});
