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
import PosterGalleryLayout from './poster-gallery.svelte';
import MarketCardLayout from './market-card.svelte';
import ClassicLayout from './classic.svelte';
import NoticeLayout from './notice.svelte';
import MessageLayout from './message.svelte';
import GivingLayout from './giving.svelte';
import TradeLayout from './trade.svelte';

/** 코어 목록 레이아웃 매니페스트 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coreListLayouts: { manifest: LayoutManifest; component: any }[] = [
    {
        manifest: {
            id: 'compact',
            name: '컴팩트',
            description: '제목과 메타데이터만 표시하는 기본 목록',
            wrapperClass: 'space-y-1 -mx-2 md:mx-0 [&>a]:border-x-0 md:[&>a]:border-x [&>a]:rounded-none md:[&>a]:rounded-lg'
        },
        component: CompactLayout
    },
    {
        manifest: {
            id: 'card',
            name: '카드',
            description: '본문 미리보기와 썸네일을 포함한 카드형 목록',
            wrapperClass: 'space-y-3 -mx-2 md:mx-0 [&>a]:border-x-0 md:[&>a]:border-x [&>a]:rounded-none md:[&>a]:rounded-lg'
        },
        component: CardLayout
    },
    {
        manifest: {
            id: 'detailed',
            name: '상세',
            description: '큰 썸네일과 상세 메타데이터를 포함한 목록',
            wrapperClass: 'space-y-3 -mx-2 md:mx-0 [&>a]:border-x-0 md:[&>a]:border-x [&>a]:rounded-none md:[&>a]:rounded-lg'
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
            wrapperClass: 'space-y-4 -mx-2 md:mx-0 [&>a]:border-x-0 md:[&>a]:border-x [&>a]:rounded-none md:[&>a]:rounded-lg'
        },
        component: WebzineLayout
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
    },
    {
        manifest: {
            id: 'classic',
            name: '클래식',
            description: 'PHP 게시판 스킨과 동일한 추천/제목/이름/날짜/조회 테이블형 목록',
            wrapperClass: 'border-y border-x-0 md:border-x border-border rounded-none md:rounded-lg divide-y divide-border overflow-hidden -mx-2 md:mx-0'
        },
        component: ClassicLayout
    },
    {
        manifest: {
            id: 'notice',
            name: '공지',
            description: '카드형 공지사항 스타일 (배지 + 깔끔한 메타데이터)',
            wrapperClass: 'space-y-2 -mx-2 md:mx-0 [&>a]:border-x-0 md:[&>a]:border-x [&>a]:rounded-none md:[&>a]:rounded-lg'
        },
        component: NoticeLayout
    },
    {
        manifest: {
            id: 'message',
            name: '축하 메시지',
            description: '축하 카드 형태로 표시 (Soft Parchment 스타일, accent border)',
            wrapperClass: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
        },
        component: MessageLayout
    },
    {
        manifest: {
            id: 'giving',
            name: '나눔',
            description: '나눔 게시판 전용 (카운트다운, 응모수, 상태 뱃지)',
            wrapperClass: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        },
        component: GivingLayout
    },
    {
        manifest: {
            id: 'trade',
            name: '거래',
            description: '중고거래/판매 게시판 전용 (가격, 상태, 거래방식)',
            wrapperClass: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        },
        component: TradeLayout
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
    PosterGalleryLayout,
    MarketCardLayout,
    ClassicLayout,
    NoticeLayout,
    MessageLayout,
    GivingLayout,
    TradeLayout
};
