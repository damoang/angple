import { browser } from '$app/environment';
import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';

/** 제목에 가림 키워드가 있을 때 작성자에게 보여주는 확인 문구 */
export const BLUR_CONFIRM_MESSAGE =
    '제목에 가림 키워드가 있습니다. 이 글을 부끄앙(가림) 처리할까요?\n\n확인 = 가림 / 취소 = 안 가림';

/**
 * 부끄앙(가림) 확인 팝업 (#13571 Phase3, #13717).
 *
 * 글쓰기·글수정 공통. 제목에 블러 키워드가 있을 때만 확인 팝업을 띄워
 * 강제 흐림 여부를 작성자가 직접 고르게 한다.
 * matchesBlurKeyword 는 리더 contentBlur 토글과 무관하게 키워드만 본다.
 *
 * @returns 키워드가 없거나 SSR 이면 `undefined`(가림 설정 변경 없음),
 *          있으면 작성자의 선택(`true` = 가림 / `false` = 안 가림)
 */
export function askBlurForTitle(title: string): boolean | undefined {
    if (!browser) return undefined;
    if (!uiSettingsStore.matchesBlurKeyword(title)) return undefined;
    return window.confirm(BLUR_CONFIRM_MESSAGE);
}
