<script lang="ts">
    import LoginForm from '$lib/components/admin/auth/login-form.svelte';

    /**
     * 관리자 로그인 페이지
     * 별도 사이트처럼 독립적인 전체 화면 로그인
     */
</script>

<svelte:head>
    <title>Angple Admin - 로그인</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-3xl">
        <LoginForm />
    </div>
</div>
