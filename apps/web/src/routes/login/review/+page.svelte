<script lang="ts">
    import { enhance } from '$app/forms';
    import type { ActionData } from './$types';

    let { form }: { form: ActionData } = $props();
    let submitting = $state(false);
</script>

<svelte:head>
    <title>심사 전용 로그인</title>
    <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="review-login">
    <h1>심사 전용 로그인</h1>
    <p class="desc">결제형 입점 심사용 임시 로그인 페이지입니다.</p>

    {#if form?.message}
        <p class="error" role="alert">{form.message}</p>
    {/if}

    <form
        method="POST"
        use:enhance={() => {
            submitting = true;
            return async ({ update }) => {
                await update();
                submitting = false;
            };
        }}
    >
        <label>
            아이디
            <input name="username" type="text" autocomplete="username" required />
        </label>
        <label>
            비밀번호
            <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit" disabled={submitting}>
            {submitting ? '로그인 중…' : '로그인'}
        </button>
    </form>
</main>

<style>
    .review-login {
        max-width: 22rem;
        margin: 4rem auto;
        padding: 0 1rem;
        font-family: system-ui, sans-serif;
    }
    h1 {
        font-size: 1.25rem;
        margin-bottom: 0.25rem;
    }
    .desc {
        color: #666;
        font-size: 0.875rem;
        margin-bottom: 1.5rem;
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.875rem;
    }
    input {
        padding: 0.6rem;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 1rem;
    }
    button {
        padding: 0.7rem;
        border: 0;
        border-radius: 6px;
        background: #03c75a;
        color: #fff;
        font-size: 1rem;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.6;
        cursor: default;
    }
    .error {
        background: #fdecea;
        border: 1px solid #f5c2c0;
        color: #c0392b;
        padding: 0.6rem 0.8rem;
        border-radius: 6px;
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }
</style>
