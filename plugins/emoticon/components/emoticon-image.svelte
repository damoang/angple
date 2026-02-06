<!--
  단일 이모티콘 이미지 렌더러
  @param filename - 이모티콘 파일명
  @param width - 표시 너비
-->
<script lang="ts">
    import { getImageUrl } from '../lib/api';

    interface Props {
        filename: string;
        width?: number;
        onclick?: () => void;
    }

    let { filename, width = 50, onclick }: Props = $props();

    let src = $derived(getImageUrl(filename));
</script>

<button type="button" class="emoticon-image-btn" {onclick} title={filename}>
    <img {src} {width} class="emoticon" loading="lazy" alt={filename} />
</button>

<style>
    .emoticon-image-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border: 1px solid transparent;
        border-radius: 4px;
        background: none;
        cursor: pointer;
        transition:
            border-color 0.15s,
            background-color 0.15s;
    }

    .emoticon-image-btn:hover {
        border-color: var(--border-color, #e2e8f0);
        background-color: var(--hover-bg, #f1f5f9);
    }

    .emoticon {
        display: block;
        max-width: 100%;
        height: auto;
    }
</style>
