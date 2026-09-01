<script lang="ts">
    import type { PageData } from './$types';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    const { data }: { data: PageData } = $props();

    let selectedOld = $state<number | null>(null);
    let selectedNew = $state<number | null>(null);
    let revertingId = $state<number | null>(null);
    let revertError = $state<string | null>(null);

    // 되돌리기: 해당 리비전 내용으로 새 리비전을 생성한다(히스토리 보존)
    async function revert(revisionId: number, versionNumber: number) {
        if (revertingId !== null) return;
        if (!confirm(`버전 v${versionNumber} 내용으로 되돌립니다. 진행할까요?`)) {
            return;
        }
        revertingId = revisionId;
        revertError = null;
        try {
            const response = await fetch(`/api/wiki/pages/${data.wikiPage.id}/revert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revisionId })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || '되돌리기에 실패했습니다.');
            }
            // 되돌려진 문서로 이동
            goto(`/wiki${result.path}`);
        } catch (err) {
            revertError = err instanceof Error ? err.message : '되돌리기에 실패했습니다.';
        } finally {
            revertingId = null;
        }
    }

    // 작성자 표시: 로그인 회원은 표시명, 익명(author_id NULL)은 IP 해시 라벨
    function authorLabel(revision: {
        author_name: string | null;
        author_ip_hash: string | null;
    }): string {
        if (revision.author_name) return revision.author_name;
        if (revision.author_ip_hash) return `익명(${revision.author_ip_hash})`;
        return '익명';
    }

    function formatDate(date: Date | string): string {
        return new Date(date).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatSize(size: number): string {
        if (size >= 1024 * 1024) {
            return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        }
        if (size >= 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        }
        return `${size} B`;
    }

    function formatDelta(delta: number): string {
        if (delta > 0) return `+${delta}`;
        return String(delta);
    }

    function getDeltaClass(delta: number): string {
        if (delta > 0) return 'delta-positive';
        if (delta < 0) return 'delta-negative';
        return 'delta-zero';
    }

    function compareUrl(): string {
        if (selectedOld && selectedNew) {
            return `${$page.url.pathname}?oldid=${selectedOld}&diff=${selectedNew}`;
        }
        return '#';
    }

    // 간단한 diff 표시 (줄 단위 비교)
    function computeDiff(
        oldText: string | null,
        newText: string | null
    ): Array<{ type: 'same' | 'add' | 'remove'; line: string }> {
        const oldLines = (oldText || '').split('\n');
        const newLines = (newText || '').split('\n');
        const result: Array<{ type: 'same' | 'add' | 'remove'; line: string }> = [];

        // 간단한 LCS 기반 diff (성능상 최대 500줄만 처리)
        const maxLines = 500;
        const oldSlice = oldLines.slice(0, maxLines);
        const newSlice = newLines.slice(0, maxLines);

        let i = 0,
            j = 0;
        while (i < oldSlice.length || j < newSlice.length) {
            if (i >= oldSlice.length) {
                result.push({ type: 'add', line: newSlice[j] });
                j++;
            } else if (j >= newSlice.length) {
                result.push({ type: 'remove', line: oldSlice[i] });
                i++;
            } else if (oldSlice[i] === newSlice[j]) {
                result.push({ type: 'same', line: oldSlice[i] });
                i++;
                j++;
            } else {
                // 간단한 휴리스틱: 다음 줄에서 일치하는지 확인
                let foundInOld = oldSlice.indexOf(newSlice[j], i);
                let foundInNew = newSlice.indexOf(oldSlice[i], j);

                if (foundInNew !== -1 && (foundInOld === -1 || foundInNew - j < foundInOld - i)) {
                    // 새 줄에서 발견 -> 현재 old 줄은 삭제됨
                    result.push({ type: 'remove', line: oldSlice[i] });
                    i++;
                } else if (foundInOld !== -1) {
                    // 기존 줄에서 발견 -> 현재 new 줄은 추가됨
                    result.push({ type: 'add', line: newSlice[j] });
                    j++;
                } else {
                    // 둘 다 변경
                    result.push({ type: 'remove', line: oldSlice[i] });
                    result.push({ type: 'add', line: newSlice[j] });
                    i++;
                    j++;
                }
            }
        }

        return result;
    }
</script>

<svelte:head>
    <title>이력: {data.wikiPage.title} - 위키앙</title>
</svelte:head>

<div class="history-page">
    <header class="page-header">
        <h1>
            <a href="/wiki{data.wikiPage.path}" class="back-link">{data.wikiPage.title}</a>
            <span class="header-separator">&rsaquo;</span>
            문서 이력
        </h1>
    </header>

    {#if data.diffMode && data.diffData}
        <!-- Diff 비교 모드 -->
        <section class="diff-section">
            <div class="diff-header">
                <div class="diff-info">
                    <h2>리비전 비교</h2>
                    {#if data.diffData.old && data.diffData.new}
                        <p>
                            버전 {data.diffData.old.version_number}
                            ({formatDate(data.diffData.old.version_date)}) &rarr; 버전 {data
                                .diffData.new.version_number}
                            ({formatDate(data.diffData.new.version_date)})
                        </p>
                    {/if}
                </div>
                <a href="/wiki{data.wikiPage.path}/history" class="back-button">목록으로</a>
            </div>

            {#if data.diffData.old && data.diffData.new}
                <div class="diff-content">
                    {#each computeDiff(data.diffData.old.content_raw, data.diffData.new.content_raw) as line}
                        <div class="diff-line diff-{line.type}">
                            <span class="diff-marker">
                                {#if line.type === 'add'}+{:else if line.type === 'remove'}-{:else}&nbsp;{/if}
                            </span>
                            <span class="diff-text">{line.line || ' '}</span>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="error-message">선택한 리비전을 찾을 수 없습니다.</p>
            {/if}
        </section>
    {:else}
        <!-- 리비전 목록 모드 -->
        <section class="revision-section">
            <p class="revision-intro">
                이 문서의 편집 이력입니다. 두 리비전을 선택하여 비교할 수 있습니다.
            </p>

            {#if data.revisions.length > 0}
                <div class="compare-actions">
                    <a
                        href={compareUrl()}
                        class="compare-button"
                        class:disabled={!selectedOld || !selectedNew}
                    >
                        선택한 리비전 비교
                    </a>
                </div>

                {#if revertError}
                    <p class="error-message">{revertError}</p>
                {/if}

                <table class="revision-table">
                    <thead>
                        <tr>
                            <th class="col-select">이전</th>
                            <th class="col-select">현재</th>
                            <th class="col-date">날짜</th>
                            <th class="col-author">편집자</th>
                            <th class="col-size">크기</th>
                            <th class="col-comment">편집 요약</th>
                            <th class="col-action">작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.revisions as revision, index}
                            <tr class:current={index === 0}>
                                <td class="col-select">
                                    {#if index < data.revisions.length - 1}
                                        <input
                                            type="radio"
                                            name="oldid"
                                            value={revision.id}
                                            checked={selectedOld === revision.id}
                                            onchange={() => (selectedOld = revision.id)}
                                        />
                                    {/if}
                                </td>
                                <td class="col-select">
                                    {#if index > 0}
                                        <input
                                            type="radio"
                                            name="diff"
                                            value={revision.id}
                                            checked={selectedNew === revision.id}
                                            onchange={() => (selectedNew = revision.id)}
                                        />
                                    {/if}
                                </td>
                                <td class="col-date">
                                    <span class="version-badge">v{revision.version_number}</span>
                                    {formatDate(revision.version_date)}
                                </td>
                                <td class="col-author">
                                    {authorLabel(revision)}
                                </td>
                                <td class="col-size">
                                    {formatSize(revision.size)}
                                    <span class={getDeltaClass(revision.delta)}>
                                        ({formatDelta(revision.delta)})
                                    </span>
                                </td>
                                <td class="col-comment">
                                    {#if revision.is_minor}
                                        <span class="minor-badge">사소한 편집</span>
                                    {/if}
                                    {revision.comment || ''}
                                </td>
                                <td class="col-action">
                                    {#if index > 0}
                                        <button
                                            type="button"
                                            class="revert-button"
                                            disabled={revertingId !== null}
                                            onclick={() =>
                                                revert(revision.id, revision.version_number)}
                                        >
                                            {revertingId === revision.id
                                                ? '되돌리는 중…'
                                                : '되돌리기'}
                                        </button>
                                    {:else}
                                        <span class="current-label">현재</span>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {:else}
                <p class="empty-message">이 문서의 편집 이력이 없습니다.</p>
            {/if}
        </section>
    {/if}
</div>

<style>
    .history-page {
        max-width: 100%;
    }

    .page-header h1 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .back-link {
        color: var(--primary);
        text-decoration: none;
    }

    .back-link:hover {
        text-decoration: underline;
    }

    .header-separator {
        color: var(--muted-foreground);
    }

    .revision-intro {
        color: var(--muted-foreground);
        margin-bottom: 1rem;
    }

    .compare-actions {
        margin-bottom: 1rem;
    }

    .compare-button {
        display: inline-block;
        padding: 0.5rem 1rem;
        background-color: var(--primary);
        color: var(--primary-foreground);
        text-decoration: none;
        border-radius: 0.375rem;
    }

    .compare-button.disabled {
        background-color: var(--muted-foreground);
        pointer-events: none;
    }

    .revision-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
    }

    .revision-table th,
    .revision-table td {
        padding: 0.5rem;
        text-align: left;
        border-bottom: 1px solid var(--border);
    }

    .revision-table th {
        background-color: var(--muted);
        font-weight: 600;
    }

    .col-select {
        width: 40px;
        text-align: center;
    }

    .col-date {
        white-space: nowrap;
    }

    .col-author {
        white-space: nowrap;
    }

    .col-size {
        white-space: nowrap;
    }

    .col-action {
        white-space: nowrap;
        text-align: center;
    }

    .revert-button {
        padding: 0.25rem 0.625rem;
        font-size: 0.8125rem;
        color: var(--primary);
        background-color: transparent;
        border: 1px solid var(--border);
        border-radius: 0.25rem;
        cursor: pointer;
    }

    .revert-button:hover:not(:disabled) {
        background-color: var(--muted);
    }

    .revert-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .current-label {
        color: var(--muted-foreground);
        font-size: 0.8125rem;
    }

    .current {
        background-color: var(--accent);
    }

    .version-badge {
        display: inline-block;
        padding: 0.125rem 0.375rem;
        background-color: var(--muted);
        border-radius: 0.25rem;
        font-size: 0.75rem;
        margin-right: 0.25rem;
    }

    .delta-positive {
        color: oklch(0.696 0.17 162.48);
    }

    .delta-negative {
        color: var(--destructive);
    }

    .delta-zero {
        color: var(--muted-foreground);
    }

    .minor-badge {
        display: inline-block;
        padding: 0.125rem 0.375rem;
        background-color: var(--accent);
        color: var(--primary);
        border-radius: 0.25rem;
        font-size: 0.75rem;
        margin-right: 0.25rem;
    }

    /* Diff 스타일 */
    .diff-section {
        margin-top: 1rem;
    }

    .diff-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
    }

    .diff-header h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
    }

    .diff-header p {
        color: var(--muted-foreground);
        font-size: 0.875rem;
    }

    .back-button {
        padding: 0.375rem 0.75rem;
        color: var(--muted-foreground);
        text-decoration: none;
        border: 1px solid var(--border);
        border-radius: 0.25rem;
    }

    .back-button:hover {
        background-color: var(--muted);
    }

    .diff-content {
        font-family: monospace;
        font-size: 0.8125rem;
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        overflow-x: auto;
    }

    .diff-line {
        display: flex;
        padding: 0.125rem 0.5rem;
        min-height: 1.5em;
    }

    .diff-same {
        background-color: var(--background);
    }

    .diff-add {
        background-color: oklch(0.9 0.1 145 / 50%);
    }

    .diff-remove {
        background-color: oklch(0.9 0.1 25 / 50%);
    }

    .diff-marker {
        width: 1.5em;
        flex-shrink: 0;
        color: var(--muted-foreground);
        user-select: none;
    }

    .diff-text {
        white-space: pre-wrap;
        word-break: break-all;
    }

    .empty-message {
        color: var(--muted-foreground);
        font-style: italic;
        padding: 2rem;
        text-align: center;
    }

    .error-message {
        color: var(--destructive);
        padding: 1rem;
        background-color: oklch(0.9 0.05 25 / 30%);
        border-radius: 0.375rem;
    }
</style>
