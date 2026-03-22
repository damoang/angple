<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Progress } from '$lib/components/ui/progress/index.js';
    import * as Tabs from '$lib/components/ui/tabs/index.js';
    import type { PageData } from './$types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { apiClient } from '$lib/api/index.js';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import User from '@lucide/svelte/icons/user';
    import Calendar from '@lucide/svelte/icons/calendar';
    import Clock from '@lucide/svelte/icons/clock';
    import FileText from '@lucide/svelte/icons/file-text';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Ban from '@lucide/svelte/icons/ban';
    import Mail from '@lucide/svelte/icons/mail';
    import Link from '@lucide/svelte/icons/link';
    import Shield from '@lucide/svelte/icons/shield';
    import Database from '@lucide/svelte/icons/database';
    import UserPlus from '@lucide/svelte/icons/user-plus';
    import UserMinus from '@lucide/svelte/icons/user-minus';
    import CheckCircle from '@lucide/svelte/icons/check-circle';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Camera from '@lucide/svelte/icons/camera';
    import X from '@lucide/svelte/icons/x';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { getGradeName } from '$lib/utils/grade.js';
    import type { Component } from 'svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import { formatDate } from '$lib/utils/format-date.js';
    import FollowListDialog from '$lib/components/features/member/follow-list-dialog.svelte';

    // 동적 플러그인 임포트: member-memo
    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));
    let MemoBadge = $state<Component | null>(null);
    $effect(() => {
        if (memoPluginActive) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
        }
    });

    // 동적 플러그인 임포트: interaction-analysis
    let InteractionPanel = $state<Component | null>(null);
    $effect(() => {
        if (pluginStore.isPluginActive('interaction-analysis')) {
            loadPluginComponent('interaction-analysis', 'interaction-panel').then(
                (c) => (InteractionPanel = c)
            );
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data }: { data: PageData & { profile: any } } = $props();
    const p = $derived(data.profile);

    let overrideImageUrl = $state<string | null>(null);
    const profileIconUrl = $derived(
        overrideImageUrl || getAvatarUrl(p?.mb_image, p?.mb_image_updated_at)
    );
    let profileIconFailed = $state(false);
    $effect(() => {
        if (p) profileIconFailed = false;
    });

    // 프로필 이미지 업로드
    let imageUploading = $state(false);
    let imageFileInput: HTMLInputElement | undefined = $state();

    function handleImageClick(): void {
        if (!isOwnProfile || imageUploading) return;
        imageFileInput?.click();
    }

    async function handleImageSelect(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드할 수 있습니다.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('파일 크기가 너무 큽니다. (최대 2MB)');
            return;
        }

        imageUploading = true;
        try {
            const result = await apiClient.uploadMemberImage(file);
            overrideImageUrl = result.url;
            profileIconFailed = false;
        } catch (err) {
            alert(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
        }
        imageUploading = false;
        input.value = '';
    }

    async function handleImageDelete(): Promise<void> {
        if (!confirm('프로필 이미지를 삭제하시겠습니까?')) return;
        imageUploading = true;
        try {
            await apiClient.deleteMemberImage();
            overrideImageUrl = null;
            profileIconFailed = true;
        } catch (err) {
            alert(err instanceof Error ? err.message : '이미지 삭제에 실패했습니다.');
        }
        imageUploading = false;
    }

    // 본인 프로필
    const isOwnProfile = $derived(authStore.user?.mb_id === p?.mb_id);
    // 팔로우 상태
    let isFollowing = $state(false);
    let followLoading = $state(false);

    // 팔로워/팔로잉 다이얼로그
    let followDialogOpen = $state(false);
    let followDialogType = $state<'followers' | 'following'>('followers');

    // 차단 상태
    let isBlocking = $state(false);
    let isBlocked = $state(false);

    // 탭 데이터 (lazy load)
    interface RecentPost {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        wr_subject: string;
        wr_datetime: string;
        href: string;
        deleted_at?: string | null;
    }
    interface RecentComment {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        preview: string;
        wr_datetime: string;
        href: string;
        deleted_at?: string | null;
        post_deleted_at?: string | null;
    }
    interface LikedPost {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        wr_subject: string;
        bg_datetime: string;
        href: string;
    }

    let recentPosts = $state<RecentPost[]>([]);
    let recentComments = $state<RecentComment[]>([]);
    let likedPosts = $state<LikedPost[]>([]);
    let loadingPosts = $state(false);
    let loadingComments = $state(false);
    let loadingLiked = $state(false);
    let postsLoaded = $state(false);
    let commentsLoaded = $state(false);
    let likedLoaded = $state(false);

    function getRecentPostTitle(post: RecentPost): string {
        return post.deleted_at ? '삭제된 글입니다.' : post.wr_subject;
    }

    function getRecentCommentPreview(comment: RecentComment): string {
        if (comment.deleted_at) return '삭제된 댓글입니다.';
        if (comment.post_deleted_at) return `[삭제된 글] ${comment.preview || '(내용 없음)'}`;
        return comment.preview || '(내용 없음)';
    }

    onMount(async () => {
        if (!p?.mb_id) return;

        // 팔로우 상태 조회
        if (authStore.isAuthenticated && !isOwnProfile) {
            try {
                const res = await fetch(`/api/members/${p.mb_id}/follow`);
                if (res.ok) {
                    const d = await res.json();
                    if (d.success) isFollowing = d.data.is_following;
                }
            } catch {}
        }
    });

    // 탭별 lazy load
    async function loadRecentPosts(): Promise<void> {
        if (postsLoaded || !p?.mb_id) return;
        loadingPosts = true;
        try {
            const res = await fetch(`/api/members/${p.mb_id}/activity?limit=20`);
            if (res.ok) {
                const d = await res.json();
                recentPosts = d.recentPosts ?? [];
            }
        } catch {}
        loadingPosts = false;
        postsLoaded = true;
    }

    async function loadRecentComments(): Promise<void> {
        if (commentsLoaded || !p?.mb_id) return;
        loadingComments = true;
        try {
            const res = await fetch(`/api/members/${p.mb_id}/activity?limit=20`);
            if (res.ok) {
                const d = await res.json();
                recentComments = d.recentComments ?? [];
            }
        } catch {}
        loadingComments = false;
        commentsLoaded = true;
    }

    async function loadLikedPosts(): Promise<void> {
        if (likedLoaded || !p?.mb_id) return;
        loadingLiked = true;
        try {
            const res = await fetch(`/api/members/${p.mb_id}/liked?limit=20`);
            if (res.ok) {
                const d = await res.json();
                likedPosts = d.data ?? [];
            }
        } catch {}
        loadingLiked = false;
        likedLoaded = true;
    }

    function handleTabChange(tab: string): void {
        if (tab === 'posts') loadRecentPosts();
        else if (tab === 'comments') loadRecentComments();
        else if (tab === 'liked') loadLikedPosts();
    }

    // 경험치 퍼센트 (서버에서 계산된 값 사용)
    const expPercent = $derived(p?.exp_progress ?? 0);

    // 통계 퍼센트 계산
    function pct(a: number, b: number): number {
        return b > 0 ? Math.round((a / b) * 100) : 0;
    }

    // 팔로우
    async function handleFollow(): Promise<void> {
        if (!authStore.isAuthenticated || !p) {
            authStore.redirectToLogin();
            return;
        }
        followLoading = true;
        try {
            const method = isFollowing ? 'DELETE' : 'POST';
            const res = await fetch(`/api/members/${p.mb_id}/follow`, { method });
            if (res.ok) {
                const d = await res.json();
                if (d.success) isFollowing = d.data.is_following;
            }
        } catch {}
        followLoading = false;
    }

    // 차단
    async function handleBlock(): Promise<void> {
        if (!p || !authStore.isAuthenticated) return;
        isBlocking = true;
        try {
            if (isBlocked) {
                await apiClient.unblockMember(p.mb_id);
                blockedUsersStore.remove(p.mb_id);
                isBlocked = false;
            } else {
                if (!confirm(`${p.mb_name}님을 차단하시겠습니까?`)) {
                    isBlocking = false;
                    return;
                }
                await apiClient.blockMember(p.mb_id);
                blockedUsersStore.add(p.mb_id);
                isBlocked = true;
            }
        } catch {
            alert('차단 처리에 실패했습니다.');
        }
        isBlocking = false;
    }

    // 상대 시간
    function relativeTime(dateString?: string): string {
        if (!dateString) return '정보 없음';
        const diff = Date.now() - new Date(dateString).getTime();
        const m = Math.floor(diff / 60000);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 30) return formatDate(dateString);
        if (d > 0) return `${d}일 전`;
        if (h > 0) return `${h}시간 전`;
        if (m > 0) return `${m}분 전`;
        return '방금 전';
    }
</script>

<svelte:head>
    <title>{p?.mb_name || '회원'} 프로필 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 pb-8 pt-4">
    {#if data.error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{data.error}</p>
            </CardContent>
        </Card>
    {:else if p}
        <!-- 프로필 헤더 -->
        <Card class="bg-background mb-4">
            <CardContent class="pt-6">
                <div class="flex items-center gap-4">
                    <!-- 프로필 이미지 -->
                    <div class="relative shrink-0">
                        {#if profileIconUrl && !profileIconFailed}
                            <img
                                src={profileIconUrl}
                                alt={p.mb_name}
                                class="size-16 rounded-full object-cover"
                                class:cursor-pointer={isOwnProfile}
                                onclick={handleImageClick}
                                onerror={() => {
                                    profileIconFailed = true;
                                }}
                            />
                        {:else}
                            <div
                                class="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full text-xl font-bold"
                                class:cursor-pointer={isOwnProfile}
                                onclick={handleImageClick}
                                role={isOwnProfile ? 'button' : undefined}
                                tabindex={isOwnProfile ? 0 : undefined}
                                onkeydown={(e) => {
                                    if (isOwnProfile && (e.key === 'Enter' || e.key === ' '))
                                        handleImageClick();
                                }}
                            >
                                {p.mb_name.charAt(0).toUpperCase()}
                            </div>
                        {/if}
                        {#if isOwnProfile}
                            {#if imageUploading}
                                <div
                                    class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40"
                                >
                                    <Loader2 class="h-5 w-5 animate-spin text-white" />
                                </div>
                            {:else}
                                <button
                                    onclick={handleImageClick}
                                    class="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-700 text-white shadow-sm transition-colors hover:bg-gray-600"
                                    title="프로필 이미지 변경"
                                >
                                    <Camera class="h-3 w-3" />
                                </button>
                            {/if}
                            {#if profileIconUrl && !profileIconFailed && !imageUploading}
                                <button
                                    onclick={handleImageDelete}
                                    class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600"
                                    title="프로필 이미지 삭제"
                                >
                                    <X class="h-3 w-3" />
                                </button>
                            {/if}
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                class="hidden"
                                bind:this={imageFileInput}
                                onchange={handleImageSelect}
                            />
                        {/if}
                    </div>

                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <h1
                                class="text-foreground truncate text-xl font-bold {p.is_left
                                    ? 'line-through opacity-60'
                                    : ''}"
                            >
                                {p.mb_name}
                            </h1>
                            {#if p.mb_certify}
                                <CheckCircle
                                    class="text-muted-foreground h-4 w-4 shrink-0"
                                    aria-label="본인확인 완료"
                                />
                            {/if}
                            {#if memoPluginActive && MemoBadge && !uiSettingsStore.hideMemo}
                                <MemoBadge
                                    memberId={p.mb_id}
                                    showIcon={true}
                                    blur={uiSettingsStore.blurMemo}
                                />
                            {/if}
                        </div>
                        <p class="text-muted-foreground text-sm">{p.mb_id}</p>
                        <div class="mt-1 flex items-center gap-1.5">
                            <LevelBadge level={p.as_level} />
                            <span class="text-sm">{getGradeName(p.mb_level)}</span>
                        </div>
                    </div>
                </div>

                <!-- 경험치 바 -->
                {#if p.as_level > 0}
                    <div class="mt-4">
                        <div class="text-muted-foreground mb-1 flex justify-between text-xs">
                            <span>Lv.{p.as_level}</span>
                            <span>Exp {p.as_exp.toLocaleString()}</span>
                        </div>
                        <div
                            class="bg-muted h-3 overflow-hidden rounded-full"
                            title="Next {(p.exp_to_next ?? 0).toLocaleString()}"
                        >
                            <div
                                class="bg-primary h-full rounded-full transition-all"
                                class:animate-pulse={!p.is_left}
                                style="width: {expPercent}%"
                            ></div>
                        </div>
                        <p class="text-muted-foreground mt-0.5 text-right text-[10px]">
                            {expPercent}%
                        </p>
                    </div>
                {/if}

                <!-- 팔로워/팔로잉 + 액션 버튼 -->
                <div class="mt-4 flex items-center gap-3">
                    <button
                        class="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
                        onclick={() => {
                            followDialogType = 'followers';
                            followDialogOpen = true;
                        }}
                    >
                        팔로워 <strong class="text-foreground">{p.follower_count}</strong>
                    </button>
                    <button
                        class="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
                        onclick={() => {
                            followDialogType = 'following';
                            followDialogOpen = true;
                        }}
                    >
                        팔로잉 <strong class="text-foreground">{p.following_count}</strong>
                    </button>

                    {#if authStore.isAuthenticated && !isOwnProfile}
                        <div class="ml-auto flex gap-1.5">
                            <Button
                                variant={isFollowing ? 'outline' : 'default'}
                                size="sm"
                                onclick={handleFollow}
                                disabled={followLoading}
                                class="h-7 text-xs"
                            >
                                {#if isFollowing}
                                    <UserMinus class="mr-1 h-3.5 w-3.5" />
                                    팔로잉
                                {:else}
                                    <UserPlus class="mr-1 h-3.5 w-3.5" />
                                    팔로우
                                {/if}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={() => goto(`/messages?to=${p.mb_id}`)}
                                class="h-7 text-xs"
                            >
                                <Mail class="mr-1 h-3.5 w-3.5" />
                                쪽지
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onclick={handleBlock}
                                disabled={isBlocking}
                                class="text-muted-foreground hover:text-destructive h-7 text-xs"
                            >
                                <Ban class="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    {/if}
                </div>
            </CardContent>
        </Card>

        <!-- 탭 영역 -->
        <Card class="bg-background">
            <Tabs.Root value="info" onValueChange={handleTabChange}>
                <Tabs.List class="border-border w-full justify-start border-b">
                    <Tabs.Trigger value="info">정보</Tabs.Trigger>
                    <Tabs.Trigger value="posts">최근 글</Tabs.Trigger>
                    <Tabs.Trigger value="comments">최근 댓글</Tabs.Trigger>
                    <Tabs.Trigger value="liked">공감 내역</Tabs.Trigger>
                </Tabs.List>

                <!-- 정보 탭 -->
                <Tabs.Content value="info" class="p-4">
                    <div class="space-y-4">
                        <!-- 포인트 -->
                        <div class="text-sm">
                            <div class="text-muted-foreground flex items-center gap-2">
                                <Database class="h-4 w-4" />
                                <span>{p.mb_point.toLocaleString()} 포인트 보유</span>
                            </div>
                        </div>

                        <!-- 기본 정보 -->
                        <div class="text-muted-foreground space-y-1.5 text-sm">
                            <div class="flex items-center gap-2">
                                <Calendar class="h-4 w-4 shrink-0" />
                                <span>
                                    {formatDate(p.mb_datetime)} 가입
                                    {#if !p.is_left}
                                        ({p.reg_days.toLocaleString()}일)
                                    {/if}
                                </span>
                            </div>
                            {#if p.is_left && p.mb_leave_date}
                                <div class="flex items-center gap-2">
                                    <Calendar class="h-4 w-4 shrink-0" />
                                    <span>{formatDate(p.mb_leave_date)} 탈퇴</span>
                                </div>
                            {/if}
                            {#if p.mb_nick_date}
                                <div class="flex items-center gap-2">
                                    <User class="h-4 w-4 shrink-0" />
                                    <span>{formatDate(p.mb_nick_date)} 닉네임 수정</span>
                                </div>
                            {/if}
                            {#if p.mb_level < 10}
                                <div class="flex items-center gap-2">
                                    <Clock class="h-4 w-4 shrink-0" />
                                    <span>{relativeTime(p.mb_today_login)} 최종 접속</span>
                                </div>
                            {/if}
                            {#if p.mb_homepage}
                                <div class="flex items-center gap-2">
                                    <Link class="h-4 w-4 shrink-0" />
                                    <a
                                        href={p.mb_homepage}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-primary hover:underline"
                                    >
                                        {p.mb_homepage}
                                    </a>
                                </div>
                            {/if}
                        </div>

                        <!-- 이용제한 -->
                        {#if p.discipline}
                            <div class="border-border rounded-lg border p-3">
                                <div class="flex items-center gap-2 text-sm">
                                    <Shield class="text-destructive h-4 w-4" />
                                    <span class="text-destructive font-medium">
                                        {#if p.discipline.penalty_period > 0}
                                            {p.discipline.penalty_period}일 이용제한
                                        {:else if p.discipline.penalty_period === 0}
                                            주의
                                        {:else}
                                            영구정지
                                        {/if}
                                    </span>
                                </div>
                                <p class="text-muted-foreground mt-1 text-xs">
                                    {p.discipline.penalty_date_from}
                                </p>
                            </div>
                        {/if}

                        <!-- 통계 프로그레스바 -->
                        <div class="border-border space-y-4 border-t pt-4">
                            <!-- 게시글 -->
                            <div>
                                <div class="mb-1 flex items-center justify-between text-sm">
                                    <span class="font-medium">게시글</span>
                                    <span class="text-muted-foreground text-xs">
                                        총 {p.stats.total_post_count.toLocaleString()}건 / 삭제율 {pct(
                                            p.stats.delete_post_count,
                                            p.stats.total_post_count
                                        )}%
                                    </span>
                                </div>
                                <div class="bg-muted flex h-4 overflow-hidden rounded-full">
                                    {#if p.stats.total_post_count > 0}
                                        <div
                                            class="flex items-center justify-center bg-blue-200 text-[10px] font-medium text-blue-900 dark:bg-blue-800 dark:text-blue-100"
                                            style="width: {Math.max(
                                                pct(
                                                    p.stats.total_post_count -
                                                        p.stats.delete_post_count,
                                                    p.stats.total_post_count
                                                ),
                                                15
                                            )}%;"
                                        >
                                            {(
                                                p.stats.total_post_count - p.stats.delete_post_count
                                            ).toLocaleString()}
                                        </div>
                                        <div
                                            class="flex items-center justify-center bg-red-200 text-[10px] font-medium text-red-900 dark:bg-red-800 dark:text-red-100"
                                            style="width: {Math.max(
                                                pct(
                                                    p.stats.delete_post_count,
                                                    p.stats.total_post_count
                                                ),
                                                15
                                            )}%;"
                                        >
                                            {p.stats.delete_post_count.toLocaleString()}
                                        </div>
                                    {:else}
                                        <div
                                            class="flex flex-1 items-center justify-center bg-blue-100 text-[10px] text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                        >
                                            0
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            <!-- 댓글 -->
                            <div>
                                <div class="mb-1 flex items-center justify-between text-sm">
                                    <span class="font-medium">댓글</span>
                                    <span class="text-muted-foreground text-xs">
                                        총 {p.stats.total_comment_count.toLocaleString()}건 / 삭제율 {pct(
                                            p.stats.delete_comment_count,
                                            p.stats.total_comment_count
                                        )}%
                                    </span>
                                </div>
                                <div class="bg-muted flex h-4 overflow-hidden rounded-full">
                                    {#if p.stats.total_comment_count > 0}
                                        <div
                                            class="flex items-center justify-center bg-blue-200 text-[10px] font-medium text-blue-900 dark:bg-blue-800 dark:text-blue-100"
                                            style="width: {Math.max(
                                                pct(
                                                    p.stats.total_comment_count -
                                                        p.stats.delete_comment_count,
                                                    p.stats.total_comment_count
                                                ),
                                                15
                                            )}%;"
                                        >
                                            {(
                                                p.stats.total_comment_count -
                                                p.stats.delete_comment_count
                                            ).toLocaleString()}
                                        </div>
                                        <div
                                            class="flex items-center justify-center bg-red-200 text-[10px] font-medium text-red-900 dark:bg-red-800 dark:text-red-100"
                                            style="width: {Math.max(
                                                pct(
                                                    p.stats.delete_comment_count,
                                                    p.stats.total_comment_count
                                                ),
                                                15
                                            )}%;"
                                        >
                                            {p.stats.delete_comment_count.toLocaleString()}
                                        </div>
                                    {:else}
                                        <div
                                            class="flex flex-1 items-center justify-center bg-blue-100 text-[10px] text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                        >
                                            0
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            <!-- 관리자 삭제 -->
                            <div>
                                <div class="mb-1 text-sm font-medium">관리자 삭제</div>
                                <div class="bg-muted flex h-4 overflow-hidden rounded-full">
                                    <div
                                        class="flex flex-1 items-center justify-center bg-yellow-200 text-[10px] font-medium text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100"
                                    >
                                        게시글 {p.stats.delete_post_by_admin.toLocaleString()}
                                    </div>
                                    <div
                                        class="flex flex-1 items-center justify-center bg-purple-200 text-[10px] font-medium text-purple-900 dark:bg-purple-800 dark:text-purple-100"
                                    >
                                        댓글 {p.stats.delete_comment_by_admin.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <!-- 추천/신고 -->
                            <div>
                                <div class="mb-1 text-sm font-medium">공감 / 신고</div>
                                <div class="flex gap-2">
                                    <div
                                        class="bg-muted flex h-4 flex-1 overflow-hidden rounded-full"
                                    >
                                        <div
                                            class="flex items-center justify-center bg-blue-300 px-2 text-[10px] font-medium text-blue-900 dark:bg-blue-700 dark:text-blue-100"
                                            style="width: 40%;"
                                        >
                                            공감
                                        </div>
                                        <div
                                            class="flex flex-1 items-center justify-center bg-blue-200 text-[10px] font-medium text-blue-900 dark:bg-blue-800 dark:text-blue-100"
                                        >
                                            {p.stats.total_rcmd_count.toLocaleString()}
                                        </div>
                                    </div>
                                    <div
                                        class="bg-muted flex h-4 flex-1 overflow-hidden rounded-full"
                                    >
                                        <div
                                            class="flex items-center justify-center bg-red-300 px-2 text-[10px] font-medium text-red-900 dark:bg-red-700 dark:text-red-100"
                                            style="width: 40%;"
                                        >
                                            신고
                                        </div>
                                        <div
                                            class="flex flex-1 items-center justify-center bg-red-200 text-[10px] font-medium text-red-900 dark:bg-red-800 dark:text-red-100"
                                        >
                                            {p.stats.total_singo_count.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 자기소개 -->
                        {#if p.mb_profile}
                            <div class="border-border border-t pt-4">
                                <h4 class="mb-2 text-sm font-medium">자기소개</h4>
                                <p class="text-muted-foreground whitespace-pre-wrap text-sm">
                                    {p.mb_profile}
                                </p>
                            </div>
                        {/if}
                    </div>
                </Tabs.Content>

                <!-- 최근 글 탭 -->
                <Tabs.Content value="posts" class="p-4">
                    {#if loadingPosts}
                        <div class="flex justify-center py-8">
                            <Loader2 class="text-muted-foreground h-5 w-5 animate-spin" />
                        </div>
                    {:else if recentPosts.length === 0}
                        <p class="text-muted-foreground py-8 text-center text-sm">
                            최근 작성한 글이 없습니다.
                        </p>
                    {:else}
                        <ul class="divide-border divide-y">
                            {#each recentPosts as post (post.wr_id)}
                                <li class="py-2">
                                    <a
                                        href={post.href}
                                        class="text-foreground hover:text-primary block text-sm transition-colors"
                                    >
                                        {getRecentPostTitle(post)}
                                    </a>
                                    <div class="text-muted-foreground mt-0.5 flex gap-2 text-xs">
                                        <span class="text-primary/70">{post.bo_subject}</span>
                                        <span>{formatDate(post.wr_datetime)}</span>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </Tabs.Content>

                <!-- 최근 댓글 탭 -->
                <Tabs.Content value="comments" class="p-4">
                    {#if loadingComments}
                        <div class="flex justify-center py-8">
                            <Loader2 class="text-muted-foreground h-5 w-5 animate-spin" />
                        </div>
                    {:else if recentComments.length === 0}
                        <p class="text-muted-foreground py-8 text-center text-sm">
                            최근 작성한 댓글이 없습니다.
                        </p>
                    {:else}
                        <ul class="divide-border divide-y">
                            {#each recentComments as comment (comment.wr_id)}
                                <li class="py-2">
                                    <a
                                        href={comment.href}
                                        class="text-foreground hover:text-primary block text-sm transition-colors"
                                    >
                                        {getRecentCommentPreview(comment)}
                                    </a>
                                    <div class="text-muted-foreground mt-0.5 flex gap-2 text-xs">
                                        <span class="text-primary/70">{comment.bo_subject}</span>
                                        <span>{formatDate(comment.wr_datetime)}</span>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </Tabs.Content>

                <!-- 공감 내역 탭 -->
                <Tabs.Content value="liked" class="p-4">
                    {#if loadingLiked}
                        <div class="flex justify-center py-8">
                            <Loader2 class="text-muted-foreground h-5 w-5 animate-spin" />
                        </div>
                    {:else if likedPosts.length === 0}
                        <p class="text-muted-foreground py-8 text-center text-sm">
                            공감 내역이 없습니다.
                        </p>
                    {:else}
                        <ul class="divide-border divide-y">
                            {#each likedPosts as liked (liked.wr_id)}
                                <li>
                                    <a
                                        href={liked.href}
                                        class="hover:bg-muted flex items-center gap-2.5 px-4 py-2 no-underline transition-all duration-200 ease-out"
                                    >
                                        <span
                                            class="bg-muted text-muted-foreground hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline-block"
                                        >
                                            {liked.bo_subject}
                                        </span>
                                        <span class="min-w-0 flex-1 truncate leading-relaxed">
                                            {liked.wr_subject}
                                        </span>
                                        <span
                                            class="text-muted-foreground hidden shrink-0 text-xs sm:inline-block"
                                        >
                                            {formatDate(liked.bg_datetime)}
                                        </span>
                                    </a>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </Tabs.Content>
            </Tabs.Root>
        </Card>

        <!-- 상호작용 분석 (플러그인) — 본인만 -->
        {#if isOwnProfile && pluginStore.isPluginActive('interaction-analysis') && InteractionPanel}
            <div class="mt-4">
                <InteractionPanel memberId={p.mb_id} />
            </div>
        {/if}
    {:else}
        <Card class="bg-background">
            <CardContent class="py-12 text-center">
                <User class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p class="text-foreground mb-2 text-lg font-medium">회원을 찾을 수 없습니다</p>
                <p class="text-secondary-foreground">요청하신 회원 정보가 존재하지 않습니다.</p>
            </CardContent>
        </Card>
    {/if}
</div>

{#if p}
    <FollowListDialog
        bind:open={followDialogOpen}
        memberId={p.mb_id}
        type={followDialogType}
        onClose={() => {
            followDialogOpen = false;
        }}
    />
{/if}
