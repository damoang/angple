<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';
    import { authStore } from '$lib/stores/auth.svelte';

    interface Attendee {
        id: number; mb_id: string; nickname: string; att_rank: string;
        subject: string; day: number; point: number; datetime: string;
    }
    interface RankingEntry {
        mb_id: string; nickname: string; total_days: number;
        total_points: number; max_streak: number;
    }

    let todayList = $state<Attendee[]>([]);
    let ranking = $state<RankingEntry[]>([]);
    let checkedToday = $state(false);
    let myStats = $state<{ total_days: number; total_points: number; max_streak: number } | null>(null);
    let isChecking = $state(false);
    let checkResult = $state<string | null>(null);
    let greeting = $state('');
    let selectedTab = $state<'today' | 'ranking' | 'calendar'>('today');

    // 달력
    const now = new Date();
    let calYear = $state(now.getFullYear());
    let calMonth = $state(now.getMonth() + 1);
    let selectedDate = $state<string | null>(null);
    let selectedDateAttendees = $state<Attendee[]>([]);
    let monthAttendedDates = $state<Set<string>>(new Set());

    function authHeaders(): Record<string, string> {
        if (!browser) return {};
        try { const t = localStorage.getItem('access_token'); return t ? { 'Authorization': `Bearer ${t}` } : {}; }
        catch { return {}; }
    }

    async function loadToday() {
        try { const r = await fetch('/api/attendance/today'); const d = await r.json(); if (d.success) todayList = d.data.attendees; } catch {}
    }
    async function loadMy() {
        try { const r = await fetch('/api/attendance/my', { headers: authHeaders() }); const d = await r.json();
            if (d.success) { checkedToday = d.data.checked_today; myStats = d.data.stats; }
        } catch {}
    }
    async function loadRanking() {
        try { const r = await fetch('/api/attendance/ranking?limit=20'); const d = await r.json(); if (d.success) ranking = d.data.ranking; } catch {}
    }
    async function loadMonthAttendance() {
        // 해당 월의 모든 출석 날짜 로드 (전체 사용자)
        try {
            const dates = new Set<string>();
            // 1일부터 마지막일까지 체크 — 더 효율적으로 today API 패턴 활용
            const r = await fetch(`/api/attendance/date?date=${calYear}-${String(calMonth).padStart(2,'0')}-01&month=true`);
            const d = await r.json();
            if (d.success) {
                for (const a of d.data.attendees) {
                    const dt = new Date(a.datetime).toISOString().slice(0, 10);
                    dates.add(dt);
                }
            }
            monthAttendedDates = dates;
        } catch {}
    }
    async function selectDate(day: number) {
        const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        selectedDate = dateStr;
        try {
            const r = await fetch(`/api/attendance/date?date=${dateStr}`);
            const d = await r.json();
            selectedDateAttendees = d.success ? d.data.attendees : [];
        } catch { selectedDateAttendees = []; }
    }
    async function checkIn() {
        if (isChecking || checkedToday) return;
        isChecking = true; checkResult = null;
        try {
            const r = await fetch('/api/attendance/check-in', {
                method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: greeting || undefined })
            });
            const d = await r.json();
            if (d.success) {
                checkResult = `🎉 ${d.data.day}일차 출석! +${d.data.point}P${d.data.rank <= 3 ? ` (${d.data.rank}등!)` : ''}${d.data.bonus ? ` ${d.data.bonus}` : ''}`;
                checkedToday = true; loadToday(); loadMy();
            } else { checkResult = `❌ ${d.error}`; }
        } catch { checkResult = '❌ 오류 발생'; }
        finally { isChecking = false; }
    }

    function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
    function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }

    $effect(() => { loadToday(); loadRanking(); if (authStore.isAuthenticated) loadMy(); });
    $effect(() => { if (selectedTab === 'calendar') loadMonthAttendance(); });
</script>

