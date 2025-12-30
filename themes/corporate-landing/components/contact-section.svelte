<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Contact Section Component
     *
     * 문의하기 섹션
     * - 문의 폼
     * - 연락처 정보
     * - 이메일 전송 (향후)
     */

    onMount(() => {
        console.log('📧 Contact Section 마운트됨');
    });

    let name = $state('');
    let email = $state('');
    let message = $state('');

    function handleSubmit(e: Event) {
        e.preventDefault();
        console.log('문의 제출:', { name, email, message });

        // TODO: Phase 6에서 API 연동
        alert('문의가 제출되었습니다!');

        // Reset form
        name = '';
        email = '';
        message = '';
    }
</script>

<!--
    TODO: Phase 2에서 구현
    - sdkcorp의 Contact 디자인 변환
    - 폼 검증
    - 스타일링
 -->
<section class="px-4 py-24">
    <div class="container mx-auto max-w-2xl">
        <h2 class="mb-12 text-center text-4xl font-bold">Contact Us</h2>

        <form onsubmit={handleSubmit} class="rounded-xl bg-white p-8 shadow-lg">
            <div class="mb-6">
                <label for="name" class="mb-2 block font-semibold">이름</label>
                <input
                    type="text"
                    id="name"
                    bind:value={name}
                    required
                    class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                />
            </div>

            <div class="mb-6">
                <label for="email" class="mb-2 block font-semibold">이메일</label>
                <input
                    type="email"
                    id="email"
                    bind:value={email}
                    required
                    class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                />
            </div>

            <div class="mb-6">
                <label for="message" class="mb-2 block font-semibold">메시지</label>
                <textarea
                    id="message"
                    bind:value={message}
                    required
                    rows="5"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                ></textarea>
            </div>

            <button
                type="submit"
                class="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
                전송하기
            </button>
        </form>
    </div>
</section>
