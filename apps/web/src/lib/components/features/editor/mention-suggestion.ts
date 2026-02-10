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
}

class MentionPopup {
    private element: HTMLDivElement | null = null;
    private props: SuggestionProps | null = null;
    private selectedIndex = 0;

    constructor() {}

    private render(): void {
        if (!this.element || !this.props) return;

        const { items } = this.props;

        if (items.length === 0) {
            this.element.innerHTML = `<div class="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>`; // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
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
    }

    onUpdate(props: SuggestionProps): void {
        this.props = props;
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
        this.destroy();
    }

    private destroy(): void {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

export const mentionSuggestion = {
    char: '@',
    allowSpaces: false,
    items: async ({ query }: { query: string }): Promise<MemberResult[]> => {
        if (!query || query.length < 1) return [];

        return new Promise((resolve) => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(
                        `/api/members/search?q=${encodeURIComponent(query)}&limit=8`
                    );
                    if (res.ok) {
                        resolve(await res.json());
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
