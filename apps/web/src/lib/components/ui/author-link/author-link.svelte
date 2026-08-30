<script lang="ts">
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { toast } from 'svelte-sonner';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { apiClient } from '$lib/api/index.js';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte.js';
    import User from '@lucide/svelte/icons/user';
    import FileText from '@lucide/svelte/icons/file-text';
    import Search from '@lucide/svelte/icons/search';
    import Mail from '@lucide/svelte/icons/mail';
    import Ban from '@lucide/svelte/icons/ban';
    import UserPlus from '@lucide/svelte/icons/user-plus';
    import UserMinus from '@lucide/svelte/icons/user-minus';
    import { canSendMessage, goToCertification } from '$lib/utils/certification-gate.js';
    import type { Snippet } from 'svelte';

    interface Props {
        authorId: string;
        authorName: string;
        isWithdrawn?: boolean;
        class?: string;
        /**
         * 모바일에서도 클릭 영역을 확장할지 (#12652).
         * 목록뷰는 제목과 인접해 모바일 확장 시 제목 오터치가 발생(#12480)하므로 false(기본).
         * 댓글/상세처럼 인접 제목이 없는 곳은 true 로 짧은 닉네임 클릭을 보장.
         */
        expandTouchArea?: boolean;
        /**
         * 닉네임을 한 줄로 고정한다 (#13608).
         * 글 상세 작성자 줄처럼 긴 메모 배지가 같은 flex 행에 붙는 곳에서, 닉네임이
         * min-content(1음절)까지 눌려 한글이 세로로 쌓이는 붕괴를 막는다.
         * 공용 컴포넌트라 기본은 false — 목록/댓글 등 flex-wrap 메타 행의 줄바꿈 동작을 보존한다.
         */
        nowrap?: boolean;
        children?: Snippet;
    }

    let {
        authorId,
        authorName,
        isWithdrawn = false,
        class: className = '',
        expandTouchArea = false,
        nowrap = false,
        children
    }: Props = $props();

    // 닉네임 세로 붕괴 차단용 클래스 (opt-in). 상세뷰에서만 적용.
    const nowrapClass = $derived(nowrap ? 'whitespace-nowrap' : '');

    const isOwnProfile = $derived(authStore.user?.mb_id === authorId);

    // 클릭 영역 확장 클래스: 댓글/상세(expandTouchArea)는 전 viewport, 목록은 PC(md:)만.
    const touchAreaClass = $derived(
        expandTouchArea ? '-mx-0.5 min-w-[2ch] px-0.5' : 'md:-mx-0.5 md:min-w-[2ch] md:px-0.5'
    );

    // 팔로우 상태 (드롭다운 열릴 때 조회)
    let isFollowing = $state(false);
    let followLoading = $state(false);
    let followChecked = $state(false);

    async function checkFollowStatus(): Promise<void> {
        if (!authStore.isAuthenticated || isOwnProfile || followChecked) return;
        try {
            const res = await fetch(`/api/members/${authorId}/follow`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isFollowing = data.data.is_following;
                }
            }
        } catch {
            // 조회 실패 시 무시
        }
        followChecked = true;
    }

    async function handleFollow(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        followLoading = true;
        try {
            const method = isFollowing ? 'DELETE' : 'POST';
            const res = await fetch(`/api/members/${authorId}/follow`, { method });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isFollowing = data.data.is_following;
                }
            }
        } catch {
            // 실패 시 무시
        } finally {
            followLoading = false;
        }
    }

    let blockLoading = $state(false);
    // #13526: iOS Safari 는 portal 된 드롭다운 항목 첫 탭에서 네이티브 confirm() 이
    // user-activation 밖으로 밀려 무반응/새로고침 후에야 뜨는 문제가 있다. 네이티브
    // confirm/alert 을 인앱 Dialog(+toast) 로 대체해 user-activation 의존을 제거한다.
    let blockDialogOpen = $state(false);
    let pendingScope = $state<'all' | 'message'>('all');

    const blockConfirmMsg = $derived(
        pendingScope === 'message'
            ? `${authorName}님의 쪽지만 차단하시겠습니까? (게시글·댓글은 그대로 표시됩니다)`
            : `${authorName}님을 차단하시겠습니까?`
    );

    // 드롭다운 항목 선택 시: 인증 확인 후 인앱 확인 다이얼로그를 연다.
    // 드롭다운이 닫히는 같은 이벤트에서 다이얼로그를 동기로 열면 bits-ui 의
    // interact-outside 처리와 충돌해 즉시 닫힐 수 있어, 다음 태스크로 미룬다.
    function requestBlock(scope: 'all' | 'message' = 'all'): void {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        if (blockLoading) return;
        pendingScope = scope;
        setTimeout(() => {
            blockDialogOpen = true;
        }, 0);
    }

    // 다이얼로그 확인 시에만 실제 차단 API 호출.
    async function confirmBlock(): Promise<void> {
        if (blockLoading) return;
        const scope = pendingScope;
        blockLoading = true;
        try {
            await apiClient.blockMember(authorId, scope);
            blockedUsersStore.add(authorId, scope);
            toast.success(
                scope === 'message'
                    ? `${authorName}님의 쪽지를 차단했습니다.`
                    : `${authorName}님을 차단했습니다.`
            );
            blockDialogOpen = false;
        } catch (err) {
            console.error('[Block] Failed:', authorId, err);
            toast.error('차단 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            blockLoading = false;
        }
    }

    function handleMessage(): void {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        if (!canSendMessage(authStore.user)) {
            goToCertification();
            return;
        }
        goto(`/messages?to=${encodeURIComponent(authorId)}`);
    }

    function stopPropagation(e: Event): void {
        e.preventDefault();
        e.stopPropagation();
    }

    // 모바일 스크롤 오터치 차단 (#6477893): bits-ui 메뉴 트리거는 터치에서 'pointerup' 에 열린다
    // (pointerdown 은 무시). 따라서 닉네임 위에서 시작한 스크롤도 pointerup 에서 메뉴를 열어버린다.
    // pointerdown~up 사이 이동이 임계(10px)를 넘으면 스크롤로 보고, capture 단계에서 pointerup 의
    // 전파를 끊어 bits-ui 의 open 을 차단한다. 의도된 탭(이동 없음)은 그대로 열림 → #12652 유지.
    const SCROLL_TAP_THRESHOLD = 10;
    let touchStartY = 0;
    let touchMoved = false;
    function onTriggerPointerDown(e: PointerEvent): void {
        if (e.pointerType !== 'touch') return;
        touchStartY = e.clientY;
        touchMoved = false;
    }
    function onTriggerPointerMove(e: PointerEvent): void {
        if (e.pointerType !== 'touch') return;
        if (Math.abs(e.clientY - touchStartY) > SCROLL_TAP_THRESHOLD) touchMoved = true;
    }
    function onTriggerPointerUp(e: PointerEvent): void {
        if (e.pointerType === 'touch' && touchMoved) {
            // 스크롤로 판정 → bits-ui 트리거의 pointerup-open 미도달
            e.stopPropagation();
            e.preventDefault();
        }
    }
</script>

{#if !authorId || !authStore.isAuthenticated}
    <!--
      #12480: 비회원에게는 작성자 dropdown 비활성 (단순 텍스트).
      모바일 list 에서 제목 영역과 인접한 작성자 영역이 자주 잘못 터치되어 dropdown 모달이
      뜨는 문제를 해소. 비회원에겐 프로필/팔로우/쪽지 같은 dropdown 메뉴가 무의미하므로
      클릭 영역 자체를 없애 부모 anchor (글 링크) 로 자연스럽게 propagate.
    -->
    <span class="{className} {nowrapClass} {isWithdrawn ? 'line-through opacity-60' : ''}">
        {#if children}
            {@render children()}
        {:else}
            {authorName}
        {/if}
    </span>
{:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- capture 단계 포인터 핸들러: 스크롤(이동) 중 pointerup 을 가로채 bits-ui 트리거의 open 차단 (#6477893) -->
    <span
        onclick={stopPropagation}
        onkeydown={stopPropagation}
        onpointerdowncapture={onTriggerPointerDown}
        onpointermovecapture={onTriggerPointerMove}
        onpointerupcapture={onTriggerPointerUp}
        class="inline-flex items-center"
    >
        <DropdownMenu.Root
            onOpenChange={(open) => {
                if (open) checkFollowStatus();
            }}
        >
            <!--
              #12444: 짧은 닉네임(예: "M.M.", "ㅇㅇ", "•") 의 클릭 영역이 텍스트 너비만큼
              만 잡혀 글자 사이 빈 공간이나 점 주변을 누르면 트리거가 활성화 안 되는 문제.
              inline-block + min-width(2ch) + 좌우 padding 으로 클릭 영역을 보장한다.
              negative margin 으로 시각적 layout 영향은 0.

              #12480: 모바일 list 에서 위 클릭 영역 보장이 인접 제목/메타 영역까지 침범하여
              제목 터치 시 dropdown 이 뜨는 문제 발생. PC(md:) 에만 적용하도록 제한.
              모바일은 기본 텍스트 너비만큼만 클릭 영역 — 제목 의도 터치 보호.
            -->
            <DropdownMenu.Trigger
                class="inline-block max-w-[11rem] cursor-pointer truncate text-left align-middle hover:underline focus:outline-none {touchAreaClass} {nowrapClass} {className} {isWithdrawn
                    ? 'line-through opacity-60'
                    : ''}"
            >
                {#if children}
                    {@render children()}
                {:else}
                    {authorName}
                {/if}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" class="w-40">
                <DropdownMenu.Item
                    class="cursor-pointer gap-2"
                    onclick={() => goto(`/member/${authorId}`)}
                >
                    <User class="h-3.5 w-3.5" />
                    프로필 보기
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    class="cursor-pointer gap-2"
                    onclick={() => goto(`/member/${encodeURIComponent(authorId)}?tab=posts`)}
                >
                    <FileText class="h-3.5 w-3.5" />
                    전체 게시물
                </DropdownMenu.Item>
                {#if $page.params.boardId}
                    <DropdownMenu.Item
                        class="cursor-pointer gap-2"
                        onclick={() =>
                            goto(
                                `/${$page.params.boardId}?sfl=author&stx=${encodeURIComponent(authorId)}&page=1`
                            )}
                    >
                        <Search class="h-3.5 w-3.5" />
                        게시판 내 검색
                    </DropdownMenu.Item>
                {/if}

                {#if authStore.isAuthenticated && !isOwnProfile}
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                        class="cursor-pointer gap-2"
                        onclick={handleFollow}
                        disabled={followLoading}
                    >
                        {#if isFollowing}
                            <UserMinus class="h-3.5 w-3.5" />
                            팔로우 해제
                        {:else}
                            <UserPlus class="h-3.5 w-3.5" />
                            팔로우
                        {/if}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="cursor-pointer gap-2"
                        onclick={handleMessage}
                        title={!canSendMessage(authStore.user) ? '실명인증' : undefined}
                    >
                        <Mail class="h-3.5 w-3.5" />
                        쪽지 보내기
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="cursor-pointer gap-2"
                        onSelect={() => requestBlock('message')}
                        disabled={blockLoading}
                    >
                        <Ban class="h-3.5 w-3.5" />
                        {blockLoading ? '처리 중...' : '쪽지만 차단'}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="text-destructive cursor-pointer gap-2"
                        onSelect={() => requestBlock('all')}
                        disabled={blockLoading}
                    >
                        <Ban class="h-3.5 w-3.5" />
                        {blockLoading ? '처리 중...' : '차단하기'}
                    </DropdownMenu.Item>
                {/if}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </span>

    <!-- #13526: 네이티브 confirm() 대체 인앱 차단 확인 다이얼로그 (portal → body, user-activation 무관) -->
    <Dialog.Root bind:open={blockDialogOpen}>
        <Dialog.Content class="sm:max-w-sm">
            <Dialog.Header>
                <Dialog.Title>차단 확인</Dialog.Title>
                <Dialog.Description>{blockConfirmMsg}</Dialog.Description>
            </Dialog.Header>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    onclick={() => (blockDialogOpen = false)}
                    disabled={blockLoading}
                >
                    취소
                </Button>
                <Button variant="destructive" onclick={confirmBlock} disabled={blockLoading}>
                    {blockLoading ? '처리 중...' : '차단'}
                </Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>
{/if}
