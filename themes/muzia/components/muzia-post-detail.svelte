<script lang="ts">
    /**
     * Muzia 게시글 상세 — 코어 우회, DB 직접 조회
     * [URL] → <img>, {emo:xxx.gif:50} → 이모지, YouTube → 임베드
     * 대댓글: wr_comment + wr_comment_reply 기반 계층 표시
     */
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';
    import MuziaAdSlot from './muzia-ad-slot.svelte';
    interface Props { boardId: string; postId: string; }
    const { boardId, postId }: Props = $props();

    interface Post {
        id: number; title: string; content: string; author: string; author_id: string;
        created_at: string; views: number; likes: number; dislikes: number;
        comments_count: number; ip: string; has_file: boolean;
        link1: string; link2: string; youtube_ids: string[];
    }
    interface Comment {
        id: number; content: string; author: string; author_id: string;
        created_at: string; likes: number; ip: string;
        wr_comment: number; wr_comment_reply: string;
    }
    interface FileInfo { bf_no: number; bf_file: string; bf_source: string; bf_filesize: number; }

    let post = $state<Post | null>(null);
    let comments = $state<Comment[]>([]);
    let files = $state<FileInfo[]>([]);
    let loading = $state(true);
    let error = $state('');

    // 댓글 입력
    let commentText = $state('');
    let isSubmitting = $state(false);
    let showEmojiPicker = $state(false);
    let isUploading = $state(false);
    let fileInput: HTMLInputElement;
    const emojiCount = 160;
    const emojis = Array.from({ length: emojiCount }, (_, i) => `onion-${String(i + 1).padStart(3, '0')}.gif`);

    // 대댓글
    let replyTo = $state<Comment | null>(null);
    let replyText = $state('');
    let replySubmitting = $state(false);
    let showReplyEmoji = $state(false);
    let replyUploading = $state(false);
    let replyFileInput: HTMLInputElement;

    function authHeaders(): Record<string, string> {
        if (!browser) return {};
        try { const t = localStorage.getItem('access_token'); return t ? { 'Authorization': `Bearer ${t}` } : {}; }
        catch { return {}; }
    }

    /** 토큰 만료 확인 + 자동 리프레시 후 인증 헤더 반환 */
    async function ensureAuth(): Promise<Record<string, string>> {
        if (!browser) return {};
        const token = localStorage.getItem('access_token');
        if (!token) return {};
        // 토큰이 있으면 바로 반환 (만료 체크는 서버에서)
        return { 'Authorization': `Bearer ${token}` };
    }

    $effect(() => {
        loading = true;
        fetch(`/api/muzia/post?board=${boardId}&id=${postId}`, { headers: authHeaders() })
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    post = d.data.post;
                    comments = d.data.comments;
                    files = d.data.files;
                } else { error = typeof d.error === 'object' ? d.error.message : d.error; }
            })
            .catch(() => error = '게시글을 불러올 수 없습니다')
            .finally(() => loading = false);
    });

    function getDepth(c: Comment): number {
        return (c.wr_comment_reply || '').length;
    }

    /** [URL] → <img> 변환 */
    function convertBracketImages(html: string): string {
        return html.replace(/\[([^\]]+\.(jpg|jpeg|png|gif|webp)[^\]]*)\]/gi, (_, url) => {
            let src = url;
            if (src.startsWith('http://muzia.net')) src = src.replace('http://', 'https://');
            return `<img src="${src}" alt="" style="max-width:100%;border-radius:8px;margin:8px 0;" />`;
        });
    }

    /** {emo:file.gif:size} → <img> 변환 */
    function convertEmoji(html: string): string {
        return html.replace(/\{emo:([^:}]+):(\d+)\}/g, (_, file, size) => {
            return `<img src="https://muzia.net/nariya/skin/emo/${file}" alt="${file}" width="${size}" height="${size}" style="display:inline;vertical-align:middle;" />`;
        });
    }

    /** @멘션 하이라이트 */
    function highlightMentions(html: string): string {
        return html.replace(/@([a-zA-Z0-9_가-힣]+)/g, '<span class="text-indigo-600 dark:text-indigo-400 font-medium">@$1</span>');
    }

    function processContent(html: string): string {
        if (!html) return '';
        let result = html;
        result = convertBracketImages(result);
        result = convertEmoji(result);
        result = highlightMentions(result);
        return result;
    }

    async function uploadImage(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        isUploading = true;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const r = await fetch('/api/muzia/upload', { method: 'POST', headers: authHeaders(), body: formData });
            const d = await r.json();
            if (d.success) {
                commentText += `[${d.data.url}]`;
            } else { alert(typeof d.error === 'object' ? d.error.message : d.error); }
        } catch { alert('업로드 실패'); }
        finally { isUploading = false; input.value = ''; }
    }

    async function uploadReplyImage(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        replyUploading = true;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const r = await fetch('/api/muzia/upload', { method: 'POST', headers: authHeaders(), body: formData });
            const d = await r.json();
            if (d.success) {
                replyText += `[${d.data.url}]`;
            } else { alert(typeof d.error === 'object' ? d.error.message : d.error); }
        } catch { alert('업로드 실패'); }
        finally { replyUploading = false; input.value = ''; }
    }

    function insertEmoji(emoFile: string) {
        if (replyTo) {
            replyText += `{emo:${emoFile}:50}`;
            showReplyEmoji = false;
        } else {
            commentText += `{emo:${emoFile}:50}`;
            showEmojiPicker = false;
        }
    }

    async function refreshComments() {
        const r = await fetch(`/api/muzia/post?board=${boardId}&id=${postId}`, { headers: authHeaders() });
        const d = await r.json();
        if (d.success) comments = d.data.comments;
    }

    async function submitComment() {
        if (!commentText.trim() || isSubmitting) return;
        isSubmitting = true;
        try {
            const auth = await ensureAuth();
            if (!auth['Authorization']) { alert('로그인이 필요합니다'); isSubmitting = false; return; }
            const r = await fetch('/api/muzia/comment', {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ board_id: boardId, post_id: postId, content: commentText })
            });
            const d = await r.json();
            if (d.success) {
                commentText = '';
                await refreshComments();
            } else { alert(typeof d.error === 'object' ? d.error.message : d.error); }
        } catch { alert('댓글 등록 중 오류'); }
        finally { isSubmitting = false; }
    }

    async function submitReply() {
        if (!replyText.trim() || replySubmitting || !replyTo) return;
        replySubmitting = true;
        try {
            const auth = await ensureAuth();
            if (!auth['Authorization']) { alert('로그인이 필요합니다'); replySubmitting = false; return; }
            const r = await fetch('/api/muzia/comment', {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ board_id: boardId, post_id: postId, content: replyText, comment_id: replyTo.id })
            });
            const d = await r.json();
            if (d.success) {
                replyText = '';
                replyTo = null;
                showReplyEmoji = false;
                await refreshComments();
            } else { alert(typeof d.error === 'object' ? d.error.message : d.error); }
        } catch { alert('답글 등록 중 오류'); }
        finally { replySubmitting = false; }
    }

    function startReply(c: Comment) {
        replyTo = c;
        replyText = '';
        showReplyEmoji = false;
    }

    function cancelReply() {
        replyTo = null;
        replyText = '';
        showReplyEmoji = false;
    }

    function getColor(name: string) {
        const c = ['bg-slate-600','bg-indigo-600','bg-sky-600','bg-emerald-600','bg-amber-600'];
        let h = 0; for (const x of (name||'?')) h = x.charCodeAt(0) + ((h << 5) - h); return c[Math.abs(h) % c.length];
    }

    function getAvatarUrl(authorId: string): string {
        if (!authorId) return '';
        const prefix = authorId.slice(0, 2);
        return `/data/member/${prefix}/${authorId}.gif`;
    }

    let avatarErrors = $state<Set<string>>(new Set());

    // muzia JWT에서 현재 사용자 정보 추출
    function getCurrentUser(): { mb_id: string; username: string; level: number } | null {
        if (!browser) return null;
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp && payload.exp < Date.now() / 1000) return null;
            return { mb_id: payload.username || payload.user_id, username: payload.username, level: payload.level || 0 };
        } catch { return null; }
    }

    let currentUser = $state<{ mb_id: string; username: string; level: number } | null>(null);
    $effect(() => {
        // 토큰 리프레시 후 사용자 정보 갱신
        if (browser) {
            ensureAuth().then(() => { currentUser = getCurrentUser(); });
        }
    });

    // 작성자 확인 (수정 버튼 표시용)
    const canEdit = $derived(
        post && currentUser &&
        (currentUser.mb_id === post.author_id || currentUser.level >= 10)
    );
