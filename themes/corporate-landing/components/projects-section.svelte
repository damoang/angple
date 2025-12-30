<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Projects Section Component
     *
     * 프로젝트 쇼케이스 섹션
     * - 프로젝트 갤러리
     * - 이미지 + 설명
     * - 링크
     */

    onMount(() => {
        console.log('💼 Projects Section 마운트됨');
    });

    // TODO: Phase 3에서 blocks.json으로 데이터 관리
    const projects = [
        {
            title: 'Angple',
            description: '오픈소스 커뮤니티 플랫폼',
            link: 'https://github.com/damoang/angple',
            image: '/placeholder-project.png'
        }
    ];
</script>

<!--
    TODO: Phase 2에서 구현
    - sdkcorp의 Projects 디자인 변환
    - 이미지 처리
    - 링크 스타일링
 -->
<section class="bg-gray-50 px-4 py-24">
    <div class="container mx-auto">
        <h2 class="mb-12 text-center text-4xl font-bold">Our Projects</h2>

        <div class="grid gap-8 md:grid-cols-2">
            {#each projects as project}
                <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group block overflow-hidden rounded-xl bg-white shadow-lg transition-transform hover:scale-105"
                >
                    <div class="aspect-video bg-gray-200"></div>
                    <div class="p-6">
                        <h3 class="mb-2 text-2xl font-bold group-hover:text-blue-600">
                            {project.title}
                        </h3>
                        <p class="text-gray-600">{project.description}</p>
                    </div>
                </a>
            {/each}
        </div>
    </div>
</section>
