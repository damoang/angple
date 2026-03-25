<script lang="ts">
    /**
     * 게시판 종합 설정 페이지
     *
     * 7개 탭으로 구성된 종합 게시판 설정 관리:
     * 1. 기본설정 (General)
     * 2. 권한설정 (Permissions)
     * 3. 표시설정 (Display)
     * 4. 포인트 (Points)
     * 5. 기능설정 (Features)
     * 6. 댓글설정 (Comments)
     * 7. 프로모션 (Promotion)
     */
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { beforeNavigate } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
    import { toast } from 'svelte-sonner';
    import { Toaster } from '$lib/components/ui/sonner';
    import {
        ChevronLeft,
        Save,
        RotateCcw,
        Settings2,
        Shield,
        Monitor,
        Coins,
        Wrench,
        MessageCircle,
        Megaphone,
        Loader2,
        AlignJustify,
        LayoutGrid,
        List,
        Image,
        Newspaper,
        TableProperties,
        LayoutDashboard
    } from '@lucide/svelte/icons';
    import type { Board, BoardGroup } from '$lib/api/types';
    import {
        getBoard,
        updateBoard,
        listBoardGroups,
        type UpdateBoardRequest
    } from '$lib/api/admin-boards';
    import {
        getDisplaySettings,
        updateDisplaySettings,
        type BoardDisplaySettings
    } from '$lib/api/board-display-settings';
    import {
        getExtendedSettings,
        updateExtendedSettings,
        type ExtendedSettings
    } from '$lib/api/board-extended-settings';
    import {
        getPromotionSettings,
        toggleBoardException,
        type PromotionGlobalSettings
    } from '$lib/api/damoang-ads-client';
    import {
        layoutRegistry,
        initCoreLayouts
    } from '$lib/components/features/board/layouts/index.js';
    import type { Component } from 'svelte';

    initCoreLayouts();

    // 아이콘 매핑
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iconMap: Record<string, Component<any>> = {
        compact: AlignJustify,
        card: LayoutGrid,
        detailed: List,
        gallery: Image,
        webzine: Newspaper,
        classic: TableProperties,
        'poster-gallery': Image,
        'market-card': LayoutGrid
    };

    const boardId = $derived($page.params.boardId || '');

    // 탭 정의
    type TabId =
        | 'general'
        | 'permissions'
        | 'display'
        | 'points'
        | 'features'
        | 'comments'
        | 'promotion';

    interface TabDef {
        id: TabId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        icon: Component<any>;
        label: string;
    }

    const tabs: TabDef[] = [
        { id: 'general', icon: Settings2, label: '기본설정' },
        { id: 'permissions', icon: Shield, label: '권한설정' },
        { id: 'display', icon: Monitor, label: '표시설정' },
        { id: 'points', icon: Coins, label: '포인트' },
        { id: 'features', icon: Wrench, label: '기능설정' },
        { id: 'comments', icon: MessageCircle, label: '댓글설정' },
        { id: 'promotion', icon: Megaphone, label: '프로모션' }
    ];

    // URL 해시에서 탭 추출
    let activeTab = $state<TabId>('general');

    // 데이터 상태
    let board = $state<Board | null>(null);
    let groups = $state<BoardGroup[]>([]);
    let displaySettings = $state<BoardDisplaySettings | null>(null);
    let isLoading = $state(true);
    let isSaving = $state(false);

    // 기본설정 폼
    let formSubject = $state('');
    let formGroupId = $state('');
    let formBoardType = $state('standard');
    let formAdmin = $state('');
    let formSkin = $state('');
    let formMobileSkin = $state('');
    let formOrder = $state(0);
    let formPageRows = $state(20);

    // 권한설정 폼
    let formListLevel = $state(0);
    let formReadLevel = $state(0);
    let formWriteLevel = $state(1);
    let formReplyLevel = $state(1);
    let formCommentLevel = $state(1);
    let formUploadLevel = $state(1);
    let formDownloadLevel = $state(0);

    // 표시설정 폼
    let formListLayout = $state('compact');
    let formCommentLayout = $state('flat');
    let formShowPreview = $state(false);
    let formPreviewLength = $state(150);
    let formShowThumbnail = $state(false);

    // 포인트 폼
    let formWritePoint = $state(0);
    let formCommentPoint = $state(0);
    let formReadPoint = $state(0);
    let formDownloadPoint = $state(0);

    // 기능설정 폼
    let formUseGood = $state(true);
    let formUseNogood = $state(true);
    let formUseCategory = $state(false);
    let formCategoryList = $state('');
    let formUseSecret = $state(false);
    let formUseSns = $state(false);

    // Extended settings
    let extendedSettings = $state<ExtendedSettings>({});

    // 럭키포인트
    let formLuckyPoints = $state(500);
    let formLuckyOdds = $state(20);

    // 확장 기능 토글
    let formAutoEmbed = $state(false);
    let formCodeHighlighter = $state(false);
    let formExternalImageSave = $state(false);
    let formHideNickname = $state(false);
    let formRating = $state(false);
    let formTags = $state(false);
    let formNotificationEnabled = $state(false);
    let formNotificationReceivers = $state('');

    // 프로모션 설정 (전역 + 게시판별)
    let promotionGlobal = $state<PromotionGlobalSettings | null>(null);
    let formPromotionExcluded = $state(false);
    let formPromotionInsertIndex = $state<number | null>(null);
    let formPromotionInsertCount = $state<number | null>(null);
    let formPromotionMinPostCount = $state<number | null>(null);

    // 댓글 설정
    let formCommentImageLimit = $state(false);
    let formCommentImageLimitMB = $state(5);
    let formCommentAutoEmbed = $state(false);
    let formCommentRecommend = $state(true);
    let formCommentDislike = $state(false);
    let formCommentAuthorOnly = $state(false);
    let formCommentPaging = $state<'oldest' | 'newest'>('oldest');
    let formCommentPageSize = $state(5000);

    // XP(경험치) 설정
    let formXpWrite = $state(0);
    let formXpComment = $state(0);

    // 스킨 설정
    let formSkinCategory = $state('basic');
    let formSkinList = $state('list');
    let formSkinView = $state('basic');
    let formSkinComment = $state('basic');

    // 태그 레벨
    let formTagLevel = $state(0);

    // 카테고리 이동 설정
    let formCategoryMovePermit = $state('admin_only');
    let formCategoryMoveMessage = $state(
        '{{auth_member}}가 {{src_cat}}에서 {{dest_cat}}으로 이동시켰습니다.'
    );

    // 글쓰기 제한 확장
    let formWriteRestricted = $state(false);
    let formMemberOnly = $state(false);
    let formMemberOnlyPermit = $state('admin_only');
    let formAllowedMembersOne = $state('');
    let formAllowedMembersTwo = $state('');
    let formAllowedMembersThree = $state('');
    let formMaxPosts = $state(0);
    let formWriteableLevel = $state('');

    // 원본 데이터 (dirty tracking용)
    let originalData = $state('');

    // 현재 폼 데이터를 JSON으로 직렬화
    function getFormSnapshot(): string {
        return JSON.stringify({
            formSubject,
            formGroupId,
            formBoardType,
            formAdmin,
            formSkin,
            formMobileSkin,
            formOrder,
            formPageRows,
            formListLevel,
            formReadLevel,
            formWriteLevel,
            formReplyLevel,
            formCommentLevel,
            formUploadLevel,
            formDownloadLevel,
            formListLayout,
            formCommentLayout,
            formShowPreview,
            formPreviewLength,
            formShowThumbnail,
            formWritePoint,
            formCommentPoint,
            formReadPoint,
            formDownloadPoint,
            formUseGood,
            formUseNogood,
            formUseCategory,
            formCategoryList,
            formUseSecret,
            formUseSns,
            formLuckyPoints,
            formLuckyOdds,
            formAutoEmbed,
            formCodeHighlighter,
            formExternalImageSave,
            formHideNickname,
            formRating,
            formTags,
            formNotificationEnabled,
            formNotificationReceivers,
            formCommentImageLimit,
            formCommentImageLimitMB,
            formCommentAutoEmbed,
            formCommentRecommend,
            formCommentDislike,
            formCommentAuthorOnly,
            formCommentPaging,
            formCommentPageSize,
            formXpWrite,
            formXpComment,
            formSkinCategory,
            formSkinList,
            formSkinView,
            formSkinComment,
            formTagLevel,
            formCategoryMovePermit,
            formCategoryMoveMessage,
            formWriteRestricted,
            formMemberOnly,
            formMemberOnlyPermit,
            formAllowedMembersOne,
            formAllowedMembersTwo,
            formAllowedMembersThree,
            formMaxPosts,
            formWriteableLevel,
            formPromotionExcluded,
            formPromotionInsertIndex,
            formPromotionInsertCount,
            formPromotionMinPostCount
        });
    }

    let isDirty = $derived(originalData !== '' && originalData !== getFormSnapshot());

    // 레이아웃 목록
    const listLayouts = $derived.by(() => {
        const manifests = layoutRegistry.getListManifests();
        return manifests.map((m) => ({
            id: m.id,
            label: m.name,
            description: m.description,
            icon: iconMap[m.id] || LayoutDashboard
        }));
    });

    const boardTypes: Record<string, string> = {
        standard: '일반',
        qa: 'Q&A',
        giving: '나눔',
        angtt: 'TT',
        angmap: '지도',
        'used-market': '중고장터'
    };

    function getLevelLabel(level: number): string {
        if (level <= 0) return '비회원';
        if (level <= 1) return '전체 회원';
        if (level < 10) return `레벨 ${level}+`;
        return '관리자만';
    }

    function populateForm(b: Board, ds: BoardDisplaySettings, es: ExtendedSettings) {
        formSubject = b.subject;
        formGroupId = b.group_id;
        formBoardType = b.board_type ?? 'standard';
        formAdmin = b.admin ?? '';
        formSkin = b.skin ?? '';
        formMobileSkin = b.mobile_skin ?? '';
        formOrder = b.order ?? 0;
        formPageRows = b.page_rows ?? 20;

        formListLevel = b.list_level;
        formReadLevel = b.read_level;
        formWriteLevel = b.write_level;
        formReplyLevel = b.reply_level;
        formCommentLevel = b.comment_level;
        formUploadLevel = b.upload_level ?? 1;
        formDownloadLevel = b.download_level ?? 0;

        formListLayout = ds.list_layout || 'compact';
        formCommentLayout = ds.comment_layout || 'flat';
        formShowPreview = ds.show_preview ?? false;
        formPreviewLength = ds.preview_length || 150;
        formShowThumbnail = ds.show_thumbnail ?? false;

        formWritePoint = b.write_point ?? 0;
        formCommentPoint = b.comment_point ?? 0;
        formReadPoint = b.read_point ?? 0;
        formDownloadPoint = b.download_point ?? 0;

        formUseGood = b.use_good === 1;
        formUseNogood = b.use_nogood === 1;
        formUseCategory = b.use_category === 1;
        formCategoryList = b.category_list ?? '';
        formUseSecret = (b.use_secret ?? 0) > 0;
        formUseSns = (b.use_sns ?? 0) > 0;

        // Extended settings
        extendedSettings = es;
        formLuckyPoints = es.lucky?.points ?? 500;
        formLuckyOdds = es.lucky?.odds ?? 20;
        formAutoEmbed = es.features?.autoEmbed ?? false;
        formCodeHighlighter = es.features?.codeHighlighter ?? false;
        formExternalImageSave = es.features?.externalImageSave ?? false;
        formHideNickname = es.features?.hideNickname ?? false;
        formRating = es.features?.rating ?? false;
        formTags = es.features?.tags ?? (es.features?.tagLevel ?? 0) > 0;
        formNotificationEnabled = es.notification?.enabled ?? false;
        formNotificationReceivers = es.notification?.newPostReceivers ?? '';

        // 댓글 설정
        formCommentImageLimit = es.comment?.imageSizeLimit ?? false;
        formCommentImageLimitMB = es.comment?.imageSizeLimitMB ?? 5;
        formCommentAutoEmbed = es.comment?.autoEmbed ?? false;
        formCommentRecommend = es.comment?.useRecommend ?? true;
        formCommentDislike = es.comment?.useDislike ?? false;
        formCommentAuthorOnly = es.comment?.authorOnly ?? false;
        formCommentPaging = es.comment?.paging ?? 'oldest';
        formCommentPageSize = es.comment?.pageSize ?? 5000;

        // XP 설정
        formXpWrite = es.xp?.write ?? 0;
        formXpComment = es.xp?.comment ?? 0;

        // 스킨 설정
        formSkinCategory = es.skin?.category ?? 'basic';
        formSkinList = es.skin?.list ?? 'list';
        formSkinView = es.skin?.view ?? 'basic';
        formSkinComment = es.skin?.comment ?? 'basic';

        // 태그 레벨
        formTagLevel = es.features?.tagLevel ?? 0;

        // 카테고리 이동
        formCategoryMovePermit = es.features?.categoryMovePermit ?? 'admin_only';
        formCategoryMoveMessage =
            es.features?.categoryMoveMessage ??
            '{{auth_member}}가 {{src_cat}}에서 {{dest_cat}}으로 이동시켰습니다.';

        // 글쓰기 제한
        formWriteRestricted = es.writing?.restrictedUsers ?? false;
        formMemberOnly = es.writing?.memberOnly ?? false;
        formMemberOnlyPermit = es.writing?.memberOnlyPermit ?? 'admin_only';
        formAllowedMembersOne = es.writing?.allowedMembersOne ?? '';
        formAllowedMembersTwo = es.writing?.allowedMembersTwo ?? '';
        formAllowedMembersThree = es.writing?.allowedMembersThree ?? '';
        formMaxPosts = es.writing?.maxPosts ?? 0;
        formWriteableLevel = es.writing?.allowedLevels ?? '';

        // 프로모션 설정
        const exceptions = (promotionGlobal?.board_exception ?? '').split(',').map((s) => s.trim());
        formPromotionExcluded = exceptions.includes(boardId);
        formPromotionInsertIndex = es.promotion?.insertIndex ?? null;
        formPromotionInsertCount = es.promotion?.insertCount ?? null;
        formPromotionMinPostCount = es.promotion?.minPostCount ?? null;

        // 원본 스냅샷 저장
        originalData = getFormSnapshot();
    }

    async function loadData() {
        isLoading = true;
        try {
            const [boardData, groupsData, displayData, extendedData, promotionData] =
                await Promise.allSettled([
                    getBoard(boardId),
                    listBoardGroups(),
                    getDisplaySettings(boardId),
                    getExtendedSettings(boardId),
                    getPromotionSettings()
                ]);

            if (boardData.status === 'fulfilled') {
                board = boardData.value;
            } else {
                toast.error('게시판 정보를 불러올 수 없습니다.');
                return;
            }

            if (groupsData.status === 'fulfilled') {
                groups = groupsData.value;
            }

            const ds: BoardDisplaySettings =
                displayData.status === 'fulfilled'
                    ? displayData.value
                    : {
                          list_layout: 'compact',
                          view_layout: 'basic',
                          comment_layout: 'flat',
                          show_preview: false,
                          preview_length: 150,
                          show_thumbnail: false
                      };
            displaySettings = ds;

            const es: ExtendedSettings =
                extendedData.status === 'fulfilled' ? extendedData.value : {};

            if (promotionData.status === 'fulfilled') {
                promotionGlobal = promotionData.value;
            }

            populateForm(board!, ds, es);
        } catch {
            toast.error('데이터를 불러오는데 실패했습니다.');
        } finally {
            isLoading = false;
        }
    }

    async function handleSave() {
        isSaving = true;
        try {
            // g5_board 업데이트
            const boardUpdate: UpdateBoardRequest = {
                subject: formSubject,
                group_id: formGroupId,
                board_type: formBoardType,
                admin: formAdmin,
                skin: formSkin,
                mobile_skin: formMobileSkin,
                order: formOrder,
                page_rows: formPageRows,
                list_level: formListLevel,
                read_level: formReadLevel,
                write_level: formWriteLevel,
                reply_level: formReplyLevel,
                comment_level: formCommentLevel,
                upload_level: formUploadLevel,
                download_level: formDownloadLevel,
                write_point: formWritePoint,
                comment_point: formCommentPoint,
                read_point: formReadPoint,
                download_point: formDownloadPoint,
                use_good: formUseGood ? 1 : 0,
                use_nogood: formUseNogood ? 1 : 0,
                use_category: formUseCategory ? 1 : 0,
                category_list: formCategoryList,
                use_secret: formUseSecret ? 1 : 0,
                use_sns: formUseSns ? 1 : 0
            };

            // 표시 설정 업데이트
            const displayUpdate = {
                list_layout: formListLayout,
                comment_layout: formCommentLayout,
                show_preview: formShowPreview,
                preview_length: formPreviewLength,
                show_thumbnail: formShowThumbnail
            };

            // 확장 설정 업데이트 (프로모션 오버라이드 포함)
            const extendedUpdate: ExtendedSettings = {
                lucky: {
                    points: formLuckyPoints,
                    odds: formLuckyOdds
                },
                xp: {
                    write: formXpWrite,
                    comment: formXpComment
                },
                features: {
                    autoEmbed: formAutoEmbed,
                    codeHighlighter: formCodeHighlighter,
                    externalImageSave: formExternalImageSave,
                    hideNickname: formHideNickname,
                    rating: formRating,
                    tags: formTags,
                    tagLevel: formTagLevel,
                    categoryMovePermit: formCategoryMovePermit,
                    categoryMoveMessage: formCategoryMoveMessage
                },
                notification: {
                    enabled: formNotificationEnabled,
                    newPostReceivers: formNotificationReceivers
                },
                comment: {
                    imageSizeLimit: formCommentImageLimit,
                    imageSizeLimitMB: formCommentImageLimitMB,
                    autoEmbed: formCommentAutoEmbed,
                    useRecommend: formCommentRecommend,
                    useDislike: formCommentDislike,
                    authorOnly: formCommentAuthorOnly,
                    paging: formCommentPaging,
                    pageSize: formCommentPageSize
                },
                writing: {
                    restrictedUsers: formWriteRestricted,
                    memberOnly: formMemberOnly,
                    memberOnlyPermit: formMemberOnlyPermit,
                    allowedMembersOne: formAllowedMembersOne,
                    allowedMembersTwo: formAllowedMembersTwo,
                    allowedMembersThree: formAllowedMembersThree,
                    maxPosts: formMaxPosts,
                    allowedLevels: formWriteableLevel
                },
                skin: {
                    category: formSkinCategory,
                    list: formSkinList,
                    view: formSkinView,
                    comment: formSkinComment
                },
                promotion: {
                    insertIndex: formPromotionInsertIndex,
                    insertCount: formPromotionInsertCount,
                    minPostCount: formPromotionMinPostCount
                }
            };

            const savePromises: Promise<unknown>[] = [
                updateBoard(boardId, boardUpdate),
                updateDisplaySettings(boardId, displayUpdate),
                updateExtendedSettings(boardId, extendedUpdate)
            ];

            // 프로모션 제외 토글 변경 시 damoang-ads API 호출
            if (promotionGlobal) {
                const currentlyExcluded = (promotionGlobal.board_exception ?? '')
                    .split(',')
                    .map((s) => s.trim())
                    .includes(boardId);
                if (formPromotionExcluded !== currentlyExcluded) {
                    savePromises.push(
                        toggleBoardException(
                            boardId,
                            formPromotionExcluded,
                            promotionGlobal.board_exception
                        ).then((newExceptions) => {
                            if (promotionGlobal) {
                                promotionGlobal.board_exception = newExceptions;
                            }
                        })
                    );
                }
            }

            await Promise.all(savePromises);

            // 원본 스냅샷 갱신
            originalData = getFormSnapshot();
            toast.success('설정이 저장되었습니다.');
        } catch (err) {
            console.error('저장 실패:', err);
            toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            isSaving = false;
        }
    }

    function handleReset() {
        if (board && displaySettings) {
            populateForm(board, displaySettings, extendedSettings);
            toast.info('변경사항이 초기화되었습니다.');
        }
    }

    // 페이지 이탈 경고
    beforeNavigate(({ cancel }) => {
        if (isDirty && !confirm('저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?')) {
            cancel();
        }
    });

    // URL 해시로 탭 관리
    function setTab(tab: TabId) {
        activeTab = tab;
        history.replaceState(null, '', `#${tab}`);
    }

    onMount(() => {
        const hash = window.location.hash.replace('#', '') as TabId;
        if (tabs.some((t) => t.id === hash)) {
            activeTab = hash;
        }
        loadData();
    });
