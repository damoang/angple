<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
    let status = $state('페이지 로딩 중...');
    let showManualButton = $state(false);
    let errorDetail = $state('');

    onMount(() => {
        // mid 값 검증
        if (!data.mid) {
            status = '오류: 상점 ID가 설정되지 않았습니다.';
            errorDetail = 'KG이니시스 MID가 비어있습니다. 관리자에게 문의하세요.';
            showManualButton = false;
            return;
        }

        status = '인증 페이지로 이동 중...';
        const form = document.getElementById('saForm') as HTMLFormElement;

        if (form) {
            try {
                form.submit();
            } catch (err) {
                console.error('[Cert] Submit error:', err);
                status = '폼 제출 오류가 발생했습니다.';
                errorDetail = err instanceof Error ? err.message : String(err);
                showManualButton = true;
            }
        } else {
            status = '오류: 폼을 찾을 수 없습니다.';
            showManualButton = true;
        }

        // 10초 후에도 페이지에 있으면 수동 버튼 표시
        setTimeout(() => {
            showManualButton = true;
        }, 10000);
    });

    function manualSubmit() {
        const form = document.getElementById('saForm') as HTMLFormElement;
        if (form) {
            form.submit();
        }
    }
</script>

<svelte:head>
    <title>KG이니시스 간편인증</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <p class="text-muted-foreground text-sm">{status}</p>
    {#if errorDetail}
        <p class="max-w-md text-center text-xs text-red-500">{errorDetail}</p>
    {/if}
    {#if showManualButton && data.mid}
        <button
            onclick={manualSubmit}
            class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
        >
            인증 페이지로 직접 이동
        </button>
        <p class="text-muted-foreground text-xs">자동 이동이 안 되면 위 버튼을 클릭하세요.</p>
    {/if}
</div>

<form id="saForm" method="post" action="https://sa.inicis.com/auth">
    <input type="hidden" name="mid" value={data.mid} />
    <input type="hidden" name="reqSvcCd" value={data.reqSvcCd} />
    <input type="hidden" name="mTxId" value={data.mTxId} />
    <input type="hidden" name="authHash" value={data.authHash} />
    <input type="hidden" name="flgFixedUser" value="N" />
    <input type="hidden" name="userName" value="" />
    <input type="hidden" name="userPhone" value="" />
    <input type="hidden" name="userBirth" value="" />
    <input type="hidden" name="userHash" value="" />
    <input type="hidden" name="reservedMsg" value={data.reservedMsg} />
    <input type="hidden" name="mbId" value={data.mbId} />
    <input type="hidden" name="directAgency" value="" />
    <input type="hidden" name="successUrl" value={data.successUrl} />
    <input type="hidden" name="failUrl" value={data.failUrl} />
</form>
