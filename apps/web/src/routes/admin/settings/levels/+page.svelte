<script lang="ts">
    /**
     * 관리자 등급/승급 설정 페이지
     * 자동 승급 조건 설정 + 승급 대상 확인 + 일괄 승급
     */
    import { onMount } from 'svelte';
    import type { PageData } from './$types.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import Award from '@lucide/svelte/icons/award';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Save from '@lucide/svelte/icons/save';
    import Check from '@lucide/svelte/icons/check';
    import Users from '@lucide/svelte/icons/users';
    import ArrowUp from '@lucide/svelte/icons/arrow-up';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import {
        getPromotionRules,
        savePromotionRules,
        getPromotionCandidates,
        promoteAllEligible,
        promoteMember,
        type PromotionRule,
        type PromotionCandidate
    } from '$lib/api/admin-levels.js';

    let { data }: { data: PageData } = $props();

    // 등급명 매핑
    const GRADE_NAMES: Record<number, string> = {
        1: '앙님💔 (등급1)',
        2: '앙님❤️ (등급2)',
        3: '앙님💛 (등급3)',
        4: '앙님💙 (등급4)',
        5: '광고앙💚 (등급5)'
    };

    // 규칙 상태 (일단 등급3 승급만)
    let rules = $state<PromotionRule[]>(data.rules || []);
    let rulesLoading = $state(false);
    let rulesSaving = $state(false);
    let rulesSaved = $state(false);

    // 대상 목록 상태
    let candidates = $state<PromotionCandidate[]>([]);
    let candidatesLoading = $state(false);

    // 일괄 승급 상태
    let promoting = $state(false);
    let promotionResult = $state<{ promoted: number; failed: number } | null>(null);

    async function loadRules() {
        rulesLoading = true;
        try {
            rules = await getPromotionRules();
        } catch (error) {
            console.error('규칙 로드 실패:', error);
        } finally {
            rulesLoading = false;
        }
    }

    async function saveRules() {
        rulesSaving = true;
        rulesSaved = false;
        try {
            await savePromotionRules(rules);
            rulesSaved = true;
            setTimeout(() => (rulesSaved = false), 2000);
        } catch (error) {
            console.error('규칙 저장 실패:', error);
            alert('설정 저장에 실패했습니다.');
        } finally {
            rulesSaving = false;
        }
    }

    async function loadCandidates() {
        candidatesLoading = true;
        try {
            candidates = await getPromotionCandidates();
        } catch (error) {
            console.error('대상 조회 실패:', error);
        } finally {
            candidatesLoading = false;
        }
    }

    async function handlePromoteAll() {
        if (!confirm(`${candidates.length}명의 회원을 일괄 승급하시겠습니까?`)) return;
        promoting = true;
        promotionResult = null;
        try {
            promotionResult = await promoteAllEligible();
            // 대상 목록 새로고침
            await loadCandidates();
        } catch (error) {
            console.error('일괄 승급 실패:', error);
            alert('일괄 승급에 실패했습니다.');
        } finally {
            promoting = false;
        }
    }

    async function handlePromoteOne(mbId: string) {
        try {
            const result = await promoteMember(mbId);
            if (result.promoted) {
                // 목록에서 제거
                candidates = candidates.filter((c) => c.mb_id !== mbId);
            }
        } catch (error) {
            console.error('승급 실패:', error);
            alert('승급에 실패했습니다.');
        }
    }

    function formatNumber(n: number): string {
        return n.toLocaleString('ko-KR');
    }

    // 등급2→3 규칙 찾기 (없으면 기본값 생성)
    let rule2to3 = $derived(
        rules.find((r) => r.fromLevel === 2 && r.toLevel === 3) || {
            fromLevel: 2,
            toLevel: 3,
            minLoginDays: 7,
            minXP: 3000
        }
    );

    function updateRule2to3(field: 'minLoginDays' | 'minXP', value: number) {
        const idx = rules.findIndex((r) => r.fromLevel === 2 && r.toLevel === 3);
        if (idx >= 0) {
            rules[idx] = { ...rules[idx], [field]: value };
        } else {
            rules = [...rules, { fromLevel: 2, toLevel: 3, minLoginDays: field === 'minLoginDays' ? value : 7, minXP: field === 'minXP' ? value : 3000 }];
        }
    }

    onMount(() => {
        loadCandidates();
    });
</script>

<svelte:head>
    <title>등급 설정 - 관리자</title>
</svelte:head>

