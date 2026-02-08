/**
 * Board Layout 시스템 타입 정의
 *
 * WordPress Template Hierarchy에서 영감을 받은 레이아웃 시스템.
 * 코어/테마/플러그인이 각각 레이아웃을 등록하고,
 * Resolution Order (Plugin > Theme > Core)로 최종 컴포넌트를 결정한다.
 */

import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';

/** 목록 레이아웃 ID */
export type ListLayoutId = 'compact' | 'card' | 'gallery' | 'webzine' | (string & {});

/** 본문 레이아웃 ID */
export type ViewLayoutId = 'basic' | (string & {});

/** 레이아웃 등록 소스 (우선순위: plugin > theme > core) */
export type LayoutSource = 'core' | 'theme' | 'plugin';

/** 목록 레이아웃 컴포넌트의 Props 인터페이스 */
export interface ListLayoutProps {
    post: FreePost;
    displaySettings?: BoardDisplaySettings;
    onclick: () => void;
}

/**
 * 레이아웃 매니페스트 — 레이아웃의 메타데이터
 *
 * 관리자 UI에서 레이아웃 선택 시 이 정보를 표시한다.
 */
export interface LayoutManifest {
    /** 고유 ID (예: 'compact', 'gallery') */
    id: string;
    /** 표시 이름 (예: '컴팩트', '갤러리') */
    name: string;
    /** 설명 */
    description: string;
    /** 미리보기 이미지 경로 (선택) */
    thumbnail?: string;
    /** 목록 래퍼 CSS 클래스 (예: gallery는 grid) */
    wrapperClass?: string;
}

/** 등록된 레이아웃 항목 */
export interface LayoutEntry {
    manifest: LayoutManifest;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: any;
    source: LayoutSource;
}
