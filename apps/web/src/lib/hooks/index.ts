/**
 * Hook System 진입점
 *
 * Built-in Hooks는 앱 시작 시 자동으로 등록되는 필수 기능들입니다.
 * 이 모듈에서 초기화 함수를 호출하면 게시판 필터, 인증 등 핵심 기능이 활성화됩니다.
 */

import { initBoardFilters, initAuthHooks, initContentEmbed } from './builtin';

let initialized = false;

/**
 * Built-in Hooks 초기화
 * 앱의 루트 레이아웃에서 한 번만 호출해야 합니다.
 *
 * @example
 * // +layout.svelte
 * import { initBuiltinHooks } from '$lib/hooks';
 * import { onMount } from 'svelte';
 *
 * onMount(() => {
 *     initBuiltinHooks();
 * });
 */
export function initBuiltinHooks(): void {
    if (initialized) {
        return;
    }

    // 게시판 필터 (차단 회원, 신고 글)
    initBoardFilters();

    // 인증 Hook (로그인/로그아웃, OAuth)
    initAuthHooks();

    // 콘텐츠 임베딩 (동영상 URL → 자동 플레이어)
    initContentEmbed();

    initialized = true;
}

/**
 * Built-in Hooks 초기화 상태 확인
 */
export function isBuiltinHooksInitialized(): boolean {
    return initialized;
}

// 기존 모듈 재export (하위 호환성)
export * from './registry';
export * from './plugin-loader';
export * from './theme-loader';
