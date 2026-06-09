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
     *
     * ⚠️ 다크모드 — 반드시 시맨틱 토큰을 쓸 것.
     *   angple 은 `.dark`/`.amoled` class + CSS 변수 시맨틱 토큰으로 다크모드를 구현한다
     *   (app.css 참조). 테마 컴포넌트가 `bg-white`/`text-gray-900` 같은 *고정 색*을 쓰면
     *   다크모드에서 글씨가 배경에 묻혀 안 보인다.
     *   대신 아래 시맨틱 토큰을 쓰면 라이트/다크/AMOLED 가 자동 대응된다:
     *     배경 : bg-background (페이지) / bg-card (카드·박스) / bg-muted (옅은 영역)
     *     글씨 : text-foreground (제목·본문) / text-muted-foreground (부가·설명)
     *     강조 : text-primary / bg-primary + text-primary-foreground (버튼)
     *     호버 : hover:bg-accent / hover:text-foreground
     *     경계 : border-border
     *   브랜드 고유색이 필요하면 테마 CSS 변수(예: --brand)를 정의하되,
     *   다크모드용 값을 `:global(.dark .my-theme){ --brand: ... }` 로 함께 둘 것.
     */
    let { data } = $props();
    const title = $derived(data?.site?.title ?? 'Sample Theme');
    const description = $derived(data?.site?.description ?? '테마 페이지 템플릿 예시 홈입니다.');
</script>

<!-- 시맨틱 토큰 사용 → 라이트/다크/AMOLED 자동 대응 -->
<section class="bg-background mx-auto max-w-3xl px-4 py-16 text-center">
    <h1 class="text-foreground text-3xl font-bold">{title}</h1>
    <p class="text-muted-foreground mt-3">{description}</p>
    <p class="text-muted-foreground mt-6 text-sm">
        이 화면은 <code>themes/sample-theme/templates/home.svelte</code> 가 렌더했습니다.
        템플릿을 삭제하면 코어 기본 홈(위젯)으로 폴백됩니다.
    </p>
</section>
