<script lang="ts">
    import Share2 from '@lucide/svelte/icons/share-2';
    import Link from '@lucide/svelte/icons/link';
    import { toast } from 'svelte-sonner';
    import {
        shareToFacebook,
        shareToX,
        shareToKakao,
        shareToNaverBand,
        shareToNaver,
        shareToPinterest,
        shareToTumblr,
        copyUrl,
        nativeShare,
        canNativeShare
    } from '$lib/utils/share.js';

    interface Props {
        boardId: string;
        postId: string | number;
        title: string;
        imageUrl?: string;
    }

    let { boardId, postId, title, imageUrl }: Props = $props();

    let open = $state(false);

    function getShareUrl(): string {
        return `${window.location.origin}/${boardId}/${postId}`;
    }

    async function handleShare() {
        // 모바일: 네이티브 공유 시트, 데스크탑: 드롭다운
        if (canNativeShare()) {
            await nativeShare(title, getShareUrl());
        } else {
            open = !open;
        }
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
            toast.success('주소가 복사되었습니다.');
        } else {
            toast.error('주소 복사에 실패했습니다.');
        }
        open = false;
    }

    async function handleKakao() {
        const success = await shareToKakao(title, getShareUrl(), imageUrl);
        if (!success) {
            toast.error('카카오톡 공유를 불러올 수 없습니다.');
        }
        open = false;
    }

    function handlePlatform(platform: string) {
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
        <span>공유</span>
    </button>

    {#if open}
        <div
            class="bg-popover absolute bottom-full right-0 z-50 mb-1 w-44 rounded-md border p-1 shadow-md"
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
