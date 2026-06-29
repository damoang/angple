#!/usr/bin/env node
/**
 * three core + OrbitControls 를 자체완결 ESM 1파일로 번들한다.
 * 출력: apps/web/build-vendor/three-vendor.<three-version>.js
 *
 * 배경: 앱이 bundleStrategy:'single' 이라 npm 'three' 를 import 하면 ~1.3MB 가
 * 단일 앱 번들에 전 페이지 인라인된다(brickang 전용인데도). 이 vendor 파일을
 * static.damoang.net 에 올려 brickang(three-scene.ts)이 절대 URL 로 로드하면
 * three 가 앱 번들에서 빠지고 brickang 진입 시에만 fetch 된다.
 *
 * deploy.yml 의 "Build & upload three vendor bundle to R2" 스텝에서 호출.
 * 버전 파일명 고정(immutable). three 업그레이드 시 파일명이 바뀌므로
 * premium plugins/brickang/lib/three-scene.ts 의 THREE_VENDOR_URL 도 함께 갱신해야 한다.
 */
import { build } from 'vite';
import { writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // apps/web
// three 의 package.json 은 exports 맵에 없어 require('three/package.json') 가
// ERR_PACKAGE_PATH_NOT_EXPORTED 로 실패한다(Node 22). 파일을 직접 읽어 버전 추출.
const version = JSON.parse(
    readFileSync(resolve(webRoot, 'node_modules/three/package.json'), 'utf8')
).version;
const outDir = resolve(webRoot, 'build-vendor');
// 진입 파일은 apps/web 내부에 둬야 'three' 가 정상 해석된다.
const entry = resolve(webRoot, '.three-vendor-entry.tmp.js');

mkdirSync(outDir, { recursive: true });
writeFileSync(
    entry,
    "export * as THREE from 'three';\n" +
        "export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';\n"
);

try {
    await build({
        root: webRoot,
        configFile: false,
        logLevel: 'warn',
        build: {
            outDir,
            emptyOutDir: false,
            minify: 'esbuild',
            target: 'es2020',
            lib: {
                entry,
                formats: ['es'],
                fileName: () => `three-vendor.${version}.js`
            },
            // external 없음: three 전부 번들 내부에 포함 (자체완결)
            rollupOptions: { external: [] }
        }
    });
    console.log(`[three-vendor] built three-vendor.${version}.js`);
} finally {
    rmSync(entry, { force: true });
}
