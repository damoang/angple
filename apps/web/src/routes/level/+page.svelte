<script lang="ts">
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import Lock from '@lucide/svelte/icons/lock';
    import LogIn from '@lucide/svelte/icons/log-in';
    import PenLine from '@lucide/svelte/icons/pen-line';
    import MessageCircle from '@lucide/svelte/icons/message-circle';
    import Star from '@lucide/svelte/icons/star';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import Trophy from '@lucide/svelte/icons/trophy';
    import Crown from '@lucide/svelte/icons/crown';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import ArrowUpCircle from '@lucide/svelte/icons/arrow-up-circle';

    const levels = Array.from({ length: 110 }, (_, i) => i);
    const userLevel = $derived(authStore.user?.as_level ?? 0);

    // 등급 (mb_level) 정보
    const grades = [
        { level: 1, name: '앙님💔', desc: '비회원', perm: '읽기만 가능' },
        { level: 2, name: '앙님❤️', desc: '가입 시 기본 등급', perm: '읽기만 가능' },
        { level: 3, name: '앙님💛', desc: '7일 로그인 후 자동 승급', perm: '글쓰기, 댓글 가능' },
        { level: 4, name: '앙님💙', desc: '활동 기반 승급', perm: '전체 기능 이용 가능' }
    ];

    // XP 레벨 구간
    const levelTiers = [
        {
            label: '초보',
            range: '1 ~ 10',
            xp: '0 ~ 45,000',
            desc: '활동을 시작하는 단계입니다.',
            badge: 5,
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-950/30'
        },
        {
            label: '성장',
            range: '11 ~ 30',
            xp: '55,000 ~ 435,000',
            desc: '꾸준히 활동하며 커뮤니티에 익숙해지는 구간입니다.',
            badge: 20,
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-950/30'
        },
        {
            label: '베테랑',
            range: '31 ~ 79',
            xp: '465,000 ~ 3,081,000',
            desc: '오랜 기간 활동한 핵심 멤버입니다.',
            badge: 50,
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-950/30'
        },
        {
            label: '마스터',
            range: '80+',
            xp: '3,160,000+',
            desc: '최고 레벨 구간입니다. 로그인(출석)으로만 경험치가 적립됩니다.',
            badge: 90,
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-950/30'
        }
    ];

    const xpMethods = [
        {
            icon: LogIn,
            label: '매일 로그인',
            xp: '+500',
            desc: '하루 1회, 로그인 시 자동 적립',
            color: 'text-green-500',
            bg: 'bg-green-100 dark:bg-green-900/30'
        },
        {
            icon: PenLine,
            label: '글 작성',
            xp: '+100',
            desc: '게시글 1건당 (게시판마다 상이)',
            color: 'text-blue-500',
            bg: 'bg-blue-100 dark:bg-blue-900/30'
        },
        {
            icon: MessageCircle,
            label: '댓글 작성',
            xp: '+50',
            desc: '댓글 1건당 (게시판마다 상이)',
            color: 'text-purple-500',
            bg: 'bg-purple-100 dark:bg-purple-900/30'
        }
    ];

    const tierIcons = [Star, TrendingUp, Trophy, Crown];
</script>

