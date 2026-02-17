import path from 'node:path';
import fs from 'node:fs';
import { toKebabCase, findProjectRoot, writeFile, success, info, error } from '../utils.js';

interface Options {
    description?: string;
    author?: string;
    dir?: string;
}

export function createTheme(name: string, options: Options): void {
    const id = toKebabCase(name);
    const root = findProjectRoot();
    const baseDir = options.dir || path.join(root, 'custom-themes');
    const themeDir = path.join(baseDir, id);

    if (fs.existsSync(themeDir)) {
        error(`테마 "${id}"가 이미 존재합니다: ${themeDir}`);
        process.exit(1);
    }

    info(`테마 "${id}" 생성 중...`);

    // theme.json
    const manifest = {
        id,
        name,
        version: '1.0.0',
        author: {
            name: options.author || 'Angple Developer',
            email: ''
        },
        description: options.description || `${name} 테마`,
        screenshot: 'screenshot.png',
        angpleVersion: '0.1.0',
        license: 'MIT',
        category: 'theme',
        tags: ['custom'],
        settings: {
            appearance: {
                primaryColor: {
                    label: 'Primary Color',
                    type: 'color',
                    default: '#3b82f6',
                    description: '메인 강조 색상'
                },
                enableDarkMode: {
                    label: 'Dark Mode',
                    type: 'boolean',
                    default: true,
                    description: '다크모드 지원'
                }
            },
            layout: {
                sidebarPosition: {
                    label: 'Sidebar Position',
                    type: 'select',
                    default: 'right',
                    description: '사이드바 위치',
                    options: [
                        { label: '왼쪽', value: 'left' },
                        { label: '오른쪽', value: 'right' },
                        { label: '없음', value: 'none' }
                    ]
                }
            }
        },
        hooks: [],
        components: []
    };

    writeFile(path.join(themeDir, 'theme.json'), JSON.stringify(manifest, null, 4));

    // layouts/main-layout.svelte
    writeFile(
        path.join(themeDir, 'layouts', 'main-layout.svelte'),
        `<script lang="ts">
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';

    const { children } = $props();

    onMount(() => {
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>{import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col bg-white dark:bg-gray-900">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg dark:bg-gray-900/90">
        <div class="container mx-auto flex h-16 items-center justify-between px-4">
            <a href="/" class="text-xl font-bold">
                {import.meta.env.VITE_SITE_NAME || 'Angple'}
            </a>
            <nav class="flex items-center gap-4">
                <a href="/" class="text-sm hover:underline">홈</a>
                <a href="/free" class="text-sm hover:underline">자유게시판</a>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto flex-1 px-4 py-6">
        {@render children()}
    </main>

    <!-- Footer -->
    <footer class="border-t py-6 text-center text-sm text-gray-500">
        <p>Powered by Angple</p>
    </footer>
</div>
`
    );

    // components/custom-header.svelte
    writeFile(
        path.join(themeDir, 'components', 'custom-header.svelte'),
        `<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte';
</script>

<div class="bg-primary/5 rounded-lg p-4">
    <p class="text-sm">
        {#if authStore.isAuthenticated}
            {authStore.user?.mb_name}님 환영합니다!
        {:else}
            <a href="/login" class="text-primary hover:underline">로그인</a>해 주세요.
        {/if}
    </p>
</div>
`
    );

    // screenshot.png placeholder
    writeFile(path.join(themeDir, 'screenshot.png'), '');

    success(`테마 "${id}" 생성 완료!`);
    console.log('');
    info(`경로: ${themeDir}`);
    info('구조:');
    console.log(`  ${id}/`);
    console.log('  ├── theme.json');
    console.log('  ├── screenshot.png');
    console.log('  ├── layouts/');
    console.log('  │   └── main-layout.svelte');
    console.log('  └── components/');
    console.log('      └── custom-header.svelte');
    console.log('');
    info('다음 단계:');
    console.log('  1. theme.json에서 설정을 커스터마이즈하세요');
    console.log('  2. main-layout.svelte에서 레이아웃을 수정하세요');
    console.log('  3. 관리자 > 테마에서 활성화하세요');
}
