/**
 * 본문·댓글 이메일 주소 수집 방지 — 서버에서 주소를 표지로 감추고, 화면에선 「이메일 보기」
 * 버튼을 눌러야 팝업으로 보이게 한다.
 *
 * 흐름
 * 1. 서버(SSR load / 댓글 API)가 내려보내기 전에 `encodeEmails()` 로 주소를
 *    `{email:<hex>}` 표지로 바꾼다. HTML·페이지 데이터(JSON) 어디에도 `a@b.c` 원문이 남지 않는다.
 * 2. 렌더러(markdown / comment-list)가 **sanitize 전에** `renderEmailMarkers()` 로 표지를 버튼으로
 *    바꾸고, 결과 전체를 DOMPurify 가 다시 거른다. 태그 안(속성값)의 표지는 버튼이 아니라
 *    「[이메일]」 글자로 바꾼다 — sanitize 끝난 HTML 에 정규식으로 마크업을 끼우면 속성 문맥이
 *    깨져 주입 표면이 된다(위조 표지를 alt/href 에 넣는 경우).
 * 3. 버튼 클릭은 `handleEmailRevealClick()` 이 받아 팝업(주소·복사·메일 쓰기)을 띄운다.
 * 4. 댓글 수정 창은 `decodeEmailMarkers()` 로 원문 주소를 되돌려 표지가 저장되지 않게 한다.
 *    단 mailto 링크는 「링크 글자 + 주소」 평문으로 돌아온다(링크 자체는 복원하지 않음).
 *
 * DB 원문은 건드리지 않는다(표시 단계 변환). 정교한 헤드리스 봇·백엔드 API 직접 호출은 막지 못한다.
 * ⛔ 정규식 lookbehind 금지(구형 iOS Safari 크래시) — 앞 글자는 offset 으로 직접 검사한다.
 * ⛔ 반복 길이는 반드시 상한을 둔다 — 무한 `+` 는 긴 입력 한 건으로 SSR 을 O(n²) 로 묶는다.
 */

const MARKER_RE = /\{email:([0-9a-f]{6,512})\}/g;

// 로컬파트@도메인.TLD (RFC 길이 상한) — 앞뒤 경계는 콜백에서 검사한다.
const EMAIL_SRC =
    '[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\\.[A-Za-z0-9-]{1,63}){0,8}\\.[A-Za-z]{2,24}';