<svelte:head>
    <title>뱃지 & 레벨 안내 | {import.meta.env.VITE_SITE_NAME || '다모앙'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 pb-12 pt-6">
    <!-- 히어로 -->
    <div class="mb-10 text-center">
        <img
            src="https://damoang.net/emoticons/DINKIssTyle-ang-025.webp"
            alt="다모앙 캐릭터"
            class="mx-auto mb-4 h-24 w-24"
        />
        <h1 class="text-foreground mb-2 text-3xl font-bold">뱃지 & 레벨 안내</h1>
        <p class="text-muted-foreground text-lg">
            다모앙에는 <strong>이용 권한</strong>과 <strong>활동 레벨</strong> 두 가지 시스템이 있습니다.
        </p>
    </div>

    <!-- ===== 1. 등급 (mb_level) ===== -->
    <section class="mb-12">
        <div class="mb-4 flex items-center gap-2">
            <ShieldCheck class="text-primary h-6 w-6" />
            <h2 class="text-foreground text-xl font-semibold">이용 권한</h2>
        </div>
        <p class="text-muted-foreground mb-4 text-sm">
            등급은 닉네임 옆에 표시되며, 게시판 이용 권한을 결정합니다.
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
            {#each grades as g}
                <Card>
                    <CardContent class="flex items-center gap-4 p-4">
                        <span class="shrink-0 text-2xl">{g.name.slice(-2)}</span>
                        <div class="min-w-0 flex-1">
                            <div class="text-foreground font-semibold">{g.name}</div>
                            <p class="text-muted-foreground text-xs">{g.desc}</p>
                            <p
                                class="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                            >
                                {g.perm}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            {/each}
        </div>

        <Card class="mt-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent class="p-4 text-sm">
                <p class="text-amber-800 dark:text-amber-300">
                    <strong>글쓰기와 댓글 작성은 앙님💛 등급부터 가능합니다.</strong>
                    가입 후 7일간 로그인하면 자동으로 승급됩니다.
                </p>
            </CardContent>
        </Card>
    </section>

    <!-- ===== 2. 레벨 (as_level) ===== -->
    <section class="mb-10">
        <div class="mb-4 flex items-center gap-2">
            <ArrowUpCircle class="h-6 w-6 text-indigo-500" />
            <h2 class="text-foreground text-xl font-semibold">활동 레벨 (경험치)</h2>
        </div>
        <p class="text-muted-foreground mb-4 text-sm">
            레벨은 활동량을 나타내는 지표입니다. 등급과 별개로, 경험치(XP)가 쌓이면 레벨이
            올라갑니다.
        </p>

        <!-- 경험치 획득 방법 -->
        <h3 class="text-foreground mb-3 font-semibold">경험치 획득 방법</h3>
        <div class="mb-6 grid gap-4 sm:grid-cols-3">
            {#each xpMethods as method}
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
                                <span
                                    class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                >
                                    {method.xp}
                                </span>
                            </div>
                            <p class="text-muted-foreground mt-0.5 text-sm">{method.desc}</p>
                        </div>
                    </CardContent>
                </Card>
            {/each}
        </div>

        <!-- 레벨 구간 -->
        <h3 class="text-foreground mb-3 font-semibold">레벨 구간</h3>
        <div class="mb-6 grid gap-4 sm:grid-cols-2">
            {#each levelTiers as tier, i}
                {@const TierIcon = tierIcons[i]}
                <Card class="{tier.bg} border-0">
                    <CardContent class="p-5">
                        <div class="mb-3 flex items-center gap-3">
                            <LevelBadge level={tier.badge} size="md" />
                            <div>
                                <div class="flex items-center gap-1.5">
                                    <TierIcon class="h-4 w-4 {tier.color}" />
                                    <span class="text-foreground font-bold">{tier.label}</span>
                                </div>
                                <span class="text-muted-foreground text-sm">Lv.{tier.range}</span>
                            </div>
                        </div>
                        <p class="text-muted-foreground mb-2 text-sm">{tier.desc}</p>
                        <p class="text-xs font-medium {tier.color}">필요 경험치: {tier.xp}</p>
                    </CardContent>
                </Card>
            {/each}
        </div>
    </section>

    <!-- 참고 사항 -->
    <section class="mb-10">
        <Card>
            <CardContent class="space-y-2 p-5">
                <h3 class="text-foreground font-semibold">참고 사항</h3>
                <ul class="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                    <li>
                        <strong>이용 권한</strong>과 <strong>활동 레벨</strong>은 별개의
                        시스템입니다.
                    </li>
                    <li>
                        레벨 80 이상부터는 <strong>로그인(출석)으로만</strong> 경험치가 적립됩니다.
                    </li>
                    <li>경험치는 누적 방식이며, 감소하지 않습니다.</li>
                    <li>최대 레벨은 134 (누적 8,911,000 XP)입니다.</li>
                </ul>
            </CardContent>
        </Card>
    </section>

    <!-- 스페셜 뱃지 -->
    <section class="mb-10">
        <h2 class="text-foreground mb-4 text-xl font-semibold">스페셜 뱃지</h2>
        <p class="text-muted-foreground mb-4 text-sm">
            특별한 역할이나 기여를 한 회원에게 부여되는 뱃지입니다.
        </p>
        <div class="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {#each [{ src: '/images/level/special.svg', name: '스페셜' }, { src: '/images/level/ang.svg', name: '앙' }, { src: '/images/level/a_ang.svg', name: '에이앙' }, { src: '/images/level/A.svg', name: 'A' }, { src: '/images/level/admin.svg', name: '관리자' }, { src: '/images/level/a_sponser.svg', name: '스폰서' }] as badge}
                <div class="border-border flex items-center justify-center rounded-md border p-3">
                    <img
                        src={badge.src}
                        alt={badge.name}
                        width="20"
                        height="20"
                        class="inline-block"
                    />
                </div>
            {/each}
        </div>
    </section>

    <!-- 레벨 뱃지 갤러리 -->
    <section>
        <h2 class="text-foreground mb-4 text-xl font-semibold">레벨 뱃지 목록</h2>
        <p class="text-muted-foreground mb-4 text-sm">
            본인 레벨까지 공개됩니다. 다음 뱃지는 레벨을 올려서 확인해 보세요!
        </p>
        <div class="grid grid-cols-5 gap-3 sm:grid-cols-8 md:grid-cols-10">
            {#each levels as level (level)}
                {#if level <= userLevel}
                    <div
                        class="border-border flex flex-col items-center gap-1 rounded-md border p-2"
                    >
                        <LevelBadge {level} size="md" />
                        <span class="text-muted-foreground text-xs">Lv.{level}</span>
                    </div>
                {:else}
                    <div
                        class="border-border bg-muted/50 flex flex-col items-center justify-center gap-1 rounded-md border p-2 opacity-40"
                    >
                        <div class="flex h-8 w-8 items-center justify-center">
                            <Lock class="text-muted-foreground h-4 w-4" />
                        </div>
                        <span class="text-muted-foreground text-xs">Lv.{level}</span>
                    </div>
                {/if}
            {/each}
        </div>
        <p class="text-muted-foreground mt-4 text-center text-xs">뱃지 디자인 : Playonly</p>
    </section>
</div>