<div class="container mx-auto px-4 py-6">
    <!-- 헤더 + 내 통계 (React Card 스타일) -->
    <div class="mx-auto max-w-2xl">
        <h1 class="mb-6 text-2xl font-bold">📅 출석부</h1>

        {#if authStore.isAuthenticated && myStats}
            <div class="mb-6 overflow-hidden rounded-lg border bg-card shadow-sm">
                <div class="bg-gradient-to-r from-indigo-500 to-violet-500 p-4 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm opacity-80">나의 출석 현황</p>
                            <p class="text-2xl font-bold">{myStats.total_days || 0}일</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm opacity-80">획득 포인트</p>
                            <p class="text-2xl font-bold">{(myStats.total_points || 0).toLocaleString()}P</p>
                        </div>
                    </div>
                    <div class="mt-2 text-xs opacity-70">최장 연속 {myStats.max_streak || 0}일</div>
                </div>
            </div>
        {/if}

        <!-- 출석 체크인 (React Card 스타일) -->
        {#if authStore.isAuthenticated}
            <div class="mb-6 overflow-hidden rounded-lg border bg-card p-6 shadow-sm">
                {#if checkedToday}
                    <div class="text-center">
                        <div class="mb-2 text-5xl">✅</div>
                        <p class="text-lg font-medium">오늘 출석 완료!</p>
                    </div>
                {:else}
                    <div class="space-y-3">
                        <input type="text" bind:value={greeting} placeholder="출석 인사말을 입력하세요 (선택)"
                            class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                        <Button class="w-full bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-white" onclick={checkIn} disabled={isChecking}>
                            {isChecking ? '출석 중...' : '🙋 출석하기'}
                        </Button>
                    </div>
                {/if}
                {#if checkResult}
                    <p class="mt-3 text-center text-sm font-medium">{checkResult}</p>
                {/if}
            </div>
        {:else}
            <div class="mb-6 overflow-hidden rounded-lg border bg-card p-6 text-center shadow-sm">
                <p class="mb-3 text-muted-foreground">출석하려면 로그인이 필요합니다</p>
                <a href="/login"><Button class="bg-gradient-to-r from-indigo-500 to-violet-500 text-white">로그인</Button></a>
            </div>
        {/if}

        <!-- 탭 (React TabsList 스타일) -->
        <div class="mb-6 flex justify-center">
            <div class="grid w-full max-w-sm grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {#each [['today', '오늘 출석'], ['ranking', '🏆 랭킹'], ['calendar', '📆 달력']] as [id, label]}
                    <button class="rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors
                        {selectedTab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                        onclick={() => selectedTab = id as any}>{label}</button>
                {/each}
            </div>
        </div>

        <!-- 오늘 출석 -->
        {#if selectedTab === 'today'}
            <div class="overflow-hidden rounded-lg border bg-card shadow-sm">
                <div class="border-b p-4"><h3 class="font-semibold">오늘 출석자 ({todayList.length}명)</h3></div>
                <div class="divide-y">
                    {#each todayList as att, i}
                        <div class="flex items-center justify-between px-4 py-3">
                            <div class="flex items-center gap-3">
                                <span class="w-8 text-center font-bold {i < 3 ? 'text-lg' : 'text-sm text-muted-foreground'}">
                                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`}
                                </span>
                                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 text-xs font-medium text-indigo-700">
                                    {(att.nickname || att.mb_id)?.[0]}
                                </div>
                                <div>
                                    <span class="text-sm font-medium">{att.nickname || att.mb_id}</span>
                                    <span class="ml-2 text-xs text-muted-foreground">{att.day}일차</span>
                                    {#if att.subject}<p class="text-xs text-muted-foreground line-clamp-1">{att.subject}</p>{/if}
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-sm font-bold text-primary">+{att.point}P</span>
                                <div class="text-xs text-muted-foreground">{new Date(att.datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                    {:else}
                        <div class="p-8 text-center text-muted-foreground">아직 출석자가 없습니다. 첫 번째로 출석해보세요! 🎉</div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- 랭킹 -->
        {#if selectedTab === 'ranking'}
            <div class="overflow-hidden rounded-lg border bg-card shadow-sm">
                <div class="border-b p-4"><h3 class="font-semibold">🏆 출석 랭킹 (누적 포인트)</h3></div>
                <div class="divide-y">
                    {#each ranking as r, i}
                        <div class="flex items-center justify-between px-4 py-3">
                            <div class="flex items-center gap-3">
                                <span class="w-8 text-center font-bold {i < 3 ? 'text-lg' : 'text-sm text-muted-foreground'}">
                                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`}
                                </span>
                                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 text-xs font-medium text-indigo-700">
                                    {(r.nickname || r.mb_id)?.[0]}
                                </div>
                                <div>
                                    <span class="text-sm font-medium">{r.nickname || r.mb_id}</span>
                                    <span class="ml-2 text-xs text-muted-foreground">{r.total_days}일 출석</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-sm font-bold text-primary">{Number(r.total_points).toLocaleString()}P</span>
                                <div class="text-xs text-muted-foreground">최장 {r.max_streak}일</div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- 달력 -->
        {#if selectedTab === 'calendar'}
            <div class="overflow-hidden rounded-lg border bg-card shadow-sm">
                <div class="flex items-center justify-between border-b p-4">
                    <button class="rounded p-2 hover:bg-accent" onclick={() => { calMonth--; if (calMonth < 1) { calMonth = 12; calYear--; } selectedDate = null; }}>◀</button>
                    <h3 class="text-lg font-semibold">{calYear}년 {calMonth}월</h3>
                    <button class="rounded p-2 hover:bg-accent" onclick={() => { calMonth++; if (calMonth > 12) { calMonth = 1; calYear++; } selectedDate = null; }}>▶</button>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-7 gap-1 text-center">
                        {#each ['일', '월', '화', '수', '목', '금', '토'] as dow, i}
                            <div class="py-2 text-xs font-medium {i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-muted-foreground'}">{dow}</div>
                        {/each}
                        {#each Array(getFirstDayOfWeek(calYear, calMonth)) as _}<div></div>{/each}
                        {#each Array(getDaysInMonth(calYear, calMonth)) as _, d}
                            {@const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`}
                            {@const isToday = dateStr === new Date().toISOString().slice(0,10)}
                            <button
                                class="relative flex h-12 flex-col items-center justify-center rounded-lg text-sm transition-all
                                    {selectedDate === dateStr ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md' : ''}
                                    {isToday && selectedDate !== dateStr ? 'ring-2 ring-pink-300' : ''}
                                    {!selectedDate || selectedDate !== dateStr ? 'hover:bg-accent' : ''}"
                                onclick={() => selectDate(d + 1)}
                            >
                                {d + 1}
                                {#if monthAttendedDates.has(dateStr)}
                                    <span class="absolute bottom-0.5 text-[7px]">🟢</span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- 선택된 날짜 출석자 -->
                {#if selectedDate}
                    <div class="border-t p-4">
                        <h4 class="mb-3 font-semibold">{selectedDate} 출석자 ({selectedDateAttendees.length}명)</h4>
                        {#if selectedDateAttendees.length > 0}
                            <div class="divide-y rounded-lg border">
                                {#each selectedDateAttendees as att, i}
                                    <div class="flex items-center justify-between px-3 py-2">
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm">{i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`}</span>
                                            <span class="text-sm font-medium">{att.nickname || att.mb_id}</span>
                                            <span class="text-xs text-muted-foreground">{att.day}일차</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-medium text-primary">+{att.point}P</span>
                                            <span class="text-xs text-muted-foreground">{new Date(att.datetime).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-center text-sm text-muted-foreground">이 날은 출석자가 없습니다</p>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
