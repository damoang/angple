<script lang="ts">
    import type { PageData } from './$types';
    import { goto } from '$app/navigation';
    import TiptapEditor from '$lib/components/features/editor/tiptap-editor.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';

    const { data }: { data: PageData } = $props();

    let title = $state(data.suggestedTitle);
    let content = $state(data.wikiPage?.content || '');
    let description = $state(data.wikiPage?.description || '');
    let comment = $state('');
    let isMinor = $state(false);
    let isSaving = $state(false);
    let errorMessage = $state<string | null>(null);

    let editorRef: TiptapEditor;

    function handleEditorUpdate(html: string): void {
        content = html;
    }

    async function handleSave(): Promise<void> {
        if (!title.trim()) {
            errorMessage = '제목을 입력해주세요.';
            return;
        }

        isSaving = true;
        errorMessage = null;

        try {
            const editorContent = editorRef?.getContent?.() || content;
            const contentRaw = stripHtml(editorContent);

            if (data.isNew) {
                // 신규 문서 생성
                const response = await fetch('/api/wiki/pages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: data.path,
                        title: title.trim(),
                        content: editorContent,
                        content_raw: contentRaw,
                        content_type: 'html',
                        description: description.trim() || null,
                        comment: comment.trim() || '문서 생성'
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || '문서 생성에 실패했습니다.');
                }

                // 생성된 문서로 이동
                goto(`/wiki${result.path}`);
            } else {
                // 기존 문서 수정
                const response = await fetch(`/api/wiki/pages/${data.wikiPage!.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title.trim(),
                        content: editorContent,
                        content_raw: contentRaw,
                        content_type: 'html',
                        description: description.trim() || null,
                        comment: comment.trim() || '',
                        is_minor: isMinor
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || '문서 수정에 실패했습니다.');
                }

                // 수정된 문서로 이동
                goto(`/wiki${result.path}`);
            }
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : '저장에 실패했습니다.';
        } finally {
            isSaving = false;
        }
    }

    function stripHtml(html: string): string {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    }

    function handleCancel(): void {
        if (data.isNew) {
            goto('/wiki/Special:AllPages');
        } else {
            goto(`/wiki${data.path}`);
        }
    }
</script>

<svelte:head>
    <title>{data.isNew ? '새 문서 작성' : `편집: ${data.suggestedTitle}`} - 위키앙</title>
</svelte:head>

<div class="wiki-edit-page">
    <header class="edit-header">
        <h1>{data.isNew ? '새 문서 작성' : '문서 편집'}</h1>
        <p class="edit-path text-muted-foreground">{data.path}</p>
    </header>

    {#if errorMessage}
        <div class="error-banner">
            {errorMessage}
        </div>
    {/if}

    <div class="edit-form">
        <!-- 제목 -->
        <div class="form-group">
            <label for="title" class="form-label">제목</label>
            <Input
                id="title"
                type="text"
                bind:value={title}
                placeholder="문서 제목"
                class="title-input"
            />
        </div>

        <!-- 설명 -->
        <div class="form-group">
            <label for="description" class="form-label">설명 (선택)</label>
            <Input
                id="description"
                type="text"
                bind:value={description}
                placeholder="문서에 대한 간단한 설명"
            />
        </div>

        <!-- 에디터 -->
        <div class="form-group">
            <label class="form-label">내용</label>
            <TiptapEditor
                bind:this={editorRef}
                content={data.wikiPage?.content || ''}
                onUpdate={handleEditorUpdate}
                placeholder="문서 내용을 입력하세요..."
                class="wiki-editor"
            />
        </div>

        <!-- 편집 요약 -->
        <div class="edit-summary">
            <div class="form-group">
                <label for="comment" class="form-label">편집 요약</label>
                <Input
                    id="comment"
                    type="text"
                    bind:value={comment}
                    placeholder="변경 내용을 간략히 설명해주세요"
                />
            </div>

            {#if !data.isNew}
                <label class="minor-edit">
                    <input type="checkbox" bind:checked={isMinor} />
                    <span>사소한 편집</span>
                </label>
            {/if}
        </div>

        <!-- 액션 버튼 -->
        <div class="edit-actions">
            <Button type="button" variant="outline" onclick={handleCancel} disabled={isSaving}>
                취소
            </Button>
            <Button type="button" onclick={handleSave} disabled={isSaving}>
                {#if isSaving}
                    저장 중...
                {:else}
                    {data.isNew ? '문서 생성' : '저장'}
                {/if}
            </Button>
        </div>
    </div>
</div>

<style>
    .wiki-edit-page {
        max-width: 100%;
    }

    .edit-header {
        margin-bottom: 1.5rem;
    }

    .edit-header h1 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
    }

    .edit-path {
        font-size: 0.875rem;
    }

    .error-banner {
        padding: 0.75rem 1rem;
        background-color: oklch(0.9 0.05 25 / 30%);
        color: var(--destructive);
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
        color: var(--foreground);
    }

    :global(.title-input) {
        font-size: 1.125rem;
        font-weight: 500;
    }

    :global(.wiki-editor) {
        min-height: 400px;
    }

    .edit-summary {
        display: flex;
        align-items: flex-end;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .edit-summary .form-group {
        flex: 1;
        min-width: 200px;
    }

    .minor-edit {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--muted-foreground);
        cursor: pointer;
        padding-bottom: 0.5rem;
    }

    .minor-edit input {
        cursor: pointer;
    }

    .edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
    }
</style>
