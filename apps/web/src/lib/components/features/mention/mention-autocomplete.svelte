<script lang="ts">
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';

    interface MemberResult {
        mb_id: string;
        mb_nick: string;
        mb_name: string;
        as_level: number;
    }

    interface Props {
        /** 연결할 textarea 엘리먼트 */
        textarea: HTMLTextAreaElement | null;
        /** 멘션 선택 콜백 */
        onSelect?: (member: MemberResult) => void;
    }

    let { textarea, onSelect }: Props = $props();

    let isOpen = $state(false);
    let results = $state<MemberResult[]>([]);
    let selectedIndex = $state(0);
    let mentionStart = $state(-1);
    let query = $state('');
    let isLoading = $state(false);
    let adminBlocked = $state(false);
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    let searchGeneration = 0;
    let dropdownEl: HTMLDivElement | undefined = $state();

    // textarea 이벤트 바인딩
    $effect(() => {
        if (!textarea) return;

        const handleInput = () => detectMention();
        const handleKeydown = (e: KeyboardEvent) => handleKeyDown(e);
        const handleBlur = () => {
            setTimeout(() => close(), 200);
        };

        textarea.addEventListener('input', handleInput);
        textarea.addEventListener('keydown', handleKeydown);
        textarea.addEventListener('blur', handleBlur);

        return () => {
            textarea!.removeEventListener('input', handleInput);
            textarea!.removeEventListener('keydown', handleKeydown);
            textarea!.removeEventListener('blur', handleBlur);
        };
    });

    function detectMention(): void {
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const text = textarea.value;

        const beforeCursor = text.substring(0, cursorPos);
        const lastAtIndex = beforeCursor.lastIndexOf('@');

        if (lastAtIndex === -1) {
            close();
            return;
        }

        // @ 바로 앞이 공백이거나 줄 시작이어야 함
        if (lastAtIndex > 0 && !/\s/.test(beforeCursor[lastAtIndex - 1])) {
            close();
            return;
        }

        // @ 이후 텍스트에 공백이 있으면 멘션이 아님
        const afterAt = beforeCursor.substring(lastAtIndex + 1);
        if (/\s/.test(afterAt)) {
            // 스페이스 직전 query가 admin이면 @텍스트 제거
            const spaceQuery = afterAt.replace(/\s+$/, '');
            if (spaceQuery.length >= 1) {
                checkAdminAndRemove(lastAtIndex, spaceQuery);
            }
            close();
            return;
        }

        mentionStart = lastAtIndex;
        query = afterAt;

        if (query.length >= 1) {
            searchMembers(query);
        } else {
            results = [];
            isOpen = true;
        }
    }

    async function searchMembers(q: string): Promise<void> {
        if (searchTimeout) clearTimeout(searchTimeout);

        const gen = ++searchGeneration;

        searchTimeout = setTimeout(async () => {
            isLoading = true;
            try {
                const res = await fetch(`/api/members/search?q=${encodeURIComponent(q)}&limit=8`);
                if (!res.ok || gen !== searchGeneration) return;

                const data = await res.json();
                results = data.members ?? [];
                adminBlocked = data.adminBlocked ?? false;
                selectedIndex = 0;
                isOpen = true;

                if (adminBlocked && results.length === 0) {
                    setTimeout(() => {
                        removeMentionText();
                    }, 1000);
                }
            } catch {
                results = [];
                adminBlocked = false;
            } finally {
                isLoading = false;
            }
        }, 150);
    }

    function handleKeyDown(e: KeyboardEvent): void {
        if (!isOpen || results.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % results.length;
                scrollToSelected();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + results.length) % results.length;
                scrollToSelected();
                break;
            case 'Enter':
            case 'Tab':
                if (isOpen && results.length > 0) {
                    e.preventDefault();
                    selectMember(results[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                close();
                break;
        }
    }

    function scrollToSelected(): void {
        if (!dropdownEl) return;
        const items = dropdownEl.querySelectorAll('[data-mention-item]');
        items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function selectMember(member: MemberResult): void {
        if (!textarea) return;

        const text = textarea.value;
        const before = text.substring(0, mentionStart);
        const after = text.substring(textarea.selectionStart);

        const mention = `@${member.mb_nick} `;
        textarea.value = before + mention + after;

        const newCursorPos = mentionStart + mention.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;

        // input 이벤트 트리거 (Svelte 바인딩 업데이트)
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        onSelect?.(member);
        close();
        textarea.focus();
    }

    function removeMentionText(): void {
        if (!textarea || mentionStart < 0) return;

        const text = textarea.value;
        const removeEnd = mentionStart + 1 + query.length; // @ + query
        const before = text.substring(0, mentionStart);
        const after = text.substring(removeEnd);

        textarea.value = before + after;
        textarea.selectionStart = mentionStart;
        textarea.selectionEnd = mentionStart;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    async function checkAdminAndRemove(atIndex: number, q: string): Promise<void> {
        try {
            const res = await fetch(`/api/members/search?q=${encodeURIComponent(q)}&limit=1`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.adminBlocked && data.members.length === 0 && textarea) {
                // 잠깐 메시지 표시
                adminBlocked = true;
                query = q;
                mentionStart = atIndex;
                results = [];
                isOpen = true;

                setTimeout(() => {
                    if (!textarea) return;
                    const text = textarea.value;
                    // @ + query + 뒤따르는 공백까지 제거
                    const removeStart = atIndex;
                    let removeEnd = atIndex + 1 + q.length;
                    while (removeEnd < text.length && /\s/.test(text[removeEnd])) removeEnd++;
                    const before = text.substring(0, removeStart);
                    const after = text.substring(removeEnd);
                    textarea.value = before + after;
                    textarea.selectionStart = removeStart;
                    textarea.selectionEnd = removeStart;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    close();
                }, 800);
            }
        } catch {
            // 무시
        }
    }

    function close(): void {
        isOpen = false;
        results = [];
        adminBlocked = false;
        mentionStart = -1;
        query = '';
        selectedIndex = 0;
    }
</script>

{#if isOpen && (results.length > 0 || isLoading || query.length === 0 || adminBlocked)}
    <div
        bind:this={dropdownEl}
        class="bg-popover text-popover-foreground border-border absolute bottom-full z-50 mb-1 max-h-60 w-72 overflow-y-auto rounded-md border shadow-lg"
        role="listbox"
        aria-label="회원 검색 결과"
    >
        {#if isLoading}
            <div class="text-muted-foreground px-3 py-2 text-sm">검색 중...</div>
        {:else if query.length === 0}
            <div class="text-muted-foreground px-3 py-2 text-sm">닉네임을 입력하세요</div>
        {:else if results.length === 0 && adminBlocked}
            <div class="px-3 py-2 text-sm text-red-500">멘션할 수 없는 아이디입니다</div>
        {:else if results.length === 0}
            <div class="text-muted-foreground px-3 py-2 text-sm">검색 결과가 없습니다</div>
        {:else}
            {#each results as member, i (member.mb_id)}
                <button
                    type="button"
                    data-mention-item
                    role="option"
                    aria-selected={i === selectedIndex}
                    class="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors {i ===
                    selectedIndex
                        ? 'bg-accent'
                        : ''}"
                    onmouseenter={() => (selectedIndex = i)}
                    onmousedown={(e) => {
                        e.preventDefault();
                        selectMember(member);
                    }}
                >
                    <div
                        class="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs"
                    >
                        {member.mb_nick.charAt(0).toUpperCase()}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1">
                            <LevelBadge level={member.as_level} size="sm" />
                            <span class="text-foreground truncate font-medium"
                                >{member.mb_nick}</span
                            >
                        </div>
                        {#if member.mb_id !== member.mb_nick}
                            <span class="text-muted-foreground text-xs">{member.mb_id}</span>
                        {/if}
                    </div>
                </button>
            {/each}
        {/if}
    </div>
{/if}
