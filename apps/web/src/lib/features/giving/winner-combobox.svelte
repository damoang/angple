<script lang="ts">
    /**
     * 「당첨자 지정」 입력. 후보를 「닉네임 (ID)」로 보여주고 닉네임·ID 일부로 거른다.
     * bind:value 에는 항상 mb_id(또는 수동 입력값)가 들어간다 — 제출 형식은 기존과 같다.
     *
     * 네이티브 <datalist> 는 브라우저마다 value/label 표시가 달라(ID 만 보이거나
     * 선택 후 ID 로 바뀌는 등) 작은 listbox 로 직접 그린다.
     */
    import {
        filterWinnerCandidates,
        resolveWinnerInput,
        winnerCandidateLabel,
        type WinnerCandidate
    } from './pure/winner-candidates.js';

    let {
        id,
        candidates,
        value = $bindable('')
    }: { id: string; candidates: WinnerCandidate[]; value?: string } = $props();

    const listId = $derived(`${id}-listbox`);

    let text = $state('');
    let open = $state(false);
    let active = $state(-1);

    const filtered = $derived(filterWinnerCandidates(candidates, text));
    const selected = $derived(candidates.find((c) => c.mb_id === value) ?? null);

    function onInput(e: Event) {
        text = (e.currentTarget as HTMLInputElement).value;
        value = resolveWinnerInput(candidates, text);
        open = true;
        active = -1;
    }

    function choose(c: WinnerCandidate) {
        text = winnerCandidateLabel(c);
        value = c.mb_id;
        open = false;
        active = -1;
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) open = true;
            if (filtered.length > 0) active = (active + 1) % filtered.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) open = true;
            if (filtered.length > 0) active = active <= 0 ? filtered.length - 1 : active - 1;
        } else if (e.key === 'Enter') {
            if (open && active >= 0 && filtered[active]) {
                e.preventDefault();
                choose(filtered[active]);
            }
        } else if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                open = false;
                active = -1;
            }
        }
    }

    $effect(() => {
        // 활성 항목이 스크롤 영역 밖이면 보이게.
        if (!open || active < 0) return;
        document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
    });
</script>

<div class="relative">
    <input
        {id}
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        aria-expanded={open && candidates.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        value={text}
        oninput={onInput}
        onkeydown={onKeydown}
        onfocus={() => (open = true)}
        onblur={() => {
            open = false;
            active = -1;
        }}
        placeholder="닉네임 또는 ID로 검색"
        class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
    />
    {#if open && candidates.length > 0}
        <ul
            id={listId}
            role="listbox"
            aria-label="당첨자 후보"
            class="bg-popover text-popover-foreground border-border absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border shadow-lg"
        >
            {#each filtered as c, i (c.mb_id)}
                <li
                    id="{id}-opt-{i}"
                    role="option"
                    tabindex="-1"
                    aria-selected={i === active}
                    class="flex cursor-pointer items-baseline gap-1.5 px-3 py-2 text-sm {i ===
                    active
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent'}"
                    onmousedown={(e) => {
                        // blur 보다 먼저 선택되도록 포커스 이동을 막는다.
                        e.preventDefault();
                        choose(c);
                    }}
                >
                    {#if c.nick && c.nick !== c.mb_id}
                        <span class="min-w-0 truncate font-medium">{c.nick}</span>
                        <span class="text-muted-foreground shrink-0 text-xs">({c.mb_id})</span>
                    {:else}
                        <span class="min-w-0 truncate">{c.mb_id}</span>
                    {/if}
                </li>
            {:else}
                <li class="text-muted-foreground px-3 py-2 text-sm">일치하는 후보가 없습니다</li>
            {/each}
        </ul>
    {/if}
    {#if value}
        <p class="text-muted-foreground mt-1 text-xs">
            {#if selected}
                당첨자: {winnerCandidateLabel(selected)}
            {:else}
                목록에 없는 값: {value} (참가자·댓글 작성자 ID만 지정할 수 있습니다)
            {/if}
        </p>
    {/if}
</div>
