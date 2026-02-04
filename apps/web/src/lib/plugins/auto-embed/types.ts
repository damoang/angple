/**
 * 자동 임베딩 플러그인 타입 정의
 */

export interface EmbedInfo {
	/** 플랫폼 이름 (youtube, instagram 등) */
	platform: string;
	/** 콘텐츠 ID (비디오 ID, 포스트 ID 등) */
	id: string;
	/** 원본 URL */
	url: string;
	/** 가로세로 비율 (height/width * 100, 기본값 56.25% = 16:9) */
	aspectRatio?: number;
	/** 최대 너비 (세로 영상용, px 단위) */
	maxWidth?: number;
	/** 추가 파라미터 (시작 시간, 재생목록 등) */
	params?: Record<string, string>;
}

export interface EmbedPlatform {
	/** 플랫폼 이름 */
	name: string;
	/** URL 패턴 목록 (정규식) */
	patterns: RegExp[];
	/** URL에서 임베드 정보 추출 */
	extract(url: string): EmbedInfo | null;
	/** 임베드 HTML 렌더링 */
	render(info: EmbedInfo): string;
}

export interface EmbedResult {
	/** 임베딩 성공 여부 */
	success: boolean;
	/** 임베드 정보 */
	info?: EmbedInfo;
	/** 렌더링된 HTML */
	html?: string;
}
