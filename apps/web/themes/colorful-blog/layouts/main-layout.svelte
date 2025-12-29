<script lang="ts">
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import BlogHeader from '../components/blog-header.svelte';
    import BlogFooter from '../components/blog-footer.svelte';

    /**
     * Colorful Blog Theme - 블로그 중심 레이아웃
     * - 넓은 콘텐츠 영역
     * - 오렌지 + 핑크 화려한 색상
     * - 중앙 정렬
     */

    const { children } = $props();

    onMount(() => {
        console.log('🎨 Colorful Blog Theme 레이아웃 마운트됨');
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>Colorful Blog - 다모앙</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
    <meta name="description" content="화려한 블로그 스타일 레이아웃" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
    <!-- Header -->
    <BlogHeader />

    <!-- Hero Banner -->
    <div class="bg-gradient-to-r from-orange-500 to-pink-500 py-12 text-white">
        <div class="container mx-auto max-w-4xl px-4 text-center">
            <h1 class="mb-4 text-4xl font-bold">Welcome to Colorful Blog</h1>
            <p class="text-lg opacity-90">화려한 색상과 함께하는 블로그 테마</p>
        </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto max-w-4xl px-4 py-8">
        <main class="rounded-xl bg-white p-8 shadow-lg">
            {@render children()}
        </main>
    </div>

    <!-- Footer -->
    <BlogFooter />
</div>
