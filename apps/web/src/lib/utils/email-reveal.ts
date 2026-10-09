/**
 * 본문·댓글 이메일 주소 수집 방지 — 서버에서 주소를 표지로 감추고, 화면에선 「이메일 보기」
 * 버튼을 눌러야 팝업으로 보이게 한다.
 *
 * 흐름
 * 1. 서버(SSR load / 댓글 API)가 내려보내기 전에 `encodeEmails()` 로 주소를
 *    `{email:<hex>}` 표지로 바꾼다. HTML·페이지 데이터(JSON) 어디에도 `a@b.c` 원문이 남지 않는다.
 * 2. 렌더러(markdown / comment-list)가 sanitize 뒤에 `renderEmailMarkers()` 로 표지를 버튼으로 바꾼다.
 *    표지 값은 16진수만 허용하므로 sanitize 뒤에 넣어도 주입 표면이 없다.
 * 3. 버튼 클릭은 `openEmailReveal()` 이 받아 팝업(주소·복사·메일 쓰기)을 띄운다.
 * 4. 댓글 수정 창은 `decodeEmailMarkers()` 로 원문 주소를 되돌려 표지가 저장되지 않게 한다.
 *
 * DB 원문은 건드리지 않는다(표시 단계 변환). 정교한 헤드리스 봇·백엔드 API 직접 호출은 막지 못한다.
 * ⛔ 정규식 lookbehind 금지(구형 iOS Safari 크래시) — 앞 글자는 offset 으로 직접 검사한다.
 */

const MARKER_RE = /\{email:([0-9a-f]{6,512})\}/g;

// 로컬파트@도메인.TLD — 앞뒤 경계는 콜백에서 검사한다.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}/g;
const EMAIL_EXACT = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;

// `logo@2x.png` 같은 파일명은 이메일이 아니다.
const FILE_TLDS = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'avif',
    'svg',
    'bmp',
    'ico',
    'heic',
    'mp4',
    'webm',
    'mov',
    'mp3',
    'wav',
    'pdf',
    'zip',
    'js',
    'css',
    'html',
    'json',
    'txt'
]);

// 이 글자 바로 뒤에 붙은 주소는 URL·속성값의 일부로 보고 건너뛴다.
const BLOCKED_BEFORE = /[A-Za-z0-9._%+\-/=@]/;
const BLOCKED_AFTER = /[A-Za-z0-9@/_-]/;

function toHex(s: string): string {
    let out = '';
    for (const ch of s) out += ch.charCodeAt(0).toString(16).padStart(2, '0');
    return out;
}

function fromHex(hex: string): string {
    let out = '';
    for (let i = 0; i + 1 < hex.length; i += 2)
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    return out;
}

/** 주소를 표지로. 뒤집어서 16진수로 담는다(단순 디코딩 봇 회피). */
export function emailToMarker(email: string): string {
    return `{email:${toHex([...email].reverse().join(''))}}`;
}

/** 표지 hex → 주소. 이메일 형태가 아니면 null(위조 표지 방어). */
export function markerToEmail(hex: string): string | null {
    if (!/^[0-9a-f]+$/.test(hex) || hex.length % 2 !== 0) return null;
    const email = [...fromHex(hex)].reverse().join('');
    return EMAIL_EXACT.test(email) ? email : null;
}

function isEmail(s: string): boolean {
    if (!EMAIL_EXACT.test(s)) return false;
    const tld = s.slice(s.lastIndexOf('.') + 1).toLowerCase();
    return !FILE_TLDS.has(tld);
}

