/**
 * Phase 1 자동 배치 — `WallFirstStrategy`.
 *
 * 알고리즘:
 *   1. 같은 층(y) 내에서 테두리(perimeter) → 안쪽으로 채운다.
 *   2. blueprint_data.floors[].holes 좌표는 skip.
 *   3. 이미 occupied (Set 으로 전달) 또는 hole 좌표면 다음 슬롯으로 이동.
 *   4. UNIQUE(x,y,z) DB 충돌은 호출자(`/orders/confirm`)가 catch 후 다시 nextPosition 호출하여 재시도.
 *
 * 단순/결정적 알고리즘이므로 단위 테스트로 100% 커버 가능.
 */

import type { Blueprint, BlueprintFloor, Building, BrickPosition } from '../types/index.js';

export interface PlacementStrategy {
    /**
     * 다음 빈 위치 1개를 반환. 더 이상 빈 위치가 없으면 throw.
     * @param building   현재 건축물
     * @param occupied   이미 점유된 좌표 (`"x,y,z"` 문자열)
     * @param startCount placement 시작 시점의 currentBricks. 같은 confirm tx 안에서 여러 벽돌을 놓을 때 카운터를 증가시켜 호출.
     */
    nextPosition(building: Building, occupied: Set<string>, startCount: number): BrickPosition;
}

const MAX_SCAN = 10_000;

export function posKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

/**
 * 한 층의 valid 좌표 시퀀스를 생성한다 (테두리 → 안쪽).
 *
 * 정사각형/직사각형 층에서 가장자리부터 시계방향으로 한 바퀴 → 한 칸 안쪽으로 들어가서 다시 한 바퀴…
 * holes 에 포함되는 좌표는 skip.
 */
export function generateFloorSlots(
    dimX: number,
    dimZ: number,
    holes: Array<{ x_start: number; x_end: number; z: number; z_end?: number }> = []
): Array<{ x: number; z: number }> {
    const result: Array<{ x: number; z: number }> = [];
    const isHole = (x: number, z: number): boolean =>
        holes.some((h) => x >= h.x_start && x <= h.x_end && z >= h.z && z <= (h.z_end ?? h.z));

    const layers = Math.ceil(Math.min(dimX, dimZ) / 2);
    for (let layer = 0; layer < layers; layer++) {
        const xMin = layer;
        const xMax = dimX - 1 - layer;
        const zMin = layer;
        const zMax = dimZ - 1 - layer;
        if (xMin > xMax || zMin > zMax) break;

        if (xMin === xMax && zMin === zMax) {
            // 가운데 한 점
            if (!isHole(xMin, zMin)) result.push({ x: xMin, z: zMin });
            continue;
        }

        // 위쪽 가로
        for (let x = xMin; x <= xMax; x++) if (!isHole(x, zMin)) result.push({ x, z: zMin });
        // 오른쪽 세로
        for (let z = zMin + 1; z <= zMax; z++) if (!isHole(xMax, z)) result.push({ x: xMax, z });
        if (zMin !== zMax) {
            // 아래쪽 가로 (역순)
            for (let x = xMax - 1; x >= xMin; x--)
                if (!isHole(x, zMax)) result.push({ x, z: zMax });
        }
        if (xMin !== xMax) {
            // 왼쪽 세로 (역순)
            for (let z = zMax - 1; z >= zMin + 1; z--)
                if (!isHole(xMin, z)) result.push({ x: xMin, z });
        }
    }
    return result;
}

function getFloorConfig(blueprint: Blueprint | null, y: number): BlueprintFloor | null {
    if (!blueprint?.floors) return null;
    for (const f of blueprint.floors) {
        const start = f.y;
        const end = f.y_end ?? f.y;
        if (y >= start && y <= end) return f;
    }
    return null;
}

export class WallFirstStrategy implements PlacementStrategy {
    nextPosition(building: Building, occupied: Set<string>, startCount: number): BrickPosition {
        const dimX = building.dimensionX;
        const dimZ = building.dimensionZ;
        const dimY = building.dimensionY;

        // 층별 가용 슬롯 캐시
        const floorSlotsCache = new Map<number, Array<{ x: number; z: number }>>();

        const getSlots = (y: number): Array<{ x: number; z: number }> => {
            const cached = floorSlotsCache.get(y);
            if (cached) return cached;
            const f = getFloorConfig(building.blueprintData, y);
            const holes = f?.holes ?? [];
            const slots = generateFloorSlots(dimX, dimZ, holes);
            floorSlotsCache.set(y, slots);
            return slots;
        };

        let count = startCount;
        let scanned = 0;
        while (scanned < MAX_SCAN) {
            // 현재 count 가 가리키는 (floor, posInFloor) 계산
            // floor 별 slot 개수가 다를 수 있으므로 누적해서 찾는다
            let remaining = count;
            for (let y = 0; y < dimY; y++) {
                const slots = getSlots(y);
                if (remaining < slots.length) {
                    const pos = slots[remaining];
                    const key = posKey(pos.x, y, pos.z);
                    if (!occupied.has(key)) {
                        return { x: pos.x, y, z: pos.z };
                    }
                    // 이미 점유 → 다음 슬롯으로 이동
                    count++;
                    scanned++;
                    break;
                }
                remaining -= slots.length;
                // 마지막 층까지 다 채운 경우
                if (y === dimY - 1) {
                    throw new Error('No empty position available in building');
                }
            }
        }
        throw new Error('Placement scan limit exceeded');
    }
}

/**
 * 단일 호출 헬퍼 — 트랜잭션 안에서 여러 벽돌을 차례로 배치할 때 사용.
 */
export function findNextPositions(
    building: Building,
    occupied: Set<string>,
    count: number
): BrickPosition[] {
    const strategy = new WallFirstStrategy();
    const result: BrickPosition[] = [];
    const localOccupied = new Set(occupied);
    let cursor = building.currentBricks;
    for (let i = 0; i < count; i++) {
        const pos = strategy.nextPosition(building, localOccupied, cursor);
        result.push(pos);
        localOccupied.add(posKey(pos.x, pos.y, pos.z));
        cursor++;
    }
    return result;
}
