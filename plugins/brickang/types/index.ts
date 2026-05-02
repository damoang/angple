/**
 * brickang 도메인 타입.
 */

export type BrickTypeSlug = 'anonymous' | 'normal' | 'silver' | 'gold' | 'diamond';

export interface BrickType {
    id: number;
    slug: BrickTypeSlug;
    name: string;
    priceKrw: number;
    priceUsd: number;
    colorHex: string;
    textureUrl: string | null;
    sizeMultiplier: number;
    glowEffect: boolean;
    isAnonymous: boolean;
    allowMessage: boolean;
    isActive: boolean;
    sortOrder: number;
}

export type BuildingStatus = 'active' | 'completed' | 'archived';

export interface BlueprintFloor {
    y: number;
    y_end?: number;
    pattern: 'full' | 'walls_only' | 'floor_with_hole';
    dimensions?: { x: number; z: number };
    wall_thickness?: number;
    holes?: Array<{ x_start: number; x_end: number; z: number; z_end?: number }>;
}

export interface Blueprint {
    name?: string;
    type?: string;
    floors?: BlueprintFloor[];
    total_brick_slots?: number;
}

export interface Building {
    id: number;
    name: string;
    description: string | null;
    targetBricks: number;
    currentBricks: number;
    status: BuildingStatus;
    blueprintData: Blueprint | null;
    dimensionX: number;
    dimensionY: number;
    dimensionZ: number;
    season: number;
    createdAt: Date;
    completedAt: Date | null;
}

export interface Brick {
    id: number;
    buildingId: number;
    userId: number;
    nickname: string;
    message: string | null;
    brickTypeId: number;
    color: string | null;
    positionX: number;
    positionY: number;
    positionZ: number;
    placedAt: Date;
    paymentOrderId: number;
    createdAt: Date;
}

export interface BrickPosition {
    x: number;
    y: number;
    z: number;
}

export interface UserStats {
    userId: number;
    totalBricks: number;
    totalSpentKrw: number;
    totalSpentUsd: number;
    firstBrickAt: Date | null;
    lastBrickAt: Date | null;
    userRank: number | null;
    updatedAt: Date;
}

export interface BrickangOrderMetadata {
    kind: 'brickang';
    brick_type_slug: BrickTypeSlug;
    quantity: number;
    message: string | null;
    building_id: number;
    is_anonymous: boolean;
    nickname_snapshot: string;
}

export const MILESTONES = [100, 500, 1000, 5000, 10000] as const;
