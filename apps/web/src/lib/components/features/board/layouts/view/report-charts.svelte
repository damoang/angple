<script lang="ts">
    import { onMount } from 'svelte';
    import type { Chart as ChartType } from 'chart.js';

    interface DailyStatEntry {
        reports: number;
        posts: number;
        comments: number;
    }

    interface WeeklyStatEntry {
        posts: number;
        reports: number;
        comments: number;
        processed: number;
    }

    interface BoardStatEntry {
        name: string;
        count: number;
    }

    interface Props {
        dailyStats?: Record<string, DailyStatEntry>;
        // 직전 4주 요일별 평균(일별 트렌드에 신고 평균선 겹치기용). key=요일명.
        dailyAvg4w?: Record<string, { reports: number; posts: number; comments: number }>;
        weeklyStats?: Record<string, WeeklyStatEntry>;
        reportTypes?: Record<string, number>;
        boardStats?: BoardStatEntry[];
        periodDays?: number;
        // ── 일간 리포트 전용 ──
        hourlyStats?: number[]; // 시간대별 활동(0~23시, 24칸)
        groupStats?: BoardStatEntry[]; // 소모임별 활동
        daily?: boolean; // 일간 모드(제목·부제 문구 분기)
    }

    let {
        dailyStats,
        dailyAvg4w,
        weeklyStats,
        reportTypes,
        boardStats,
        periodDays = 1,
        hourlyStats,
        groupStats,
        daily = false
    }: Props = $props();

    let dailyCanvas: HTMLCanvasElement | undefined = $state();
    let weeklyCanvas: HTMLCanvasElement | undefined = $state();
    let typesCanvas: HTMLCanvasElement | undefined = $state();
    let boardCanvas: HTMLCanvasElement | undefined = $state();
    let hourlyCanvas: HTMLCanvasElement | undefined = $state();
    let groupCanvas: HTMLCanvasElement | undefined = $state();

    let charts: ChartType[] = [];

    onMount(() => {
        import('chart.js').then(({ Chart, registerables }) => {
            Chart.register(...registerables);
            const gridColor = 'rgba(156, 163, 175, 0.2)';

            // 일별 활동 트렌드 (line)
            if (dailyCanvas && dailyStats && Object.keys(dailyStats).length > 0) {
                const labels: string[] = [];
                const reports: number[] = [];
                const posts: number[] = [];
                const comments: number[] = [];
                // 직전 4주 요일별 평균(신고). 요일명 배열은 getDay() 0=일..6=토 순.
                const dowNames = ['일', '월', '화', '수', '목', '금', '토'];
                const hasAvg = !!dailyAvg4w && Object.keys(dailyAvg4w).length > 0;
                const avgReports: number[] = [];

                for (const [date, data] of Object.entries(dailyStats)) {
                    const d = new Date(date + 'T00:00:00');
                    labels.push(`${d.getMonth() + 1}월 ${d.getDate()}일`);
                    reports.push(data.reports || 0);
                    posts.push(data.posts || 0);
                    comments.push(data.comments || 0);
                    if (hasAvg) {
                        const av = dailyAvg4w?.[dowNames[d.getDay()]];
                        avgReports.push(av ? Math.round(av.reports) : 0);
                    }
                }

                charts.push(
                    new Chart(dailyCanvas, {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [
                                {
                                    label: '신고 건수',
                                    data: reports,
                                    borderColor: '#ef4444',
                                    backgroundColor: '#ef4444',
                                    pointRadius: 4
                                },
                                {
                                    label: '전체 게시글',
                                    data: posts,
                                    borderColor: '#3b82f6',
                                    backgroundColor: '#3b82f6',
                                    pointRadius: 4
                                },
                                {
                                    label: '전체 댓글',
                                    data: comments,
                                    borderColor: '#10b981',
                                    backgroundColor: '#10b981',
                                    pointRadius: 4
                                },
                                // 신고 4주 평균(점선) — 이번 주 신고가 평소보다 많/적은지 비교용.
                                ...(hasAvg
                                    ? [
                                          {
                                              label: '신고 4주 평균',
                                              data: avgReports,
                                              borderColor: '#ef4444',
                                              backgroundColor: 'transparent',
                                              borderDash: [5, 5],
                                              borderWidth: 1.5,
                                              pointRadius: 0
                                          }
                                      ]
                                    : [])
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { beginAtZero: true, grid: { color: gridColor } },
                                x: { grid: { display: false } }
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    align: 'start',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 20,
                                        boxWidth: 6,
                                        boxHeight: 6
                                    }
                                }
                            }
                        }
                    })
                );
            }

            // 요일별 활동 현황 (bar)
            if (weeklyCanvas && weeklyStats && Object.keys(weeklyStats).length > 0) {
                const dayMap: Record<string, number> = {
                    일: 0,
                    월: 1,
                    화: 2,
                    수: 3,
                    목: 4,
                    금: 5,
                    토: 6
                };
                const wp = [0, 0, 0, 0, 0, 0, 0];
                const wc = [0, 0, 0, 0, 0, 0, 0];
                const wr = [0, 0, 0, 0, 0, 0, 0];
                const wprc = [0, 0, 0, 0, 0, 0, 0];

                for (const [day, data] of Object.entries(weeklyStats)) {
                    const idx = dayMap[day];
                    if (idx !== undefined) {
                        wp[idx] = data.posts || 0;
                        wc[idx] = data.comments || 0;
                        wr[idx] = data.reports || 0;
                        wprc[idx] = data.processed || 0;
                    }
                }

                charts.push(
                    new Chart(weeklyCanvas, {
                        type: 'bar',
                        data: {
                            labels: ['일', '월', '화', '수', '목', '금', '토'],
                            datasets: [
                                { label: '전체글', data: wp, backgroundColor: '#3b82f6' },
                                { label: '전체댓글', data: wc, backgroundColor: '#10b981' },
                                { label: '신고수', data: wr, backgroundColor: '#ef4444' },
                                { label: '처리수', data: wprc, backgroundColor: '#8b5cf6' }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { beginAtZero: true, grid: { color: gridColor } },
                                x: { grid: { display: false } }
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    align: 'start',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 20,
                                        boxWidth: 6,
                                        boxHeight: 6
                                    }
                                }
                            }
                        }
                    })
                );
            }

            // 신고 사유 분포 (doughnut)
            if (typesCanvas && reportTypes && Object.keys(reportTypes).length > 0) {
                charts.push(
                    new Chart(typesCanvas, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(reportTypes),
                            datasets: [
                                {
                                    data: Object.values(reportTypes),
                                    backgroundColor: [
                                        '#ef4444',
                                        '#10b981',
                                        '#3b82f6',
                                        '#f59e0b',
                                        '#8b5cf6',
                                        '#ec4899',
                                        '#6b7280',
                                        '#14b8a6',
                                        '#f97316'
                                    ],
                                    borderWidth: 0
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'right',
                                    align: 'start',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 20,
                                        boxWidth: 6,
                                        boxHeight: 6
                                    }
                                }
                            }
                        }
                    })
                );
            }

            // 게시판별 현황 (horizontal bar)
            if (boardCanvas && boardStats && boardStats.length > 0) {
                charts.push(
                    new Chart(boardCanvas, {
                        type: 'bar',
                        data: {
                            labels: boardStats.map((b) => b.name || '게시판'),
                            datasets: [
                                {
                                    label: '신고 건수',
                                    data: boardStats.map((b) => b.count || 0),
                                    backgroundColor: '#ef4444'
                                }
                            ]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { beginAtZero: true, grid: { color: gridColor } },
                                y: { grid: { display: false } }
                            },
                            plugins: { legend: { display: false } }
                        }
                    })
                );
            }

            // 시간대별 활동 (bar) — 일간 리포트 전용
            if (hourlyCanvas && hourlyStats && hourlyStats.length > 0) {
                charts.push(
                    new Chart(hourlyCanvas, {
                        type: 'bar',
                        data: {
                            labels: hourlyStats.map((_, h) => `${h}시`),
                            datasets: [
                                {
                                    label: '글·댓글',
                                    data: hourlyStats,
                                    backgroundColor: '#3b82f6'
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
                                y: { beginAtZero: true, grid: { color: gridColor } }
                            },
                            plugins: { legend: { display: false } }
                        }
                    })
                );
            }

            // 소모임별 활동 (horizontal bar) — 일간 리포트 전용
            if (groupCanvas && groupStats && groupStats.length > 0) {
                charts.push(
                    new Chart(groupCanvas, {
                        type: 'bar',
                        data: {
                            labels: groupStats.map((g) => g.name || '소모임'),
                            datasets: [
                                {
                                    label: '글·댓글',
                                    data: groupStats.map((g) => g.count || 0),
                                    backgroundColor: '#10b981'
                                }
                            ]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { beginAtZero: true, grid: { color: gridColor } },
                                y: { grid: { display: false } }
                            },
                            plugins: { legend: { display: false } }
                        }
                    })
                );
            }
        });

        return () => {
            charts.forEach((c) => c.destroy());
        };
    });
