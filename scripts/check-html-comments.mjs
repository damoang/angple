#!/usr/bin/env node
/**
 * HTML 주석 조기 종료 검사.
 *
 * HTML 주석은 중첩되지 않는다. 파서는 여는 시퀀스를 만나면 **처음 나오는 닫는 시퀀스**까지를
 * 주석으로 보고 끊는다. 그래서 주석 본문에 닫는 시퀀스가 들어가면 거기서 주석이 끝나고,
 * 뒤에 이어지던 설명이 그대로 화면에 렌더된다.
 *
 * 실제 사고: 2026-07-28, app.html 의 하이드레이션 앵커 설명 주석에 Svelte 마커를 예시로
 * 적었다가 모바일 메인 하단에 한글 설명이 통째로 노출됐다(bug/13122). 배포까지 나갔고
 * 회원 제보로 알았다. 사람 눈으로는 잘 안 걸리는 종류라 기계가 막는다.
 *
 * 검사 대상: .html (Svelte 파일의 {# ... } 주석은 이 규칙과 무관)
 * 종료코드: 위반 1건 이상이면 1
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const OPEN = '<' + '!--';
const CLOSE = '--' + '>';

const files = globSync('apps/web/src/**/*.html', { exclude: (p) => p.includes('node_modules') });

let violations = 0;

for (const file of files) {
    const src = readFileSync(file, 'utf8');
    let i = 0;
    while (true) {
        const start = src.indexOf(OPEN, i);
        if (start === -1) break;
        const end = src.indexOf(CLOSE, start + OPEN.length);
        if (end === -1) break;

        const body = src.slice(start + OPEN.length, end);
        // 주석 본문에 여는 시퀀스가 또 있으면, 이 주석은 의도한 범위보다 일찍 끊긴 것이다.
        if (body.includes(OPEN)) {
            const line = src.slice(0, start).split('\n').length;
            const preview = body.replace(/\s+/g, ' ').trim().slice(0, 70);
            console.error(
                `${file}:${line}  주석이 조기 종료됩니다 — 본문에 여는 시퀀스가 중첩되어 있습니다.\n` +
                    `    ${preview}...\n` +
                    `    → 설명이 필요하면 <script> 안의 JS 주석으로 옮기세요.`
            );
            violations++;
        }
        i = end + CLOSE.length;
    }
}

if (violations > 0) {
    console.error(`\n❌ HTML 주석 조기 종료 ${violations}건. 배포되면 화면에 텍스트가 노출됩니다.`);
    process.exit(1);
}
console.log(`✅ HTML 주석 검사 통과 (${files.length}개 파일)`);
