<script lang="ts">
    // 현재 연도 자동 계산
    const currentYear = new Date().getFullYear();

    // 앙포털 메뉴
    const dummyPortalLinks = [
        { name: 'Dummy Map - Map', href: 'https://dummy.net/map' },
        { name: 'Dummy Reviews - Reviews', href: 'https://dummy.net/reviews' },
        { name: 'Dummy Music - Music', href: 'https://dummy.net/music' },
        { name: 'Dummy Shop - Shop', href: 'http://dummy.shop', external: true },
        { name: 'Dummy Videos - Videos', href: 'http://youtube.com/@DummyVideos', external: true },
        { name: 'X (구 트위터)', href: 'https://x.com/@dummy', external: true }
    ];

    // 함께만들어가요 메뉴
    const dummyTogetherLinks = [
        { name: 'Notices', href: 'https://dummy.net/notice' },
        { name: 'Maintenance (Bug Report)', href: 'https://dummy.net/bug' },
        { name: 'Create Dummy', href: 'https://dummy.net/create' },
        { name: 'Event Suggestions', href: 'https://dummy.net/event' },
        { name: 'Dummy Dev Support', href: 'https://dummy.net/discord' },
        { name: 'Dummy Ads', href: 'https://damoang.net/content/advertisement', external: true }
    ];

    // 시스템 메뉴
    const dummySystemLinks = [
        { name: 'Point Info', href: 'https://dummy.net/content/info' },
        { name: 'Level Info', href: 'https://dummy.net/content/level' },
        { name: 'New Posts', href: 'https://dummy.net/bbs/new.php', external: true }
    ];

    // 🚨삐앙삐앙🚨 메뉴
    const dummyEmergencyLinks = [
        { name: 'Dummy Report', href: 'https://dummy.net/report' },
        { name: 'Appeal Board', href: 'https://dummy.net/claim' },
        { name: 'User Report (Truth Room)', href: 'https://dummy.net/truthroom' },
        { name: 'Viral Report Log (No Ads)', href: 'https://dummy.net/nope' },
        { name: 'User Restriction Log', href: 'https://dummy.net/disciplinelog' }
    ];
</script>

<footer class="w-full border-t border-dusty-200 bg-dusty-50 text-gray-800">
    <!-- 상단 섹션 -->
    <div class="mx-auto container px-4 py-8">
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <!-- Portal -->
            <div>
                <h3 class="mb-4 text-lg font-semibold text-gray-900">Portal</h3>
                <ul class="space-y-2">
                    {#each dummyPortalLinks as link}
                        <li>
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                class="text-sm text-gray-600 transition-colors hover:text-blue-600"
                            >
                                {link.name}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>

            <!-- 함께만들어가요 -->
            <div>
                <h3 class="mb-4 text-lg font-semibold text-gray-900">함께만들어가요</h3>
                <ul class="space-y-2">
                    {#each dummyTogetherLinks as link}
                        <li>
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                class="text-sm text-gray-600 transition-colors hover:text-blue-600"
                            >
                                {link.name}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>

            <!-- 시스템 -->
            <div>
                <h3 class="mb-4 text-lg font-semibold text-gray-900">시스템</h3>
                <ul class="space-y-2">
                    {#each dummySystemLinks as link}
                        <li>
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                class="text-sm text-gray-600 transition-colors hover:text-blue-600"
                            >
                                {link.name}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>

            <!-- 🚨Alert🚨 -->
            <div>
                <h3 class="mb-4 text-lg font-semibold text-red-600">🚨Alert🚨</h3>
                <ul class="space-y-2">
                    {#each dummyEmergencyLinks as link}
                        <li>
                            <a
                                href={link.href}
                                class="text-sm text-gray-600 transition-colors hover:text-blue-600"
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
    <div class=" bg-dusty-50">
        <div class="mx-auto max-w-[1200px] px-4 py-6 text-center">
            <div class="space-y-2 text-sm text-gray-700">
                <p>© All rights reserved.</p>
                <p>
                    Report/Inquiry : report@dummy.net, Contact (Ads and all inquiries) : contact@dummy.net
                </p>
            </div>

            <!-- 유튜브 아이콘 -->
            <div class="mt-4 flex justify-center">
                <a
                    href="http://youtube.com/@DummyVideos"
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
