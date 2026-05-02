<!--
  Building3D.svelte — Three.js 3D 뷰어.
  - mode='view': InstancedMesh 등급별 5종 + OrbitControls
  - mode='place': Raycaster + ghost preview, 클릭 시 onPositionPick 콜백
  - Three.js 는 dynamic import 로만 로드 → 메인 번들에 포함되지 않음.
  - 모바일/저성능 환경: WebGL 미지원 시 자식 컴포넌트가 2D fallback.
-->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { BrickDto, BuildingDto } from '../lib/api.js';
    import type { BrickTypeSlug } from '../types/index.js';

    interface Props {
        building: BuildingDto;
        bricks: BrickDto[];
        mode?: 'view' | 'place';
        placingType?: BrickTypeSlug;
        onPositionPick?: (pos: { x: number; y: number; z: number }) => void;
    }

    let {
        building,
        bricks,
        mode = 'view',
        placingType = 'silver',
        onPositionPick
    }: Props = $props();

    let container = $state<HTMLDivElement | null>(null);
    let loadError = $state<string | null>(null);
    let loaded = $state(false);

    let cleanup: (() => void) | null = null;

    onMount(() => {
        let cancelled = false;
        (async () => {
            try {
                const [
                    { createScene, attachControls },
                    { createInstancedMesh, applyInstances, createGhostMesh }
                ] = await Promise.all([
                    import('../lib/three-scene.js'),
                    import('../lib/brick-geometry.js')
                ]);

                if (cancelled || !container) return;
                const w = container.clientWidth || 600;
                const h = container.clientHeight || 400;
                const handles = await createScene({ container, width: w, height: h });
                const { THREE, scene, camera, renderer } = handles;

                // bbox 가이드 wireframe
                const bboxGeo = new THREE.BoxGeometry(
                    building.dimension?.x ?? 20,
                    building.dimension?.y ?? 30,
                    building.dimension?.z ?? 20
                );
                const bboxEdges = new THREE.EdgesGeometry(bboxGeo);
                const bboxLine = new THREE.LineSegments(
                    bboxEdges,
                    new THREE.LineBasicMaterial({
                        color: 0x6688ff,
                        transparent: true,
                        opacity: 0.3
                    })
                );
                bboxLine.position.set(
                    (building.dimension?.x ?? 20) / 2,
                    (building.dimension?.y ?? 30) / 2,
                    (building.dimension?.z ?? 20) / 2
                );
                scene.add(bboxLine);

                const controls = await attachControls(camera, renderer.domElement);
                controls.target.set(
                    (building.dimension?.x ?? 20) / 2,
                    (building.dimension?.y ?? 30) / 4,
                    (building.dimension?.z ?? 20) / 2
                );

                const types: BrickTypeSlug[] = ['anonymous', 'normal', 'silver', 'gold', 'diamond'];
                const meshes = new Map<BrickTypeSlug, import('three').InstancedMesh>();
                const cap = Math.max(1024, bricks.length + 256);
                for (const t of types) {
                    const mesh = await createInstancedMesh(THREE, t, cap);
                    scene.add(mesh);
                    meshes.set(t, mesh);
                }

                const updateBricks = () => {
                    applyInstances(
                        THREE,
                        meshes,
                        bricks.map((b) => ({
                            id: b.id,
                            typeSlug: (b.brick_type_slug as BrickTypeSlug) ?? 'normal',
                            x: b.position?.x ?? 0,
                            y: b.position?.y ?? 0,
                            z: b.position?.z ?? 0,
                            color: b.color
                        }))
                    );
                };
                updateBricks();

                // place 모드 ghost + raycaster
                let ghost: import('three').Mesh | null = null;
                let raycaster: import('three').Raycaster | null = null;
                let pointer: import('three').Vector2 | null = null;
                if (mode === 'place') {
                    ghost = await createGhostMesh(THREE, placingType);
                    scene.add(ghost);
                    raycaster = new THREE.Raycaster();
                    pointer = new THREE.Vector2();
                }

                function onPointerMove(ev: PointerEvent) {
                    if (mode !== 'place' || !raycaster || !pointer || !ghost) return;
                    const rect = renderer.domElement.getBoundingClientRect();
                    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
                    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
                    raycaster.setFromCamera(pointer, camera);
                    // 가상 평면(y=0) 교차 → 격자 좌표
                    const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    const target = new THREE.Vector3();
                    if (raycaster.ray.intersectPlane(planeY, target)) {
                        const gx = Math.floor(target.x);
                        const gz = Math.floor(target.z);
                        if (
                            gx >= 0 &&
                            gx < (building.dimension?.x ?? 20) &&
                            gz >= 0 &&
                            gz < (building.dimension?.z ?? 20)
                        ) {
                            ghost.position.set(gx + 0.5, 0.5, gz + 0.5);
                            ghost.visible = true;
                            return;
                        }
                    }
                    ghost.visible = false;
                }

                function onClick() {
                    if (mode !== 'place' || !ghost || !ghost.visible || !onPositionPick) return;
                    const x = Math.floor(ghost.position.x);
                    const y = Math.floor(ghost.position.y);
                    const z = Math.floor(ghost.position.z);
                    onPositionPick({ x, y, z });
                }

                renderer.domElement.addEventListener('pointermove', onPointerMove);
                renderer.domElement.addEventListener('click', onClick);

                let raf = 0;
                const tick = () => {
                    controls.update();
                    renderer.render(scene, camera);
                    raf = requestAnimationFrame(tick);
                };
                raf = requestAnimationFrame(tick);
                loaded = true;

                cleanup = () => {
                    cancelAnimationFrame(raf);
                    renderer.domElement.removeEventListener('pointermove', onPointerMove);
                    renderer.domElement.removeEventListener('click', onClick);
                    handles.dispose();
                };
            } catch (err) {
                console.error('[Building3D] init failed', err);
                loadError = (err as Error).message;
            }
        })();

        return () => {
            cancelled = true;
        };
    });

    onDestroy(() => {
        if (cleanup) cleanup();
    });
</script>

<div class="building-3d" bind:this={container}>
    {#if loadError}
        <p class="error">3D 뷰어 로드 실패: {loadError}</p>
    {/if}
    {#if !loaded && !loadError}
        <p class="loading">3D 로딩 중...</p>
    {/if}
</div>

<style>
    .building-3d {
        position: relative;
        width: 100%;
        height: 480px;
        background: #1a1a2e;
        border-radius: 8px;
        overflow: hidden;
    }
    .error,
    .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #fff;
        font-size: 14px;
    }
    .error {
        color: #f88;
    }
</style>
