/**
 * TipTap Slash Command Extension
 * / 입력 시 커서 위치에 명령어 팝업 표시
 */
import { Extension } from '@tiptap/core';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export interface SlashCommandItem {
    title: string;
    description: string;
    icon: string;
    command: (editor: any) => void;
}

interface SlashSuggestionProps {
    query: string;
    clientRect?: (() => DOMRect | null) | null;
    items: SlashCommandItem[];
    command: (item: SlashCommandItem) => void;
    editor: any;
}

class SlashCommandPopup {
    private element: HTMLDivElement | null = null;
    private props: SlashSuggestionProps | null = null;
    private selectedIndex = 0;

    private render(): void {
        if (!this.element || !this.props) return;

        const { items } = this.props;

        if (items.length === 0) {
            this.element.innerHTML = `<div class="px-3 py-2 text-sm text-muted-foreground">일치하는 명령이 없습니다</div>`; // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            return;
        }

        this.element.innerHTML = items // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            .map(
                (item, i) => `
                <button
                    type="button"
                    class="slash-command-item flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${i === this.selectedIndex ? 'bg-accent' : ''}"
                    data-index="${i}"
                >
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-base">${item.icon}</span>
                    <div class="min-w-0 flex-1">
                        <div class="font-medium text-foreground">${item.title}</div>
                        <div class="text-xs text-muted-foreground">${item.description}</div>
                    </div>
                </button>
            `
            )
            .join('');

        this.element.querySelectorAll('.slash-command-item').forEach((btn) => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const index = parseInt((btn as HTMLElement).dataset.index || '0');
                const item = items[index];
                if (item) {
                    this.props?.command(item);
                }
            });
        });

        // 선택된 항목이 보이도록 스크롤
        const selected = this.element.querySelector(
            `.slash-command-item:nth-child(${this.selectedIndex + 1})`
        );
        selected?.scrollIntoView({ block: 'nearest' });
    }

    onStart(props: SlashSuggestionProps): void {
        this.props = props;
        this.selectedIndex = 0;

        this.element = document.createElement('div'); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        this.element.className =
            'bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-80 w-72 overflow-y-auto z-50';

        this.render();
        this.positionElement(props);
        document.body.appendChild(this.element); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    }

    onUpdate(props: SlashSuggestionProps): void {
        this.props = props;
        this.selectedIndex = 0;
        this.render();
        this.positionElement(props);
    }

    onKeyDown(props: { event: KeyboardEvent }): boolean {
        if (!this.props) return false;
        const items = this.props.items;
        if (items.length === 0) return false;

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
                this.props.command(item);
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

    private positionElement(props: SlashSuggestionProps): void {
        const rect = props.clientRect?.();
        if (rect && this.element) {
            const viewportHeight = window.innerHeight;
            const popupHeight = 320; // max-h-80 = 20rem = 320px
            const spaceBelow = viewportHeight - rect.bottom;

            this.element.style.position = 'fixed';
            this.element.style.left = `${rect.left}px`;

            if (spaceBelow < popupHeight && rect.top > popupHeight) {
                // 위에 표시
                this.element.style.top = '';
                this.element.style.bottom = `${viewportHeight - rect.top + 4}px`;
            } else {
                // 아래에 표시
                this.element.style.bottom = '';
                this.element.style.top = `${rect.bottom + 4}px`;
            }
        }
    }

    private destroy(): void {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}

/**
 * Slash Command 아이템 목록
 * onImageUpload, onEmoticon 등 콜백은 에디터에서 주입
 */
export function createSlashCommandItems(callbacks: {
    onImageUpload?: () => void;
    onEmoticon?: () => void;
    onYoutube?: () => void;
}): SlashCommandItem[] {
    return [
        {
            title: '이미지',
            description: '이미지 파일 업로드',
            icon: '📷',
            command: () => callbacks.onImageUpload?.()
        },
        {
            title: '앙티콘',
            description: '이모티콘 삽입',
            icon: '😊',
            command: () => callbacks.onEmoticon?.()
        },
        {
            title: 'YouTube',
            description: 'YouTube 동영상 삽입',
            icon: '▶️',
            command: () => callbacks.onYoutube?.()
        },
        {
            title: '표',
            description: '3×3 테이블 삽입',
            icon: '📊',
            command: (editor) => {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            }
        },
        {
            title: '코드 블록',
            description: '코드 블록 삽입',
            icon: '💻',
            command: (editor) => {
                editor.chain().focus().toggleCodeBlock().run();
            }
        },
        {
            title: '구분선',
            description: '수평 구분선 삽입',
            icon: '──',
            command: (editor) => {
                editor.chain().focus().setHorizontalRule().run();
            }
        },
        {
            title: '인용',
            description: '인용문 블록',
            icon: '❝',
            command: (editor) => {
                editor.chain().focus().toggleBlockquote().run();
            }
        },
        {
            title: '제목 1',
            description: '큰 제목',
            icon: 'H1',
            command: (editor) => {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
            }
        },
        {
            title: '제목 2',
            description: '중간 제목',
            icon: 'H2',
            command: (editor) => {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
            }
        },
        {
            title: '글머리 기호',
            description: '글머리 기호 목록',
            icon: '•',
            command: (editor) => {
                editor.chain().focus().toggleBulletList().run();
            }
        },
        {
            title: '번호 목록',
            description: '번호가 매겨진 목록',
            icon: '1.',
            command: (editor) => {
                editor.chain().focus().toggleOrderedList().run();
            }
        }
    ];
}

const slashCommandPluginKey = new PluginKey('slashCommand');

/**
 * Slash Command TipTap Extension
 * 사용법: SlashCommand.configure({ suggestion: { items, ... } })
 */
export const SlashCommand = Extension.create({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                startOfLine: false,
                pluginKey: slashCommandPluginKey,
                command: ({
                    editor,
                    range,
                    props
                }: {
                    editor: any;
                    range: any;
                    props: SlashCommandItem;
                }) => {
                    // / 텍스트 삭제
                    editor.chain().focus().deleteRange(range).run();
                    // 명령 실행
                    props.command(editor);
                },
                items: ({ query }: { query: string }): SlashCommandItem[] => {
                    return [];
                },
                render: () => {
                    const popup = new SlashCommandPopup();
                    return {
                        onStart: (props: SlashSuggestionProps) => popup.onStart(props),
                        onUpdate: (props: SlashSuggestionProps) => popup.onUpdate(props),
                        onKeyDown: (props: { event: KeyboardEvent }) => popup.onKeyDown(props),
                        onExit: () => popup.onExit()
                    };
                }
            } as Partial<SuggestionOptions>
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion
            })
        ];
    }
});
