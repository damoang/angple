<script lang="ts">
    // 앙포털 메뉴
    const angportalLinks = [
        { name: '다모앙 지도 - 앙지도', href: 'https://damoang.net/angmap' },
        { name: '다모앙 평점 - 앙티티', href: 'https://damoang.net/angtt' },
        { name: '다모앙 음악 - 앙뮤직', href: 'https://damoang.net/music' },
        { name: '다모앙 상점 - 앙상점', href: 'http://damoang.shop', external: true },
        { name: '다모앙 영상 - 앙팡팡', href: 'http://youtube.com/@AngPangPang', external: true },
        { name: 'X (구 트위터)', href: 'https://x.com/@damoang_net', external: true }
    ];

    // 함께만들어가요 메뉴
    const togetherLinks = [
        { name: '공지사항', href: 'https://damoang.net/notice' },
        { name: '유지관리(버그제보)', href: 'https://damoang.net/bug' },
        { name: '다모앙 만들기', href: 'https://damoang.net/makeang' },
        { name: '이벤트 제안', href: 'https://damoang.net/event' },
        { name: '다모앙 개발지원 신청', href: 'https://damoang.net/discord' },
        { name: '광고앙', href: 'https://damoang.net/content/advertisement', external: true }
    ];

    // 시스템 메뉴
    const systemLinks = [
        { name: '포인트 안내', href: 'https://damoang.net/content/info' },
        { name: '레벨 안내', href: 'https://damoang.net/content/level' },
        { name: '새글모음', href: 'https://damoang.net/bbs/new.php', external: true }
    ];

    // 🚨삐앙삐앙🚨 메뉴
    const emergencyLinks = [
        { name: '앙리포트', href: 'https://damoang.net/report' },
        { name: '소명게시판', href: 'https://damoang.net/claim' },
        { name: '회원 신고 (누적 진실의 방)', href: 'https://damoang.net/truthroom' },
        { name: '바이럴 신고 기록 (광고 앙대앙)', href: 'https://damoang.net/nope' },
        { name: '회원 이용제한 기록', href: 'https://damoang.net/disciplinelog' }
    ];
</script>

<footer class="border-border bg-dusty-50 dark:bg-dusty-900 w-full border-t">
    <!-- 상단 섹션 -->
    <div class="mx-auto max-w-[1200px] px-4 py-8">
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <!-- 앙포털 -->
            <div>
                <h3 class="text-dusty-900 dark:text-dusty-200 mb-4 text-lg font-semibold">
                    앙포털
                </h3>
                <ul class="space-y-2">
                    {#each angportalLinks as link (link.href)}
                        <li>
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                class="text-dusty-600 dark:text-dusty-400 text-sm transition-colors hover:text-blue-600"
                            >
                                {link.name}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>

            <!-- 함께만들어가요 -->
            <div>
                <h3 class="text-dusty-900 dark:text-dusty-200 mb-4 text-lg font-semibold">
                    함께만들어가요
                </h3>
                <ul class="space-y-2">
                    {#each togetherLinks as link (link.href)}
                        <li>
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                class="text-dusty-600 dark:text-dusty-400 text-sm transition-colors hover:text-blue-600"
                            >
                                {link.name}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>

            <!-- 시스템 -->
            <div>
                <h3 class="text-dusty-900 dark:text-dusty-200 mb-4 text-lg font-semibold">
                    시스템
                </h3>
                <ul class="space-y-2">
                    {#each systemLinks as link (link.href)}
                        <li>
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                class="text-dusty-600 dark:text-dusty-400 text-sm transition-colors hover:text-blue-600"
                            >
                                {link.name}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>

            <!-- 🚨삐앙삐앙🚨 -->
            <div>
                <h3 class="mb-4 text-lg font-semibold text-red-600">🚨삐앙삐앙🚨</h3>
                <ul class="space-y-2">
                    {#each emergencyLinks as link (link.href)}
                        <li>
                            <a
                                href={link.href}
                                class="text-dusty-600 dark:text-dusty-400 text-sm transition-colors hover:text-blue-600"
                            >
                                {link.name}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>

    <!-- 저작권 및 연락처 섹션 -->
    <div class=" bg-canvas">
        <div class="mx-auto max-w-[1200px] px-4 py-6 text-center">
            <div class="text-dusty-700 dark:text-dusty-300 space-y-2 text-sm">
                <p>© SDK Co., Ltd. All rights reserved.</p>
                <p>
                    제보/신고 : jebo@damoang.net, 문의(광고 그리고 모든 문의) : contact@damoang.net
                </p>
            </div>

            <!-- 유튜브 아이콘 -->
            <div class="mt-4 flex justify-center">
                <a
                    href="http://youtube.com/@AngPangPang"
                    class="inline-block"
                    aria-label="유튜브 채널"
                >
                    <svg
                        class="h-8 w-8 text-red-600 transition-colors hover:text-red-700"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
                        />
                    </svg>
                </a>
            </div>
        </div>
    </div>
</footer>
