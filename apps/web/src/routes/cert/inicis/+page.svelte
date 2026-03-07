<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    onMount(() => {
        // 페이지 로드 시 자동으로 이니시스로 POST
        const form = document.getElementById('saForm') as HTMLFormElement;
        if (form) {
            form.submit();
        }
    });
</script>

<svelte:head>
    <title>KG이니시스 간편인증</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
    <p class="text-muted-foreground text-sm">인증 페이지로 이동 중...</p>
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
