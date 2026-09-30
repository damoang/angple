<script lang="ts">
    import Share2 from '@lucide/svelte/icons/share-2';
    import Link from '@lucide/svelte/icons/link';
    import { toast } from 'svelte-sonner';
    import { trackEvent } from '$lib/services/ga4.js';
    import {
        shareToFacebook,
        shareToX,
        shareToKakao,
        shareToNaverBand,
        shareToNaver,
        shareToPinterest,
        shareToTumblr,
        copyUrl,
        preloadKakaoSdk
    } from '$lib/utils/share.js';

    interface Props {
        boardId: string;
        postId: string | number;
        title: string;
        imageUrl?: string;
        /** true 면 모바일(<640px)에서 "공유" 텍스트를 숨기고 아이콘만 표시. 기본값 false=현행 유지. */
        labelHiddenMobile?: boolean;
    }

    let { boardId, postId, title, imageUrl, labelHiddenMobile = false }: Props = $props();

    let open = $state(false);

    function getShareUrl(): string {
        return `${window.location.origin}/${boardId}/${postId}`;
    }

    function handleShare() {
        open = !open;
        // 카카오 SDK 를 메뉴 열 때 미리 받아 둔다(클릭 후 새 창 차단 방지).
        if (open) preloadKakaoSdk();
    }

    function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest('.share-dropdown')) {
            open = false;
        }
    }

    async function handleCopyUrl() {
        const success = await copyUrl(getShareUrl());
        if (success) {
            trackEvent('share', { method: 'copy_url', board_id: boardId });
            toast.success('주소가 복사되었습니다.');
        } else {
            toast.error('주소 복사에 실패했습니다.');
        }
        open = false;
    }

    async function handleKakao() {
        trackEvent('share', { method: 'kakao', board_id: boardId });
        const url = getShareUrl();
        const success = await shareToKakao(title, url, imageUrl);
        if (!success) {
            // bug/13991: 실패를 조용히 삼키지 않는다. 주소라도 복사해 직접 붙여 넣게 한다.
            // SDK 로드·초기화·호출 예외(주로 PC)만 여기로 온다. 모바일에서 카카오 측 검증이
            // 실패하면 SDK 가 sharer.kakao.com/picker/failed 로 페이지를 옮기므로 잡을 수 없다.
            const copied = await copyUrl(url);
            if (copied) {
                toast.error(
                    '카카오톡 공유를 열 수 없어 주소를 복사했습니다. 카카오톡에 붙여 넣어 주세요.'
                );
            } else {
                toast.error('카카오톡 공유를 열 수 없습니다. 잠시 후 다시 시도해 주세요.');
            }
        }
        open = false;
    }

    function handlePlatform(platform: string) {
        trackEvent('share', { method: platform, board_id: boardId });
        const url = getShareUrl();
        switch (platform) {
            case 'facebook':
                shareToFacebook(url);
                break;
            case 'x':
                shareToX(title, url);
                break;
            case 'band':
                shareToNaverBand(title, url);
                break;
            case 'naver':
                shareToNaver(title, url);
                break;
            case 'pinterest':
                shareToPinterest(url, title, imageUrl);
                break;
            case 'tumblr':
                shareToTumblr(url);
                break;
        }
        open = false;
    }

    const platforms = [
        { id: 'copy', label: 'URL 복사', color: '' },
        { id: 'kakao', label: '카카오톡', color: 'bg-[#FEE500]' },
        { id: 'x', label: 'X (Twitter)', color: 'bg-black dark:bg-white' },
        { id: 'facebook', label: 'Facebook', color: 'bg-[#1877F2]' },
        { id: 'band', label: 'Band', color: 'bg-[#06CF5E]' },
        { id: 'naver', label: '네이버', color: 'bg-[#03C75A]' },
        { id: 'pinterest', label: 'Pinterest', color: 'bg-[#E60023]' },
        { id: 'tumblr', label: 'Tumblr', color: 'bg-[#35465C]' }
    ] as const;
</script>

<svelte:window onclick={handleClickOutside} />

<div class="share-dropdown relative">
    <button
        type="button"
        onclick={handleShare}
        class="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm transition-colors"
        aria-label="공유하기"
        aria-expanded={open}
    >
        <Share2 class="h-4 w-4" />
        <span class={labelHiddenMobile ? 'hidden sm:inline' : ''}>공유</span>
    </button>

    {#if open}
        <!-- bug/13644: 공유는 우측 액션 그룹(justify-end)의 최좌측 버튼이라, #2132 로
             모바일 라벨이 복원돼 버튼 폭이 커지자 right-0(오른쪽 모서리 기준 왼쪽으로 176px
             펼침)이 화면 좌측 밖으로 잘렸다. 모바일(<640px)에서만 left-0 으로 오른쪽 펼침
             으로 바꾸고(우측엔 스크랩·신고 등 버튼이 있어 w-44 넘침 없음), 데스크톱은
             sm:right-0 으로 종전 동작 그대로 유지한다. -->
        <div
            class="bg-popover absolute bottom-full left-0 z-50 mb-1 w-44 rounded-md border p-1 shadow-md sm:left-auto sm:right-0"
        >
            {#each platforms as platform}
                <button
                    class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm"
                    onclick={() => {
                        if (platform.id === 'copy') handleCopyUrl();
                        else if (platform.id === 'kakao') handleKakao();
                        else handlePlatform(platform.id);
                    }}
                >
                    {#if platform.id === 'copy'}
                        <Link class="h-4 w-4 shrink-0" />
                    {:else}
                        <span class="inline-block h-4 w-4 shrink-0 rounded-sm {platform.color}"
                        ></span>
                    {/if}
                    <span>{platform.label}</span>
                </button>
            {/each}
        </div>
    {/if}
</div>
