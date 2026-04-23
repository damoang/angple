<!--
  Avatar 컴포넌트 — Lambda variant 지원 (optional).

  - size 미지정(default): **원본 URL** 사용 (Lambda variant 불필요, 하위 호환)
  - size="list"    : 32px base + 64px srcset 2x (variant 요청)
  - size="profile" : 96px base + 192px srcset 2x (variant 요청)

  Lambda (avatar-resize) variant 가 없으면 onerror → 원본 URL fallback.

  usage:
    <Avatar path={user.mb_image} updatedAt={user.mb_image_updated_at} alt={user.nickname} />
    <Avatar ... size="list" />      # Lambda 배포 후 적용
    <Avatar ... size="profile" />   # 프로필 페이지
-->
<script lang="ts">
    import { getAvatarUrl, type AvatarSize } from '$lib/utils/member-icon';

    interface Props {
        path: string | null | undefined;
        updatedAt?: number | string | null;
        size?: 'list' | 'profile';
        alt?: string;
        class?: string;
        width?: number;
        height?: number;
    }

    let { path, updatedAt, size, alt = '', class: className = '', width, height }: Props = $props();

    const sizes: [AvatarSize, AvatarSize] | null = $derived(
        size === 'profile' ? [96, 192] : size === 'list' ? [32, 64] : null
    );
    const src = $derived(
        sizes ? getAvatarUrl(path, updatedAt, sizes[0]) : getAvatarUrl(path, updatedAt)
    );
    const src2x = $derived(sizes ? getAvatarUrl(path, updatedAt, sizes[1]) : null);
    const widthAttr = $derived(sizes ? sizes[0] : width);
    const heightAttr = $derived(sizes ? sizes[0] : (height ?? width));
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
        width={widthAttr}
        height={heightAttr}
        {alt}
        class={className}
        loading="lazy"
        decoding="async"
        onerror={handleError}
    />
{/if}
