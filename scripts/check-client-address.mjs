#!/usr/bin/env node
/**
 * `getClientAddress()` 직접 호출 금지 검사.
 *
 * adapter-node 에 `ADDRESS_HEADER=x-real-ip` 가 설정돼 있으면, 그 헤더가 없는 요청에서
 * `getClientAddress()` 는 값을 돌려주지 않고 **throw** 한다. 핸들러 최상단에서 부르면
 * try 밖이라 그대로 500 이 된다.
 *
 * 헤더가 없는 요청은 예외 상황이 아니라 **일상 경로**다. SvelteKit 의 `event.fetch` 로
 * 서버가 자기 API 를 부를 때(SSR) 쿠키·인증 헤더만 승계되고 x-real-ip 는 실리지 않는다.
 *
 * 실제 사고: 2026-08-19. 글 상세 SSR 이 event.fetch 로 댓글 API 를 부르는데 이 throw 로
 * 500 이 나면서 **댓글이 통째로 안 실렸다**. 운영 18파드 환산 시간당 약 3.6만 건.
 * 화면에는 "리플 (4)" 인데 댓글이 0개로 보였고, 회원 제보로 알았다(free/7060456).
 *
 * ⛔ 이 사고가 특히 아픈 이유: `hooks.server.ts` 에 이미 같은 함정을 설명하는 헬퍼와
 *    "이 헬퍼로 통일하면 향후 호출 추가 시에도 방지된다"는 주석이 **이미 있었다.**
 *    그런데 그 헬퍼가 파일 안에만 있었고 강제하는 장치가 없어서, 새 라우트가 그대로 밟았다.
 *    주석과 선의로는 못 막는다. 그래서 기계가 막는다.
 *
 * 규칙: `getClientAddress()` 호출은 `resolveClientIp()`(lib/server/rate-limit.ts) 안에서만.
 *       라우트에서는 `resolveClientIp(getClientAddress, request)` 로 받아 쓴다.
 *
 * 값이 없을 때의 처리는 용도마다 다르다 — 하나로 통일하지 마라:
 *   · 공개 읽기 API   → 속도제한을 **건너뛴다** (키 없이는 못 건다. 죽이는 건 더 나쁘다)
 *   · 인증·남용 방지  → `?? 'unknown'` 공용 버킷으로 **제한을 유지한다** (fail-closed).
 *                      ⛔ 기록·캡차에 이 값을 쓰지 마라. mb_ip 오염·Turnstile 실패로 이어진다
 *   · IP 기록        → `?? ''` (키는 유지하고 값만 비운다)
 *
 * 검사 대상: apps/web/src/**\/*.ts (ALLOWLIST 제외)
 * 종료코드: 위반 1건 이상이면 1
 */
import { readFileSync, globSync } from 'node:fs';

// 정본 헬퍼가 사는 곳. 여기서만 직접 호출할 수 있다.
const ALLOWLIST = new Set(['apps/web/src/lib/server/rate-limit.ts']);

const CALL = /getClientAddress\s*\(\s*\)/;

const files = globSync('apps/web/src/**/*.ts', {
    exclude: (p) => p.includes('node_modules')
});

let violations = 0;

for (const file of files) {
    const rel = file.replaceAll('\\', '/');
    if (ALLOWLIST.has(rel)) continue;

    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (!CALL.test(line)) return;

        const trimmed = line.trim();
        // 주석은 검사 대상이 아니다 — 이 규칙 자체를 설명하는 주석이 많다.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        // 정본 헬퍼에 넘기는 형태는 허용한다.
        //   resolveClientIp(getClientAddress, request)
        //   resolveClientIp(() => event.getClientAddress(), event.request)
        if (line.includes('resolveClientIp(')) return;

        violations++;
        console.error(
            `${rel}:${i + 1}  getClientAddress() 직접 호출 — resolveClientIp(getClientAddress, request) 를 쓸 것\n` +
                `    ${trimmed.slice(0, 100)}`
        );
    });
}

if (violations > 0) {
    console.error(
        `\n⛔ getClientAddress() 직접 호출 ${violations}건.\n` +
            `   x-real-ip 가 없는 요청(SSR 의 event.fetch 등)에서 throw → 500 이 된다.\n` +
            `   정본: apps/web/src/lib/server/rate-limit.ts 의 resolveClientIp()\n` +
            `   값이 없을 때의 처리는 용도별로 다르다 — 이 파일 상단 주석을 읽을 것.\n`
    );
    process.exit(1);
}

console.log(`✅ getClientAddress() 직접 호출 없음 (${files.length}개 파일 검사)`);
