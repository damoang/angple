<script lang="ts">
    /**
     * 온라인 대전 현황 위젯.
     *
     * ⛔ 왜 만드는가 (2026-08-17 실측)
     *   오목·장기는 서버·DB·웹이 전부 완성돼 배포까지 됐는데 **접속이 0** 이다.
     *   누적 대국 오목 2건 · 장기 0건, 최근 50시간 connections=0.
     *   원인은 게임이 없어서가 아니라 **진입 경로가 3단 깊이**라서다 —
     *   헤더 메뉴에 없고(사이드바에만 있으며 그 사이드바는 `hidden 2xl:block`),
     *   페이지에 들어가 「온라인 대전」 탭을 눌러야 대기 인원이 보인다.
     *   아무도 안 들어오니 대기자가 0이고, 대기자가 0이니 들어와도 바로 나간다.
     *
     * ⭐ 그래서 대기 인원을 **회원이 이미 있는 곳(메인)** 으로 가져온다.
     *   ⛔ 대기자가 있을 때만 띄우면 영원히 안 뜬다(닭-달걀). 0 명일 때도 조용히
     *      존재를 알리고 "먼저 기다리면 다음 분과 바로 매칭" 이라는 유인을 준다.
     */
    import { browser } from '$app/environment';
    import { Card, CardContent } from '$lib/components/ui/card';
    import { PlayCircle, Users, ChevronRight } from '../lucide.js';
    import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import { timedFetch } from '$lib/utils/timed-fetch';

    interface Props {
        config?: WidgetConfig;
        slot?: string;
        isEditMode?: boolean;
    }

    const { isEditMode = false }: Props = $props();

    // 폴링 주기. 대기자는 몇 분 단위로 바뀌므로 30초면 충분하고,
    // 메인 페이지 전원이 호출하는 자리라 이보다 짧게 두지 않는다.
    const POLL_MS = 30_000;

    type Game = { id: string; label: string; href: string; endpoint: string };

    const GAMES: Game[] = [
        { id: 'omok', label: '오목', href: '/games/omok', endpoint: '/omok-ws/lobby' },
        { id: 'janggi', label: '장기', href: '/games/janggi', endpoint: '/janggi-ws/lobby' }
    ];

    // ⛔ $state 안에 Map/Set 을 두지 않는다(룬 모드에서 반응성이 깨진다). 평범한 객체로.
    let waiting = $state<Record<string, number>>({});
    let loaded = $state(false);

    const totalWaiting = $derived(GAMES.reduce((sum, g) => sum + (waiting[g.id] ?? 0), 0));
    const activeGames = $derived(GAMES.filter((g) => (waiting[g.id] ?? 0) > 0));

    async function pollOnce(signal: AbortSignal) {
        const next: Record<string, number> = {};
        for (const g of GAMES) {
            try {
                const r = await timedFetch(g.endpoint, { signal }, { timeout: 4000, retries: 0 });
                if (!r.ok) continue;
                const j = await r.json();
                next[g.id] = typeof j?.waiting === 'number' ? j.waiting : 0;
            } catch {
                // 게임 서버가 내려가도 메인 페이지가 깨지면 안 된다. 해당 게임만 조용히 건너뛴다.
            }
        }
        if (signal.aborted) return;
        waiting = next;
        loaded = true;
    }

    $effect(() => {
        if (!browser) return;
        const ac = new AbortController();
        void pollOnce(ac.signal);
        const t = setInterval(() => void pollOnce(ac.signal), POLL_MS);
        // ⛔ 모든 분기에서 정리한다 — interval 이 남으면 페이지를 옮겨도 계속 때린다.
        return () => {
            clearInterval(t);
            ac.abort();
        };
    });
</script>

{#if loaded || isEditMode}
    <Card class="overflow-hidden">
        <CardContent class="p-3">
            {#if totalWaiting > 0}
                <!-- 대기자 있음 — 강조. 지금 들어가면 바로 매칭된다는 게 핵심 메시지다. -->
                <div class="flex flex-wrap items-center gap-2">
                    <span
                        class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    >
                        <Users class="h-3.5 w-3.5" />
                        지금 {totalWaiting}명 대기 중
                    </span>
                    {#each activeGames as g (g.id)}
                        <a
                            href={g.href}
                            class="hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium"
                        >
                            {g.label}
                            {waiting[g.id]}명
                            <ChevronRight class="h-3.5 w-3.5" />
                        </a>
                    {/each}
                    <span class="text-muted-foreground text-xs">바로 대국이 시작됩니다</span>
                </div>
            {:else}
                <!-- 대기자 0 — 조용히 존재만 알린다. 여기서 숨기면 첫 대기자가 영영 안 생긴다. -->
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <PlayCircle class="h-3.5 w-3.5" />
                        온라인 대전
                    </span>
                    {#each GAMES as g (g.id)}
                        <a
                            href={g.href}
                            class="text-sm font-medium underline-offset-2 hover:underline"
                        >
                            {g.label}
                        </a>
                    {/each}
                    <span class="text-muted-foreground text-xs">
                        먼저 기다리시면 다음 앙님과 바로 매칭됩니다
                    </span>
                </div>
            {/if}
        </CardContent>
    </Card>
{/if}
