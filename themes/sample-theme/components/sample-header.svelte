<script lang="ts">
    /**
     * Sample Theme - 커스텀 Header
     * 기본 Header와 완전히 다른 디자인
     */
</script>

<header class="bg-blue-600 text-white shadow-md">
    <div class="container mx-auto flex h-16 items-center justify-between px-4">
        <div class="flex items-center gap-4">
            <h1 class="text-2xl font-bold">Sample Theme</h1>
            <span class="rounded-full bg-blue-500 px-3 py-1 text-xs font-medium">Beta</span>
        </div>

        <nav class="hidden space-x-6 md:flex">
            <a href="/" class="transition-colors hover:text-blue-200">홈</a>
            <a href="/free" class="transition-colors hover:text-blue-200">자유게시판</a>
            <a href="/about" class="transition-colors hover:text-blue-200">소개</a>
        </nav>

        <div class="flex items-center gap-3">
            <button class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium hover:bg-blue-400">
                로그인
            </button>
        </div>
    </div>
</header>
