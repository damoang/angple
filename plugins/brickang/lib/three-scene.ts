/**
 * Three.js Scene 초기화 헬퍼.
 *
 * 중요: 이 파일을 import 만 해도 three 모듈이 즉시 로드되므로
 * **Building3D.svelte 안에서 dynamic import (`await import('./three-scene.ts')`) 로만 사용**.
 */

import type * as THREE from 'three';

export interface SceneHandles {
    THREE: typeof THREE;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    canvas: HTMLCanvasElement;
    dispose: () => void;
}

export interface SceneOptions {
    container: HTMLElement;
    width: number;
    height: number;
    background?: number;
}

/**
 * Scene + Camera + Renderer + 기본 조명 셋업. OrbitControls 는 별도로 attach.
 */
export async function createScene(opts: SceneOptions): Promise<SceneHandles> {
    const THREE = await import('three');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(opts.background ?? 0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(50, opts.width / opts.height, 0.1, 1000);
    camera.position.set(15, 12, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(opts.width, opts.height);
    renderer.shadowMap.enabled = true;
    opts.container.appendChild(renderer.domElement);

    // 조명: ambient + directional (그림자) + hemisphere
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(20, 30, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);

    const hemi = new THREE.HemisphereLight(0x88aaff, 0x442200, 0.3);
    scene.add(hemi);

    // 바닥 grid (가이드)
    const grid = new THREE.GridHelper(20, 20, 0x444466, 0x222244);
    scene.add(grid);

    return {
        THREE,
        scene,
        camera,
        renderer,
        canvas: renderer.domElement,
        dispose: () => {
            renderer.dispose();
            opts.container.removeChild(renderer.domElement);
        }
    };
}

/**
 * OrbitControls dynamic import 헬퍼.
 */
export async function attachControls(camera: THREE.Camera, dom: HTMLElement) {
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    const controls = new OrbitControls(camera, dom);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI / 2;
    return controls;
}