function encodeText(text: string): string {
    if (text.indexOf('@') === -1) return text;
    // mailto:주소 → 표지
    text = text.replace(/mailto:([^\s<>"'()?]+)/gi, (m, addr: string) =>
        isEmail(addr) ? emailToMarker(addr) : m
    );
    return text.replace(EMAIL_RE, (m: string, offset: number, whole: string) => {
        const before = offset > 0 ? whole[offset - 1] : '';
        const after = whole[offset + m.length] ?? '';
        if (before && BLOCKED_BEFORE.test(before)) return m;
        // http://user:pass@host 처럼 URL 토큰 안이면 건너뛴다
        const tokenStart = Math.max(
            whole.lastIndexOf(' ', offset),
            whole.lastIndexOf('\n', offset)
        );
        if (whole.slice(tokenStart + 1, offset).includes('://')) return m;
        // 주소 뒤 마침표·쉼표(문장부호)는 경계로 허용한다
        if (after && BLOCKED_AFTER.test(after)) return m;
        return isEmail(m) ? emailToMarker(m) : m;
    });
}

/**
 * 서버 전용 — 본문/댓글 원문(HTML·마크다운·평문 혼합)의 이메일을 표지로 바꾼다.
 * 태그 안(속성값)은 건드리지 않되, `mailto:` 링크는 링크째 표지로 바꾼다.
 */
export function encodeEmails(content: string): string {
    if (!content || content.indexOf('@') === -1) return content;

    // <a href="mailto:주소">…</a> → 표지 (링크 글자도 주소인 경우가 대부분)
    let out = content.replace(
        /<a\b[^>]*\bhref\s*=\s*["']mailto:([^"'?]+)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
        (m, addr: string) => (isEmail(addr.trim()) ? emailToMarker(addr.trim()) : m)
    );
    // [글자](mailto:주소) → 표지
    out = out.replace(/\[[^\]\n]*\]\(\s*mailto:([^)\s?]+)[^)]*\)/gi, (m, addr: string) =>
        isEmail(addr) ? emailToMarker(addr) : m
    );

    // 태그 밖 텍스트만 변환
    return out
        .split(/(<[^>]*>)/g)
        .map((part) => (part.startsWith('<') ? part : encodeText(part)))
        .join('');
}

/** 수정 창 프리필용 — 표지를 원래 주소로 되돌린다. */
export function decodeEmailMarkers(content: string): string {
    if (!content || content.indexOf('{email:') === -1) return content;
    return content.replace(MARKER_RE, (m, hex: string) => markerToEmail(hex) ?? m);
}

/** 메타 설명 등 평문용 — 표지를 「[이메일]」로. */
export function stripEmailMarkers(text: string): string {
    if (!text || text.indexOf('{email:') === -1) return text;
    return text.replace(MARKER_RE, '[이메일]');
}

/** 렌더러용(sanitize 뒤) — 표지를 버튼으로. */
export function renderEmailMarkers(html: string): string {
    if (!html || html.indexOf('{email:') === -1) return html;
    return html.replace(MARKER_RE, (m, hex: string) =>
        markerToEmail(hex)
            ? `<button type="button" class="email-reveal" data-er="${hex}" aria-haspopup="dialog">이메일 보기</button>`
            : m
    );
}

let popEl: HTMLDivElement | null = null;
let cleanupPop: (() => void) | null = null;

export function closeEmailReveal(): void {
    cleanupPop?.();
    cleanupPop = null;
    popEl?.remove();
    popEl = null;
}

/** 클릭 위임에서 호출 — 대상이 이메일 버튼이면 팝업을 띄우고 true. */
export function handleEmailRevealClick(ev: MouseEvent): boolean {
    const btn = (ev.target as HTMLElement | null)?.closest?.('button.email-reveal');
    if (!(btn instanceof HTMLElement)) return false;
    ev.preventDefault();
    ev.stopPropagation();
    openEmailReveal(btn);
    return true;
}

export function openEmailReveal(btn: HTMLElement): void {
    const email = markerToEmail(btn.dataset.er ?? '');
    closeEmailReveal();
    if (!email) return;

    const pop = document.createElement('div');
    pop.className = 'email-reveal-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', '이메일 주소');

    const addr = document.createElement('span');
    addr.className = 'email-reveal-addr';
    addr.textContent = email;

    const actions = document.createElement('div');
    actions.className = 'email-reveal-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = '복사';
    copyBtn.addEventListener('click', () => {
        const done = () => (copyBtn.textContent = '복사됨');
        navigator.clipboard?.writeText(email).then(done, () => {
            const range = document.createRange();
            range.selectNodeContents(addr);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        });
    });

    const mailLink = document.createElement('a');
    mailLink.href = `mailto:${email}`;
    mailLink.textContent = '메일 쓰기';

    actions.append(copyBtn, mailLink);
    pop.append(addr, actions);
    document.body.appendChild(pop);

    const r = btn.getBoundingClientRect();
    const width = pop.offsetWidth;
    const left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - width - 8));
    pop.style.top = `${r.bottom + window.scrollY + 6}px`;
    pop.style.left = `${left + window.scrollX}px`;

    const onDocClick = (e: MouseEvent) => {
        const t = e.target as Node;
        if (!pop.contains(t) && !btn.contains(t)) closeEmailReveal();
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeEmailReveal();
    };
    // 현재 클릭이 곧바로 닫지 않도록 다음 틱에 설치
    const timer = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    document.addEventListener('keydown', onKey);
    cleanupPop = () => {
        clearTimeout(timer);
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onKey);
    };
    popEl = pop;
}
