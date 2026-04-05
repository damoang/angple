<script lang="ts">
    // Wiki Footer
</script>

<footer class="border-border bg-muted/50 border-t">
    <div class="mx-auto max-w-7xl px-4 py-8">
        <!-- Quick Links Section -->
        <div class="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
            <!-- Navigation -->
            <div>
                <h4 class="text-foreground mb-3 text-sm font-semibold">둘러보기</h4>
                <ul class="space-y-2">
                    <li>
                        <a href="/" class="text-muted-foreground hover:text-primary text-sm"
                            >대문</a
                        >
                    </li>
                    <li>
                        <a
                            href="/wiki/Special:RecentChanges"
                            class="text-muted-foreground hover:text-primary text-sm">최근 변경</a
                        >
                    </li>
                    <li>
                        <a
                            href="/wiki/Special:AllPages"
                            class="text-muted-foreground hover:text-primary text-sm">모든 문서</a
                        >
                    </li>
                    <li>
                        <a
                            href="/wiki/Special:Random"
                            class="text-muted-foreground hover:text-primary text-sm">임의 문서</a
                        >
                    </li>
                </ul>
            </div>

            <!-- Categories -->
            <div>
                <h4 class="text-foreground mb-3 text-sm font-semibold">분류</h4>
                <ul class="space-y-2">
                    <li>
                        <a
                            href="/wiki/Special:Categories"
                            class="text-muted-foreground hover:text-primary text-sm">분류 목록</a
                        >
                    </li>
                    <li>
                        <a
                            href="/wiki/Special:Tags"
                            class="text-muted-foreground hover:text-primary text-sm">태그 목록</a
                        >
                    </li>
                </ul>
            </div>

            <!-- Help -->
            <div>
                <h4 class="text-foreground mb-3 text-sm font-semibold">도움말</h4>
                <ul class="space-y-2">
                    <li>
                        <a
                            href="/wiki/Help:Contents"
                            class="text-muted-foreground hover:text-primary text-sm">도움말</a
                        >
                    </li>
                    <li>
                        <a
                            href="/wiki/Help:Editing"
                            class="text-muted-foreground hover:text-primary text-sm">편집 안내</a
                        >
                    </li>
                </ul>
            </div>

            <!-- Site -->
            <div>
                <h4 class="text-foreground mb-3 text-sm font-semibold">사이트</h4>
                <ul class="space-y-2">
                    <li>
                        <a
                            href="/wiki/Wikiang:About"
                            class="text-muted-foreground hover:text-primary text-sm">소개</a
                        >
                    </li>
                    <li>
                        <a
                            href="/sitemap.xml"
                            class="text-muted-foreground hover:text-primary text-sm">사이트맵</a
                        >
                    </li>
                </ul>
            </div>
        </div>

        <div class="border-border border-t pt-6">
            <div class="flex flex-col items-center justify-between gap-4 md:flex-row">
                <!-- Copyright -->
                <div class="text-center md:text-left">
                    <p class="text-muted-foreground text-sm">
                        위키앙의 모든 문서는
                        <a
                            href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-primary hover:underline"
                        >
                            CC BY-NC-SA 4.0
                        </a>
                        라이선스로 배포됩니다.
                    </p>
                    <p class="text-muted-foreground mt-1 text-xs">
                        &copy; {new Date().getFullYear()} WIKIANG LLC. All rights reserved.
                    </p>
                    <p class="text-muted-foreground mt-1 text-xs">EIN: 30-1443167</p>
                </div>

                <!-- Links -->
                <nav class="flex flex-wrap items-center justify-center gap-4 text-sm">
                    <a href="/wiki/Wikiang:Terms" class="text-muted-foreground hover:text-primary"
                        >이용약관</a
                    >
                    <span class="text-border">|</span>
                    <a href="/wiki/Wikiang:Privacy" class="text-muted-foreground hover:text-primary"
                        >개인정보처리방침</a
                    >
                    <span class="text-border">|</span>
                    <a href="/wiki/Wikiang:Contact" class="text-muted-foreground hover:text-primary"
                        >문의하기</a
                    >
                </nav>
            </div>
        </div>
    </div>
</footer>
