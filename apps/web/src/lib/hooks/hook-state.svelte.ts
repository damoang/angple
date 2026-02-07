/**
 * Hook 등록 상태 추적 (Svelte 5 reactive)
 *
 * Hook이 동적으로 로드되므로, 컴포넌트가 hook 등록 완료를 감지하여
 * 필터를 재실행할 수 있도록 reactive 카운터를 제공합니다.
 */

let hookVersion = $state(0);

/**
 * Hook 등록 시 호출하여 버전을 증가시킵니다.
 * 이를 구독하는 컴포넌트의 $effect가 재실행됩니다.
 */
export function incrementHookVersion(): void {
    hookVersion++;
}

/**
 * 현재 hook 버전을 반환합니다.
 * $effect 안에서 호출하면 hook 등록 시 자동으로 재실행됩니다.
 */
export function getHookVersion(): number {
    return hookVersion;
}
