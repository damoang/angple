<script lang="ts">
    import LoginForm from '$lib/components/admin/auth/login-form.svelte';
</script>

<svelte:head>
    <title>Angple Admin - 로그인</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-3xl">
        <LoginForm />
    </div>
</div>