<div class="space-y-6">
    <!-- 헤더 -->
    <div class="flex items-center gap-3">
        <Award class="h-8 w-8" />
        <div>
            <h1 class="text-2xl font-bold">등급 자동 승급 설정</h1>
            <p class="text-muted-foreground text-sm">로그인 일수와 경험치 조건 기반 자동 등급 승급</p>
        </div>
    </div>

    <!-- 등급2 → 등급3 승급 조건 -->
    <Card.Root>
        <Card.Header class="pb-3">
            <Card.Title class="flex items-center gap-2 text-base">
                <ArrowUp class="h-4 w-4" />
                {GRADE_NAMES[2]} → {GRADE_NAMES[3]} 승급 조건
            </Card.Title>
            <Card.Description>
                아래 조건을 모두 충족하면 로그인 시 자동으로 등급3으로 승급됩니다.
            </Card.Description>
        </Card.Header>
        <Card.Content>
            {#if rulesLoading}
                <div class="flex items-center gap-2 py-2">
                    <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                    <span class="text-muted-foreground text-sm">설정 로드 중...</span>
                </div>
            {:else}
                <div class="space-y-5">
                    <!-- 로그인 일수 조건 -->
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1">
                            <Label for="min-login-days" class="font-medium">로그인 일수</Label>
                            <p class="text-muted-foreground mt-0.5 text-xs">
                                최소 로그인 일수 (매일 첫 로그인 카운트)
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Input
                                id="min-login-days"
                                type="number"
                                min="1"
                                max="365"
                                class="w-24 text-right"
                                value={rule2to3.minLoginDays}
                                onchange={(e) => updateRule2to3('minLoginDays', parseInt(e.currentTarget.value) || 7)}
                            />
                            <span class="text-muted-foreground w-6 text-sm">일</span>
                        </div>
                    </div>

                    <!-- XP 조건 -->
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1">
                            <Label for="min-xp" class="font-medium">최소 경험치</Label>
                            <p class="text-muted-foreground mt-0.5 text-xs">
                                누적 경험치 (as_exp) 기준
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Input
                                id="min-xp"
                                type="number"
                                min="0"
                                step="500"
                                class="w-28 text-right"
                                value={rule2to3.minXP}
                                onchange={(e) => updateRule2to3('minXP', parseInt(e.currentTarget.value) || 3000)}
                            />
                            <span class="text-muted-foreground w-6 text-sm">XP</span>
                        </div>
                    </div>

                    <!-- 참고 -->
                    <div class="bg-muted/50 rounded-lg p-3">
                        <p class="text-muted-foreground text-xs">
                            * 등급4 이상의 자동 승급 조건은 추후 설정됩니다.<br />
                            * 등급5(광고앙💚)는 광고주 전용으로, 자동 승급 대상이 아닙니다.
                        </p>
                    </div>

                    <!-- 저장 버튼 -->
                    <div class="flex justify-end">
                        <Button size="sm" onclick={saveRules} disabled={rulesSaving}>
                            {#if rulesSaved}
                                <Check class="mr-2 h-4 w-4" />
                                저장됨
                            {:else if rulesSaving}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                저장 중...
                            {:else}
                                <Save class="mr-2 h-4 w-4" />
                                저장
                            {/if}
                        </Button>
                    </div>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>

    <!-- 승급 대상 목록 -->
    <Card.Root>
        <Card.Header class="pb-3">
            <div class="flex items-center justify-between">
                <div>
                    <Card.Title class="flex items-center gap-2 text-base">
                        <Users class="h-4 w-4" />
                        승급 대상 회원
                    </Card.Title>
                    <Card.Description>
                        조건을 충족했지만 아직 승급되지 않은 회원 목록
                    </Card.Description>
                </div>
                <div class="flex items-center gap-2">
                    <Button variant="outline" size="sm" onclick={loadCandidates} disabled={candidatesLoading}>
                        <RefreshCw class="mr-2 h-4 w-4 {candidatesLoading ? 'animate-spin' : ''}" />
                        새로고침
                    </Button>
                    {#if candidates.length > 0}
                        <Button size="sm" onclick={handlePromoteAll} disabled={promoting}>
                            {#if promoting}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                승급 중...
                            {:else}
                                <ArrowUp class="mr-2 h-4 w-4" />
                                전체 승급 ({candidates.length}명)
                            {/if}
                        </Button>
                    {/if}
                </div>
            </div>
        </Card.Header>
        <Card.Content>
            {#if promotionResult}
                <div class="bg-muted mb-4 rounded-lg p-3 text-sm">
                    승급 완료: <strong>{promotionResult.promoted}명</strong> 성공
                    {#if promotionResult.failed > 0}
                        , <span class="text-red-500">{promotionResult.failed}명 실패</span>
                    {/if}
                </div>
            {/if}

            {#if candidatesLoading}
                <div class="flex items-center justify-center py-8">
                    <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
            {:else if candidates.length === 0}
                <div class="text-muted-foreground py-8 text-center text-sm">
                    현재 승급 대상 회원이 없습니다.
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-border border-b">
                                <th class="px-3 py-2 text-left font-medium">회원 ID</th>
                                <th class="px-3 py-2 text-left font-medium">닉네임</th>
                                <th class="px-3 py-2 text-center font-medium">현재 등급</th>
                                <th class="px-3 py-2 text-right font-medium">로그인</th>
                                <th class="px-3 py-2 text-right font-medium">XP</th>
                                <th class="px-3 py-2 text-center font-medium">승급 대상</th>
                                <th class="px-3 py-2 text-center font-medium">작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each candidates as candidate (candidate.mb_id)}
                                <tr class="border-border hover:bg-muted/50 border-b">
                                    <td class="px-3 py-2 font-mono text-xs">{candidate.mb_id}</td>
                                    <td class="px-3 py-2">{candidate.mb_nick}</td>
                                    <td class="px-3 py-2 text-center">
                                        <Badge variant="outline">등급{candidate.mb_level}</Badge>
                                    </td>
                                    <td class="px-3 py-2 text-right tabular-nums">
                                        {candidate.login_days}일
                                    </td>
                                    <td class="px-3 py-2 text-right tabular-nums">
                                        {formatNumber(candidate.as_exp)}
                                    </td>
                                    <td class="px-3 py-2 text-center">
                                        <Badge variant="secondary">등급{candidate.eligible_for}</Badge>
                                    </td>
                                    <td class="px-3 py-2 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onclick={() => handlePromoteOne(candidate.mb_id)}
                                        >
                                            <ArrowUp class="h-4 w-4" />
                                        </Button>
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
