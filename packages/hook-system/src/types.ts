/**
 * Hook System 타입 정의
 */

export type ActionCallback = (...args: any[]) => void;
export type FilterCallback = (value: any, ...args: any[]) => any;

export interface Hook {
	callback: ActionCallback | FilterCallback;
	priority: number;
}

export interface RegisteredHooks {
	actions: string[];
	filters: string[];
}

/**
 * Hook 포인트 정의
 * 애플리케이션에서 사용 가능한 모든 Hook을 타입 안전하게 관리
 */
export interface HookPoints {
	// 페이지 렌더링
	before_page_render: [];
	after_page_render: [];
	before_component_mount: [componentName: string];
	after_component_mount: [componentName: string];

	// 데이터 로딩
	post_data_loaded: [posts: any[]];
	comment_data_loaded: [comments: any[]];
	user_data_loaded: [user: any];

	// 사용자 액션
	before_post_submit: [postData: any];
	after_post_submit: [postData: any, response: any];
	before_comment_submit: [commentData: any];
	after_comment_submit: [commentData: any, response: any];

	// UI 렌더링
	sidebar_widgets_render: [widgets: any[]];
	header_menu_render: [menuItems: any[]];
	footer_content_render: [content: string];
}

/**
 * Filter 포인트 정의
 */
export interface FilterPoints {
	// 데이터 변환
	post_content: [content: string, post: any];
	comment_content: [content: string, comment: any];
	post_title: [title: string, post: any];

	// UI 요소
	sidebar_widgets: [widgets: any[]];
	menu_items: [items: any[]];

	// API 응답
	api_response: [response: any, endpoint: string];
	api_error: [error: any, endpoint: string];
}
