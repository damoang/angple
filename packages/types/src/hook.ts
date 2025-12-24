/**
 * Hook 시스템 타입 정의 (확장)
 */

/**
 * Hook 타입
 */
export type HookType = 'action' | 'filter';

/**
 * Hook 정의
 */
export interface HookDefinition {
	/** Hook 이름 */
	name: string;

	/** Hook 타입 */
	type: HookType;

	/** 콜백 함수 경로 (테마/플러그인 기준) */
	callback: string;

	/** 우선순위 */
	priority?: number;

	/** 설명 */
	description?: string;
}

/**
 * 사전 정의된 Action Hook 포인트
 */
export interface ActionHookPoints {
	// 페이지 라이프사이클
	before_page_render: [];
	after_page_render: [];
	page_loaded: [];

	// 컴포넌트 라이프사이클
	before_component_mount: [componentName: string];
	after_component_mount: [componentName: string];
	before_component_unmount: [componentName: string];
	after_component_unmount: [componentName: string];

	// 데이터 로딩
	before_data_fetch: [endpoint: string];
	after_data_fetch: [endpoint: string, data: any];
	data_fetch_error: [endpoint: string, error: Error];

	// 사용자 액션
	user_login: [userId: string];
	user_logout: [userId: string];
	user_register: [userId: string];

	// 게시물 관련
	before_post_create: [postData: any];
	after_post_create: [post: any];
	before_post_update: [postId: string, updateData: any];
	after_post_update: [post: any];
	before_post_delete: [postId: string];
	after_post_delete: [postId: string];

	// 댓글 관련
	before_comment_create: [commentData: any];
	after_comment_create: [comment: any];
	before_comment_delete: [commentId: string];
	after_comment_delete: [commentId: string];

	// 테마/플러그인
	theme_activated: [themeId: string];
	theme_deactivated: [themeId: string];
	plugin_activated: [pluginId: string];
	plugin_deactivated: [pluginId: string];
}

/**
 * 사전 정의된 Filter Hook 포인트
 */
export interface FilterHookPoints {
	// 페이지 관련
	page_title: [title: string];
	page_meta: [meta: Record<string, any>];

	// 게시물 콘텐츠
	post_content: [content: string, post: any];
	post_excerpt: [excerpt: string, post: any];
	post_title: [title: string, post: any];

	// 댓글
	comment_content: [content: string, comment: any];
	comment_author_name: [name: string, comment: any];

	// URL 및 링크
	post_permalink: [url: string, post: any];
	asset_url: [url: string, assetPath: string];

	// 사용자 정보
	user_display_name: [name: string, user: any];
	user_avatar_url: [url: string, user: any];

	// API 응답
	api_response: [response: any, endpoint: string];
	api_error_message: [message: string, error: Error];

	// 검색
	search_query: [query: string];
	search_results: [results: any[], query: string];

	// 렌더링
	component_props: [props: Record<string, any>, componentName: string];
	html_output: [html: string, context: string];
}

/**
 * Hook 실행 컨텍스트
 */
export interface HookContext {
	/** Hook이 실행되는 환경 */
	environment: 'client' | 'server';

	/** 현재 사용자 정보 */
	user?: {
		id: string;
		role: string;
	};

	/** 현재 라우트 */
	route?: {
		path: string;
		params: Record<string, string>;
		query: Record<string, string>;
	};

	/** 추가 메타데이터 */
	metadata?: Record<string, any>;
}
