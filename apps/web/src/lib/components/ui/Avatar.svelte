<!--
  Avatar 컴포넌트 — Lambda variant 지원.

  - size="list"    : 32px base, 64px 2x retina (게시글 목록/댓글용)
  - size="profile" : 96px base, 192px 2x retina (프로필 페이지/홈 상단용)

  Lambda (avatar-resize) 가 variant 를 생성하지 않은 경우 (기존 이미지 or 오류)
  onerror → 원본 이미지 fallback.

  usage:
    <Avatar path={user.mb_image} updatedAt={user.mb_image_updated_at} size="list" alt={user.nickname} />
-->
<script lang="ts">
    import { getAvatarUrl, type AvatarSize } from '$lib/utils/member-icon';

    interface Props {
        path: string | null | undefined;
        updatedAt?: number | string | null;
        size?: 'list' | 'profile';
        alt?: string;
        class?: string;
    }

    let { path, updatedAt, size = 'list', alt = '', class: className = '' }: Props = $props();

    const sizes: [AvatarSize, AvatarSize] = $derived(size === 'profile' ? [96, 192] : [32, 64]);
    const base = $derived(sizes[0]);
    const src = $derived(getAvatarUrl(path, updatedAt, sizes[0]));
    const src2x = $derived(getAvatarUrl(path, updatedAt, sizes[1]));
    const fallback = $derived(getAvatarUrl(path, updatedAt));

    let errored = $state(false);

    function handleError(e: Event) {
        if (errored) return;
        errored = true;
        const img = e.currentTarget as HTMLImageElement;
        if (fallback && img.src !== fallback) {
            img.src = fallback;
            img.removeAttribute('srcset');
        }
    }
</script>

{#if src}
    <img
        {src}
        srcset={src2x ? `${src} 1x, ${src2x} 2x` : undefined}
        width={base}
        height={base}
        {alt}
        class={className}
        loading="lazy"
        decoding="async"
        onerror={handleError}
    />
{/if}
