/**
 * placement.test.ts — `WallFirstStrategy` 단위 테스트.
 *
 * 검증 시나리오:
 *  - 빈 건물 (0,0,0) 부터 테두리 우선 배치
 *  - occupied set 충돌 시 다음 슬롯으로 시프트 (race 보호)
 *  - blueprint_data.floors[].holes 좌표는 skip
 *  - 한 층 만원 시 다음 층(y+1) 진입
 *  - MAX_SCAN 도달 시 에러 (기능적으로는 빈 슬롯이 없을 때 throw)
 *
 * DB 호출 없음 — 순수 알고리즘 테스트.
 */

import { describe, it, expect } from 'vitest';
import {
    WallFirstStrategy,
    generateFloorSlots,
    posKey,
    findNextPositions
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

describe('generateFloorSlots', () => {
    it('5x5 정사각형: 테두리(16) → 안쪽 테두리(8) → 가운데 1 = 25개', () => {
        const slots = generateFloorSlots(5, 5);
        expect(slots).toHaveLength(25);
        // 첫 4개는 위쪽 가로 (z=0)
        expect(slots[0]).toEqual({ x: 0, z: 0 });
        expect(slots[1]).toEqual({ x: 1, z: 0 });
        expect(slots[4]).toEqual({ x: 4, z: 0 });
    });

    it('holes 좌표는 결과에서 빠진다', () => {
        const slots = generateFloorSlots(3, 3, [{ x_start: 1, x_end: 1, z: 1, z_end: 1 }]);
        // 3x3 = 9, 가운데 1개 hole 제외 → 8개
        expect(slots).toHaveLength(8);
        const hasCenter = slots.some((s) => s.x === 1 && s.z === 1);
        expect(hasCenter).toBe(false);
    });

    it('1x1 단일 좌표', () => {
        const slots = generateFloorSlots(1, 1);
        expect(slots).toEqual([{ x: 0, z: 0 }]);
    });
});

describe('WallFirstStrategy.nextPosition', () => {
    it('빈 건물 startCount=0 → 첫 테두리 좌표 (0,0,0)', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding();
        const pos = strategy.nextPosition(building, new Set(), 0);
        expect(pos).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('startCount 가 첫 층 슬롯 끝 = 25 → 다음 층(y=1) 진입', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding();
        const pos = strategy.nextPosition(building, new Set(), 25);
        expect(pos.y).toBe(1);
        expect(pos.x).toBe(0);
        expect(pos.z).toBe(0);
    });

    it('occupied 충돌 시 다음 슬롯으로 시프트', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding();
        // (0,0,0) 점유 → cursor=0 호출 시 다음 슬롯 (1,0,0)
        const occupied = new Set<string>([posKey(0, 0, 0)]);
        const pos = strategy.nextPosition(building, occupied, 0);
        expect(pos).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('연속 2개 슬롯이 occupied → 3번째 슬롯 반환', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding();
        const occupied = new Set<string>([posKey(0, 0, 0), posKey(1, 0, 0)]);
        const pos = strategy.nextPosition(building, occupied, 0);
        expect(pos).toEqual({ x: 2, y: 0, z: 0 });
    });

    it('blueprint holes 좌표는 자동으로 skip', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding({
            blueprintData: {
                floors: [
                    {
                        y: 0,
                        pattern: 'full',
                        holes: [{ x_start: 0, x_end: 0, z: 0, z_end: 0 }]
                    }
                ]
            }
        });
        // (0,0,0) 이 hole → 첫 슬롯은 (1,0,0)
        const pos = strategy.nextPosition(building, new Set(), 0);
        expect(pos).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('한 층 가득 차면 자동으로 다음 층(y+1)', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding({ dimensionX: 2, dimensionY: 3, dimensionZ: 2 });
        // 2x2 층은 4 슬롯 → cursor=4 → y=1 진입
        const pos = strategy.nextPosition(building, new Set(), 4);
        expect(pos.y).toBe(1);
    });

    it('모든 층의 모든 슬롯이 occupied 면 throw', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding({ dimensionX: 2, dimensionY: 1, dimensionZ: 2 });
        const occupied = new Set<string>([
            posKey(0, 0, 0),
            posKey(1, 0, 0),
            posKey(1, 0, 1),
            posKey(0, 0, 1)
        ]);
        expect(() => strategy.nextPosition(building, occupied, 0)).toThrow();
    });

    it('마지막 층에서도 슬롯 없으면 throw', () => {
        const strategy = new WallFirstStrategy();
        const building = makeBuilding({ dimensionX: 1, dimensionY: 1, dimensionZ: 1 });
        // 1x1x1 = 1 슬롯, cursor=1 → throw
        expect(() => strategy.nextPosition(building, new Set(), 1)).toThrow();
    });
});

describe('findNextPositions', () => {
    it('quantity=3 → 서로 다른 3개 좌표', () => {
        const building = makeBuilding();
        const positions = findNextPositions(building, new Set(), 3);
        expect(positions).toHaveLength(3);
        const keys = new Set(positions.map((p) => posKey(p.x, p.y, p.z)));
        expect(keys.size).toBe(3);
    });

    it('currentBricks 부터 시작', () => {
        const building = makeBuilding({ currentBricks: 25 });
        const positions = findNextPositions(building, new Set(), 1);
        // 5x5 첫 층 25 슬롯 다 차서 y=1 진입
        expect(positions[0].y).toBe(1);
    });
});
