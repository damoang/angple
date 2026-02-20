/**
 * 레거시 {video:} / {동영상:} 패턴 변환 Built-in Hook
 * 나리야(PHP) 호환 동영상 삽입 문법을 HTML 플레이어로 변환
 */
import { registerHook } from '../registry';
import { transformVideos } from '$lib/utils/content-transform';

/**
 * 동영상 패턴 변환 필터 초기화
 * post_content 필터에 등록 (auto-embed보다 먼저 실행: priority 5)
 */
export function initContentVideo(): void {
    registerHook(
        'post_content',
        (html: unknown) => transformVideos(html as string),
        5, // auto-embed(10)보다 먼저 실행
        'core',
        'filter'
    );
}
