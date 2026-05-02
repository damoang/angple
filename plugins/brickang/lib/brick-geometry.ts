/**
 * brick InstancedMesh 헬퍼 — 등급별로 1 mesh, 위치는 setMatrixAt 으로 갱신.
 *
 * Three.js dynamic import 를 사용하므로 호출자는 await 필요.
 */

import type * as THREE from 'three';
import type { BrickTypeSlug } from '../types/index.js';

export interface BrickInstance {
    id: number;
    typeSlug: BrickTypeSlug;
    x: number;
    y: number;
    z: number;
    color?: string | null;
}

/**
 * 등급별 색상 + glow 매핑.
 */
const TYPE_STYLE: Record<BrickTypeSlug, { color: number; emissive: number; opacity: number }> = {
    anonymous: { color: 0xa0a0a0, emissive: 0x000000, opacity: 0.7 },
    normal: { color: 0xc89060, emissive: 0x000000, opacity: 1 },
    silver: { color: 0xc0c8e0, emissive: 0x223344, opacity: 1 },
    gold: { color: 0xffd060, emissive: 0x553300, opacity: 1 },
    diamond: { color: 0x88e0ff, emissive: 0x004488, opacity: 0.95 }
};

export async function createInstancedMesh(
    THREE: typeof import('three'),
    slug: BrickTypeSlug,
    capacity: number = 1024
) {
    const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const style = TYPE_STYLE[slug];
    const mat = new THREE.MeshStandardMaterial({
        color: style.color,
        emissive: style.emissive,
        emissiveIntensity: style.emissive === 0 ? 0 : 0.4,
        metalness: slug === 'gold' || slug === 'silver' ? 0.7 : 0.2,
        roughness: 0.4,
        transparent: style.opacity < 1,
        opacity: style.opacity
    });
    const mesh = new THREE.InstancedMesh(geo, mat, capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    return mesh;
}

/**
 * bricks 배열을 등급별 InstancedMesh 그룹에 분배해서 setMatrixAt.
 */
export function applyInstances(
    THREE: typeof import('three'),
    meshesBySlug: Map<BrickTypeSlug, THREE.InstancedMesh>,
    bricks: BrickInstance[]
) {
    const counts = new Map<BrickTypeSlug, number>();
    const dummy = new THREE.Object3D();
    for (const b of bricks) {
        const mesh = meshesBySlug.get(b.typeSlug);
        if (!mesh) continue;
        const idx = counts.get(b.typeSlug) ?? 0;
        dummy.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        counts.set(b.typeSlug, idx + 1);
    }
    for (const [slug, mesh] of meshesBySlug) {
        mesh.count = counts.get(slug) ?? 0;
        mesh.instanceMatrix.needsUpdate = true;
    }
}

/**
 * Ghost preview 메시 (place 모드에서 hover 시 반투명 표시).
 */
export async function createGhostMesh(THREE: typeof import('three'), slug: BrickTypeSlug) {
    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const style = TYPE_STYLE[slug];
    const mat = new THREE.MeshBasicMaterial({
        color: style.color,
        transparent: true,
        opacity: 0.4,
        wireframe: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return mesh;
}
