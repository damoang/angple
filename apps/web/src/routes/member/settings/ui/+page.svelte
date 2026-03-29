<script lang="ts">
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import Settings from '@lucide/svelte/icons/settings';
    import User from '@lucide/svelte/icons/user';
    import Star from '@lucide/svelte/icons/star';
    import Ban from '@lucide/svelte/icons/ban';
    import Type from '@lucide/svelte/icons/type';
    import Moon from '@lucide/svelte/icons/moon';
    import Sun from '@lucide/svelte/icons/sun';
    import SmartphoneIcon from '@lucide/svelte/icons/smartphone';
    import Monitor from '@lucide/svelte/icons/monitor';
    import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
    import LayoutList from '@lucide/svelte/icons/layout-list';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import XIcon from '@lucide/svelte/icons/x';
    import Plus from '@lucide/svelte/icons/plus';
    import Search from '@lucide/svelte/icons/search';
    import Keyboard from '@lucide/svelte/icons/keyboard';
    import Hand from '@lucide/svelte/icons/hand';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import Bell from '@lucide/svelte/icons/bell';
    import UserPlus from '@lucide/svelte/icons/user-plus';
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import {
        uiSettingsStore,
        BLUR_KEYWORDS,
        type FontFamily,
        type LineHeight,
        type ContentFontSize,
        type ListFontSize,
        type ShortcutButtonSize
    } from '$lib/stores/ui-settings.svelte.js';
    import { densityStore } from '$lib/stores/density.svelte.js';
    import {
        boardFavoritesStore,
        slotLabel,
        NORMAL_SLOTS,
        SHIFT_SLOTS
    } from '$lib/stores/board-favorites.svelte.js';
    import { keyboardShortcuts } from '$lib/services/keyboard-shortcuts.svelte.js';
    import { readPostStyleStore, type ReadPostStyle } from '$lib/stores/read-post-style.svelte.js';
    import BellRing from '@lucide/svelte/icons/bell-ring';
    import { apiClient } from '$lib/api/index.js';
    import type { NotificationPreferences } from '$lib/api/types.js';

    import MyNav from '$lib/components/features/my/my-nav.svelte';

    type Tab = 'layout' | 'board' | 'shortcut' | 'notification' | 'etc';
    const validTabs: Tab[] = ['layout', 'board', 'shortcut', 'notification', 'etc'];
    const urlTab = $derived($page.url.searchParams.get('tab'));
    let activeTab = $state<Tab>('layout');

    $effect(() => {
        if (urlTab && validTabs.includes(urlTab as Tab)) {
            activeTab = urlTab as Tab;
        }
    });

    const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
        { id: 'layout', label: '레이아웃', icon: LayoutDashboard },
        { id: 'board', label: '게시판', icon: LayoutList },
        { id: 'shortcut', label: '단축키', icon: Settings },
        { id: 'notification', label: '알림', icon: BellRing },
        { id: 'etc', label: '기타', icon: MessageSquare }
    ];

    const fontOptions: { value: FontFamily; label: string }[] = [
        { value: 'default', label: '기본' },
        { value: 'pretendard', label: 'Pretendard' },
        { value: 'nanum-gothic', label: '나눔고딕' },
        { value: 'noto-sans', label: 'Noto Sans KR' }
    ];

    const lineHeightOptions: { value: LineHeight; label: string }[] = [
        { value: 'compact', label: '촘촘 (1.4)' },
        { value: 'normal', label: '보통 (1.6)' },
        { value: 'relaxed', label: '여유 (1.8)' },
        { value: 'loose', label: '넓게 (2.0)' }
    ];

    const contentFontSizeOptions: { value: ContentFontSize; label: string }[] = [
        { value: 'small', label: '작게 (17px)' },
        { value: 'base', label: '보통 (19px)' },
        { value: 'large', label: '크게 (21px)' },
        { value: 'xlarge', label: '아주 크게 (23px)' },
        { value: '2xlarge', label: '매우 크게 (25px)' },
        { value: '3xlarge', label: '최대 (28px)' }
    ];

    const listFontSizeOptions: { value: ListFontSize; label: string }[] = [
        { value: 'xsmall', label: '아주 작게 (13px)' },
        { value: 'small', label: '작게 (15px)' },
        { value: 'base', label: '보통 (17px)' },
        { value: 'large', label: '크게 (19px)' },
        { value: 'xlarge', label: '아주 크게 (21px)' }
    ];

    const readStyleOptions: { value: ReadPostStyle; label: string }[] = [
        { value: 'dimmed', label: '흐림' },
        { value: 'bold', label: '굵게' },
        { value: 'italic', label: '기울임' },
        { value: 'underline', label: '밑줄' },
        { value: 'strikethrough', label: '취소선' }
    ];

    const densityOptions: { value: 'compact' | 'balanced' | 'relaxed'; label: string }[] = [
        { value: 'compact', label: '촘촘' },
        { value: 'balanced', label: '보통' },
        { value: 'relaxed', label: '여유' }
    ];

    type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';
    const themeModeOptions: {
        value: ThemeMode;
        label: string;
        icon: typeof Sun;
        desc: string;
    }[] = [
        { value: 'system', label: 'OS 설정', icon: Monitor, desc: '운영체제 설정 따름' },
        { value: 'light', label: '라이트', icon: Sun, desc: '밝은 테마' },
        { value: 'dark', label: '다크', icon: Moon, desc: '어두운 테마' },
        { value: 'amoled', label: 'AMOLED', icon: SmartphoneIcon, desc: '순수 블랙 테마' }
    ];

    let currentThemeMode = $state<ThemeMode>('system');

    function setThemeMode(mode: ThemeMode) {
        currentThemeMode = mode;
        const el = document.documentElement;
        el.classList.remove('dark', 'amoled');

        if (mode === 'system') {
            // OS 설정 따르기: 명시적 설정 제거
            try {
                localStorage.removeItem('themeMode');
            } catch {}
            document.cookie = 'angple_theme_mode=;path=/;max-age=0;SameSite=Lax';
            // OS가 다크모드면 적용
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                el.classList.add('dark');
            }
        } else {
            if (mode === 'dark') el.classList.add('dark');
            else if (mode === 'amoled') el.classList.add('amoled');
            try {
                localStorage.setItem('themeMode', mode);
            } catch {}
            if (mode === 'light') {
                document.cookie = 'angple_theme_mode=;path=/;max-age=0;SameSite=Lax';
            } else {
                document.cookie =
                    'angple_theme_mode=' + mode + ';path=/;max-age=31536000;SameSite=Lax';
            }
        }
    }

    const shortcutSizeOptions: { value: ShortcutButtonSize; label: string }[] = [
        { value: 'small', label: '작게' },
        { value: 'medium', label: '보통' },
        { value: 'large', label: '크게' }
    ];

    // 뮤트 키워드 입력
    let muteInput = $state('');

    function addMuteKeyword() {
        const trimmed = muteInput.trim();
        if (trimmed) {
            uiSettingsStore.addMuteKeyword(trimmed);
            muteInput = '';
        }
    }

    function handleMuteKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addMuteKeyword();
        }
    }

    // 구독 게시판 / 팔로우 회원
    interface SubBoard {
        board_id: string;
        board_name: string;
    }
    interface FollowMember {
        mb_id: string;
        mb_name: string;
        mb_nick: string;
    }

    let subscriptions = $state<SubBoard[]>([]);
    let following = $state<FollowMember[]>([]);
    let subsLoading = $state(false);
    let followLoading = $state(false);

    async function loadSubscriptions() {
        if (!browser) return;
        subsLoading = true;
        try {
            const res = await fetch('/api/my/subscriptions');
            const json = await res.json();
            if (json.success) subscriptions = json.data;
        } catch {
            // ignore
        }
        subsLoading = false;
    }

    async function loadFollowing() {
        if (!browser) return;
        followLoading = true;
        try {
            const res = await fetch('/api/my/following');
            const json = await res.json();
            if (json.success) following = json.data;
        } catch {
            // ignore
        }
        followLoading = false;
    }

    async function unsubscribe(boardId: string) {
        try {
            await fetch(`/api/boards/${boardId}/subscribe`, { method: 'DELETE' });
            subscriptions = subscriptions.filter((s) => s.board_id !== boardId);
        } catch {
            // ignore
        }
    }

    async function unfollow(mbId: string) {
        try {
            await fetch(`/api/members/${mbId}/follow`, { method: 'DELETE' });
            following = following.filter((f) => f.mb_id !== mbId);
        } catch {
            // ignore
        }
    }

    // 알림 설정
    let notiPrefs = $state<NotificationPreferences>({
        noti_comment: true,
        noti_reply: true,
        noti_mention: true,
        noti_like: true,
        noti_follow: true,
        like_threshold: 1
    });
    let notiLoading = $state(false);
    let notiSaving = $state(false);
    let notiSaveTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadNotiPrefs() {
        if (!browser) return;
        notiLoading = true;
        try {
            notiPrefs = await apiClient.getNotificationPreferences();
        } catch {
            // ignore — defaults are fine
        }
        notiLoading = false;
    }

    function saveNotiPrefs(update: Partial<NotificationPreferences>) {
        // Apply immediately to UI
        notiPrefs = { ...notiPrefs, ...update };
        // Debounce API call
        if (notiSaveTimer) clearTimeout(notiSaveTimer);
        notiSaving = true;
        notiSaveTimer = setTimeout(async () => {
            try {
                notiPrefs = await apiClient.updateNotificationPreferences(update);
            } catch {
                // ignore
            }
            notiSaving = false;
        }, 300);
    }

    onMount(() => {
        loadSubscriptions();
        loadFollowing();
        loadNotiPrefs();

        // 현재 테마 모드 복원
        const cookieMatch = document.cookie.match(/angple_theme_mode=(\w+)/);
        let saved: string | null = cookieMatch?.[1] || null;
        if (!saved) {
            try {
                saved = localStorage.getItem('themeMode');
            } catch {}
        }
        if (saved === 'dark' || saved === 'amoled') {
            currentThemeMode = saved;
        } else if (saved === 'light') {
            currentThemeMode = 'light';
        } else {
            currentThemeMode = 'system';
        }
    });
