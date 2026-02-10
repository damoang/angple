/**
 * 목록 레이아웃 코어 등록
 *
 * 코어 레이아웃 4종을 Layout Registry에 등록한다.
 * 테마/플러그인은 동일 ID로 등록하여 오버라이드 가능.
 */

import { layoutRegistry } from '../registry.js';
import type { LayoutManifest } from '../types.js';

import CompactLayout from './compact.svelte';
import CardLayout from './card.svelte';
import DetailedLayout from './detailed.svelte';
import GalleryLayout from './gallery.svelte';
import WebzineLayout from './webzine.svelte';
import GivingCardLayout from './giving-card.svelte';
import PosterGalleryLayout from './poster-gallery.svelte';
import MarketCardLayout from './market-card.svelte';

/** 코어 목록 레이아웃 매니페스트 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coreListLayouts: { manifest: LayoutManifest; component: any }[] = [
    {
        manifest: {
            id: 'compact',
            name: '컴팩트',
            description: '제목과 메타데이터만 표시하는 기본 목록',
            wrapperClass: 'space-y-1'
        },
        component: CompactLayout
    },
    {
        manifest: {
            id: 'card',
            name: '카드',
            description: '본문 미리보기와 썸네일을 포함한 카드형 목록',
            wrapperClass: 'space-y-3'
        },
        component: CardLayout
    },
    {
        manifest: {
            id: 'detailed',
            name: '상세',
            description: '큰 썸네일과 상세 메타데이터를 포함한 목록',
            wrapperClass: 'space-y-3'
        },
        component: DetailedLayout
    },
    {
        manifest: {
            id: 'gallery',
            name: '갤러리',
            description: '이미지 중심의 그리드 레이아웃',
            wrapperClass: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
        },
        component: GalleryLayout
    },
    {
        manifest: {
            id: 'webzine',
            name: '웹진',
            description: '큰 이미지와 본문 미리보기를 포함한 블로그 스타일',
            wrapperClass: 'space-y-4'
        },
        component: WebzineLayout
    },
    {
        manifest: {
            id: 'giving-card',
            name: '나눔 카드',
            description: '나눔 게시판 전용 카드 레이아웃 (카운트다운, 참여자 배지)',
            wrapperClass: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
        },
        component: GivingCardLayout
    },
    {
        manifest: {
            id: 'poster-gallery',
            name: '포스터 갤러리',
            description: '2:3 비율 포스터 카드 갤러리 (앙티티 전용)',
            wrapperClass: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        },
        component: PosterGalleryLayout
    },
    {
        manifest: {
            id: 'market-card',
            name: '마켓 카드',
            description: '중고마켓 전용 카드 레이아웃 (가격, 상태 배지)',
            wrapperClass: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
        },
        component: MarketCardLayout
    }
];

/**
 * 코어 목록 레이아웃을 레지스트리에 등록
 *
 * +layout.svelte의 onMount에서 호출되거나,
 * 모듈 import 시 자동 등록 (side-effect)
 */
export function registerCoreListLayouts(): void {
    for (const { manifest, component } of coreListLayouts) {
        layoutRegistry.registerList(manifest, component, 'core');
    }
}

// 컴포넌트 개별 export (하위호환)
export {
    CompactLayout,
    CardLayout,
    DetailedLayout,
    GalleryLayout,
    WebzineLayout,
    GivingCardLayout,
    PosterGalleryLayout,
    MarketCardLayout
};
