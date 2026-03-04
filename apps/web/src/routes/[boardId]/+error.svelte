<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import Home from '@lucide/svelte/icons/home';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import Rss from '@lucide/svelte/icons/rss';
    import FileQuestion from '@lucide/svelte/icons/file-question';
    import ServerCrash from '@lucide/svelte/icons/server-crash';
    import ShieldAlert from '@lucide/svelte/icons/shield-alert';

    const status = $derived($page.status);
    const message = $derived($page.error?.message || '');

    const is403 = $derived(status === 403);
    const is404 = $derived(status === 404);
    const is5xx = $derived(status >= 500);
</script>

<svelte:head>
    <title>
        {status} - {is404
            ? '게시판을 찾을 수 없습니다'
            : is403
              ? '접근 권한 없음'
              : '오류가 발생했습니다'} | {import.meta.env.VITE_SITE_NAME || 'Angple'}
    </title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-16">
    <Card class="bg-background text-center">
        <CardContent class="py-12">
            {#if is403}
                <ShieldAlert class="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h1 class="text-foreground mb-2 text-4xl font-bold">403</h1>
                <p class="text-foreground mb-2 text-lg font-medium">접근 권한이 없습니다</p>
                <p class="text-muted-foreground mb-8 text-sm">
                    {message || '이 게시판에 접근할 권한이 없습니다.'}
                </p>
                <div class="flex justify-center gap-3">
                    <Button href="/" variant="default">
                        <Home class="mr-2 h-4 w-4" />
                        홈으로
                    </Button>
                    <Button href="/feed" variant="outline">
                        <Rss class="mr-2 h-4 w-4" />
                        전체글
                    </Button>
                </div>
            {:else if is404}
                <FileQuestion class="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h1 class="text-foreground mb-2 text-4xl font-bold">404</h1>
                <p class="text-foreground mb-2 text-lg font-medium">게시판을 찾을 수 없습니다</p>
                <p class="text-muted-foreground mb-8 text-sm">
                    요청하신 게시판이 삭제되었거나, 주소가 변경되었을 수 있습니다.
                </p>
                <div class="flex justify-center gap-3">
                    <Button href="/" variant="default">
                        <Home class="mr-2 h-4 w-4" />
                        홈으로
                    </Button>
                    <Button href="/feed" variant="outline">
                        <Rss class="mr-2 h-4 w-4" />
                        전체글
                    </Button>
                </div>
            {:else if is5xx}
                <ServerCrash class="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h1 class="text-foreground mb-2 text-4xl font-bold">{status}</h1>
                <p class="text-foreground mb-2 text-lg font-medium">오류가 발생했습니다</p>
                <p class="text-muted-foreground mb-8 text-sm">
                    일시적인 문제일 수 있습니다. 잠시 후 다시 시도해주세요.
                </p>
                <div class="flex justify-center gap-3">
                    <Button onclick={() => window.location.reload()} variant="default">
                        <RotateCcw class="mr-2 h-4 w-4" />
                        다시 시도
                    </Button>
                    <Button href="/" variant="outline">
                        <Home class="mr-2 h-4 w-4" />
                        홈으로
                    </Button>
                </div>
            {:else}
                <ServerCrash class="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h1 class="text-foreground mb-2 text-4xl font-bold">{status}</h1>
                <p class="text-foreground mb-2 text-lg font-medium">
                    {message || '문제가 발생했습니다'}
                </p>
                <div class="mt-8 flex justify-center gap-3">
                    <Button href="/" variant="default">
                        <Home class="mr-2 h-4 w-4" />
                        홈으로
                    </Button>
                </div>
            {/if}
        </CardContent>
    </Card>
</div>
