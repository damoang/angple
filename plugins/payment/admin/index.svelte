<script lang="ts">
    import { onMount } from 'svelte';

    type ProviderRow = {
        provider: 'toss' | 'naver' | 'paypal';
        sandbox: boolean;
        active: boolean;
        hasCredentials: boolean;
    };

    let rows = $state<ProviderRow[]>([]);
    let loading = $state(true);
    let loadError = $state<string | null>(null);

    onMount(async () => {
        try {
            const res = await fetch('/api/plugins/payment/admin/providers');
            if (!res.ok) {
                loadError = `상태 조회 실패 (HTTP ${res.status})`;
                return;
            }
            rows = (await res.json()) as ProviderRow[];
        } catch (err) {
            loadError = (err as Error).message;
        } finally {
            loading = false;
        }
    });
</script>

<div class="payment-admin">
    <h1>결제 관리</h1>
    <p class="hint">사이트별 PG 키와 활성 여부를 관리합니다.</p>

    {#if loading}
        <div class="loading">로딩 중…</div>
    {:else if loadError}
        <div class="error">{loadError}</div>
    {:else}
        <table>
            <thead>
                <tr>
                    <th>PG</th>
                    <th>모드</th>
                    <th>활성</th>
                    <th>키 등록</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {#each rows as row (row.provider)}
                    <tr>
                        <td>{row.provider}</td>
                        <td>{row.sandbox ? 'Sandbox' : 'Production'}</td>
                        <td>{row.active ? '✓' : '–'}</td>
                        <td>{row.hasCredentials ? '✓' : '–'}</td>
                        <td><a href="/admin/plugins/payment/{row.provider}">설정</a></td>
                    </tr>
                {/each}
            </tbody>
        </table>
        <p class="todo">
            상세 키 입력 / 거래 조회 / 환불 기능은 후속 PR에서 추가됩니다.
        </p>
    {/if}
</div>

<style>
    .payment-admin {
        padding: 1rem;
    }
    .hint {
        color: #666;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
    }
    th,
    td {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #eee;
        text-align: left;
    }
    .error {
        color: #c33;
        background: #fee;
        padding: 0.75rem;
        border-radius: 4px;
    }
    .todo {
        color: #888;
        font-size: 0.9rem;
        margin-top: 1rem;
    }
</style>
