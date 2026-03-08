/**
 * 기본 슬롯 등록
 *
 * 사이트별 커스텀 컴포넌트를 슬롯에 등록합니다.
 * 포크 시 이 파일을 수정하여 사이트에 맞는 컴포넌트를 등록하세요.
 *
 * 예: 다모앙 배너를 제거하고 자체 배너로 교체하려면,
 *     해당 registerComponent() 호출을 삭제하거나 교체하면 됩니다.
 */

import { registerComponent } from './slot-manager';
import DamoangBanner from '$lib/components/ui/damoang-banner/damoang-banner.svelte';
import CelebrationRolling from '$lib/components/ui/celebration-rolling/celebration-rolling.svelte';
import PromotionInlineList from '$lib/components/ui/promotion-inline-post/promotion-inline-list.svelte';

let initialized = false;

/**
 * 기본 슬롯 컴포넌트 등록 (앱 초기화 시 1회 호출)
 *
 * 등록되는 컴포넌트:
 * - DamoangBanner: 게시판/게시글 상단 배너 (축하이미지 → 다모앙광고 → GAM 폴백)
 * - CelebrationRolling: 축하 메시지 텍스트 롤링
 *
 * 포크에서는 이 함수 내용을 비우거나, 자체 컴포넌트를 등록하세요.
 */
export function registerDefaultSlots(): void {
    if (initialized) return;
    initialized = true;

    // 게시판 목록 상단 배너
    registerComponent(
        'board-list-banner',
        DamoangBanner,
        10,
        { position: 'board-list', height: '90px', showCelebration: false },
        'core-damoang'
    );

    // 게시판 목록 축하 메시지 롤링
    registerComponent('board-list-rolling', CelebrationRolling, 10, {}, 'core-damoang');

    // 게시글 상세 상단 배너
    registerComponent(
        'board-view-banner',
        DamoangBanner,
        10,
        { position: 'board-view', showCelebration: false, height: '45px' },
        'core-damoang'
    );

    // 게시글 상세 축하 메시지 롤링
    registerComponent('board-view-rolling', CelebrationRolling, 10, {}, 'core-damoang');

    // 사이드바 배너
    registerComponent(
        'sidebar-banner',
        DamoangBanner,
        10,
        { position: 'sidebar', height: 'auto' },
        'core-damoang'
    );

    // 게시판 목록 인라인 홍보글 (직접홍보게시판 연계)
    registerComponent('board-list-promotion', PromotionInlineList, 10, {}, 'core-damoang');
}