</script>

<div class="container mx-auto max-w-4xl px-4 py-6">
    {#if loading}
        <div class="py-20 text-center text-muted-foreground">로딩 중...</div>
    {:else if error}
        <div class="py-20 text-center text-red-500">{error}</div>
    {:else if post}
        <!-- 뒤로가기 -->
        <a href="/{boardId}" class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← 목록으로</a>

        <!-- 광고: 본문 위 리더보드 -->
        <MuziaAdSlot position="leaderboard" />

        <!-- 게시글 카드 -->
        <div class="overflow-hidden rounded-lg border bg-card shadow-sm">
            <!-- 헤더 -->
            <div class="border-b p-6">
                <h1 class="mb-3 text-xl font-bold">{post.title}</h1>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        {#if post.author_id && !avatarErrors.has(post.author_id)}
                            <img src={getAvatarUrl(post.author_id)} alt={post.author} class="h-10 w-10 rounded-full object-cover" onerror={() => { avatarErrors = new Set([...avatarErrors, post.author_id]); }} />
                        {:else}
                            <div class="flex h-10 w-10 items-center justify-center rounded-full {getColor(post.author)} text-sm font-bold text-white">{post.author?.[0] || '?'}</div>
                        {/if}
                        <div>
                            <span class="font-medium">{post.author}</span>
                            <div class="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{new Date(post.created_at).toLocaleDateString('ko-KR')} {new Date(post.created_at).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'})}</span>
                                <span>조회 {post.views.toLocaleString()}</span>
                                {#if post.ip}<span>IP {post.ip}</span>{/if}
                            </div>
                        </div>
                    </div>
                    {#if canEdit}
                        <a href="/{boardId}/{postId}/edit" class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:border-zinc-600">
                            수정
                        </a>
                    {/if}
                </div>
            </div>

            <!-- YouTube 임베드 -->
            {#if post.youtube_ids && post.youtube_ids.length > 0}
                <div class="space-y-3 p-6 pb-0">
                    {#each post.youtube_ids as vid}
                        <div class="relative overflow-hidden rounded-lg" style="padding-bottom:56.25%;">
                            <iframe src="https://www.youtube.com/embed/{vid}" title="YouTube" class="absolute inset-0 h-full w-full" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- 본문 -->
            <div class="prose prose-sm max-w-none p-6 dark:prose-invert">
                {@html processContent(post.content)}
            </div>

            <!-- 첨부파일 -->
            {#if files.length > 0}
                <div class="border-t px-6 py-4">
                    <h4 class="mb-2 text-sm font-semibold">📎 첨부파일 ({files.length})</h4>
                    <div class="space-y-1">
                        {#each files as f}
                            <a href="https://muzia.net/data/file/{boardId}/{f.bf_file}" target="_blank" class="block text-sm text-primary hover:underline">
                                {f.bf_source || f.bf_file}
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- 좋아요/싫어요 -->
            <div class="flex items-center justify-center gap-6 border-t py-4">
                <button class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent"
                    onclick={async () => {
                        const auth = await ensureAuth();
                        if (!auth['Authorization']) { alert('로그인이 필요합니다'); return; }
                        const r = await fetch('/api/muzia/good', { method:'POST', headers:{...auth,'Content-Type':'application/json'}, body:JSON.stringify({board_id:boardId,post_id:postId,type:'good'}) });
                        const d = await r.json();
                        if (d.success && post) { post = {...post, likes: d.data.likes, dislikes: d.data.dislikes}; }
                        else { alert((typeof d.error === 'object' ? d.error.message : d.error) || '추천 실패'); }
                    }}>
                    👍 추천 <span class="font-bold">{post.likes}</span>
                </button>
            </div>
        </div>

        <!-- 광고: 본문과 댓글 사이 -->
        <MuziaAdSlot position="content" />

        <!-- 댓글 -->
        <div class="mt-6 overflow-hidden rounded-lg border bg-card shadow-sm">
            <div class="border-b p-4">
                <h3 class="font-semibold">💬 댓글 ({comments.length})</h3>
            </div>

            <!-- 댓글 목록 -->
            <div class="divide-y">
                {#each comments as c (c.id)}
                    {@const depth = getDepth(c)}
                    <div class="p-4" style={depth > 0 ? `padding-left: ${1 + depth * 2}rem` : ''}>
                        {#if depth > 0}
                            <div class="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                                <span class="text-indigo-400">↳</span> 답글
                            </div>
                        {/if}
                        <div class="mb-2 flex items-center gap-2">
                            {#if c.author_id && !avatarErrors.has(c.author_id)}
                                <img src={getAvatarUrl(c.author_id)} alt={c.author} class="{depth > 0 ? 'h-6 w-6' : 'h-7 w-7'} rounded-full object-cover" onerror={() => { avatarErrors = new Set([...avatarErrors, c.author_id]); }} />
                            {:else}
                                <div class="flex {depth > 0 ? 'h-6 w-6' : 'h-7 w-7'} items-center justify-center rounded-full {getColor(c.author)} text-xs font-bold text-white">{c.author?.[0]}</div>
                            {/if}
                            <span class="text-sm font-medium">{c.author}</span>
                            <span class="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('ko-KR')} {new Date(c.created_at).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'})}</span>
                            {#if c.ip}<span class="text-xs text-muted-foreground">({c.ip})</span>{/if}
                        </div>
                        <div class="prose prose-sm max-w-none text-sm dark:prose-invert">
                            {@html processContent(c.content)}
                        </div>
                        <div class="mt-1 flex items-center gap-3">
                            {#if c.likes > 0}
                                <span class="text-xs text-muted-foreground">👍 {c.likes}</span>
                            {/if}
                            <button class="text-xs text-muted-foreground hover:text-indigo-500" onclick={() => startReply(c)}>답글</button>
                        </div>

                        <!-- 인라인 답글 입력 -->
                        {#if replyTo?.id === c.id}
                            <div class="mt-3 rounded-lg border bg-muted/30 p-3">
                                <div class="mb-2 flex items-center justify-between">
                                    <span class="text-xs text-muted-foreground"><span class="text-indigo-400">↳</span> {c.author}님에게 답글</span>
                                    <button class="text-xs text-muted-foreground hover:text-foreground" onclick={cancelReply}>취소</button>
                                </div>
                                <textarea bind:value={replyText} placeholder="답글을 입력하세요..." rows="2"
                                    class="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"></textarea>
                                <div class="mt-2 flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <button class="rounded-lg px-2 py-1 text-lg hover:bg-accent" title="이모지" onclick={() => showReplyEmoji = !showReplyEmoji}>😊</button>
                                        <button class="rounded-lg px-2 py-1 text-lg hover:bg-accent" title="이미지" onclick={() => replyFileInput?.click()}>
                                            {replyUploading ? '⏳' : '📷'}
                                        </button>
                                        <input type="file" accept="image/*" class="hidden" bind:this={replyFileInput} onchange={uploadReplyImage} />
                                    </div>
                                    <Button size="sm" class="bg-indigo-600 text-white" onclick={submitReply} disabled={replySubmitting || !replyText.trim()}>
                                        {replySubmitting ? '등록 중...' : '답글 등록'}
                                    </Button>
                                </div>
                                {#if showReplyEmoji}
                                    <div class="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-background p-2">
                                        <div class="grid grid-cols-10 gap-1">
                                            {#each emojis as emo}
                                                <button class="rounded p-1 hover:bg-accent" onclick={() => insertEmoji(emo)} title={emo}>
                                                    <img src="https://muzia.net/nariya/skin/emo/{emo}" alt={emo} class="h-6 w-6" />
                                                </button>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>

            <!-- 루트 댓글 입력 -->
            <div class="border-t p-4">
                <div class="flex items-start gap-3">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 text-xs font-medium text-indigo-700">U</div>
                    <div class="flex-1">
                        <textarea bind:value={commentText} placeholder="댓글을 입력하세요..." rows="3"
                            class="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"></textarea>
                        <div class="mt-2 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <button class="rounded-lg px-2 py-1 text-lg hover:bg-accent" title="이모지" onclick={() => showEmojiPicker = !showEmojiPicker}>😊</button>
                                <button class="rounded-lg px-2 py-1 text-lg hover:bg-accent" title="이미지" onclick={() => fileInput?.click()}>
                                    {isUploading ? '⏳' : '📷'}
                                </button>
                                <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={uploadImage} />
                            </div>
                            <Button size="sm" class="bg-indigo-600 text-white" onclick={submitComment} disabled={isSubmitting || !commentText.trim()}>
                                {isSubmitting ? '등록 중...' : '등록'}
                            </Button>
                        </div>

                        <!-- 이모지 선택기 -->
                        {#if showEmojiPicker}
                            <div class="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-background p-2">
                                <div class="grid grid-cols-10 gap-1">
                                    {#each emojis as emo}
                                        <button class="rounded p-1 hover:bg-accent" onclick={() => insertEmoji(emo)} title={emo}>
                                            <img src="https://muzia.net/nariya/skin/emo/{emo}" alt={emo} class="h-6 w-6" />
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
