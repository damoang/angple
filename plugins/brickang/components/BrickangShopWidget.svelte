<!--
  BrickangShopWidget.svelte — damoang.net/shop 의 brickang 섹션 삽입용 미니 위젯.

  한 번의 fetch (`/api/plugins/brickang/buildings/active`) 로 활성 건축물 정보 + recent 5명 을
  가져와서 진행률 바 + 최근 벽돌 닉네임 row + CTA 를 보여준다.

  Svelte 5 Rune 모드 (`$state`, `$derived`, `$effect`) 사용.
  로딩/에러/빈 상태 모두 처리.
-->
<script lang="ts">
    import ProgressBar from './ProgressBar.svelte';

    interface ActiveBuilding {
        id: number;
        name: string;
        target_bricks: number;
        current_bricks: number;
        progress_percent: number;
        status: string;
    }
    interface RecentBrick {
        id: number;
        nickname: string;
        message: string | null;
        placed_at: string;
        brick_type_slug: string | null;
    }
    interface ApiResponse {
        building: ActiveBuilding | null;
        recent: RecentBrick[];
    }

    interface Props {
        ctaHref?: string;
        title?: string;
    }
    let { ctaHref = '/brickang', title = '브릭앙 — 함께 짓는 가상 건축' }: Props = $props();

    let loading = $state(true);
    let errorMsg = $state<string | null>(null);
    let building = $state<ActiveBuilding | null>(null);
    let recent = $state<RecentBrick[]>([]);

    let hasBuilding = $derived(building !== null);

    $effect(() => {
        void load();
    });

    async function load(): Promise<void> {
        loading = true;
        errorMsg = null;
        try {
            const res = await fetch('/api/plugins/brickang/buildings/active', {
                credentials: 'include'
            });
            if (!res.ok) {
                errorMsg = `로딩 실패 (${res.status})`;
                return;
            }
            const data = (await res.json()) as ApiResponse;
            building = data.building;
            recent = data.recent ?? [];
        } catch (err) {
            console.error('[BrickangShopWidget] fetch failed:', err);
            errorMsg = '브릭앙 정보를 불러오지 못했어요';
        } finally {
            loading = false;
        }
    }
</script>

<section class="brickang-widget">
    <header class="brickang-widget__header">
        <h3 class="brickang-widget__title">{title}</h3>
    </header>

    {#if loading}
        <div class="brickang-widget__skeleton" aria-busy="true">
            <div class="skeleton-line skeleton-line--lg"></div>
            <div class="skeleton-bar"></div>
            <div class="skeleton-row">
                <div class="skeleton-pill"></div>
                <div class="skeleton-pill"></div>
                <div class="skeleton-pill"></div>
            </div>
        </div>
    {:else if errorMsg}
        <div class="brickang-widget__error">{errorMsg}</div>
    {:else if !hasBuilding}
        <div class="brickang-widget__empty">현재 진행 중인 건축물이 없어요</div>
    {:else if building}
        <div class="brickang-widget__progress">
            <ProgressBar
                current={building.current_bricks}
                target={building.target_bricks}
                label={building.name}
            />
        </div>

        {#if recent.length > 0}
            <ul class="brickang-widget__recent" aria-label="최근 벽돌">
                {#each recent as brick (brick.id)}
                    <li class="recent-row" title={brick.message ?? ''}>
                        <span class="recent-row__dot" data-type={brick.brick_type_slug ?? 'normal'}
                        ></span>
                        <span class="recent-row__name">{brick.nickname}</span>
                    </li>
                {/each}
            </ul>
        {/if}

        <a class="brickang-widget__cta" href={ctaHref}>
            벽돌 쌓으러 가기 <span aria-hidden="true">→</span>
        </a>
    {/if}
</section>

<style>
    .brickang-widget {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
        padding: 1rem 1.125rem;
        border: 1px solid #e6e6e6;
        border-radius: 12px;
        background: linear-gradient(180deg, #fffaf3 0%, #fff 60%);
    }
    .brickang-widget__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .brickang-widget__title {
        font-size: 1rem;
        font-weight: 700;
        margin: 0;
        color: #333;
    }
    .brickang-widget__progress {
        margin-top: 0.25rem;
    }
    .brickang-widget__error,
    .brickang-widget__empty {
        font-size: 0.875rem;
        color: #888;
        padding: 0.5rem 0;
    }
    .brickang-widget__recent {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .recent-row {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        background: #fff;
        border: 1px solid #ececec;
        border-radius: 999px;
        font-size: 0.8125rem;
        color: #444;
    }
    .recent-row__dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: #c84c32;
    }
    .recent-row__dot[data-type='diamond'] {
        background: linear-gradient(135deg, #b6e0ff, #ffffff);
    }
    .recent-row__dot[data-type='gold'] {
        background: #ffd700;
    }
    .recent-row__dot[data-type='silver'] {
        background: #c0c0c0;
    }
    .recent-row__dot[data-type='anonymous'] {
        background: #888;
    }
    .recent-row__name {
        font-weight: 500;
    }
    .brickang-widget__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0.875rem;
        background: #c84c32;
        color: #fff;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        transition: background 0.15s ease;
    }
    .brickang-widget__cta:hover {
        background: #a83a26;
    }
    .brickang-widget__skeleton {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
    }
    .skeleton-line {
        height: 0.875rem;
        background: linear-gradient(90deg, #eee, #f6f6f6, #eee);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
        border-radius: 4px;
    }
    .skeleton-line--lg {
        width: 60%;
        height: 1rem;
    }
    .skeleton-bar {
        height: 12px;
        background: linear-gradient(90deg, #eee, #f6f6f6, #eee);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
        border-radius: 6px;
    }
    .skeleton-row {
        display: flex;
        gap: 0.5rem;
    }
    .skeleton-pill {
        width: 4.5rem;
        height: 1.5rem;
        border-radius: 999px;
        background: linear-gradient(90deg, #eee, #f6f6f6, #eee);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }
</style>
