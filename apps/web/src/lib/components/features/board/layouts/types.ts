/**
 * Board Layout 시스템 타입 정의
 *
 * WordPress Template Hierarchy에서 영감을 받은 레이아웃 시스템.
 * 코어/테마/플러그인이 각각 레이아웃을 등록하고,
 * Resolution Order (Plugin > Theme > Core)로 최종 컴포넌트를 결정한다.
 */

import type { FreePost, LikerInfo, BoardDisplaySettings } from '$lib/api/types.js';
import type { Component } from 'svelte';
import type { ReactionItem } from '$lib/types/reaction.js';

/** 목록 레이아웃 ID */
export type ListLayoutId = 'compact' | 'card' | 'gallery' | 'webzine' | (string & {});

/** 본문 레이아웃 ID */
export type ViewLayoutId = 'basic' | 'report' | 'disciplinelog' | 'giving' | 'map' | (string & {});

/** 레이아웃 등록 소스 (우선순위: plugin > theme > core) */
export type LayoutSource = 'core' | 'theme' | 'plugin';

/** 목록 레이아웃 컴포넌트의 Props 인터페이스 */
export interface ListLayoutProps {
    post: FreePost;
    displaySettings?: BoardDisplaySettings;
    href: string;
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

/** 본문(View) 레이아웃 컴포넌트의 Props 인터페이스 */
export interface ViewLayoutProps {
    /** 게시글 데이터 */
    post: FreePost;
    /** 게시판 정보 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    board: any;
    /** 게시판 ID */
    boardId: string;

    // 작성자/권한
    isAuthor: boolean;
    isAdmin: boolean;
    canViewSecret: boolean;
    promotionExpired?: boolean;

    // 추천/비추천 상태
    likeCount: number;
    dislikeCount: number;
    isLiked: boolean;
    isDisliked: boolean;
    isLiking: boolean;
    isDisliking: boolean;
    isLikeAnimating: boolean;

    // 추천자
    likers: LikerInfo[];
    likersTotal: number;

    // 글자 크기
    fontSize: string;
    fontSizeLabel: string;

    // 콜백
    onLike: () => void;
    onDislike: () => void;
    onLoadLikers: () => void;
    onReport: () => void;
    onChangeFontSize: (direction: -1 | 0 | 1) => void;

    // 플러그인
    memoPluginActive: boolean;
    reactionPluginActive: boolean;
    MemoBadge: Component | null;

    // 슬롯 컴포넌트
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeContentSlots: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterContentSlots: any[];

    // 수정/삭제 메타
    /** 수정 횟수 (update 타입 리비전 수) */
    editCount?: number;

    // 유틸
    formatDate: (date: string) => string;
    /** 시간만 짧게 표시 (같은 날: HH:MM, 다른 날: MM.DD HH:MM) */
    formatTimeShort?: (date: string, refDate?: string) => string;
    formatFileSize: (bytes: number) => string;
    /** 본문 HTML (link1 동영상 URL 포함) */
    postContent: string;

    // 페이지 데이터 (슬롯용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageData: any;

    /** 일괄 조회된 게시글 리액션 (있으면 개별 fetch 스킵) */
    postReactions?: ReactionItem[];

    /** 게시글 신고 횟수 (관리자만, wr_7 값) */
    postReportCount?: number | string | null;

    /** 잠긴 게시글의 진실의방 참조 글 ID */
    truthroomPostId?: number | null;

    /** 진실의방 글에서 원본 게시글/댓글 링크 */
    originalPostLink?: { boardId: string; postId: string; commentId?: string } | null;
}
