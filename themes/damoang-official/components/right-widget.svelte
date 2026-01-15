<script lang="ts">
    const popularPosts = [
        { id: 1, title: '오늘의 핫한 소식!', views: 1234, comments: 56 },
        { id: 2, title: '추천합니다 이거', views: 987, comments: 43 },
        { id: 3, title: '궁금한게 있어요', views: 765, comments: 32 },
        { id: 4, title: '정보공유합니다', views: 654, comments: 28 },
        { id: 5, title: '다들 보세요!', views: 543, comments: 21 }
    ];

    const trendingTags = [
        { name: '일상', count: 234 },
        { name: '질문', count: 189 },
        { name: '정보', count: 156 },
        { name: '후기', count: 142 },
        { name: '추천', count: 128 }
    ];
</script>

<div class="space-y-4">
    <!-- 실시간 인기글 -->
    <div class="rounded-xl bg-white p-4 shadow-sm">
        <div class="mb-4 flex items-center gap-2">
            <span class="text-xl">🔥</span>
            <h3 class="font-bold text-gray-900">실시간 인기글</h3>
        </div>
        <ul class="space-y-3">
            {#each popularPosts as post, idx}
                <li>
                    <a href="/free/{post.id}" class="group block">
                        <div class="flex gap-2">
                            <span
                                class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs font-bold"
                                class:text-pink-500={idx === 0}
                                class:text-purple-500={idx === 1}
                                class:text-blue-500={idx === 2}
                                class:text-gray-500={idx > 2}
                            >
                                {idx + 1}
                            </span>
                            <div class="flex-1">
                                <p
                                    class="line-clamp-1 text-sm text-gray-700 group-hover:text-purple-600"
                                >
                                    {post.title}
                                </p>
                                <div class="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                    <span>👁 {post.views.toLocaleString()}</span>
                                    <span>💬 {post.comments}</span>
                                </div>
                            </div>
                        </div>
                    </a>
                </li>
            {/each}
        </ul>
    </div>

    <!-- 트렌딩 태그 -->
    <div class="rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-4 text-white shadow-sm">
        <div class="mb-4 flex items-center gap-2">
            <span class="text-xl">📈</span>
            <h3 class="font-bold">트렌딩 태그</h3>
        </div>
        <div class="flex flex-wrap gap-2">
            {#each trendingTags as tag}
                <a
                    href="/tag/{tag.name}"
                    class="rounded-lg bg-white/20 px-3 py-1.5 text-sm backdrop-blur-sm transition-all hover:bg-white/30"
                >
                    #{tag.name}
                    <span class="ml-1 text-xs opacity-80">{tag.count}</span>
                </a>
            {/each}
        </div>
    </div>

    <!-- 최근 활동 -->
    <div class="rounded-xl bg-white p-4 shadow-sm">
        <div class="mb-4 flex items-center gap-2">
            <span class="text-xl">⏰</span>
            <h3 class="font-bold text-gray-900">최근 활동</h3>
        </div>
        <ul class="space-y-2 text-sm">
            <li class="flex items-center gap-2">
                <div class="h-6 w-6 rounded-full bg-purple-100"></div>
                <span class="text-gray-700">김철수님이 댓글을 남겼습니다</span>
            </li>
            <li class="flex items-center gap-2">
                <div class="h-6 w-6 rounded-full bg-pink-100"></div>
                <span class="text-gray-700">이영희님이 게시글을 작성했습니다</span>
            </li>
            <li class="flex items-center gap-2">
                <div class="h-6 w-6 rounded-full bg-blue-100"></div>
                <span class="text-gray-700">박민수님이 좋아요를 눌렀습니다</span>
            </li>
        </ul>
    </div>
</div>
