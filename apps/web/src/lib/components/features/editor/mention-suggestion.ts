/**
 * Tiptap Mention Suggestion 설정
 * 게시글 에디터에서 @멘션 자동완성 팝업을 제공
 */

interface MemberResult {
    mb_id: string;
    mb_nick: string;
    mb_name: string;
    as_level: number;
}

interface SuggestionProps {
    query: string;
    clientRect?: (() => DOMRect | null) | null;
    items: MemberResult[];
    command: (attrs: { id: string; label: string }) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor?: any;
    range?: { from: number; to: number };
}

// 모듈 레벨 검색 결과 캐시 (items → render 간 adminBlocked 전달용)
let lastSearchResult: { query: string; adminBlocked: boolean } | null = null;
// items()에서 즉시 저장 — onExit()에서 stale한 this.props.query 대신 사용
let lastQuery = '';

class MentionPopup {
    private element: HTMLDivElement | null = null;
    private props: SuggestionProps | null = null;
    private selectedIndex = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private editor: any = null;
    private range: { from: number; to: number } | null = null;
    private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

    constructor() {}

    private render(): void {
        if (!this.element || !this.props) return;

        const { items, query } = this.props;

        if (items.length === 0) {
            // 현재 query에 대한 adminBlocked 확인
            const adminBlocked =
                lastSearchResult?.query === query && lastSearchResult?.adminBlocked;

            if (adminBlocked) {
                this.element.innerHTML = `<div class="px-3 py-2 text-sm text-red-500">멘션할 수 없는 아이디입니다</div>`; // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                // 잠시 메시지 표시 후 @텍스트 제거 + 팝업 닫기
                setTimeout(() => {
                    if (this.editor && this.range) {
                        const { from, to } = this.range;
                        // @ 포함 범위 삭제 (from - 1 = @ 위치)
                        this.editor
                            .chain()
                            .focus()
                            .deleteRange({ from: from - 1, to })
                            .run();
                    }
                    this.destroy();
                }, 1000);
            } else if (query.length > 0) {
                this.element.innerHTML = `<div class="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>`; // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            }
            return;
        }

        this.element.innerHTML = items // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            .map(
                (item, i) => `
			<button
				type="button"
				class="mention-suggestion-item flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${i === this.selectedIndex ? 'bg-accent' : ''}"
				data-index="${i}"
			>
				<div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
					${item.mb_nick.charAt(0).toUpperCase()}
				</div>
				<div class="min-w-0 flex-1">
					<span class="font-medium text-foreground truncate">${item.mb_nick}</span>
					${item.mb_id !== item.mb_nick ? `<span class="text-xs text-muted-foreground ml-1">${item.mb_id}</span>` : ''}
				</div>
			</button>
		`
            )
            .join('');

        // 클릭 이벤트 바인딩
        this.element.querySelectorAll('.mention-suggestion-item').forEach((btn) => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const index = parseInt((btn as HTMLElement).dataset.index || '0');
                const item = items[index];
                if (item) {
                    this.props?.command({ id: item.mb_id, label: item.mb_nick });
                }
            });
        });
    }

    onStart(props: SuggestionProps): void {
        this.props = props;
        this.selectedIndex = 0;
        this.editor = props.editor ?? null;
        this.range = props.range ?? null;

        this.element = document.createElement('div'); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        this.element.className =
            'bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-60 w-72 overflow-y-auto z-50';

        this.render();

        const rect = props.clientRect?.();
        if (rect) {
            this.element.style.position = 'fixed';
            this.element.style.left = `${rect.left}px`;
            this.element.style.top = `${rect.bottom + 4}px`;
        }

        document.body.appendChild(this.element); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method

        // 팝업 바깥 클릭 시 닫기
        this.clickOutsideHandler = (e: MouseEvent) => {
            if (this.element && !this.element.contains(e.target as Node)) {
                this.destroy();
            }
        };
        setTimeout(() => {
            if (this.clickOutsideHandler) {
                document.addEventListener('mousedown', this.clickOutsideHandler);
            }
        }, 100);
    }

    onUpdate(props: SuggestionProps): void {
        this.props = props;
        this.editor = props.editor ?? this.editor;
        this.range = props.range ?? this.range;
        this.render();

        const rect = props.clientRect?.();
        if (rect && this.element) {
            this.element.style.left = `${rect.left}px`;
            this.element.style.top = `${rect.bottom + 4}px`;
        }
    }

    onKeyDown(props: { event: KeyboardEvent }): boolean {
        if (!this.props) return false;
        const items = this.props.items;

        if (props.event.key === 'ArrowDown') {
            this.selectedIndex = (this.selectedIndex + 1) % items.length;
            this.render();
            return true;
        }

        if (props.event.key === 'ArrowUp') {
            this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
            this.render();
            return true;
        }

        if (props.event.key === 'Enter') {
            const item = items[this.selectedIndex];
            if (item) {
                this.props.command({ id: item.mb_id, label: item.mb_nick });
            }
            return true;
        }

        if (props.event.key === 'Escape') {
            this.destroy();
            return true;
        }

        return false;
    }

    onExit(): void {
        // 팝업 닫힐 때 (스페이스 등) admin 차단 체크
        // this.props.query/range는 빠르게 타이핑 시 stale — 모듈 레벨 lastQuery + 에디터 텍스트 검색 사용
        const query = lastQuery || this.props?.query || '';
        if (query.length >= 1 && this.editor) {
            const editor = this.editor;
            const deleteAtQuery = () => {
                // 에디터 텍스트에서 @query 위치를 직접 찾아 삭제 (stale range 의존 X)
                const { $from } = editor.state.selection;
                const textBefore = $from.parent.textContent.substring(0, $from.parentOffset);
                const target = `@${query}`;
                const idx = textBefore.lastIndexOf(target);
                if (idx >= 0) {
                    const nodeStart = $from.start();
                    editor
                        .chain()
                        .focus()
                        .deleteRange({ from: nodeStart + idx, to: nodeStart + idx + target.length })
                        .run();
                }
            };
            const showMessageThenDelete = () => {
                // 잠깐 메시지 표시 후 삭제
                const msg = document.createElement('div'); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                msg.className =
                    'bg-popover text-popover-foreground border border-border rounded-md shadow-lg z-50 px-3 py-2 text-sm text-red-500';
                msg.style.position = 'fixed';
                msg.textContent = '멘션할 수 없는 아이디입니다';
                try {
                    const coords = editor.view.coordsAtPos(editor.state.selection.from);
                    msg.style.left = `${coords.left}px`;
                    msg.style.top = `${coords.bottom + 4}px`;
                } catch {
                    // 좌표 실패 시 무시
                }
                document.body.appendChild(msg); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                setTimeout(() => {
                    deleteAtQuery();
                    msg.remove();
                }, 800);
            };
            // 이미 캐시된 결과가 있으면 즉시 처리
            if (lastSearchResult?.query === query && lastSearchResult.adminBlocked) {
                showMessageThenDelete();
            } else {
                // 캐시 없으면 API로 확인
                fetch(`/api/members/search?q=${encodeURIComponent(query)}&limit=1`)
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data) => {
                        if (data?.adminBlocked && data.members?.length === 0) {
                            showMessageThenDelete();
                        }
                    })
                    .catch(() => {});
            }
        }
        lastQuery = '';
        this.destroy();
    }

    private destroy(): void {
        if (this.clickOutsideHandler) {
            document.removeEventListener('mousedown', this.clickOutsideHandler);
            this.clickOutsideHandler = null;
        }
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let searchGeneration = 0;

export const mentionSuggestion = {
    char: '@',
    allowSpaces: false,
    items: async ({ query }: { query: string }): Promise<MemberResult[]> => {
        if (!query || query.length < 1) return [];

        // 즉시 저장 (debounce 전) — 빠르게 타이핑 후 스페이스 시 onExit()에서 사용
        lastQuery = query;
        const gen = ++searchGeneration;

        return new Promise((resolve) => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(
                        `/api/members/search?q=${encodeURIComponent(query)}&limit=8`
                    );
                    if (res.ok) {
                        const data = await res.json();
                        const members = data.members ?? [];
                        // 최신 검색만 캐시 반영 (이전 응답이 늦게 도착해도 무시)
                        if (gen === searchGeneration) {
                            lastSearchResult = {
                                query,
                                adminBlocked: data.adminBlocked ?? false
                            };
                        }
                        resolve(members);
                    } else {
                        resolve([]);
                    }
                } catch {
                    resolve([]);
                }
            }, 150);
        });
    },
    render: () => {
        const popup = new MentionPopup();
        return {
            onStart: (props: SuggestionProps) => popup.onStart(props),
            onUpdate: (props: SuggestionProps) => popup.onUpdate(props),
            onKeyDown: (props: { event: KeyboardEvent }) => popup.onKeyDown(props),
            onExit: () => popup.onExit()
        };
    }
};