</script>

<svelte:head>
    <title>화면 설정 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<MyNav />

<div class="mx-auto max-w-2xl px-4 pb-8">
    <!-- 탭 -->
    <div class="border-border bg-muted/30 mb-6 flex gap-1 rounded-lg border p-1">
        {#each tabs as tab (tab.id)}
            <button
                class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors {activeTab ===
                tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => (activeTab = tab.id)}
            >
                <tab.icon class="h-4 w-4" />
                {tab.label}
            </button>
        {/each}
    </div>

    <div class="space-y-6">
        <!-- ========== 레이아웃 탭 ========== -->
        {#if activeTab === 'layout'}
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Moon class="h-5 w-5" />
                        테마 모드
                    </CardTitle>
                    <CardDescription>라이트/다크/AMOLED 테마를 선택합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {#each themeModeOptions as opt (opt.value)}
                            {@const Icon = opt.icon}
                            <button
                                class="flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-colors {currentThemeMode ===
                                opt.value
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                onclick={() => setThemeMode(opt.value)}
                            >
                                <Icon class="h-5 w-5" />
                                <span class="font-medium">{opt.label}</span>
                                <span class="text-muted-foreground text-xs">{opt.desc}</span>
                            </button>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Type class="h-5 w-5" />
                        글씨체
                    </CardTitle>
                    <CardDescription>사이트 전체에 적용할 글씨체를 선택합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="flex flex-wrap gap-2">
                        {#each fontOptions as opt (opt.value)}
                            <button
                                class="rounded-lg border px-4 py-2 text-sm transition-colors {uiSettingsStore.fontFamily ===
                                opt.value
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                onclick={() => uiSettingsStore.setFontFamily(opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <LayoutList class="h-5 w-5" />
                        줄 높이
                    </CardTitle>
                    <CardDescription>본문 텍스트의 줄 간격을 조정합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="flex flex-wrap gap-2">
                        {#each lineHeightOptions as opt (opt.value)}
                            <button
                                class="rounded-lg border px-4 py-2 text-sm transition-colors {uiSettingsStore.lineHeight ===
                                opt.value
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                onclick={() => uiSettingsStore.setLineHeight(opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Type class="h-5 w-5" />
                        본문 글자 크기
                    </CardTitle>
                    <CardDescription
                        >게시글 본문의 글자 크기를 조정합니다. 게시글 상세 페이지의 A-/A/A+ 버튼과
                        연동됩니다.</CardDescription
                    >
                </CardHeader>
                <CardContent>
                    <div class="flex flex-wrap gap-2">
                        {#each contentFontSizeOptions as opt (opt.value)}
                            <button
                                class="rounded-lg border px-4 py-2 text-sm transition-colors {uiSettingsStore.contentFontSize ===
                                opt.value
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                onclick={() => uiSettingsStore.setContentFontSize(opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Type class="h-5 w-5" />
                        공감글 글씨 크기
                    </CardTitle>
                    <CardDescription
                        >메인화면 공감 컴포넌트의 글씨 크기를 조정합니다.</CardDescription
                    >
                </CardHeader>
                <CardContent>
                    <div class="flex flex-wrap gap-2">
                        {#each listFontSizeOptions as opt (opt.value)}
                            <button
                                class="rounded-lg border px-4 py-2 text-sm transition-colors {uiSettingsStore.recommendFontSize ===
                                opt.value
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                onclick={() => uiSettingsStore.setRecommendFontSize(opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <LayoutList class="h-5 w-5" />
                        목록 밀도
                    </CardTitle>
                    <CardDescription
                        >게시판 목록의 행 간격을 조정합니다. (게시판 목록 상단에서도 변경 가능)</CardDescription
                    >
                </CardHeader>
                <CardContent>
                    <div class="flex flex-wrap gap-2">
                        {#each densityOptions as opt (opt.value)}
                            <button
                                class="rounded-lg border px-4 py-2 text-sm transition-colors {densityStore.value ===
                                opt.value
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                onclick={() => densityStore.set(opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <User class="h-5 w-5" />
                        프로필 표시
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>내 프로필 가리기</Label>
                            <p class="text-muted-foreground text-xs">
                                헤더와 사이드바에서 내 닉네임과 프로필 이미지를 숨깁니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.hideMyProfile}
                            onCheckedChange={(v) => uiSettingsStore.setHideMyProfile(v)}
                        />
                    </div>
                </CardContent>
            </Card>
        {/if}

        <!-- ========== 게시판 탭 ========== -->
        {#if activeTab === 'board'}
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Search class="h-5 w-5" />
                        검색
                    </CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>검색창 고정</Label>
                            <p class="text-muted-foreground text-xs">
                                게시판 목록에서 검색창을 항상 열어둡니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.pinSearch}
                            onCheckedChange={(v) => uiSettingsStore.setPinSearch(v)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Type class="h-5 w-5" />
                        제목 표시
                    </CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>제목 굵게</Label>
                            <p class="text-muted-foreground text-xs">
                                게시판 목록에서 제목을 굵게 표시합니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.titleBold}
                            onCheckedChange={(v) => uiSettingsStore.setTitleBold(v)}
                        />
                    </div>
                    <Separator />
                    <div>
                        <Label>목록 글씨 크기</Label>
                        <p class="text-muted-foreground mb-2 text-xs">
                            게시판 목록에서 제목의 글씨 크기를 조정합니다
                        </p>
                        <div class="flex flex-wrap gap-2">
                            {#each listFontSizeOptions as opt (opt.value)}
                                <button
                                    class="rounded-lg border px-4 py-2 text-sm transition-colors {uiSettingsStore.listFontSize ===
                                    opt.value
                                        ? 'border-primary bg-primary/10 text-foreground'
                                        : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                    onclick={() => uiSettingsStore.setListFontSize(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            {/each}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <LayoutList class="h-5 w-5" />
                        읽은 글 스타일
                    </CardTitle>
                    <CardDescription
                        >이미 읽은 게시글의 제목 표시 방식을 선택합니다.</CardDescription
                    >
                </CardHeader>
                <CardContent>
                    <div class="flex flex-wrap gap-2">
                        {#each readStyleOptions as opt (opt.value)}
                            <button
                                class="rounded-lg border px-4 py-2 text-sm transition-colors {readPostStyleStore.value ===
                                opt.value
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                onclick={() => readPostStyleStore.set(opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent class="pt-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>읽은 공지 숨기기</Label>
                            <p class="text-muted-foreground text-xs">
                                이미 읽은 공지사항을 게시판 목록에서 숨깁니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.hideReadNotices}
                            onCheckedChange={(v) => uiSettingsStore.setHideReadNotices(v)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <EyeOff class="h-5 w-5" />
                        본문 흐림
                    </CardTitle>
                    <CardDescription
                        >제목에 특정 키워드가 포함된 글의 본문을 블러 처리합니다.</CardDescription
                    >
                </CardHeader>
                <CardContent class="space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>본문 흐림 사용</Label>
                            <p class="text-muted-foreground text-xs">
                                대상 키워드: {BLUR_KEYWORDS.join(', ')}
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.contentBlur}
                            onCheckedChange={(v) => uiSettingsStore.setContentBlur(v)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <LayoutList class="h-5 w-5" />
                        목록 설정
                    </CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>새 댓글 수 표시</Label>
                            <p class="text-muted-foreground text-xs">
                                방문 이후 새로 달린 댓글 수를 목록에 표시합니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.showNewComments}
                            onCheckedChange={(v) => uiSettingsStore.setShowNewComments(v)}
                        />
                    </div>
                    <Separator />
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>글 보기 하단 목록 감추기</Label>
                            <p class="text-muted-foreground text-xs">
                                게시글 하단의 최근글 목록을 숨깁니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.hidePostList}
                            onCheckedChange={(v) => uiSettingsStore.setHidePostList(v)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Ban class="h-5 w-5" />
                        제목 필터링 (뮤트)
                    </CardTitle>
                    <CardDescription>특정 단어가 포함된 게시글을 목록에서 숨깁니다.</CardDescription
                    >
                </CardHeader>
                <CardContent class="space-y-3">
                    <div class="flex gap-2">
                        <Input
                            bind:value={muteInput}
                            placeholder="숨길 키워드 입력"
                            onkeydown={handleMuteKeydown}
                            class="flex-1"
                        />
                        <Button variant="outline" size="sm" onclick={addMuteKeyword}>
                            <Plus class="mr-1 h-4 w-4" />
                            추가
                        </Button>
                    </div>
                    {#if uiSettingsStore.muteKeywords.length > 0}
                        <div class="flex flex-wrap gap-1.5">
                            {#each uiSettingsStore.muteKeywords as keyword (keyword)}
                                <Badge variant="secondary" class="gap-1 pr-1">
                                    {keyword}
                                    <button
                                        onclick={() => uiSettingsStore.removeMuteKeyword(keyword)}
                                        class="hover:bg-foreground/10 rounded-full p-0.5"
                                    >
                                        <XIcon class="h-3 w-3" />
                                    </button>
                                </Badge>
                            {/each}
                        </div>
                    {:else}
                        <p class="text-muted-foreground text-xs">등록된 뮤트 키워드가 없습니다.</p>
                    {/if}
                </CardContent>
            </Card>
        {/if}

        <!-- ========== 단축키 탭 ========== -->
        {#if activeTab === 'shortcut'}
            <!-- 글로벌 단축키 on/off -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Keyboard class="h-5 w-5" />
                        키보드 단축키
                    </CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>글로벌 단축키 사용</Label>
                            <p class="text-muted-foreground text-xs">
                                글 목록에서 j/k(이동), f(새로고침), 숫자(즐겨찾기) 등 키보드
                                단축키를 사용합니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.enableKeyboardShortcuts}
                            onCheckedChange={(v) => uiSettingsStore.setEnableKeyboardShortcuts(v)}
                        />
                    </div>
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>사이드바 숫자 배지 표시</Label>
                            <p class="text-muted-foreground text-xs">
                                사이드바 즐겨찾기에 숫자 단축키 배지를 표시합니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.showShortcutBadge}
                            onCheckedChange={(v) => uiSettingsStore.setShowShortcutBadge(v)}
                        />
                    </div>
                </CardContent>
            </Card>

            <!-- 즐겨찾기 단축키 관리 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Star class="h-5 w-5" />
                        즐겨찾기 단축키
                    </CardTitle>
                    <CardDescription
                        >게시판에서 별(★) 버튼으로 등록합니다. 숫자키 1-0으로 바로 이동합니다.</CardDescription
                    >
                </CardHeader>
                <CardContent class="space-y-4">
                    <!-- 일반 슬롯 (1-0) -->
                    <div>
                        <p class="text-foreground mb-2 text-sm font-medium">일반 (1-0)</p>
                        {#if boardFavoritesStore.normalSlots.length > 0}
                            <div class="space-y-1">
                                {#each boardFavoritesStore.normalSlots as { slot, entry } (slot)}
                                    <div
                                        class="border-border flex items-center justify-between rounded-md border px-3 py-2"
                                    >
                                        <div class="flex items-center gap-2">
                                            <kbd
                                                class="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px] font-medium"
                                                >{slotLabel(slot)}</kbd
                                            >
                                            <a
                                                href="/{entry.boardId}"
                                                class="text-foreground text-sm hover:underline"
                                                >{entry.title}</a
                                            >
                                        </div>
                                        <button
                                            onclick={() => boardFavoritesStore.removeSlot(slot)}
                                            class="text-muted-foreground hover:text-destructive p-1 transition-colors"
                                        >
                                            <Trash2 class="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-muted-foreground text-xs">
                                등록된 즐겨찾기가 없습니다. 게시판에서 별(★) 버튼을 눌러 등록하세요.
                            </p>
                        {/if}
                    </div>

                    <!-- Shift 슬롯 (S+1 ~ S+0) -->
                    {#if boardFavoritesStore.shiftSlots.length > 0}
                        <Separator />
                        <div>
                            <p class="text-foreground mb-2 text-sm font-medium">
                                Shift (S+1 ~ S+0)
                            </p>
                            <div class="space-y-1">
                                {#each boardFavoritesStore.shiftSlots as { slot, entry } (slot)}
                                    <div
                                        class="border-border flex items-center justify-between rounded-md border px-3 py-2"
                                    >
                                        <div class="flex items-center gap-2">
                                            <kbd
                                                class="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px] font-medium"
                                                >{slotLabel(slot)}</kbd
                                            >
                                            <a
                                                href="/{entry.boardId}"
                                                class="text-foreground text-sm hover:underline"
                                                >{entry.title}</a
                                            >
                                        </div>
                                        <button
                                            onclick={() => boardFavoritesStore.removeSlot(slot)}
                                            class="text-muted-foreground hover:text-destructive p-1 transition-colors"
                                        >
                                            <Trash2 class="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if boardFavoritesStore.normalSlots.length > 0 || boardFavoritesStore.shiftSlots.length > 0}
                        <div class="pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                class="text-destructive"
                                onclick={() => {
                                    if (confirm('모든 즐겨찾기를 초기화하시겠습니까?')) {
                                        boardFavoritesStore.clear();
                                    }
                                }}
                            >
                                <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                                전체 초기화
                            </Button>
                        </div>
                    {/if}
                </CardContent>
            </Card>

            <!-- 시스템 단축키 안내 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Keyboard class="h-5 w-5" />
                        시스템 단축키
                    </CardTitle>
                    <CardDescription>알파벳 키로 게시판에 바로 이동합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <!-- 특수 단축키 (항상 표시) -->
                    <div class="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        <div
                            class="border-border flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                        >
                            <kbd
                                class="bg-muted inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px] font-medium"
                                >H</kbd
                            >
                            <span class="text-muted-foreground truncate text-xs">홈</span>
                        </div>
                        <div
                            class="border-border flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                        >
                            <kbd
                                class="bg-muted inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px] font-medium"
                                >,</kbd
                            >
                            <span class="text-muted-foreground truncate text-xs">이전글</span>
                        </div>
                        <div
                            class="border-border flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                        >
                            <kbd
                                class="bg-muted inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px] font-medium"
                                >.</kbd
                            >
                            <span class="text-muted-foreground truncate text-xs">다음글</span>
                        </div>
                    </div>

                    <!-- 게시판 단축키 -->
                    {@const shortcuts = keyboardShortcuts.allShortcuts}
                    {#if shortcuts.size > 0}
                        <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                            {#each [...shortcuts] as [code, url] (code)}
                                {@const key = code
                                    .replace('Key', '')
                                    .replace('Digit', '')
                                    .replace('Shift+Digit', 'S+')}
                                {#if !code.startsWith('Digit') && !code.startsWith('Shift+Digit')}
                                    <div
                                        class="border-border flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                                    >
                                        <kbd
                                            class="bg-muted inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px] font-medium"
                                            >{key}</kbd
                                        >
                                        <span class="text-muted-foreground truncate text-xs"
                                            >{url === '__refresh__' ? '새로고침' : url}</span
                                        >
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {:else}
                        <p class="text-muted-foreground text-xs">
                            등록된 시스템 단축키가 없습니다.
                        </p>
                    {/if}
                </CardContent>
            </Card>

            <!-- 단축 버튼 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <SmartphoneIcon class="h-5 w-5" />
                        단축 버튼
                    </CardTitle>
                    <CardDescription>화면 하단에 플로팅 바로가기 버튼을 표시합니다.</CardDescription
                    >
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>단축 버튼 사용</Label>
                            <p class="text-muted-foreground text-xs">
                                홈, 새로고침, 위로/아래로 + 즐겨찾기 바로가기
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.showShortcutButtons}
                            onCheckedChange={(v) => uiSettingsStore.setShowShortcutButtons(v)}
                        />
                    </div>
                    {#if uiSettingsStore.showShortcutButtons}
                        <Separator />
                        <div>
                            <Label class="mb-2 block">버튼 크기</Label>
                            <div class="flex flex-wrap gap-2">
                                {#each shortcutSizeOptions as opt (opt.value)}
                                    <button
                                        class="rounded-lg border px-4 py-2 text-sm transition-colors {uiSettingsStore.shortcutButtonSize ===
                                        opt.value
                                            ? 'border-primary bg-primary/10 text-foreground'
                                            : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
                                        onclick={() =>
                                            uiSettingsStore.setShortcutButtonSize(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </CardContent>
            </Card>

            <!-- 터치 제스처 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Hand class="h-5 w-5" />
                        터치 제스처
                    </CardTitle>
                    <CardDescription
                        >게시글 상세에서 스와이프/더블탭 제스처를 사용합니다.</CardDescription
                    >
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>터치 제스처 사용</Label>
                            <p class="text-muted-foreground text-xs">
                                좌/우 스와이프: 다음/이전글, 더블탭: 공감
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.enableTouchGestures}
                            onCheckedChange={(v) => uiSettingsStore.setEnableTouchGestures(v)}
                        />
                    </div>
                    {#if uiSettingsStore.enableTouchGestures}
                        <Separator />
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <Label for="swipe-threshold" class="mb-1 block"
                                    >스와이프 감도 (px)</Label
                                >
                                <Input
                                    id="swipe-threshold"
                                    type="number"
                                    min={20}
                                    max={150}
                                    value={String(uiSettingsStore.swipeThreshold)}
                                    onchange={(e) => {
                                        const v = parseInt(
                                            (e.target as HTMLInputElement).value,
                                            10
                                        );
                                        if (v >= 20 && v <= 150)
                                            uiSettingsStore.setSwipeThreshold(v);
                                    }}
                                />
                            </div>
                            <div>
                                <Label for="doubletap-interval" class="mb-1 block"
                                    >더블탭 간격 (ms)</Label
                                >
                                <Input
                                    id="doubletap-interval"
                                    type="number"
                                    min={150}
                                    max={600}
                                    value={String(uiSettingsStore.doubleTapInterval)}
                                    onchange={(e) => {
                                        const v = parseInt(
                                            (e.target as HTMLInputElement).value,
                                            10
                                        );
                                        if (v >= 150 && v <= 600)
                                            uiSettingsStore.setDoubleTapInterval(v);
                                    }}
                                />
                            </div>
                        </div>
                    {/if}
                </CardContent>
            </Card>
        {/if}

        <!-- ========== 알림 탭 ========== -->
        {#if activeTab === 'notification'}
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <BellRing class="h-5 w-5" />
                        알림 수신 설정
                    </CardTitle>
                    <CardDescription>알림 종류별 수신 여부를 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                    {#if notiLoading}
                        <p class="text-muted-foreground text-xs">로딩 중...</p>
                    {:else}
                        <div class="flex items-center justify-between">
                            <div>
                                <Label>댓글 알림</Label>
                                <p class="text-muted-foreground text-xs">
                                    내 글에 댓글이 달리면 알림을 받습니다
                                </p>
                            </div>
                            <Switch
                                checked={notiPrefs.noti_comment}
                                onCheckedChange={(v) => saveNotiPrefs({ noti_comment: v })}
                            />
                        </div>
                        <Separator />
                        <div class="flex items-center justify-between">
                            <div>
                                <Label>답글 알림</Label>
                                <p class="text-muted-foreground text-xs">
                                    내 댓글에 답글이 달리면 알림을 받습니다
                                </p>
                            </div>
                            <Switch
                                checked={notiPrefs.noti_reply}
                                onCheckedChange={(v) => saveNotiPrefs({ noti_reply: v })}
                            />
                        </div>
                        <Separator />
                        <div class="flex items-center justify-between">
                            <div>
                                <Label>멘션 알림</Label>
                                <p class="text-muted-foreground text-xs">
                                    다른 사람이 나를 @멘션하면 알림을 받습니다
                                </p>
                            </div>
                            <Switch
                                checked={notiPrefs.noti_mention}
                                onCheckedChange={(v) => saveNotiPrefs({ noti_mention: v })}
                            />
                        </div>
                        <Separator />
                        <div class="flex items-center justify-between">
                            <div>
                                <Label>공감 알림</Label>
                                <p class="text-muted-foreground text-xs">
                                    내 글이 공감을 받으면 알림을 받습니다
                                </p>
                            </div>
                            <Switch
                                checked={notiPrefs.noti_like}
                                onCheckedChange={(v) => saveNotiPrefs({ noti_like: v })}
                            />
                        </div>
                        {#if notiPrefs.noti_like}
                            <div class="bg-muted/50 ml-4 rounded-md p-3">
                                <Label>공감 임계값</Label>
                                <p class="text-muted-foreground mb-2 text-xs">
                                    공감 수가 이 값 이상일 때만 알림을 받습니다
                                </p>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    class="w-24"
                                    value={String(notiPrefs.like_threshold)}
                                    onchange={(e) => {
                                        const v = parseInt(
                                            (e.target as HTMLInputElement).value,
                                            10
                                        );
                                        if (v >= 1) saveNotiPrefs({ like_threshold: v });
                                    }}
                                />
                            </div>
                        {/if}
                        <Separator />
                        <div class="flex items-center justify-between">
                            <div>
                                <Label>팔로우/구독 알림</Label>
                                <p class="text-muted-foreground text-xs">
                                    팔로우 회원이나 구독 게시판에 새 글이 올라오면 알림을 받습니다
                                </p>
                            </div>
                            <Switch
                                checked={notiPrefs.noti_follow}
                                onCheckedChange={(v) => saveNotiPrefs({ noti_follow: v })}
                            />
                        </div>
                        {#if notiSaving}
                            <p class="text-muted-foreground text-right text-xs">저장 중...</p>
                        {/if}
                    {/if}
                </CardContent>
            </Card>
        {/if}

        <!-- ========== 기타 탭 ========== -->
        {#if activeTab === 'etc'}
            <!-- 구독 게시판 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Bell class="h-5 w-5" />
                        구독 게시판
                    </CardTitle>
                    <CardDescription>새 글 알림을 받는 게시판 목록입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    {#if subsLoading}
                        <p class="text-muted-foreground text-xs">로딩 중...</p>
                    {:else if subscriptions.length > 0}
                        <div class="space-y-1">
                            {#each subscriptions as sub (sub.board_id)}
                                <div
                                    class="border-border flex items-center justify-between rounded-md border px-3 py-2"
                                >
                                    <a
                                        href="/{sub.board_id}"
                                        class="text-foreground text-sm hover:underline"
                                        >{sub.board_name}</a
                                    >
                                    <button
                                        onclick={() => unsubscribe(sub.board_id)}
                                        class="text-muted-foreground hover:text-destructive p-1 transition-colors"
                                    >
                                        <XIcon class="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="text-muted-foreground text-xs">구독 중인 게시판이 없습니다.</p>
                    {/if}
                </CardContent>
            </Card>

            <!-- 팔로우 회원 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <UserPlus class="h-5 w-5" />
                        팔로우 회원
                    </CardTitle>
                    <CardDescription>팔로우 중인 회원 목록입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    {#if followLoading}
                        <p class="text-muted-foreground text-xs">로딩 중...</p>
                    {:else if following.length > 0}
                        <div class="space-y-1">
                            {#each following as member (member.mb_id)}
                                <div
                                    class="border-border flex items-center justify-between rounded-md border px-3 py-2"
                                >
                                    <span class="text-foreground text-sm"
                                        >{member.mb_nick || member.mb_name}</span
                                    >
                                    <button
                                        onclick={() => unfollow(member.mb_id)}
                                        class="text-muted-foreground hover:text-destructive p-1 transition-colors"
                                    >
                                        <XIcon class="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="text-muted-foreground text-xs">팔로우 중인 회원이 없습니다.</p>
                    {/if}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <MessageSquare class="h-5 w-5" />
                        메모 설정
                    </CardTitle>
                    <CardDescription>메모 플러그인의 표시 방식을 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>메모 배지 가리기</Label>
                            <p class="text-muted-foreground text-xs">
                                게시글 상세에서 메모 배지를 숨깁니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.hideMemo}
                            onCheckedChange={(v) => uiSettingsStore.setHideMemo(v)}
                        />
                    </div>
                    <Separator />
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>목록 메모 배지 가리기</Label>
                            <p class="text-muted-foreground text-xs">
                                게시판 목록에서 메모 배지를 숨깁니다
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.hideMemoInList}
                            onCheckedChange={(v) => uiSettingsStore.setHideMemoInList(v)}
                        />
                    </div>
                    <Separator />
                    <div class="flex items-center justify-between">
                        <div>
                            <Label>메모 내용 흐리게</Label>
                            <p class="text-muted-foreground text-xs">
                                메모 배지의 내용을 블러 처리합니다 (호버 시 표시)
                            </p>
                        </div>
                        <Switch
                            checked={uiSettingsStore.blurMemo}
                            onCheckedChange={(v) => uiSettingsStore.setBlurMemo(v)}
                        />
                    </div>
                </CardContent>
            </Card>
        {/if}
    </div>
</div>
