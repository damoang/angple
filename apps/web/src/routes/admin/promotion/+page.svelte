<script lang="ts">
    /**
     * 전역 프로모션 관리 페이지
     *
     * damoang-ads API와 연동하여 프로모션 전역 설정을 관리합니다.
     */
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import { toast } from 'svelte-sonner';
    import { Toaster } from '$lib/components/ui/sonner';
    import { Save, Loader2, Megaphone } from '@lucide/svelte/icons';
    import {
        getPromotionSettings,
        updatePromotionSettings,
        listAdvertisers,
        type PromotionGlobalSettings,
        type Advertiser
    } from '$lib/api/damoang-ads-client';

    let isLoading = $state(true);
    let isSaving = $state(false);
    let settings = $state<PromotionGlobalSettings | null>(null);
    let advertisers = $state<Advertiser[]>([]);

    // 폼 상태
    let formBoardException = $state('');
    let formInsertIndex = $state(15);
    let formMinCnt = $state(20);
    let formHowMany = $state(2);

    async function loadData() {
        isLoading = true;
        try {
            const [settingsData, advertisersData] = await Promise.allSettled([
                getPromotionSettings(),
                listAdvertisers()
            ]);

            if (settingsData.status === 'fulfilled') {
                settings = settingsData.value;
                formBoardException = settings.board_exception;
                formInsertIndex = settings.insert_index;
                formMinCnt = settings.min_cnt_for_insert_index;
                formHowMany = settings.how_many_to_display;
            }

            if (advertisersData.status === 'fulfilled') {
                advertisers = advertisersData.value;
            }
        } catch {
            toast.error('프로모션 설정을 불러올 수 없습니다.');
        } finally {
            isLoading = false;
        }
    }

    async function handleSave() {
        isSaving = true;
        try {
            const updated = await updatePromotionSettings({
                board_exception: formBoardException,
                insert_index: formInsertIndex,
                min_cnt_for_insert_index: formMinCnt,
                how_many_to_display: formHowMany
            });
            settings = updated;
            toast.success('프로모션 설정이 저장되었습니다.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            isSaving = false;
        }
    }

    onMount(loadData);
</script>

<svelte:head>
    <title>프로모션 관리 - Angple Admin</title>
</svelte:head>

<Toaster />

<div class="mx-auto max-w-4xl p-6">
    <div class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">프로모션 관리</h1>
            <p class="text-muted-foreground text-sm">
                damoang-ads 전역 프로모션 설정을 관리합니다.
            </p>
        </div>
        <Button onclick={handleSave} disabled={isSaving || isLoading}>
            {#if isSaving}
                <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                저장 중...
            {:else}
                <Save class="mr-1.5 h-4 w-4" />
                저장
            {/if}
        </Button>
    </div>

    {#if isLoading}
        <div class="flex items-center justify-center py-24">
            <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
    {:else}
        <div class="space-y-6">
            <!-- 전역 설정 -->
            <Card.Root>
                <Card.Header>
                    <Card.Title>전역 설정</Card.Title>
                    <Card.Description>
                        모든 게시판에 적용되는 프로모션 기본 설정입니다.
                    </Card.Description>
                </Card.Header>
                <Card.Content class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <Label for="insert-index">삽입 위치</Label>
                            <Input
                                id="insert-index"
                                type="number"
                                bind:value={formInsertIndex}
                                min="1"
                            />
                            <p class="text-muted-foreground text-xs">N번째 글 뒤에 프로모션 삽입</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="how-many">표시 갯수</Label>
                            <Input id="how-many" type="number" bind:value={formHowMany} min="1" />
                            <p class="text-muted-foreground text-xs">한 번에 표시할 프로모션 수</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="min-cnt">최소 글 갯수</Label>
                            <Input id="min-cnt" type="number" bind:value={formMinCnt} min="1" />
                            <p class="text-muted-foreground text-xs">
                                이 수 이상의 글이 있을 때만 프로모션 표시
                            </p>
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="board-exception">제외 게시판</Label>
                        <Input
                            id="board-exception"
                            bind:value={formBoardException}
                            placeholder="콤마로 구분된 게시판 ID"
                        />
                        <p class="text-muted-foreground text-xs">
                            프로모션을 표시하지 않을 게시판 ID (예: promotion,notice,faq)
                        </p>
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- 광고주 목록 -->
            <Card.Root>
                <Card.Header>
                    <Card.Title>광고주 목록</Card.Title>
                    <Card.Description>현재 등록된 광고주 목록입니다.</Card.Description>
                </Card.Header>
                <Card.Content>
                    {#if advertisers.length === 0}
                        <div class="text-muted-foreground flex flex-col items-center py-8">
                            <Megaphone class="mb-3 h-10 w-10 opacity-40" />
                            <p class="text-sm">등록된 광고주가 없습니다.</p>
                            <p class="text-xs">
                                damoang-ads API가 연결되지 않았거나 광고주가 없습니다.
                            </p>
                        </div>
                    {:else}
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b">
                                        <th class="p-2 text-left font-medium">이름</th>
                                        <th class="p-2 text-left font-medium">회원 ID</th>
                                        <th class="p-2 text-center font-medium">레벨</th>
                                        <th class="p-2 text-center font-medium">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each advertisers as adv (adv.id)}
                                        <tr class="border-b">
                                            <td class="p-2">{adv.name}</td>
                                            <td class="text-muted-foreground p-2">
                                                {adv.member_id}
                                            </td>
                                            <td class="p-2 text-center">{adv.level}</td>
                                            <td class="p-2 text-center">
                                                {#if adv.is_active}
                                                    <span class="text-green-600">활성</span>
                                                {:else}
                                                    <span class="text-muted-foreground">비활성</span
                                                    >
                                                {/if}
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>
        </div>
    {/if}
</div>
