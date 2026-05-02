<!--
  MyBricks.svelte — 내가 놓은 벽돌 목록.
  - placed_at desc 정렬
  - 등급 색상 표시 (BrickType.color_hex 매칭)
  - 본인은 익명 brick 의 message 도 볼 수 있음 (어뷰징 추적용 — bricks API 가 그렇게 응답)
  - Svelte 5 Rune 모드
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { brickangApi, type BrickDto, type BrickTypeDto } from '../lib/api.js';

    interface Props {
        userId: number;
    }
    // userId 는 표시 / 디버깅용. 실제 필터링은 서버 세션 기반.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let { userId }: Props = $props();

    let bricks = $state<BrickDto[]>([]);
    let brickTypes = $state<BrickTypeDto[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    const typeMap = $derived.by(() => {
        const m = new Map<string, BrickTypeDto>();
        for (const t of brickTypes) m.set(t.slug, t);
        return m;
    });

    onMount(async () => {
        try {
            const [bricksRes, typesRes] = await Promise.all([
                brickangApi.getMyBricks({ limit: 200 }),
                brickangApi.listBrickTypes()
            ]);
            bricks = bricksRes.bricks;
            brickTypes = typesRes.brick_types;
        } catch (err) {
            error = err instanceof Error ? err.message : '불러오기 실패';
        } finally {
            loading = false;
        }
    });

    function fmtDate(s: string | Date): string {
        try {
            const d = typeof s === 'string' ? new Date(s) : s;
            return d.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return String(s);
        }
    }
</script>

<section class="my-bricks">
    <h2 class="my-bricks__title">내가 놓은 벽돌</h2>

    {#if loading}
        <p class="my-bricks__empty">불러오는 중…</p>
    {:else if error}
        <p class="my-bricks__error">에러: {error}</p>
    {:else if bricks.length === 0}
        <p class="my-bricks__empty">아직 놓은 벽돌이 없습니다.</p>
    {:else}
        <p class="my-bricks__count">총 {bricks.length}장</p>
        <div class="my-bricks__table-wrap">
            <table class="my-bricks__table">
                <thead>
                    <tr>
                        <th>일시</th>
                        <th>등급</th>
                        <th>건축물</th>
                        <th>닉네임</th>
                        <th>메시지</th>
                    </tr>
                </thead>
                <tbody>
                    {#each bricks as b (b.id)}
                        {@const t = typeMap.get(b.brick_type_slug)}
                        <tr>
                            <td class="my-bricks__date">{fmtDate(b.placed_at)}</td>
                            <td>
                                <span
                                    class="my-bricks__chip"
                                    style="background-color: {b.color ?? t?.color_hex ?? '#9CA3AF'}"
                                    title={t?.name ?? b.brick_type_slug}
                                >
                                    {t?.name ?? b.brick_type_slug}
                                </span>
                            </td>
                            <td>#{b.building_id ?? '-'}</td>
                            <td>{b.nickname}</td>
                            <td class="my-bricks__msg">{b.message ?? ''}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</section>

<style>
    .my-bricks {
        max-width: 960px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
    }
    .my-bricks__title {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 1rem;
    }
    .my-bricks__count {
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 0.5rem;
    }
    .my-bricks__empty,
    .my-bricks__error {
        padding: 1.5rem;
        text-align: center;
        color: #6b7280;
    }
    .my-bricks__error {
        color: #dc2626;
    }
    .my-bricks__table-wrap {
        overflow-x: auto;
    }
    .my-bricks__table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
    }
    .my-bricks__table th,
    .my-bricks__table td {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
        vertical-align: top;
    }
    .my-bricks__table th {
        font-weight: 600;
        background-color: #f9fafb;
        color: #374151;
    }
    .my-bricks__date {
        white-space: nowrap;
        color: #6b7280;
    }
    .my-bricks__chip {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        color: #fff;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .my-bricks__msg {
        max-width: 360px;
        white-space: pre-wrap;
        word-break: break-word;
    }
</style>