</script>

<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
    {#if dailyStats && Object.keys(dailyStats).length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">
                    {daily ? '최근 7일 추이' : '일별 활동 트렌드'}
                </h3>
                <p class="text-muted-foreground text-xs">
                    {daily
                        ? '신고/글/댓글 — 오늘 포함 7일'
                        : `선택 기간 신고/게시글/댓글 현황 (${periodDays}일간)`}
                </p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={dailyCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if weeklyStats && Object.keys(weeklyStats).length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">요일별 활동 현황</h3>
                <p class="text-muted-foreground text-xs">글/댓글/신고/처리 활동 분석</p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={weeklyCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if reportTypes && Object.keys(reportTypes).length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">신고 사유 분포</h3>
                <p class="text-muted-foreground text-xs">주요 신고 유형별 비율</p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={typesCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if hourlyStats && hourlyStats.length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">시간대별 활동</h3>
                <p class="text-muted-foreground text-xs">0시~23시 글·댓글 작성량</p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={hourlyCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if groupStats && groupStats.length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">소모임 활동</h3>
                <p class="text-muted-foreground text-xs">소모임별 글·댓글 활동</p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={groupCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if boardStats && boardStats.length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">게시판별 현황</h3>
                <p class="text-muted-foreground text-xs">
                    {daily ? '게시판별 글·댓글 활동' : '게시판별 신고 건수'}
                </p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={boardCanvas}></canvas>
            </div>
        </div>
    {/if}
</div>
