<script lang="ts">
    /**
     * Muzia Footer — 뮤지아 브랜딩 푸터
     */
</script>

<footer class="border-t bg-gray-50 dark:border-white/10 dark:bg-[#030213]">
    <div class="container mx-auto px-4 py-8">
        <div class="flex flex-col items-center gap-4 text-center">
            <div class="flex items-center gap-2">
                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-600">
                    <span class="text-xs font-bold text-white">M</span>
                </div>
                <span class="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text font-bold text-transparent">
                    Muzia
                </span>
            </div>
            <div class="flex gap-4 text-xs text-gray-400">
                <a href="/privacy" class="hover:text-gray-600">개인정보처리방침</a>
                <a href="/terms" class="hover:text-gray-600">이용약관</a>
                <a href="/disclaimer" class="hover:text-gray-600">면책조항</a>
                <a href="/company" class="hover:text-gray-600">회사소개</a>
            </div>
            <p class="mt-1 text-xs text-gray-400">
                주식회사 에스디케이랩스 &middot; 대표: 김선도 &middot; 서울특별시 서초구 우면동 &middot; 사업자등록번호: 424-86-03401
            </p>
            <p class="mt-0.5 text-xs text-gray-400">
                &copy; {new Date().getFullYear()} Muzia. All rights reserved.
            </p>
        </div>
    </div>
</footer>
