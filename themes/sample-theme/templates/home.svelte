<script lang="ts">
    /**
     * 페이지 템플릿 예시 (#1548) — 테마가 홈(/)을 직접 렌더하는 방법.
     *
     * `themes/<id>/templates/<name>.svelte` 또는 `custom-themes/<id>/templates/<name>.svelte`
     * 파일을 두면 page-registry 가 빌드타임에 자동 등록한다.
     * 코어 라우트(예: routes/+page.svelte)가 getThemePageTemplate(themeId, 'home') 로 조회해
     * 존재하면 코어 기본 위젯 대신 이 컴포넌트를 렌더한다 (없으면 코어 기본 폴백).
     *
     * data: 코어 +page.server.ts 의 load 반환값 (site, indexWidgets 등). 필요한 것만 사용.
     */
    let { data } = $props();
    const title = $derived(data?.site?.title ?? 'Sample Theme');
    const description = $derived(data?.site?.description ?? '테마 페이지 템플릿 예시 홈입니다.');
</script>

<section class="mx-auto max-w-3xl px-4 py-16 text-center">
    <h1 class="text-3xl font-bold">{title}</h1>
    <p class="mt-3 text-gray-500">{description}</p>
    <p class="mt-6 text-sm text-gray-400">
        이 화면은 <code>themes/sample-theme/templates/home.svelte</code> 가 렌더했습니다.
        템플릿을 삭제하면 코어 기본 홈(위젯)으로 폴백됩니다.
    </p>
</section>
