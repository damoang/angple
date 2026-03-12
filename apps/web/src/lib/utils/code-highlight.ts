/**
 * 코드 구문 하이라이팅 유틸리티
 * highlight.js common 번들 (~37개 주요 언어) 사용
 * 줄번호 + 복사 버튼 포함
 * 본문(markdown.svelte) + 댓글(comment-list.svelte) 공용
 */
import hljs from 'highlight.js/lib/common';

function getLanguageClass(codeEl: HTMLElement): string | null {
    for (const cls of Array.from(codeEl.classList)) {
        if (cls.startsWith('language-')) {
            return cls.slice('language-'.length);
        }
    }

    return null;
}

/**
 * 줄번호 테이블 생성
 * highlight.js 처리 후의 <code> 내부 HTML을 줄 단위 테이블로 변환
 */
function addLineNumbers(codeEl: HTMLElement): void {
    const lines = codeEl.innerHTML.split('\n');
    // 마지막 빈 줄 제거
    if (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    // 단일 줄은 줄번호 생략
    if (lines.length <= 1) return;

    const rows = lines
        .map((line, i) => {
            const num = i + 1;
            return `<tr><td class="hljs-ln-num" data-line-number="${num}"></td><td class="hljs-ln-code">${line || ' '}</td></tr>`;
        })
        .join('');

    codeEl.innerHTML = `<table class="hljs-ln">${rows}</table>`;
}

/**
 * 복사 버튼 생성 및 <pre>에 부착
 */
function addCopyButton(preEl: HTMLElement): void {
    if (preEl.querySelector('.hljs-copy-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'hljs-copy-btn';
    btn.textContent = '복사';
    btn.setAttribute('aria-label', '코드 복사');

    btn.addEventListener('click', () => {
        const code = preEl.querySelector('code');
        if (!code) return;
        // 줄번호 테이블이 있으면 코드 셀만 추출하여 줄바꿈으로 합침
        const codeLines = code.querySelectorAll('.hljs-ln-code');
        const text =
            codeLines.length > 0
                ? Array.from(codeLines)
                      .map((td) => {
                          const t = td.textContent || '';
                          // 빈 줄 placeholder 공백을 빈 문자열로 복원
                          return t === ' ' ? '' : t;
                      })
                      .join('\n')
                : code.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '복사됨!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '복사';
                btn.classList.remove('copied');
            }, 2000);
        });
    });

    preEl.appendChild(btn);
}

/**
 * 컨테이너 내의 모든 <pre><code> 블록에 구문 하이라이팅 + 줄번호 + 복사 버튼 적용
 * DOM 렌더링 이후 호출해야 함
 */
export function highlightAllCodeBlocks(container: HTMLElement): void {
    const pres = container.querySelectorAll<HTMLElement>('pre');
    for (const pre of pres) {
        const code = pre.querySelector<HTMLElement>('code');
        if (!code) continue;
        // 이미 처리된 블록은 건너뜀
        if (code.dataset.highlighted === 'yes') continue;

        const source = code.textContent || '';
        const language = getLanguageClass(code);

        if (language && hljs.getLanguage(language)) {
            code.innerHTML = hljs.highlight(source, { language, ignoreIllegals: true }).value;
        } else {
            code.innerHTML = hljs.highlightAuto(source).value;
        }
        code.dataset.highlighted = 'yes';

        addLineNumbers(code);
        addCopyButton(pre);
    }
}