const EMAIL_RE = new RegExp(EMAIL_SRC, 'g');
const EMAIL_EXACT = new RegExp(`^${EMAIL_SRC}$`);

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
// URL 토큰 경계 — 공백류(탭·NBSP 포함)와 따옴표·괄호·꺾쇠, `&nbsp;` 의 `;`
const TOKEN_SEP = /[\s "'()<>;]/;

function toHex(s: string): string {
    let out = '';
    for (const ch of s) out += ch.charCodeAt(0).toString(16).padStart(2, '0');
    return out;
}

function fromHex(hex: string): string {
    let out = '';
    for (let i = 0; i + 1 < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
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

/** 링크 글자가 주소 자체(또는 비어 있음)면 표지만, 아니면 「글자 표지」로 남긴다. */
function linkToMarker(text: string, addr: string): string {
    const label = text.replace(/<[^>]*>/g, '').trim();
    if (!label || label === addr) return emailToMarker(addr);
    return `${text} ${emailToMarker(addr)}`;
}

/** URL 토큰(`https://user:pass@host` 등) 안의 위치인가. */
function insideUrlToken(whole: string, offset: number): boolean {
    let i = offset - 1;
    while (i >= 0 && !TOKEN_SEP.test(whole[i])) i--;
    return whole.slice(i + 1, offset).includes('://');
}

/**
 * 서버 전용 — 본문/댓글 원문(HTML·마크다운·평문 혼합)의 이메일을 표지로 바꾼다.
 * 태그 속성 안의 주소도 바꾼다(렌더 단계에서 「[이메일]」 글자가 된다). URL·파일명의 `@` 는 둔다.
 */
export function encodeEmails(content: string): string {
    if (!content || content.indexOf('@') === -1) return content;

    // <a href="mailto:주소">글자</a> → 표지 (글자가 주소가 아니면 글자는 남긴다)
    let out = content.replace(
        /<a\b[^>]{0,500}?\bhref\s*=\s*["']mailto:([^"'?]{1,320})[^"']{0,500}["'][^>]{0,500}>([\s\S]{0,500}?)<\/a>/gi,
        (m, addr: string, text: string) =>
            isEmail(addr.trim()) ? linkToMarker(text, addr.trim()) : m
    );
    // [글자](mailto:주소) → 표지
    out = out.replace(
        /\[([^\]\n]{0,200})\]\(\s*mailto:([^)\s?]{1,320})[^)]{0,500}\)/gi,
        (m, text: string, addr: string) => (isEmail(addr) ? linkToMarker(text, addr) : m)
    );
    // <주소> 꺾쇠 자동링크 → 표지
    out = out.replace(/<([^<>\s]{3,320})>/g, (m, addr: string) =>
        isEmail(addr) ? emailToMarker(addr) : m
    );
    // 남은 mailto:주소 → 표지
    out = out.replace(/mailto:([^\s<>"'()?]{1,320})/gi, (m, addr: string) =>
        isEmail(addr) ? emailToMarker(addr) : m
    );
    if (out.indexOf('@') === -1) return out;

    return out.replace(EMAIL_RE, (m: string, offset: number, whole: string) => {
        const before = offset > 0 ? whole[offset - 1] : '';
        const after = whole[offset + m.length] ?? '';
        if (before && BLOCKED_BEFORE.test(before)) return m;
        if (after && BLOCKED_AFTER.test(after)) return m;
        if (insideUrlToken(whole, offset)) return m;
        // 주소 뒤 마침표·쉼표(문장부호)는 경계로 허용한다
        return isEmail(m) ? emailToMarker(m) : m;
    });
}

/** 수정 창 프리필용 — 표지를 원래 주소로 되돌린다. */
export function decodeEmailMarkers(content: string): string {
    if (!content || content.indexOf('{email:') === -1) return content;
    return content.replace(MARKER_RE, (m, hex: string) => markerToEmail(hex) ?? m);
}

/** 메타 설명·구조화 데이터 등 평문용 — 표지를 「[이메일]」로. */
export function stripEmailMarkers(text: string): string {
    if (!text || text.indexOf('{email:') === -1) return text;
    return text.replace(MARKER_RE, '[이메일]');
}

/**
 * 평문 마스킹 — 원문 주소와 표지를 모두 「[이메일]」로 바꾼다. 목록 제목·검색·RSS·미리보기처럼
 * 버튼을 그릴 수 없는(또는 그릴 필요 없는) 곳에 쓴다. 여러 번 적용해도 결과가 같다.
 */
export function maskEmailText(text: string): string {
    if (!text) return text;
    return stripEmailMarkers(encodeEmails(text));
}

export type EmailTextSegment = { text: string } | { hex: string };

/**
 * 제목 컴포넌트용 — 표지가 섞인 평문을 글자/표지 조각으로 나눈다. 유효한 표지만 `{hex}` 가 되고
 * 위조 표지(주소 형태가 아님)는 글자로 남는다. 마크업을 만들지 않으므로 `{@html}` 이 필요 없다.
 */
export function splitEmailMarkers(text: string): EmailTextSegment[] {
    if (!text) return [];
    if (text.indexOf('{email:') === -1) return [{ text }];
    const out: EmailTextSegment[] = [];
    let buf = '';
    let last = 0;
    for (const m of text.matchAll(MARKER_RE)) {
        const idx = m.index ?? 0;
        buf += text.slice(last, idx);
        last = idx + m[0].length;
        if (markerToEmail(m[1])) {
            if (buf) out.push({ text: buf });
            buf = '';
            out.push({ hex: m[1] });
        } else {
            buf += m[0];
        }
    }
    buf += text.slice(last);
    if (buf) out.push({ text: buf });
    return out;
}

/** 제목으로 취급해 마스킹하는 필드 이름 — 백엔드 v1 응답·그누보드 컬럼 이름 모두. */
const TITLE_KEYS: ReadonlySet<string> = new Set(['title', 'wr_subject', 'subject', 'parent_title']);
const MASK_MAX_DEPTH = 6;

function isPlainObject(v: unknown): v is Record<string, unknown> {
    if (v === null || typeof v !== 'object') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

function maskWalk(v: unknown, keys: ReadonlySet<string>, depth: number): void {
    if (depth > MASK_MAX_DEPTH) return;
    if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
            const item = v[i];
            if (item !== null && typeof item === 'object') maskWalk(item, keys, depth + 1);
        }
        return;
    }
    if (!isPlainObject(v)) return;
    for (const k of Object.keys(v)) {
        const val = v[k];
        if (typeof val === 'string') {
            if (keys.has(k)) v[k] = maskEmailText(val);
        } else if (keys.has(k) && Array.isArray(val)) {
            // 제목 필드가 문자열 배열인 경우(검색 하이라이트 `highlight.title: string[]` 등).
            for (let i = 0; i < val.length; i++) {
                const item = val[i];
                if (typeof item === 'string') val[i] = maskEmailText(item);
                else if (item !== null && typeof item === 'object') maskWalk(item, keys, depth + 1);
            }
        } else if (val !== null && typeof val === 'object') {
            maskWalk(val, keys, depth + 1);
        }
    }
}

/**
 * 응답 데이터 안의 제목 필드(`title`·`wr_subject`·`subject`·`parent_title`)를 제자리에서
 * 마스킹하고 같은 객체를 돌려준다. 배열·평범한 객체만 따라가며 깊이는 6단계까지만 본다.
 */
export function maskTitleFields<T>(data: T, keys?: Iterable<string>): T {
    const keySet = keys ? new Set(keys) : TITLE_KEYS;
    if (data !== null && typeof data === 'object') maskWalk(data, keySet, 0);
    return data;
}

/** `JSON.parse(text, titleEmailReviver)` — 파싱하면서 제목 필드를 마스킹한다. */
export function titleEmailReviver(key: string, value: unknown): unknown {
    if (!TITLE_KEYS.has(key)) return value;
    if (typeof value === 'string') return maskEmailText(value);
    if (Array.isArray(value)) {
        return value.map((item) => (typeof item === 'string' ? maskEmailText(item) : item));
    }
    return value;
}

/**
 * 렌더러용 — **DOMPurify 전에** 호출한다. 태그 밖 표지는 버튼, 태그 안(속성값) 표지는
 * 「[이메일]」 글자로 바꾼다. 결과는 반드시 sanitize 를 거쳐야 한다(button·data-er 허용 필요).
 */
export function renderEmailMarkers(html: string): string {
    if (!html || html.indexOf('{email:') === -1) return html;
    return html
        .split(/(<[^>]*>)/g)
        .map((part) => {
            if (part.indexOf('{email:') === -1) return part;
            if (part.startsWith('<')) return part.replace(MARKER_RE, '[이메일]');
            return part.replace(MARKER_RE, (m, hex: string) =>
                markerToEmail(hex)
                    ? `<button type="button" class="email-reveal" data-er="${hex}" aria-haspopup="dialog">이메일 보기</button>`
                    : m
            );
        })
        .join('');
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

function selectText(el: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
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
        // clipboard 미지원·거부 시 주소를 선택해 두어 직접 복사하게 한다.
        if (!navigator.clipboard?.writeText) {
            selectText(addr);
            return;
        }
        navigator.clipboard.writeText(email).then(
            () => (copyBtn.textContent = '복사됨'),
            () => selectText(addr)
        );
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
    // 뒤로가기 등 화면 전환 시 남지 않게
    window.addEventListener('popstate', closeEmailReveal);
    cleanupPop = () => {
        clearTimeout(timer);
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('popstate', closeEmailReveal);
    };
    popEl = pop;
}
