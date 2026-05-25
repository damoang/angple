<script lang="ts">
    import { invalidateAll } from '$app/navigation';

    let { data } = $props();

    let domain = $state('');
    let themeId = $state(data.themes[0]?.id ?? '');
    let siteTitle = $state('');
    let siteDescription = $state('');
    let aliasesInput = $state('');

    let submitting = $state(false);
    let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

    // 인라인 수정 상태
    let editingId = $state<number | null>(null);
    let editDraft = $state<{ themeId: string; siteTitle: string; active: boolean }>({
        themeId: '',
        siteTitle: '',
        active: true
    });
    let busyId = $state<number | null>(null);

    async function createSite(e: Event) {
        e.preventDefault();
        if (submitting) return;
        message = null;
        submitting = true;
        try {
            const aliases = aliasesInput
                .split(/[\s,]+/)
                .map((a) => a.trim())
                .filter(Boolean);
            const res = await fetch('/api/super-admin/sites/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, themeId, siteTitle, siteDescription, aliases })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                message = {
                    type: 'success',
                    text: `사이트 생성 완료: ${result.site.domain} (#${result.site.id}). DNS·리버스프록시가 이 서버를 향하면 즉시 동작합니다.`
                };
                domain = '';
                siteTitle = '';
                siteDescription = '';
                aliasesInput = '';
                await invalidateAll();
            } else {
                message = { type: 'error', text: result.message ?? '사이트 생성 실패' };
            }
        } catch {
            message = { type: 'error', text: '네트워크 오류로 생성에 실패했습니다.' };
        } finally {
            submitting = false;
        }
    }

    function startEdit(s: (typeof data.sites)[number]) {
        editingId = s.id;
        editDraft = { themeId: s.themeId, siteTitle: s.siteTitle, active: s.active };
    }

    function cancelEdit() {
        editingId = null;
    }

    async function saveEdit(id: number) {
        if (busyId) return;
        message = null;
        busyId = id;
        try {
            const res = await fetch(`/api/super-admin/sites/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editDraft)
            });
            const result = await res.json();
            if (res.ok && result.success) {
                editingId = null;
                await invalidateAll();
            } else {
                message = { type: 'error', text: result.message ?? '수정 실패' };
            }
        } catch {
            message = { type: 'error', text: '네트워크 오류로 수정에 실패했습니다.' };
        } finally {
            busyId = null;
        }
    }

    async function deleteSite(s: (typeof data.sites)[number]) {
        if (busyId) return;
        if (!confirm(`정말 삭제하시겠습니까?\n${s.domain} (#${s.id}) — 되돌릴 수 없습니다.`))
            return;
        message = null;
        busyId = s.id;
        try {
            const res = await fetch(`/api/super-admin/sites/${s.id}`, { method: 'DELETE' });
            const result = await res.json();
            if (res.ok && result.success) {
                await invalidateAll();
            } else {
                message = { type: 'error', text: result.message ?? '삭제 실패' };
            }
        } catch {
            message = { type: 'error', text: '네트워크 오류로 삭제에 실패했습니다.' };
        } finally {
            busyId = null;
        }
    }
</script>

<svelte:head><title>사이트 관리 · 최고관리자</title></svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
    <h1 class="mb-1 text-2xl font-bold">멀티사이트 관리</h1>
    <p class="mb-6 text-sm text-gray-500">
        angple core 하나로 운영하는 모든 사이트. 새 사이트를 추가하면 선택한 테마로 즉시
        라이브됩니다 (콘텐츠가 없으면 환영 화면 표시).
    </p>

    {#if message}
        <div
            class="mb-4 rounded-lg px-4 py-3 text-sm {message.type === 'success'
                ? 'border border-green-200 bg-green-50 text-green-800'
                : 'border border-red-200 bg-red-50 text-red-800'}"
        >
            {message.text}
        </div>
    {/if}

    <!-- 신규 사이트 생성 -->
    <section class="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold">새 사이트 만들기</h2>

        <form class="grid gap-4 sm:grid-cols-2" onsubmit={createSite}>
            <label class="flex flex-col gap-1 text-sm">
                <span class="font-medium">도메인 <span class="text-red-500">*</span></span>
                <input
                    type="text"
                    bind:value={domain}
                    required
                    placeholder="example.com"
                    autocomplete="off"
                    class="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            <label class="flex flex-col gap-1 text-sm">
                <span class="font-medium">테마 <span class="text-red-500">*</span></span>
                <select
                    bind:value={themeId}
                    required
                    class="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                    {#each data.themes as t (t.id)}
                        <option value={t.id}>{t.name} ({t.id})</option>
                    {/each}
                </select>
            </label>

            <label class="flex flex-col gap-1 text-sm">
                <span class="font-medium">사이트 제목</span>
                <input
                    type="text"
                    bind:value={siteTitle}
                    placeholder="(선택) 사이트 이름"
                    class="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            <label class="flex flex-col gap-1 text-sm">
                <span class="font-medium">별칭 도메인</span>
                <input
                    type="text"
                    bind:value={aliasesInput}
                    placeholder="(선택) www.example.com, example.net"
                    autocomplete="off"
                    class="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            <label class="flex flex-col gap-1 text-sm sm:col-span-2">
                <span class="font-medium">설명</span>
                <textarea
                    bind:value={siteDescription}
                    rows="2"
                    placeholder="(선택) 사이트 설명 (SEO)"
                    class="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                ></textarea>
            </label>

            <div class="sm:col-span-2">
                <button
                    type="submit"
                    disabled={submitting}
                    class="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {submitting ? '생성 중…' : '사이트 생성'}
                </button>
            </div>
        </form>
    </section>

    <!-- 사이트 목록 -->
    <section>
        <h2 class="mb-3 text-lg font-semibold">등록된 사이트 ({data.sites.length})</h2>
        <div class="overflow-x-auto rounded-xl border border-gray-200">
            <table class="w-full text-left text-sm">
                <thead class="bg-gray-50 text-gray-600">
                    <tr>
                        <th class="px-4 py-2 font-medium">#</th>
                        <th class="px-4 py-2 font-medium">도메인</th>
                        <th class="px-4 py-2 font-medium">테마</th>
                        <th class="px-4 py-2 font-medium">제목</th>
                        <th class="px-4 py-2 font-medium">별칭</th>
                        <th class="px-4 py-2 font-medium">상태</th>
                        <th class="px-4 py-2 text-right font-medium">작업</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    {#each data.sites as s (s.id)}
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-2 text-gray-400">{s.id}</td>
                            <td class="px-4 py-2 font-medium">
                                <a
                                    href="https://{s.domain}/"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="text-blue-600 hover:underline">{s.domain}</a
                                >
                            </td>

                            {#if editingId === s.id}
                                <!-- 편집 모드 -->
                                <td class="px-4 py-2">
                                    <select
                                        bind:value={editDraft.themeId}
                                        class="rounded border border-gray-300 px-2 py-1 text-xs"
                                    >
                                        {#each data.themes as t (t.id)}
                                            <option value={t.id}>{t.id}</option>
                                        {/each}
                                    </select>
                                </td>
                                <td class="px-4 py-2">
                                    <input
                                        type="text"
                                        bind:value={editDraft.siteTitle}
                                        placeholder="제목"
                                        class="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                                    />
                                </td>
                                <td class="px-4 py-2 text-xs text-gray-500">{s.aliases || '—'}</td>
                                <td class="px-4 py-2">
                                    <label class="inline-flex items-center gap-1 text-xs">
                                        <input type="checkbox" bind:checked={editDraft.active} /> 활성
                                    </label>
                                </td>
                                <td class="whitespace-nowrap px-4 py-2 text-right">
                                    <button
                                        onclick={() => saveEdit(s.id)}
                                        disabled={busyId === s.id}
                                        class="rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                                        >{busyId === s.id ? '저장 중…' : '저장'}</button
                                    >
                                    <button
                                        onclick={cancelEdit}
                                        class="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100"
                                        >취소</button
                                    >
                                </td>
                            {:else}
                                <!-- 보기 모드 -->
                                <td class="px-4 py-2"><code class="text-xs">{s.themeId}</code></td>
                                <td class="px-4 py-2 text-gray-600">{s.siteTitle || '—'}</td>
                                <td class="px-4 py-2 text-xs text-gray-500">{s.aliases || '—'}</td>
                                <td class="px-4 py-2">
                                    {#if s.active}
                                        <span
                                            class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700"
                                            >활성</span
                                        >
                                    {:else}
                                        <span
                                            class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                                            >비활성</span
                                        >
                                    {/if}
                                </td>
                                <td class="whitespace-nowrap px-4 py-2 text-right">
                                    <button
                                        onclick={() => startEdit(s)}
                                        disabled={busyId === s.id || editingId !== null}
                                        class="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
                                        >수정</button
                                    >
                                    <button
                                        onclick={() => deleteSite(s)}
                                        disabled={busyId === s.id || editingId !== null}
                                        class="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        >{busyId === s.id ? '삭제 중…' : '삭제'}</button
                                    >
                                </td>
                            {/if}
                        </tr>
                    {:else}
                        <tr
                            ><td colspan="7" class="px-4 py-6 text-center text-gray-400"
                                >등록된 사이트가 없습니다.</td
                            ></tr
                        >
                    {/each}
                </tbody>
            </table>
        </div>
    </section>
</div>
