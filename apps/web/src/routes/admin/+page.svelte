<script lang="ts">
    import AdminLoginForm from '$lib/components/admin/auth/login-form.svelte';
    import { browser } from '$app/environment';

    let { data } = $props();

    let checking = $state(true);

    $effect(() => {
        if (!browser) return;

        if (data.isAdmin) {
            window.location.href = '/admin/dashboard';
            return;
        }

        checking = false;
    });
</script>

{#if !checking && !data.isAdmin}
    <div class="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div class="w-full max-w-sm md:max-w-3xl">
            <AdminLoginForm />
        </div>
    </div>
{:else}
    <div class="bg-muted flex min-h-svh items-center justify-center">
        <p class="text-muted-foreground text-sm">인증 확인 중...</p>
    </div>
{/if}
