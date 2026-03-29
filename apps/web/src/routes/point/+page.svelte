<script lang="ts">
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import LogIn from '@lucide/svelte/icons/log-in';
    import PenLine from '@lucide/svelte/icons/pen-line';
    import MessageCircle from '@lucide/svelte/icons/message-circle';
    import UserPlus from '@lucide/svelte/icons/user-plus';
    import Coins from '@lucide/svelte/icons/coins';
    import ShieldAlert from '@lucide/svelte/icons/shield-alert';
    import Info from '@lucide/svelte/icons/info';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const earnMethods = [
        {
            icon: UserPlus,
            label: '회원가입',
            point: '+1,000',
            desc: '최초 1회',
            color: 'text-pink-500',
            bg: 'bg-pink-100 dark:bg-pink-900/30'
        },
        {
            icon: LogIn,
            label: '매일 로그인',
            point: '+100',
            desc: '하루 1회',
            color: 'text-green-500',
            bg: 'bg-green-100 dark:bg-green-900/30'
        },
        {
            icon: PenLine,
            label: '글 작성',
            point: '',
            desc: '게시판마다 상이 (아래 상세 참고)',
            color: 'text-blue-500',
            bg: 'bg-blue-100 dark:bg-blue-900/30'
        },
        {
            icon: MessageCircle,
            label: '댓글 작성',
            point: '',
            desc: '게시판마다 상이 (아래 상세 참고)',
            color: 'text-purple-500',
            bg: 'bg-purple-100 dark:bg-purple-900/30'
        }
    ];
</script>

<svelte:head>
    <title>포인트 안내 | {import.meta.env.VITE_SITE_NAME || '다모앙'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 pb-12 pt-6">
    <!-- 히어로 -->
    <div class="mb-10 text-center">
        <div
            class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30"
        >
            <Coins class="h-8 w-8 text-amber-500" />
        </div>
        <h1 class="text-foreground mb-2 text-3xl font-bold">포인트 안내</h1>
        <p class="text-muted-foreground text-lg">
            다모앙에서 활동하면 포인트가 적립되며, 다양한 서비스에 사용할 수 있습니다.
        </p>
    </div>

    <!-- 포인트 획득 방법 -->
    <section class="mb-10">
        <h2 class="text-foreground mb-4 text-xl font-semibold">포인트 획득 방법</h2>
        <div class="grid gap-4 sm:grid-cols-2">
            {#each earnMethods as method}
                <Card>
                    <CardContent class="flex items-center gap-4 p-4">
                        <div
                            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {method.bg}"
                        >
                            <method.icon class="h-6 w-6 {method.color}" />
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-foreground font-semibold">{method.label}</span>
                                {#if method.point}
                                    <span
                                        class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    >
                                        {method.point}P
                                    </span>
                                {/if}
                            </div>
                            <p class="text-muted-foreground mt-0.5 text-sm">{method.desc}</p>
                        </div>
                    </CardContent>
                </Card>
            {/each}
        </div>
    </section>

    <!-- 포인트 사용 -->
    <section class="mb-10">
        <h2 class="text-foreground mb-4 text-xl font-semibold">포인트 사용</h2>
        <Card>
            <CardContent class="space-y-3 p-5">
                <div class="flex items-start gap-3">
                    <Info class="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                    <div>
                        <p class="text-foreground text-sm font-medium">사이트 내 서비스 이용</p>
                        <p class="text-muted-foreground text-sm">
                            적립된 포인트는 사이트 내 다양한 서비스를 이용하는 데 사용됩니다.
                        </p>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <Info class="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                    <div>
                        <p class="text-foreground text-sm font-medium">나의 포인트 확인</p>
                        <p class="text-muted-foreground text-sm">
                            <a href="/my/points" class="text-primary underline"
                                >마이페이지 &gt; 포인트 내역</a
                            >에서 적립/사용 내역을 확인할 수 있습니다.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    </section>

    <!-- 주의 사항 -->
    <section>
        <Card class="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent class="p-5">
                <div class="mb-3 flex items-center gap-2">
                    <ShieldAlert class="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 class="font-semibold text-amber-800 dark:text-amber-300">주의 사항</h3>
                </div>
                <ul
                    class="list-inside list-disc space-y-1 text-sm text-amber-800 dark:text-amber-300"
                >
                    <li>포인트 정책은 수시로 변경될 수 있으며, 별도로 통보하지 않습니다.</li>
                    <li>
                        포인트 획득을 위한 도배, 어뷰징 등의 행위 시 <strong
                            >포인트 몰수, 회원정지, 접근차단</strong
                        > 등의 조치를 받을 수 있습니다.
                    </li>
                    <li>
                        적립된 포인트는 사이트 내 서비스 이용 목적 이외의 어떠한 효력도 갖지
                        않습니다.
                    </li>
                </ul>
            </CardContent>
        </Card>
    </section>

    <!-- 게시판별 포인트 상세 -->
    {#if data.boardPoints?.length > 0}
        <section class="mt-10">
            <h2 class="text-foreground mb-4 text-xl font-semibold">게시판별 포인트 상세</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-border border-b">
                            <th class="text-muted-foreground px-3 py-2 text-left font-medium"
                                >게시판</th
                            >
                            <th class="text-muted-foreground px-3 py-2 text-right font-medium"
                                >글쓰기</th
                            >
                            <th class="text-muted-foreground px-3 py-2 text-right font-medium"
                                >댓글</th
                            >
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.boardPoints as bp}
                            <tr class="border-border border-b last:border-0">
                                <td class="text-foreground px-3 py-1.5">{bp.name}</td>
                                <td
                                    class="px-3 py-1.5 text-right font-medium text-blue-600 dark:text-blue-400"
                                    >{bp.writePoint > 0
                                        ? '+'
                                        : ''}{bp.writePoint.toLocaleString()}</td
                                >
                                <td
                                    class="px-3 py-1.5 text-right font-medium text-purple-600 dark:text-purple-400"
                                    >{bp.commentPoint > 0
                                        ? '+'
                                        : ''}{bp.commentPoint.toLocaleString()}</td
                                >
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </section>
    {/if}
</div>
