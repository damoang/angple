<!--
  KG이니시스 실명인증 요청 팝업 페이지
  PHP ini_request.php 대응
  서버에서 받은 파라미터로 KG이니시스에 폼 자동 제출
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
    let formRef: HTMLFormElement | undefined = $state();

    onMount(() => {
        // PHP와 동일하게 폼 자동 제출
        if (formRef) {
            formRef.submit();
        }
    });
</script>

<svelte:head>
    <title>KG이니시스 간편인증</title>
</svelte:head>

<form bind:this={formRef} name="saForm" method="post" action={data.params.actionUrl}>
    <input type="hidden" name="mid" value={data.params.mid} />
    <input type="hidden" name="reqSvcCd" value={data.params.reqSvcCd} />
    <input type="hidden" name="mTxId" value={data.params.mTxId} />
    <input type="hidden" name="authHash" value={data.params.authHash} />
    <input type="hidden" name="flgFixedUser" value={data.params.flgFixedUser} />
    <input type="hidden" name="userName" value="" />
    <input type="hidden" name="userPhone" value="" />
    <input type="hidden" name="userBirth" value="" />
    <input type="hidden" name="userHash" value="" />
    <input type="hidden" name="reservedMsg" value={data.params.reservedMsg} />
    <input type="hidden" name="mbId" value="" />
    <input type="hidden" name="directAgency" value="" />
    <input type="hidden" name="successUrl" value={data.params.successUrl} />
    <input type="hidden" name="failUrl" value={data.params.failUrl} />
</form>

<div style="display:flex;align-items:center;justify-content:center;height:100vh;">
    <p>인증 페이지로 이동 중...</p>
</div>
