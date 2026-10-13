/**
 * 장기판·장기알 색 토큰 — 보드(janggi-board)와 먹은 말 줄(janggi-captured)이 같이 쓴다.
 *
 * CSS 사용자 지정 속성으로 내보내 요소의 style 에 그대로 꽂는다. 값은 보드에 있던 것과 같다
 * (판은 다크 모드에서도 같은 나무색 — 판 바깥 대비만 각 컴포넌트가 조정한다).
 */
export const JANGGI_TOKENS: Readonly<Record<string, string>> = {
    '--jb-wood-a': '#efcf98',
    '--jb-wood-b': '#dcb174',
    '--jb-wood-c': '#c99a5b',
    '--jb-frame-a': '#8f5f2e',
    '--jb-frame-b': '#5e3a18',
    '--jb-line': '#4a2c10',
    '--jb-face-a': '#fcf4e1',
    '--jb-face-b': '#e6cc9c',
    '--jb-side-a': '#cfa96f',
    '--jb-side-b': '#a47b45',
    '--jb-side-2': '#8c6534',
    '--jb-side-3': '#6b4a22',
    '--jb-rim': '#8a6538',
    '--jb-shine': 'rgba(255, 255, 255, 0.8)',
    '--jb-cho': '#0e5566',
    '--jb-cho-deep': '#062f3a',
    '--jb-han': '#c2371d',
    '--jb-han-deep': '#6e1a0b',
    '--jb-shadow': 'rgba(40, 20, 0, 0.5)',
    '--jb-selected': '#d97706',
    '--jb-target': '#0f766e',
    '--jb-last': '#2563eb',
    '--jb-check': '#dc2626'
};

/** style 속성에 넣을 문자열. */
export const JANGGI_TOKEN_STYLE = Object.entries(JANGGI_TOKENS)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
