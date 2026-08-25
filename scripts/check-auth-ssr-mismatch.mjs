#!/usr/bin/env node
/**
 * 템플릿에서 `authStore` 로 렌더를 가르는 것 금지 검사.
 *
 * ## 왜 기계가 막아야 하는가
 *
 * `authStore` 는 **SSR 시점에 언제나 `null`** 이다. 모듈 레벨 `$state` 라 서버에서 채우면
 * 요청 간에 공유되어 다른 사용자 정보가 새기 때문에, 일부러 `$effect` 안에서만 채운다
 * (`+layout.svelte`: "인증 상태 동기화 (클라이언트 전용 — 모듈 레벨 $state는 SSR에서 요청간 공유되므로)").
 * `$effect` 는 서버에서 실행되지 않는다.
 *
 * 따라서 **템플릿이 `authStore` 로 렌더를 가르면 SSR 은 "비로그인"으로 그리고
 * 클라이언트는 "로그인"으로 하이드레이션한다.** DOM 구조가 달라 하이드레이션이 폐기된다.
 *
 * ⛔ **불일치가 하나만 있어도 전체가 폐기된다.** 열 군데 중 아홉을 고쳐도 하나가 남으면
 *    효과가 0 이다. 그래서 "새로 늘어나는 것"을 막는 게 핵심이다.
 *
 * 실측(2026-08-25, 24시간, 봇 제외):
 *
 *     로그인 × 글 상세  14.42%   ← 하루 448명+ 이 글쓰기 버튼 안 먹히고 화면 깜빡임
 *     비로그인 × 글 상세  3.47%
 *     로그인 × 목록       0.11%   ← 목록엔 이 분기가 없다
 *
 * 목록에서는 로그인 여부가 아무 차이도 안 만든다. **인증 자체가 아니라
 * 인증 상태로 렌더가 갈리는 것**이 원인이라는 증거다.
 *
 * ## 무엇을 쓰라는 것인가
 *
 * `$page.data.user` — SSR 로 내려오는 **요청별** 데이터라 서버·클라이언트가 같은 값을 본다.
 * ⛔ 단 필드 이름이 다르다(`data.user.level` vs `authStore.user.mb_level`).
 *    그대로 바꾸면 권한 판정이 조용히 깨진다. 매퍼를 경유하라.
 *
 * ⛔ **`authStore` 를 SSR 에서 채우는 방향으로 고치지 마라.** 정보 유출이다.
 *    고칠 곳은 템플릿이지 스토어가 아니다.
 *
 * ## 기준선 방식
 *
 * 기존 위반을 한 번에 다 고칠 수 없으므로 **파일별 상한**을 박아두고 **늘어나면 실패**시킨다.
 * 고칠 때마다 상한을 내린다. 0 이 되면 그 파일을 목록에서 빼라.
 *
 * 종료코드: 상한 초과 1건 이상이면 1
 */
import { readFileSync, globSync } from 'node:fs';

/**
 * 파일별 허용 상한(현재 위반 수). ⛔ **늘리지 마라.** 줄이는 방향으로만 고친다.
 * 2026-08-25 측정값.
 */
const BASELINE = {
    'apps/web/src/lib/components/features/adult/adult-blur.svelte': 1,
    'apps/web/src/lib/components/features/board/comment-likers-dialog.svelte': 1,
    'apps/web/src/lib/components/features/board/comment-list.svelte': 10,
    'apps/web/src/lib/components/features/board/deal-end-report-button.svelte': 1,
    'apps/web/src/lib/components/features/board/layouts/view/basic.svelte': 4,
    'apps/web/src/lib/components/features/board/layouts/view/report.svelte': 3,
    'apps/web/src/lib/components/features/board/post-form.svelte': 1,
    'apps/web/src/lib/components/features/board/qa-post-list.svelte': 1,
    'apps/web/src/lib/components/features/poll/poll-widget.svelte': 1,
    'apps/web/src/lib/components/features/reaction/reaction-bar.svelte': 1,
    'apps/web/src/lib/components/ui/author-link/author-link.svelte': 2,
    'apps/web/src/lib/components/ui/permission-gate/permission-gate.svelte': 1,
    'apps/web/src/lib/features/giving/giving-participation.svelte': 1,
    'apps/web/src/routes/[boardId]/+page.svelte': 4,
    'apps/web/src/routes/[boardId]/[postId]/+page.svelte': 10,
    'apps/web/src/routes/[boardId]/[postId]/edit/+page.svelte': 1,
    'apps/web/src/routes/[boardId]/write/+page.svelte': 1,
    'apps/web/src/routes/angtt/[slug=entityslug]/+page.svelte': 1,
    'apps/web/src/routes/member/[id]/+page.svelte': 1,
    'apps/web/src/routes/my/+page.svelte': 6
};
// 합계 52군데 · 20개 파일 (2026-08-25). ⛔ 글 상세 경로(comment-list 10 + [postId] 10 +
//    view/basic 4 = 24)에 몰려 있고, 목록은 4개뿐이다 — 로그인 글상세 14.42% vs 목록 0.11%
//    이라는 실측과 정확히 맞는다.

/** 템플릿에서 렌더를 가르는 형태만 본다 — `<script>` 안의 authStore 는 무해하다. */
const COND = /\{#if[^}]*\bauthStore\b[^}]*\}/g;

const files = globSync('apps/web/src/**/*.svelte', { cwd: process.cwd() }).sort();
let failed = 0;
let total = 0;

for (const file of files) {
    const src = readFileSync(file, 'utf8');
    // ⛔ 마지막 `</script>` 이후만 템플릿이다. 앞쪽을 같이 세면 무해한 참조까지 잡아
    //    가드가 오경보로 무시당한다.
    const cut = src.lastIndexOf('</script>');
    const tpl = cut >= 0 ? src.slice(cut) : src;
    const hits = tpl.match(COND) ?? [];
    if (hits.length === 0) continue;
    total += hits.length;

    const allowed = BASELINE[file] ?? 0;
    if (hits.length > allowed) {
        failed++;
        console.error(`\n⛔ ${file}`);
        console.error(`   authStore 조건부 렌더 ${hits.length}개 (허용 ${allowed}개)`);
        for (const h of hits.slice(0, 6)) {
            console.error(`     ${h.replace(/\s+/g, ' ').slice(0, 100)}`);
        }
        if (hits.length > 6) console.error(`     … 외 ${hits.length - 6}개`);
    }
}

if (failed > 0) {
    console.error(`
────────────────────────────────────────────────────────────
 authStore 로 렌더를 가르면 하이드레이션이 폐기된다.

 authStore 는 SSR 에서 항상 null 이다(모듈 레벨 $state — 서버에서 채우면
 요청 간 공유되어 정보가 샌다. 그래서 $effect 안에서만 채우고, $effect 는
 서버에서 실행되지 않는다).

 → 템플릿에서는 \`$page.data.user\`(요청별 데이터)를 쓰라.
 ⛔ 필드 이름이 다르다(data.user.level vs authStore.user.mb_level).
    그대로 치환하면 권한 판정이 조용히 깨진다. 매퍼를 경유하라.
 ⛔ authStore 를 SSR 에서 채우는 방향으로 고치지 마라 — 정보 유출이다.

 배경: docs.damoang.net/2026-08-25-hydration-auth-fix-plan.html
────────────────────────────────────────────────────────────`);
    process.exit(1);
}

console.log(`✅ authStore 조건부 렌더 ${total}개 — 전부 기준선 이내`);
