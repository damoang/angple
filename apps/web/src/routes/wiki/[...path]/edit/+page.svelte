<script lang="ts">
    import type { PageData } from './$types';
    import { goto } from '$app/navigation';
    import { beforeNavigate } from '$app/navigation';
    import { on } from 'svelte/events';
    import { onMount } from 'svelte';
    import MarkdownEditor from '$lib/components/wiki/markdown-editor.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';

    const { data }: { data: PageData } = $props();

    const contentType = data.wikiPage?.content_type || 'markdown';
    const initialContent = data.wikiPage?.content ?? data.wikiPage?.content_raw ?? '';
    let title = $state(data.suggestedTitle || '');
    let content = $state(initialContent);
    let description = $state(data.wikiPage?.description || '');
    let comment = $state('');
    let isMinor = $state(false);
    let isSaving = $state(false);
    let errorMessage = $state<string | null>(null);

    const dirty = $derived(
        title !== data.suggestedTitle ||
            content !== initialContent ||
            description !== (data.wikiPage?.description || '') ||
            comment !== '' ||
            isMinor
    );
    let saved = false;
    beforeNavigate(({ cancel }) => {
        // Keep the submitted form mounted until the server confirms the write.
        if (isSaving && !saved) {
            cancel();
            return;
        }
        if (dirty && !saved && !confirm('저장하지 않은 편집 내용이 있습니다. 나가시겠습니까?'))
            cancel();
    });
    onMount(() =>
        on(window, 'beforeunload', (event) => {
            if ((dirty || isSaving) && !saved) {
                event.preventDefault();
                event.returnValue = '';
            }
        })
    );

    async function handleSave() {
        if (isSaving || saved) return;
        if (!title.trim()) {
            errorMessage = '제목을 입력해주세요.';
            return;
        }
        if (!content.trim()) {
            errorMessage = '본문을 입력해주세요.';
            return;
        }
        isSaving = true;
        errorMessage = null;
        try {
            const body = {
                title: title.trim(),
                // markdown source: content_raw, content 도 같은 source (서버측 marked + DOMPurify 가 보기 단계서 처리)
                content,
                content_raw: content,
                content_type: contentType,
                base_revision: data.baseRevision,
                description: description.trim() || null,
                comment: comment.trim() || (data.isNew ? '문서 생성' : ''),
                is_minor: isMinor
            };
            let response: Response;
            if (data.isNew) {
                response = await fetch('/api/wiki/pages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(data.csrfToken ? { 'X-CSRF-Token': data.csrfToken } : {})
                    },
                    body: JSON.stringify({ ...body, path: data.path })
                });
            } else {
                response = await fetch(`/api/wiki/pages/${data.wikiPage!.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(data.csrfToken ? { 'X-CSRF-Token': data.csrfToken } : {})
                    },
                    body: JSON.stringify(body)
                });
            }
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || result.error || '저장에 실패했습니다.');
            }
            // SvelteKit reroute 가 wiki 를 root URL 로 serving — 결과 path 그대로 이동
            const encoded = (result.path || data.path)
                .replace(/^\/+/, '')
                .split('/')
                .map(encodeURIComponent)
                .join('/');
            saved = true;
            window.location.href = '/' + encoded;
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : '저장에 실패했습니다.';
        } finally {
            // A successful save keeps controls locked until the document navigation finishes.
            if (!saved) isSaving = false;
        }
    }

    function handleCancel() {
        if (data.isNew) {
            goto('/');
        } else {
            const encoded = data.path
                .replace(/^\/+/, '')
                .split('/')
                .map(encodeURIComponent)
                .join('/');
            goto('/' + encoded);
        }
    }
</script>

<svelte:head>
    <meta name="robots" content="noindex, nofollow" />
    <title>{data.isNew ? '새 문서 작성' : `편집: ${data.suggestedTitle}`} - 위키앙</title>
</svelte:head>

<div class="wiki-edit-page">
    <header class="edit-header">
        <h1>{data.isNew ? '새 문서 작성' : '문서 편집'}</h1>
        <p class="edit-path">{data.path}</p>
        {#if !data.isNew && data.wikiPage?.content_type === 'html'}
            <p class="edit-notice">
                이 문서는 HTML 원문을 그대로 편집합니다. 표·이미지·링크가 유지되는지 미리보기에서
                확인해주세요.
            </p>
        {/if}
    </header>

    {#if errorMessage}
        <div class="error-banner" role="alert">{errorMessage}</div>
    {/if}

    <p class="hint">
        익명 편집이 가능합니다. 편집 이력에는 익명 식별자가 남으며 원본 IP는 공개되지 않습니다. 저장
        전 출처와 저작권을 확인해주세요.
    </p>
    <p class="save-status" role="status">
        {#if isSaving}저장 중입니다. 완료될 때까지 이 화면을 유지해주세요.{/if}
    </p>
    <fieldset class="edit-form" disabled={isSaving} aria-busy={isSaving}>
        <legend class="sr-only">문서 편집</legend>
        <div class="form-group">
            <label for="title" class="form-label">제목</label>
            <Input id="title" type="text" bind:value={title} placeholder="문서 제목" />
        </div>

        <div class="form-group">
            <label for="description" class="form-label">설명 (선택)</label>
            <Input
                id="description"
                type="text"
                bind:value={description}
                placeholder="문서에 대한 간단한 설명"
            />
        </div>

        <div class="form-group">
            <label for="wiki-content-source" class="form-label"
                >내용 ({contentType === 'html' ? 'HTML' : '마크다운'})</label
            >
            <MarkdownEditor bind:value={content} {contentType} path={data.path} />
            <p class="hint">
                {#if contentType === 'html'}
                    HTML 원문 편집 모드입니다. 마크다운 서식 도구는 적용되지 않습니다.
                    미리보기에서 결과를 확인한 뒤 저장해주세요.
                {:else}
                    💡 위키링크 <code>[[문서명]]</code>, 굵게 <code>**굵게**</code>, 헤딩
                    <code>## 제목</code>
                {/if}
            </p>
        </div>

        <div class="edit-summary">
            <div class="form-group" style="flex:1;min-width:200px">
                <label for="comment" class="form-label">편집 요약</label>
                <Input
                    id="comment"
                    type="text"
                    bind:value={comment}
                    placeholder="변경 내용을 간략히 설명"
                />
            </div>
            {#if !data.isNew}
                <label class="minor-edit">
                    <input type="checkbox" bind:checked={isMinor} />
                    <span>사소한 편집</span>
                </label>
            {/if}
        </div>

        <div class="edit-actions">
            <Button type="button" variant="outline" onclick={handleCancel} disabled={isSaving}>
                취소
            </Button>
            <Button type="button" onclick={handleSave} disabled={isSaving}>
                {#if isSaving}저장 중...{:else}{data.isNew ? '문서 생성' : '저장'}{/if}
            </Button>
        </div>
    </fieldset>
</div>

<style>
    .wiki-edit-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
    }
    .edit-header {
        margin-bottom: 1.5rem;
    }
    .edit-header h1 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 0.25rem;
    }
    .edit-path {
        font-size: 0.875rem;
        color: var(--muted-foreground, #6b7280);
        margin: 0;
    }
    .edit-notice {
        margin: 0.5rem 0 0;
        padding: 0.5rem 0.75rem;
        background: #fffbeb;
        color: #92400e;
        border-radius: 0.375rem;
        font-size: 0.85rem;
    }
    .error-banner {
        padding: 0.75rem 1rem;
        background: oklch(0.9 0.05 25 / 30%);
        color: var(--destructive, #b91c1c);
        border-radius: 0.375rem;
        margin-bottom: 1rem;
    }
    .save-status {
        font-size: 0.875rem;
        color: var(--muted-foreground, #6b7280);
    }
    .save-status:empty {
        display: none;
    }
    .edit-form {
        min-inline-size: 0;
        margin: 0;
        padding: 0;
        border: 0;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .form-label {
        font-size: 0.875rem;
        font-weight: 500;
    }
    .wiki-edit-page :global(input[type='text']) {
        color: var(--foreground);
    }
    .hint {
        margin: 0.25rem 0 0;
        font-size: 0.75rem;
        color: var(--muted-foreground, #6b7280);
    }
    .hint code {
        background: var(--muted, #f3f4f6);
        padding: 0.05rem 0.3rem;
        border-radius: 0.2rem;
        font-family: ui-monospace, monospace;
        font-size: 0.7rem;
    }
    .edit-summary {
        display: flex;
        align-items: flex-end;
        gap: 1rem;
        flex-wrap: wrap;
    }
    .minor-edit {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.875rem;
        color: var(--muted-foreground, #6b7280);
        cursor: pointer;
        padding-bottom: 0.5rem;
    }
    .edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border, #e5e7eb);
    }
</style>
