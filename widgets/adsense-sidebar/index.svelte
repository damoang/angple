<script lang="ts">
    /**
     * 사이드바 AdSense 위젯
     * Soft Modern 디자인 가이드라인 적용
     * GAM 지원 + AdSense 폴백
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';
    import Megaphone from '@lucide/svelte/icons/megaphone';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    // 위젯 설정에서 값 가져오기
    const position = (config?.settings?.position as string) || 'banner-square';
    const style = (config?.settings?.style as string) || 'border';
    const customSlotId = (config?.settings?.slot_id as string) || '';

    // AdSense 설정
    const clientId = 'ca-pub-5124617752473025';

    // 위치별 광고 설정
    const adConfig: Record<string, { pc: { style: string; slot: string }; mobile: { style: string; slot: string } }> = {
        'banner-square': {
            pc: {
                style: 'display:block;width:100%;max-width:280px;min-height:140px;max-height:280px;aspect-ratio:1/1;',
                slot: '6815163626'
            },
            mobile: {
                style: 'display:inline-block;width:100%;max-height:100px;min-height:50px;aspect-ratio:4.25/1;',
                slot: '9584797155'
            }
        },
        'banner-responsive': {
            pc: {
                style: 'display:inline-block;width:100%;min-height:88px;',
                slot: '9584797155'
            },
            mobile: {
                style: 'display:inline-block;width:100%;min-height:50px;aspect-ratio:2.36/1;',
                slot: '9584797155'
            }
        },
        'banner-halfpage': {
            pc: {
                style: 'display:block;width:100%;max-width:280px;height:600px',
                slot: '7464730194'
            },
            mobile: {
                style: 'display:inline-block;width:100%;max-height:180px;min-height:90px;aspect-ratio:2.36/1;',
                slot: '9584797155'
            }
        }
    };

    let isMobile = $state(false);
    let widgetId = $state('');
    let adLoaded = $state(false);

    const currentConfig = $derived(adConfig[position] || adConfig['banner-square']);
    const deviceConfig = $derived(isMobile ? currentConfig.mobile : currentConfig.pc);
    const adSlot = $derived(customSlotId || deviceConfig.slot);
    const adStyle = $derived(deviceConfig.style);

    onMount(() => {
        // 모바일 체크
        isMobile = window.innerWidth < 768;

        // 랜덤 ID 생성
        widgetId = 'da-adsense-' + Math.random().toString(36).substring(2, 10);

        // AdSense 로드
        try {
            if (typeof window !== 'undefined' && (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle) {
                ((window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle || []).push({});
                adLoaded = true;
            }
        } catch {
            // 조용히 실패
        }
    });
</script>

<div class="bg-background border-border overflow-hidden rounded-xl border shadow-sm">
    <!-- 헤더 -->
    <div class="bg-muted/50 border-border flex items-center gap-2 border-b px-4 py-2.5">
        <div class="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg">
            <Megaphone class="text-primary h-4 w-4" />
        </div>
        <span class="text-muted-foreground flex-1 text-xs">광고</span>
    </div>

    <!-- 본문 -->
    <div class="p-3">
        {#if isEditMode}
            <!-- 편집 모드에서는 미리보기 표시 -->
            <div class="bg-muted/30 flex min-h-[140px] items-center justify-center rounded-lg border border-dashed">
                <div class="text-muted-foreground text-center text-sm">
                    <Megaphone class="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>AdSense 광고</p>
                    <p class="text-xs opacity-75">{position}</p>
                </div>
            </div>
        {:else}
            <div
                id={widgetId}
                class="da-adsense-container"
                class:da-adsense-container--border={style === 'border'}
                class:da-adsense-container--none={style === 'none'}
                class:da-adsense-container--clean={style === 'clean'}
                data-position={position}
            >
                {#if style !== 'none' && style !== 'clean'}
                    <div class="text-muted-foreground mb-1 text-center text-[10px]">구글 광고</div>
                {/if}
                <!-- svelte-ignore element_invalid_self_closing_tag -->
                <ins
                    class="adsbygoogle"
                    style={adStyle}
                    data-ad-client={clientId}
                    data-ad-slot={adSlot}
                />
            </div>
        {/if}
    </div>
</div>

<style>
    .da-adsense-container {
        text-align: center;
    }

    .da-adsense-container--border {
        padding: 4px;
        border: 1px dashed hsl(var(--border));
        border-radius: 8px;
    }

    .adsbygoogle {
        margin: 0 auto;
    }
</style>