</script>

<svelte:head>
    <title>{board?.subject ?? boardId} 설정 - Angple Admin</title>
</svelte:head>

<Toaster />

<div class="mx-auto max-w-6xl p-6">
    <!-- 상단 헤더 -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <Button variant="ghost" size="icon" href="/admin/boards">
                <ChevronLeft class="h-5 w-5" />
            </Button>
            <div>
                <h1 class="text-2xl font-bold">
                    {board?.subject ?? boardId} 설정
                </h1>
                <p class="text-muted-foreground text-sm">/{boardId}</p>
            </div>
            {#if isDirty}
                <Badge variant="outline" class="border-orange-300 text-orange-600">변경됨</Badge>
            {/if}
        </div>
        <div class="flex items-center gap-2">
            <Button variant="outline" onclick={handleReset} disabled={!isDirty || isSaving}>
                <RotateCcw class="mr-1.5 h-4 w-4" />
                초기화
            </Button>
            <Button onclick={handleSave} disabled={isSaving || isLoading}>
                {#if isSaving}
                    <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                    저장 중...
                {:else}
                    <Save class="mr-1.5 h-4 w-4" />
                    저장
                {/if}
            </Button>
        </div>
    </div>

    {#if isLoading}
        <div class="flex items-center justify-center py-24">
            <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
            <span class="text-muted-foreground ml-3">설정 불러오는 중...</span>
        </div>
    {:else if board}
        <!-- 탭 레이아웃 -->
        <div class="flex gap-6">
            <!-- 왼쪽: Vertical Tabs -->
            <nav class="w-48 shrink-0">
                <div class="sticky top-6 space-y-1">
                    {#each tabs as tab (tab.id)}
                        {@const Icon = tab.icon}
                        <button
                            type="button"
                            class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors {activeTab ===
                            tab.id
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'}"
                            onclick={() => setTab(tab.id)}
                        >
                            <Icon class="h-4 w-4" />
                            {tab.label}
                        </button>
                    {/each}
                </div>
            </nav>

            <!-- 오른쪽: 탭 콘텐츠 -->
            <div class="min-w-0 flex-1">
                <!-- 1. 기본설정 -->
                {#if activeTab === 'general'}
                    <Card.Root>
                        <Card.Header>
                            <Card.Title>기본 설정</Card.Title>
                            <Card.Description>게시판의 기본 정보를 설정합니다.</Card.Description>
                        </Card.Header>
                        <Card.Content class="space-y-4">
                            <div class="grid gap-2">
                                <Label for="board-id">게시판 ID</Label>
                                <Input id="board-id" value={boardId} disabled />
                                <p class="text-muted-foreground text-xs">
                                    게시판 ID는 변경할 수 없습니다.
                                </p>
                            </div>

                            <div class="grid gap-2">
                                <Label for="subject">게시판 이름</Label>
                                <Input id="subject" bind:value={formSubject} />
                            </div>

                            <div class="grid gap-2">
                                <Label for="group">그룹</Label>
                                <select
                                    id="group"
                                    bind:value={formGroupId}
                                    class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                >
                                    {#each groups as group (group.id)}
                                        <option value={group.id}>{group.name}</option>
                                    {/each}
                                </select>
                            </div>

                            <div class="grid gap-2">
                                <Label for="board-type">게시판 타입</Label>
                                <select
                                    id="board-type"
                                    bind:value={formBoardType}
                                    class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                >
                                    {#each Object.entries(boardTypes) as [value, label] (value)}
                                        <option {value}>{label}</option>
                                    {/each}
                                </select>
                            </div>

                            <div class="grid gap-2">
                                <Label for="admin">추가 관리자</Label>
                                <Input
                                    id="admin"
                                    bind:value={formAdmin}
                                    placeholder="콤마로 구분된 회원 ID"
                                />
                                <p class="text-muted-foreground text-xs">
                                    이 게시판의 추가 관리자를 지정합니다. (예: user1,user2)
                                </p>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="grid gap-2">
                                    <Label for="skin">스킨</Label>
                                    <Input id="skin" bind:value={formSkin} placeholder="basic" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="mobile-skin">모바일 스킨</Label>
                                    <Input
                                        id="mobile-skin"
                                        bind:value={formMobileSkin}
                                        placeholder="basic"
                                    />
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="grid gap-2">
                                    <Label for="order">정렬 순서</Label>
                                    <Input
                                        id="order"
                                        type="number"
                                        bind:value={formOrder}
                                        min="0"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="page-rows">페이지당 글 수</Label>
                                    <Input
                                        id="page-rows"
                                        type="number"
                                        bind:value={formPageRows}
                                        min="5"
                                        max="100"
                                    />
                                </div>
                            </div>
                        </Card.Content>
                    </Card.Root>

                    <!-- 2. 권한설정 -->
                {:else if activeTab === 'permissions'}
                    <Card.Root>
                        <Card.Header>
                            <Card.Title>권한 설정</Card.Title>
                            <Card.Description>
                                각 기능에 접근할 수 있는 최소 레벨을 설정합니다. (0=비회원, 1=전체,
                                2~9=해당 레벨, 10=관리자)
                            </Card.Description>
                        </Card.Header>
                        <Card.Content class="space-y-6">
                            {#each [{ id: 'list', label: '목록 보기', desc: '게시판 목록을 볼 수 있는 최소 레벨' }, { id: 'read', label: '글 읽기', desc: '게시글을 읽을 수 있는 최소 레벨' }, { id: 'write', label: '글 쓰기', desc: '게시글을 작성할 수 있는 최소 레벨' }, { id: 'reply', label: '답글 작성', desc: '답글을 작성할 수 있는 최소 레벨' }, { id: 'comment', label: '댓글 작성', desc: '댓글을 작성할 수 있는 최소 레벨' }, { id: 'upload', label: '파일 업로드', desc: '파일을 업로드할 수 있는 최소 레벨' }, { id: 'download', label: '파일 다운로드', desc: '파일을 다운로드할 수 있는 최소 레벨' }] as item (item.id)}
                                {@const value =
                                    item.id === 'list'
                                        ? formListLevel
                                        : item.id === 'read'
                                          ? formReadLevel
                                          : item.id === 'write'
                                            ? formWriteLevel
                                            : item.id === 'reply'
                                              ? formReplyLevel
                                              : item.id === 'comment'
                                                ? formCommentLevel
                                                : item.id === 'upload'
                                                  ? formUploadLevel
                                                  : formDownloadLevel}
                                <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                        <p class="text-sm font-medium">{item.label}</p>
                                        <p class="text-muted-foreground text-xs">{item.desc}</p>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0"
                                            max="10"
                                            {value}
                                            oninput={(e) => {
                                                const v = Number(
                                                    (e.target as HTMLInputElement).value
                                                );
                                                if (item.id === 'list') formListLevel = v;
                                                else if (item.id === 'read') formReadLevel = v;
                                                else if (item.id === 'write') formWriteLevel = v;
                                                else if (item.id === 'reply') formReplyLevel = v;
                                                else if (item.id === 'comment')
                                                    formCommentLevel = v;
                                                else if (item.id === 'upload') formUploadLevel = v;
                                                else formDownloadLevel = v;
                                            }}
                                            class="w-32"
                                        />
                                        <Badge
                                            variant={value >= 10
                                                ? 'destructive'
                                                : value >= 2
                                                  ? 'secondary'
                                                  : 'outline'}
                                            class="w-20 justify-center text-xs"
                                        >
                                            {getLevelLabel(value)}
                                        </Badge>
                                    </div>
                                </div>
                            {/each}
                        </Card.Content>
                    </Card.Root>

                    <Card.Root class="mt-6">
                        <Card.Header>
                            <Card.Title>글쓰기 제한</Card.Title>
                            <Card.Description>글쓰기 권한을 세밀하게 제어합니다.</Card.Description>
                        </Card.Header>
                        <Card.Content class="space-y-5">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium">글쓰기 제한 사용</p>
                                    <p class="text-muted-foreground text-xs">
                                        특정 회원만 글을 작성할 수 있도록 제한합니다.
                                    </p>
                                </div>
                                <Switch
                                    checked={formWriteRestricted}
                                    onCheckedChange={(v: boolean) => (formWriteRestricted = v)}
                                />
                            </div>
                            {#if formWriteRestricted}
                                <div class="ml-4 space-y-3 border-l-2 pl-4">
                                    <div class="grid gap-2">
                                        <Label for="allowed-members-one">허용 회원 1그룹</Label>
                                        <Input
                                            id="allowed-members-one"
                                            bind:value={formAllowedMembersOne}
                                            placeholder="콤마로 구분된 회원 ID"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="allowed-members-two">허용 회원 2그룹</Label>
                                        <Input
                                            id="allowed-members-two"
                                            bind:value={formAllowedMembersTwo}
                                            placeholder="콤마로 구분된 회원 ID"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="allowed-members-three">허용 회원 3그룹</Label>
                                        <Input
                                            id="allowed-members-three"
                                            bind:value={formAllowedMembersThree}
                                            placeholder="콤마로 구분된 회원 ID"
                                        />
                                    </div>
                                </div>
                            {/if}

                            <div class="border-t pt-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">회원 전용 게시판</p>
                                        <p class="text-muted-foreground text-xs">
                                            비회원의 접근을 제한합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formMemberOnly}
                                        onCheckedChange={(v: boolean) => (formMemberOnly = v)}
                                    />
                                </div>
                                {#if formMemberOnly}
                                    <div class="ml-4 mt-3 border-l-2 pl-4">
                                        <Label for="member-only-permit" class="text-sm">
                                            회원 전용 권한
                                        </Label>
                                        <select
                                            id="member-only-permit"
                                            bind:value={formMemberOnlyPermit}
                                            class="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                        >
                                            <option value="admin_only">관리자만 변경 가능</option>
                                            <option value="all">모든 회원</option>
                                        </select>
                                    </div>
                                {/if}
                            </div>

                            <div class="space-y-4 border-t pt-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="grid gap-2">
                                        <Label for="max-posts">일일 글쓰기 제한</Label>
                                        <Input
                                            id="max-posts"
                                            type="number"
                                            bind:value={formMaxPosts}
                                            min="0"
                                        />
                                        <p class="text-muted-foreground text-xs">0=무제한</p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="writeable-level">글쓰기 허용 레벨</Label>
                                        <Input
                                            id="writeable-level"
                                            bind:value={formWriteableLevel}
                                            placeholder="비워두면 제한 없음"
                                        />
                                        <p class="text-muted-foreground text-xs">
                                            특정 레벨만 글쓰기 허용
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card.Content>
                    </Card.Root>

                    <!-- 3. 표시설정 -->
                {:else if activeTab === 'display'}
                    <div class="space-y-6">
                        <Card.Root>
                            <Card.Header>
                                <Card.Title>목록 레이아웃</Card.Title>
                                <Card.Description>
                                    게시판 목록 페이지에서 사용할 레이아웃을 선택합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-3">
                                {#each listLayouts as layout (layout.id)}
                                    {@const Icon = layout.icon}
                                    <button
                                        type="button"
                                        class="flex w-full items-center gap-4 rounded-lg border p-3 text-left transition-colors {formListLayout ===
                                        layout.id
                                            ? 'border-primary bg-primary/5'
                                            : 'hover:bg-muted/50'}"
                                        onclick={() => (formListLayout = layout.id)}
                                    >
                                        <div
                                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md {formListLayout ===
                                            layout.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'}"
                                        >
                                            <Icon class="h-4 w-4" />
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-sm font-medium">{layout.label}</p>
                                            <p class="text-muted-foreground text-xs">
                                                {layout.description}
                                            </p>
                                        </div>
                                        {#if formListLayout === layout.id}
                                            <span class="text-primary text-xs font-medium"
                                                >선택됨</span
                                            >
                                        {/if}
                                    </button>
                                {/each}
                            </Card.Content>
                        </Card.Root>

                        <!-- 댓글 레이아웃 -->
                        <Card.Root>
                            <Card.Header>
                                <Card.Title>댓글 레이아웃</Card.Title>
                                <Card.Description>
                                    게시글 본문 하단 댓글 영역의 레이아웃을 선택합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-3">
                                {#each [{ id: 'flat', icon: AlignJustify, label: '기본', description: '구분선 없이 평면적으로 나열' }, { id: 'bordered', icon: LayoutGrid, label: '카드형', description: '각 댓글을 테두리가 있는 카드로 표시' }, { id: 'divided', icon: List, label: '구분선형', description: '댓글 사이에 구분선으로 분리' }, { id: 'bubble', icon: MessageCircle, label: '말풍선형', description: '채팅 앱처럼 말풍선 스타일로 표시' }, { id: 'compact', icon: AlignJustify, label: '컴팩트', description: '간격을 줄여 밀집된 레이아웃' }, { id: 'discussion', icon: LayoutDashboard, label: '토론형', description: '차분한 구분선과 여백으로 토론 흐름을 강조' }, { id: 'feed', icon: List, label: '피드형', description: '더 촘촘한 간격으로 빠르게 훑는 흐름' }] as layout (layout.id)}
                                    {@const Icon = layout.icon}
                                    <button
                                        type="button"
                                        class="flex w-full items-center gap-4 rounded-lg border p-3 text-left transition-colors {formCommentLayout ===
                                        layout.id
                                            ? 'border-primary bg-primary/5'
                                            : 'hover:bg-muted/50'}"
                                        onclick={() => (formCommentLayout = layout.id)}
                                    >
                                        <div
                                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md {formCommentLayout ===
                                            layout.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'}"
                                        >
                                            <Icon class="h-4 w-4" />
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-sm font-medium">{layout.label}</p>
                                            <p class="text-muted-foreground text-xs">
                                                {layout.description}
                                            </p>
                                        </div>
                                        {#if formCommentLayout === layout.id}
                                            <span class="text-primary text-xs font-medium"
                                                >선택됨</span
                                            >
                                        {/if}
                                    </button>
                                {/each}
                            </Card.Content>
                        </Card.Root>

                        <Card.Root>
                            <Card.Header>
                                <Card.Title>표시 옵션</Card.Title>
                                <Card.Description>
                                    목록에서의 추가 표시 옵션을 설정합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-6">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">본문 미리보기</p>
                                        <p class="text-muted-foreground text-xs">
                                            목록에서 게시글 본문 일부를 미리 표시합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formShowPreview}
                                        onCheckedChange={(v: boolean) => (formShowPreview = v)}
                                    />
                                </div>

                                {#if formShowPreview}
                                    <div class="ml-4 border-l-2 pl-4">
                                        <label class="text-sm font-medium" for="preview-length">
                                            미리보기 글자 수
                                        </label>
                                        <Select
                                            type="single"
                                            value={String(formPreviewLength)}
                                            onValueChange={(v) => (formPreviewLength = Number(v))}
                                        >
                                            <SelectTrigger id="preview-length" class="mt-1 w-32">
                                                {formPreviewLength}자
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="50">50자</SelectItem>
                                                <SelectItem value="100">100자</SelectItem>
                                                <SelectItem value="150">150자</SelectItem>
                                                <SelectItem value="200">200자</SelectItem>
                                                <SelectItem value="300">300자</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                {/if}

                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">썸네일 이미지</p>
                                        <p class="text-muted-foreground text-xs">
                                            목록에서 게시글의 첫 번째 이미지를 썸네일로 표시합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formShowThumbnail}
                                        onCheckedChange={(v: boolean) => (formShowThumbnail = v)}
                                    />
                                </div>
                            </Card.Content>
                        </Card.Root>
                    </div>

                    <!-- 4. 포인트 -->
                {:else if activeTab === 'points'}
                    <div class="space-y-6">
                        <Card.Root>
                            <Card.Header>
                                <Card.Title>활동 포인트</Card.Title>
                                <Card.Description>
                                    게시판 활동 시 지급/차감되는 포인트를 설정합니다. 양수=지급,
                                    음수=차감, 0=없음
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="grid gap-2">
                                        <Label for="write-point">글 작성</Label>
                                        <Input
                                            id="write-point"
                                            type="number"
                                            bind:value={formWritePoint}
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="comment-point">댓글 작성</Label>
                                        <Input
                                            id="comment-point"
                                            type="number"
                                            bind:value={formCommentPoint}
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="read-point">글 읽기</Label>
                                        <Input
                                            id="read-point"
                                            type="number"
                                            bind:value={formReadPoint}
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="download-point">파일 다운로드</Label>
                                        <Input
                                            id="download-point"
                                            type="number"
                                            bind:value={formDownloadPoint}
                                        />
                                    </div>
                                </div>
                            </Card.Content>
                        </Card.Root>

                        <Card.Root>
                            <Card.Header>
                                <Card.Title>럭키 포인트</Card.Title>
                                <Card.Description>
                                    글 작성 시 확률적으로 추가 포인트를 지급합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="grid gap-2">
                                        <Label for="lucky-points">당첨 포인트</Label>
                                        <Input
                                            id="lucky-points"
                                            type="number"
                                            bind:value={formLuckyPoints}
                                            min="0"
                                        />
                                        <p class="text-muted-foreground text-xs">
                                            당첨 시 지급할 포인트 (기본 500)
                                        </p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="lucky-odds">당첨 확률 (N분의 1)</Label>
                                        <Input
                                            id="lucky-odds"
                                            type="number"
                                            bind:value={formLuckyOdds}
                                            min="1"
                                        />
                                        <p class="text-muted-foreground text-xs">
                                            {formLuckyOdds}분의 1 확률 (기본 20)
                                        </p>
                                    </div>
                                </div>
                            </Card.Content>
                        </Card.Root>

                        <Card.Root>
                            <Card.Header>
                                <Card.Title>경험치 (XP)</Card.Title>
                                <Card.Description>
                                    글 작성 및 댓글 작성 시 지급되는 경험치를 설정합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="grid gap-2">
                                        <Label for="xp-write">글 작성 XP</Label>
                                        <Input
                                            id="xp-write"
                                            type="number"
                                            bind:value={formXpWrite}
                                            min="0"
                                        />
                                        <p class="text-muted-foreground text-xs">
                                            글 작성 시 지급 경험치
                                        </p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="xp-comment">댓글 작성 XP</Label>
                                        <Input
                                            id="xp-comment"
                                            type="number"
                                            bind:value={formXpComment}
                                            min="0"
                                        />
                                        <p class="text-muted-foreground text-xs">
                                            댓글 작성 시 지급 경험치
                                        </p>
                                    </div>
                                </div>
                            </Card.Content>
                        </Card.Root>
                    </div>

                    <!-- 5. 기능설정 -->
                {:else if activeTab === 'features'}
                    <div class="space-y-6">
                        <Card.Root>
                            <Card.Header>
                                <Card.Title>기본 기능</Card.Title>
                                <Card.Description>
                                    게시판에서 사용할 기본 기능을 선택합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-5">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">공감 기능</p>
                                        <p class="text-muted-foreground text-xs">
                                            게시글에 공감 버튼을 표시합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formUseGood}
                                        onCheckedChange={(v: boolean) => (formUseGood = v)}
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">비공감 기능</p>
                                        <p class="text-muted-foreground text-xs">
                                            게시글에 비공감 버튼을 표시합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formUseNogood}
                                        onCheckedChange={(v: boolean) => (formUseNogood = v)}
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">비밀글 사용</p>
                                        <p class="text-muted-foreground text-xs">
                                            게시글을 비밀글로 작성할 수 있습니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formUseSecret}
                                        onCheckedChange={(v: boolean) => (formUseSecret = v)}
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">SNS 공유</p>
                                        <p class="text-muted-foreground text-xs">
                                            게시글에 SNS 공유 버튼을 표시합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formUseSns}
                                        onCheckedChange={(v: boolean) => (formUseSns = v)}
                                    />
                                </div>

                                <div class="border-t pt-4">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <p class="text-sm font-medium">카테고리 사용</p>
                                            <p class="text-muted-foreground text-xs">
                                                게시판에 카테고리 분류를 사용합니다.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formUseCategory}
                                            onCheckedChange={(v: boolean) => (formUseCategory = v)}
                                        />
                                    </div>
                                    {#if formUseCategory}
                                        <div class="ml-4 mt-3 border-l-2 pl-4">
                                            <Label for="category-list" class="text-sm">
                                                카테고리 목록
                                            </Label>
                                            <Input
                                                id="category-list"
                                                bind:value={formCategoryList}
                                                placeholder="일반|질문|정보|후기"
                                                class="mt-1"
                                            />
                                            <p class="text-muted-foreground mt-1 text-xs">
                                                | 로 구분합니다.
                                            </p>
                                        </div>
                                    {/if}
                                </div>
                            </Card.Content>
                        </Card.Root>

                        <Card.Root>
                            <Card.Header>
                                <Card.Title>부가 기능</Card.Title>
                                <Card.Description>
                                    콘텐츠 변환, 코드 하이라이팅 등 확장 기능을 설정합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-5">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">
                                            플랫폼 주소 자동 변환 (임베드)
                                        </p>
                                        <p class="text-muted-foreground text-xs">
                                            유튜브, 비메오 등 동영상 URL을 자동으로 임베드합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formAutoEmbed}
                                        onCheckedChange={(v: boolean) => (formAutoEmbed = v)}
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">코드 하이라이터</p>
                                        <p class="text-muted-foreground text-xs">
                                            [code]...[/code] 태그의 코드를 구문 강조합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formCodeHighlighter}
                                        onCheckedChange={(v: boolean) => (formCodeHighlighter = v)}
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">외부 이미지 서버 저장</p>
                                        <p class="text-muted-foreground text-xs">
                                            외부 이미지를 서버에 저장하여 표시합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formExternalImageSave}
                                        onCheckedChange={(v: boolean) =>
                                            (formExternalImageSave = v)}
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">별점 기능</p>
                                        <p class="text-muted-foreground text-xs">
                                            게시글에 별점 평가 기능을 추가합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formRating}
                                        onCheckedChange={(v: boolean) => (formRating = v)}
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">태그 등록</p>
                                        <p class="text-muted-foreground text-xs">
                                            게시글에 태그를 등록할 수 있는 레벨을 설정합니다.
                                            0=비활성, 1~10=해당 레벨 이상
                                        </p>
                                    </div>
                                    <Input
                                        id="tag-level"
                                        type="number"
                                        bind:value={formTagLevel}
                                        min="0"
                                        max="10"
                                        class="w-20"
                                    />
                                </div>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">닉네임 숨기기</p>
                                        <p class="text-muted-foreground text-xs">
                                            게시판 목록에서 작성자 닉네임을 숨깁니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formHideNickname}
                                        onCheckedChange={(v: boolean) => (formHideNickname = v)}
                                    />
                                </div>
                            </Card.Content>
                        </Card.Root>

                        <Card.Root>
                            <Card.Header>
                                <Card.Title>알림 설정</Card.Title>
                                <Card.Description>
                                    새 글/댓글/공감 알림을 설정합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">알림 사용</p>
                                        <p class="text-muted-foreground text-xs">
                                            답글/댓글/공감 알림을 사용합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formNotificationEnabled}
                                        onCheckedChange={(v: boolean) =>
                                            (formNotificationEnabled = v)}
                                    />
                                </div>
                                {#if formNotificationEnabled}
                                    <div class="ml-4 border-l-2 pl-4">
                                        <Label for="notification-receivers" class="text-sm">
                                            새 글 알림 수신자
                                        </Label>
                                        <Input
                                            id="notification-receivers"
                                            bind:value={formNotificationReceivers}
                                            placeholder="콤마로 구분된 회원 ID"
                                            class="mt-1"
                                        />
                                        <p class="text-muted-foreground mt-1 text-xs">
                                            새 글이 작성될 때 알림을 받을 회원 ID
                                        </p>
                                    </div>
                                {/if}
                            </Card.Content>
                        </Card.Root>

                        <Card.Root>
                            <Card.Header>
                                <Card.Title>카테고리 이동</Card.Title>
                                <Card.Description>
                                    게시글 카테고리 이동 권한과 메시지를 설정합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-4">
                                <div class="grid gap-2">
                                    <Label for="category-move-permit">이동 권한</Label>
                                    <select
                                        id="category-move-permit"
                                        bind:value={formCategoryMovePermit}
                                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                    >
                                        <option value="admin_only">관리자만</option>
                                        <option value="admin_and_member">관리자 + 작성자</option>
                                    </select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="category-move-message">이동 알림 메시지</Label>
                                    <Input
                                        id="category-move-message"
                                        bind:value={formCategoryMoveMessage}
                                        placeholder="{'{{auth_member}}'}가 {'{{src_cat}}'}에서 {'{{dest_cat}}'}으로 이동시켰습니다."
                                    />
                                    <p class="text-muted-foreground text-xs">
                                        {'{{auth_member}}'}, {'{{src_cat}}'}, {'{{dest_cat}}'} 변수 사용
                                        가능
                                    </p>
                                </div>
                            </Card.Content>
                        </Card.Root>

                        <Card.Root>
                            <Card.Header>
                                <Card.Title>nariya 스킨 설정</Card.Title>
                                <Card.Description>
                                    PHP 게시판에서 사용하는 nariya 스킨을 설정합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="grid gap-2">
                                        <Label for="skin-list">목록 스킨</Label>
                                        <Input
                                            id="skin-list"
                                            bind:value={formSkinList}
                                            placeholder="list"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="skin-view">본문 스킨</Label>
                                        <Input
                                            id="skin-view"
                                            bind:value={formSkinView}
                                            placeholder="basic"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="skin-comment">댓글 스킨</Label>
                                        <Input
                                            id="skin-comment"
                                            bind:value={formSkinComment}
                                            placeholder="basic"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="skin-category">카테고리 스킨</Label>
                                        <Input
                                            id="skin-category"
                                            bind:value={formSkinCategory}
                                            placeholder="basic"
                                        />
                                    </div>
                                </div>
                            </Card.Content>
                        </Card.Root>
                    </div>

                    <!-- 6. 댓글설정 -->
                {:else if activeTab === 'comments'}
                    <Card.Root>
                        <Card.Header>
                            <Card.Title>댓글 설정</Card.Title>
                            <Card.Description>댓글 관련 세부 설정을 관리합니다.</Card.Description>
                        </Card.Header>
                        <Card.Content class="space-y-5">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium">댓글 공감</p>
                                    <p class="text-muted-foreground text-xs">
                                        댓글에 공감 기능을 사용합니다.
                                    </p>
                                </div>
                                <Switch
                                    checked={formCommentRecommend}
                                    onCheckedChange={(v: boolean) => (formCommentRecommend = v)}
                                />
                            </div>
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium">댓글 비공감</p>
                                    <p class="text-muted-foreground text-xs">
                                        댓글에 비공감 기능을 사용합니다.
                                    </p>
                                </div>
                                <Switch
                                    checked={formCommentDislike}
                                    onCheckedChange={(v: boolean) => (formCommentDislike = v)}
                                />
                            </div>
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium">댓글 URL 자동 변환</p>
                                    <p class="text-muted-foreground text-xs">
                                        댓글의 유튜브 등 URL을 자동으로 임베드합니다.
                                    </p>
                                </div>
                                <Switch
                                    checked={formCommentAutoEmbed}
                                    onCheckedChange={(v: boolean) => (formCommentAutoEmbed = v)}
                                />
                            </div>
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium">작성자만 댓글 가능</p>
                                    <p class="text-muted-foreground text-xs">
                                        게시글 작성자만 댓글을 작성할 수 있습니다.
                                    </p>
                                </div>
                                <Switch
                                    checked={formCommentAuthorOnly}
                                    onCheckedChange={(v: boolean) => (formCommentAuthorOnly = v)}
                                />
                            </div>

                            <div class="border-t pt-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">댓글 이미지 용량 제한</p>
                                        <p class="text-muted-foreground text-xs">
                                            댓글 이미지 업로드 크기를 제한합니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formCommentImageLimit}
                                        onCheckedChange={(v: boolean) =>
                                            (formCommentImageLimit = v)}
                                    />
                                </div>
                                {#if formCommentImageLimit}
                                    <div class="ml-4 mt-3 border-l-2 pl-4">
                                        <Label for="comment-image-limit-mb" class="text-sm">
                                            최대 용량 (MB)
                                        </Label>
                                        <Input
                                            id="comment-image-limit-mb"
                                            type="number"
                                            bind:value={formCommentImageLimitMB}
                                            min="1"
                                            max="50"
                                            class="mt-1 w-24"
                                        />
                                    </div>
                                {/if}
                            </div>

                            <div class="space-y-4 border-t pt-4">
                                <div class="grid gap-2">
                                    <Label for="comment-paging">댓글 정렬</Label>
                                    <select
                                        id="comment-paging"
                                        bind:value={formCommentPaging}
                                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                    >
                                        <option value="oldest">과거순 (오래된 댓글 먼저)</option>
                                        <option value="newest">최신순 (최신 댓글 먼저)</option>
                                    </select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="comment-page-size">페이징 댓글 목록수</Label>
                                    <Input
                                        id="comment-page-size"
                                        type="number"
                                        bind:value={formCommentPageSize}
                                        min="10"
                                        max="10000"
                                    />
                                    <p class="text-muted-foreground text-xs">
                                        한 번에 표시할 댓글 수 (기본 5000)
                                    </p>
                                </div>
                            </div>
                        </Card.Content>
                    </Card.Root>

                    <!-- 7. 프로모션 -->
                {:else if activeTab === 'promotion'}
                    <div class="space-y-6">
                        <!-- 전역 설정 표시 (읽기 전용) -->
                        {#if promotionGlobal}
                            <Card.Root>
                                <Card.Header>
                                    <Card.Title>전역 프로모션 설정</Card.Title>
                                    <Card.Description>
                                        damoang-ads 전역 설정입니다. 수정은 프로모션 관리 페이지에서
                                        할 수 있습니다.
                                    </Card.Description>
                                </Card.Header>
                                <Card.Content>
                                    <div class="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p class="text-muted-foreground">삽입 위치</p>
                                            <p class="font-medium">
                                                {promotionGlobal.insert_index}번째 글 뒤
                                            </p>
                                        </div>
                                        <div>
                                            <p class="text-muted-foreground">표시 갯수</p>
                                            <p class="font-medium">
                                                {promotionGlobal.how_many_to_display}개
                                            </p>
                                        </div>
                                        <div>
                                            <p class="text-muted-foreground">최소 글 갯수</p>
                                            <p class="font-medium">
                                                {promotionGlobal.min_cnt_for_insert_index}개 이상
                                            </p>
                                        </div>
                                        <div>
                                            <p class="text-muted-foreground">제외 게시판</p>
                                            <p class="font-medium">
                                                {promotionGlobal.board_exception || '없음'}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="mt-4">
                                        <Button variant="outline" size="sm" href="/admin/promotion">
                                            전역 설정 관리
                                        </Button>
                                    </div>
                                </Card.Content>
                            </Card.Root>
                        {/if}

                        <!-- 게시판별 오버라이드 -->
                        <Card.Root>
                            <Card.Header>
                                <Card.Title>게시판별 프로모션 설정</Card.Title>
                                <Card.Description>
                                    이 게시판의 프로모션 설정을 오버라이드합니다. 비어있으면
                                    전역값을 사용합니다.
                                </Card.Description>
                            </Card.Header>
                            <Card.Content class="space-y-5">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">이 게시판 프로모션 제외</p>
                                        <p class="text-muted-foreground text-xs">
                                            이 게시판에서 프로모션(사잇글)을 표시하지 않습니다.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formPromotionExcluded}
                                        onCheckedChange={(v: boolean) =>
                                            (formPromotionExcluded = v)}
                                    />
                                </div>

                                {#if !formPromotionExcluded}
                                    <div class="space-y-4 border-t pt-4">
                                        <div class="grid gap-2">
                                            <Label for="promo-insert-index">
                                                삽입 위치 오버라이드
                                            </Label>
                                            <Input
                                                id="promo-insert-index"
                                                type="number"
                                                value={formPromotionInsertIndex ?? ''}
                                                oninput={(e) => {
                                                    const v = (e.target as HTMLInputElement).value;
                                                    formPromotionInsertIndex = v ? Number(v) : null;
                                                }}
                                                min="1"
                                                placeholder="전역값 사용"
                                            />
                                            <p class="text-muted-foreground text-xs">
                                                비어있으면 전역 설정값({promotionGlobal?.insert_index ??
                                                    15})을 사용합니다.
                                            </p>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="promo-insert-count">
                                                표시 갯수 오버라이드
                                            </Label>
                                            <Input
                                                id="promo-insert-count"
                                                type="number"
                                                value={formPromotionInsertCount ?? ''}
                                                oninput={(e) => {
                                                    const v = (e.target as HTMLInputElement).value;
                                                    formPromotionInsertCount = v ? Number(v) : null;
                                                }}
                                                min="1"
                                                placeholder="전역값 사용"
                                            />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="promo-min-posts">
                                                최소 글 갯수 오버라이드
                                            </Label>
                                            <Input
                                                id="promo-min-posts"
                                                type="number"
                                                value={formPromotionMinPostCount ?? ''}
                                                oninput={(e) => {
                                                    const v = (e.target as HTMLInputElement).value;
                                                    formPromotionMinPostCount = v
                                                        ? Number(v)
                                                        : null;
                                                }}
                                                min="1"
                                                placeholder="전역값 사용"
                                            />
                                        </div>
                                    </div>
                                {/if}
                            </Card.Content>
                        </Card.Root>
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <Card.Root>
            <Card.Content class="flex flex-col items-center justify-center py-12">
                <p class="text-muted-foreground">게시판을 찾을 수 없습니다.</p>
                <Button variant="outline" href="/admin/boards" class="mt-4">게시판 목록으로</Button>
            </Card.Content>
        </Card.Root>
    {/if}
</div>
