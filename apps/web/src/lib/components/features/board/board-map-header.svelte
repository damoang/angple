<script lang="ts">
    import MapPin from '@lucide/svelte/icons/map-pin';
    import ExternalLink from '@lucide/svelte/icons/external-link';

    // 지도 서비스 링크 데이터 (PHP angmap 게시판과 동일)
    const mapServices = [
        {
            name: '카카오맵',
            description: '다모앙 회원이 추천하는 장소를 카카오맵에서 확인하세요',
            url: 'https://map.kakao.com/?urlX=522644&urlY=1084476&urlLevel=3&map_type=TYPE_MAP&q=%EB%8B%A4%EB%AA%A8%EC%95%99',
            icon: '🗺️',
            color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
        },
        {
            name: '네이버 지도',
            description: '다모앙 회원이 추천하는 장소를 네이버 지도에서 확인하세요',
            url: 'https://map.naver.com/',
            icon: '📍',
            color: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
        },
        {
            name: '구글 지도',
            description: '다모앙 회원이 추천하는 장소를 구글 지도에서 확인하세요',
            url: 'https://www.google.com/maps',
            icon: '🌍',
            color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
        }
    ];
</script>

<div class="mb-6">
    <div class="mb-3 flex items-center gap-2">
        <MapPin class="text-primary h-5 w-5" />
        <h2 class="text-foreground text-lg font-semibold">앙지도 바로가기</h2>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {#each mapServices as service (service.name)}
            <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 rounded-lg border p-4 transition-all hover:shadow-md {service.color}"
            >
                <span class="text-2xl">{service.icon}</span>
                <div class="min-w-0 flex-1">
                    <div class="text-foreground flex items-center gap-1 font-medium">
                        {service.name}
                        <ExternalLink class="text-muted-foreground h-3 w-3" />
                    </div>
                    <p class="text-muted-foreground mt-0.5 truncate text-xs">
                        {service.description}
                    </p>
                </div>
            </a>
        {/each}
    </div>
</div>
