<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Contact Section Component
     *
     * sdkcorp 디자인을 Svelte로 변환
     * - 다크 테마 폼
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

<!-- sdkcorp Contact Section 디자인 -->
<section class="bg-gradient-to-tl from-zinc-900/0 via-zinc-900 to-zinc-900/0 px-4 py-20">
    <div class="container mx-auto max-w-4xl">
        <!-- Header -->
        <div class="mb-16 text-center">
            <h2 class="mb-4 text-5xl font-bold text-white">문의하기</h2>
            <p class="mx-auto max-w-3xl text-xl text-zinc-400">
                프로젝트에 대해 문의하시거나 협업을 제안해주세요
            </p>
        </div>

        <div class="grid gap-8 md:grid-cols-2">
            <!-- Contact Form -->
            <div
                class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80"
            >
                <form onsubmit={handleSubmit} class="space-y-6">
                    <div>
                        <label for="name" class="mb-2 block font-semibold text-white"
                            >이름</label
                        >
                        <input
                            type="text"
                            id="name"
                            bind:value={name}
                            required
                            class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="홍길동"
                        />
                    </div>

                    <div>
                        <label for="email" class="mb-2 block font-semibold text-white"
                            >이메일</label
                        >
                        <input
                            type="email"
                            id="email"
                            bind:value={email}
                            required
                            class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="your@email.com"
                        />
                    </div>

                    <div>
                        <label for="message" class="mb-2 block font-semibold text-white"
                            >메시지</label
                        >
                        <textarea
                            id="message"
                            bind:value={message}
                            required
                            rows="5"
                            class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="문의 내용을 입력해주세요"
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        class="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-all duration-300 hover:bg-blue-500"
                    >
                        전송하기
                    </button>
                </form>
            </div>

            <!-- Contact Info -->
            <div class="space-y-8">
                <div
                    class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80"
                >
                    <h3 class="mb-4 text-2xl font-bold text-white">연락처 정보</h3>
                    <div class="space-y-4">
                        <div class="flex items-start">
                            <svg
                                class="mr-4 mt-1 h-6 w-6 text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                            </svg>
                            <div>
                                <p class="font-semibold text-white">이메일</p>
                                <p class="text-zinc-400">contact@example.com</p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <svg
                                class="mr-4 mt-1 h-6 w-6 text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                            </svg>
                            <div>
                                <p class="font-semibold text-white">전화</p>
                                <p class="text-zinc-400">+82-10-1234-5678</p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <svg
                                class="mr-4 mt-1 h-6 w-6 text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                            </svg>
                            <div>
                                <p class="font-semibold text-white">주소</p>
                                <p class="text-zinc-400">서울특별시 강남구</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80"
                >
                    <h3 class="mb-4 text-2xl font-bold text-white">소셜 미디어</h3>
                    <div class="flex gap-4">
                        <a
                            href="#"
                            class="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white"
                        >
                            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                <path
                                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                                />
                            </svg>
                        </a>
                        <a
                            href="#"
                            class="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white"
                        >
                            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                <path
                                    d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"
                                />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
