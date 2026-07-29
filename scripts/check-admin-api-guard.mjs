#!/usr/bin/env node
/**
 * 관리자 API 인증 가드 검사.
 *
 * `apps/web/src/routes/api/admin/**\/+server.ts` 의 모든 요청 핸들러가
 * 인증 가드를 갖고 있는지 확인한다.
 *
 * 왜 필요한가 (2026-07-29 실측):
 *   /api/admin 하위 11개 라우트 중 **4개**에 인증 코드가 한 줄도 없었다.
 *     settings(GET,PUT) · heap-snapshot(GET) · migration(POST) · migration/run(POST)
 *
 *   `GET /api/admin/settings` 는 익명 요청에 200 을 돌려줬고, 응답에 oauth
 *   clientSecret 필드가 들어 있었다. PUT 은 누구나 사이트 설정을 덮어쓸 수 있었다.
 *   heap-snapshot 은 운영 파드의 프로세스 메모리를 통째로 내려준다 — 세션 토큰,
 *   DB 자격, JWT 시크릿이 거기 들어 있고, 생성 자체가 수십 초 GC pause 를 만든다.
 *   migration 두 개는 요청 본문의 임의 host/port/user/password 로 외부 접속을 연다.
 *
 *   더 나쁜 것은 **셋 다 주석에 "인증 검증은 hooks.server.ts에서 처리" 라고
 *   적혀 있었다는 점이다. 그런 가드는 존재하지 않았다.** 작성자들은 있지도 않은
 *   보호를 믿고 자기 가드를 생략했고, 아무도 그걸 확인하지 않았다.
 *   사람이 매번 기억해야 하는 규칙은 이렇게 조용히 무너진다.
 *
 * 무엇을 인정하는가:
 *   - `requireAdmin(` 호출 (권장)
 *   - `locals` 참조 + `level` 언급이 함께 있는 직접 구현
 *
 * ⛔ 판정을 좁게 만들지 말 것. 초안은 `.level <` 만 인정했다가 실제 코드의
 *    `(locals.user?.level ?? 0) < 10` 형태를 못 읽고 **멀쩡한 라우트 6개를
 *    위반으로 잡았다.** 오탐이 나오면 사람이 가드를 꺼버린다 — 그러면 없느니만 못하다.
 *    실제 구멍 4개는 `locals` 를 아예 참조하지 않았으므로, 느슨한 판정으로도 전부 잡힌다.
 *
 * 한계 (정직하게):
 *   가드가 "있다"만 보고 "옳다"는 못 본다. `level < 1` 같은 잘못된 임계값은 못 잡는다.
 *   hooks 의 경로 접두사 가드가 2차 방어선이므로 여기서는 "빠뜨림"만 잡는다.
 *   참고: levels/* 는 `< 8`, 나머지는 `< 10` 을 쓴다. 이 불일치는 별도 판단 대상이다.
 *
 * 종료코드: 위반 1건 이상이면 1, 검사 자체가 성립하지 않으면 2
 */
import { readFileSync, globSync } from 'node:fs';

const PATTERN = 'apps/web/src/routes/api/admin/**/+server.ts';
const files = globSync(PATTERN, { exclude: (p) => p.includes('node_modules') });

// 검사 대상이 0개면 글롭이 어긋난 것이다. 통과로 위장하지 않는다.
if (files.length === 0) {
    console.error(`❌ 검사 대상이 0개입니다 (${PATTERN}). 경로·글롭을 확인하세요.`);
    process.exit(2);
}

const METHOD_RE = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*:/g;

let violations = 0;
let checked = 0;

for (const file of files) {
    const src = readFileSync(file, 'utf8');

    const methods = [...src.matchAll(METHOD_RE)].map((m) => m[1]);
    if (methods.length === 0) continue; // 핸들러가 없는 파일(타입만 등)은 대상 아님
    checked++;

    const hasHelper = src.includes('requireAdmin(');
    // 직접 구현: locals 를 참조하면서 level 을 언급하면 인정한다.
    // 표기 변형(`locals.user.level`, `locals.user?.level`, `(… ?? 0) < 10`)을 모두 통과시키려고
    // 일부러 느슨하게 둔다. 실제 구멍들은 locals 를 아예 안 받았으므로 이걸로 충분하다.
    const hasInline = /\blocals\b/.test(src) && /\blevel\b/.test(src);

    if (hasHelper || hasInline) continue;

    console.error(
        `${file}\n` +
            `    핸들러 [${methods.join(', ')}] 에 인증 가드가 없습니다.\n` +
            `    → import { requireAdmin } from '$lib/server/require-admin.js';\n` +
            `      const denied = requireAdmin(locals); if (denied) return denied;\n` +
            `    ⛔ "hooks 가 막아준다"고 가정하지 마세요. 그 가정이 2026-07-29 구멍을 만들었습니다.`
    );
    violations++;
}

if (checked === 0) {
    console.error(`❌ 핸들러를 가진 파일이 0개입니다 (파일 ${files.length}개). 검사가 성립하지 않습니다.`);
    process.exit(2);
}

if (violations > 0) {
    console.error(`\n❌ 가드 없는 관리자 API ${violations}건. 인증 없이 노출됩니다.`);
    process.exit(1);
}

console.log(`✅ 관리자 API 인증 가드 검사 통과 (${checked}개 파일)`);
