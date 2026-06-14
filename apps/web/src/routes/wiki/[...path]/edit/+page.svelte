<script lang="ts">
    import type { PageData } from './$types';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import MarkdownEditor from '$lib/components/wiki/markdown-editor.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';

    const { data }: { data: PageData } = $props();

    // 기존 문서 → markdown 으로 통일.
    // - content_type='markdown': content_raw 또는 content (source 가 markdown)
    // - content_type='html'    : 클라이언트 마운트 후 turndown 으로 markdown 변환
    // - content_type='wikitext': content_raw 그대로 (위키텍스트는 marked 가 못 다루므로 사용자가 markdown 으로 다시 작성)
    function pickInitial(): string {
        if (!data.wikiPage) return '';
        const p = data.wikiPage;
        if (p.content_type === 'markdown') return p.content_raw || p.content || '';
        if (p.content_type === 'wikitext') return p.content_raw || '';
        // html 은 onMount 에서 turndown
        return p.content_raw || '';
    }

    let title = $state(data.suggestedTitle || '');
    let content = $state(pickInitial());
    let description = $state(data.wikiPage?.description || '');
    let comment = $state('');
    let isMinor = $state(false);
    let isSaving = $state(false);
    let errorMessage = $state<string | null>(null);

    // html 문서 → turndown 으로 markdown 변환 (클라이언트 only)
    onMount(async () => {
        if (data.wikiPage?.content_type === 'html' && data.wikiPage.content) {
            const TurndownModule = await import('turndown');
            const TurndownService = TurndownModule.default;
            const td = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced',
                bulletListMarker: '-',
                emDelimiter: '_'
            });
            // 위키링크 보존: <a class="wiki-link" href="/path">label</a> → [[path|label]]
            td.addRule('wikilink', {
                filter: (node) =>
                    node.nodeName === 'A' && (node as HTMLElement).classList?.contains('wiki-link'),
                replacement: (text, node) => {
                    const el = node as HTMLAnchorElement;
                    const href = (el.getAttribute('href') || '').replace(/^\//, '');
                    const decoded = decodeURIComponent(href);
                    return text === decoded ? `[[${decoded}]]` : `[[${decoded}|${text}]]`;
                }
            });
            content = td.turndown(data.wikiPage.content);
        }
    });

    async function handleSave() {
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
                content_type: 'markdown',
                description: description.trim() || null,
                comment: comment.trim() || (data.isNew ? '문서 생성' : ''),
                is_minor: isMinor
            };
            let response: Response;
            if (data.isNew) {
                response = await fetch('/api/wiki/pages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...body, path: data.path })
                });
            } else {
                response = await fetch(`/api/wiki/pages/${data.wikiPage!.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || '저장에 실패했습니다.');
            }
            // SvelteKit reroute 가 wiki 를 root URL 로 serving — 결과 path 그대로 이동
            const encoded = (result.path || data.path)
                .replace(/^\/+/, '')
                .split('/')
                .map(encodeURIComponent)
                .join('/');
            window.location.href = '/' + encoded;
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : '저장에 실패했습니다.';
        } finally {
            isSaving = false;
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
            window.location.href = '/' + encoded;
        }
    }
</script>

<svelte:head>
    <title>{data.isNew ? '새 문서 작성' : `편집: ${data.suggestedTitle}`} - 위키앙</title>
</svelte:head>

<div class="wiki-edit-page">
    <header class="edit-header">
        <h1>{data.isNew ? '새 문서 작성' : '문서 편집'}</h1>
        <p class="edit-path">{data.path}</p>
        {#if !data.isNew && data.wikiPage?.content_type === 'html'}
            <p class="edit-notice">
                ℹ️ 이 문서는 원래 HTML 로 작성되었습니다. 자동으로 마크다운 변환 후 편집합니다. 저장
                시 마크다운으로 통일됩니다.
            </p>
        {/if}
    </header>

    {#if errorMessage}
        <div class="error-banner">{errorMessage}</div>
    {/if}

    <div class="edit-form">
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
            <label class="form-label">내용 (마크다운)</label>
            <MarkdownEditor bind:value={content} />
            <p class="hint">
                💡 위키링크 <code>[[문서명]]</code>, 굵게 <code>**굵게**</code>, 헤딩
                <code>## 제목</code>
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
    </div>
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
    .edit-form {
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
