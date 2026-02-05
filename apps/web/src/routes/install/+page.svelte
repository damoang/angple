<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { StepIndicator } from '$lib/components/install';
    import Check from '@lucide/svelte/icons/check';

    /**
     * 설치 위저드 Step 1: 사이트 정보 입력
     */

    // 지원 언어 목록
    const languages = [
        { code: 'ko', label: '한국어 (Korean)' },
        { code: 'en', label: 'English' },
        { code: 'ja', label: '日本語 (Japanese)' },
        { code: 'zh', label: '中文 (Chinese)' },
        { code: 'es', label: 'Español (Spanish)' },
        { code: 'vi', label: 'Tiếng Việt (Vietnamese)' },
        { code: 'ar', label: 'العربية (Arabic)' }
    ];

    interface Theme {
        id: string;
        name: string;
        description: string;
        screenshot: string | null;
    }

    let { data, form } = $props();
    let isSubmitting = $state(false);
    let selectedTheme = $state('damoang-default');

    // 테마 목록 (서버에서 전달)
    const themes: Theme[] = data.themes ?? [];
</script>

<svelte:head>
    <title>Angple 설치 - Step 1</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <div class="mb-4 text-4xl font-bold">Angple</div>
            <CardTitle class="text-2xl">사이트 설정</CardTitle>
            <CardDescription>
                Angple에 오신 것을 환영합니다. 사이트 기본 정보를 입력해주세요.
            </CardDescription>
        </CardHeader>

        <CardContent>
            <StepIndicator currentStep={1} />

            {#if form?.error}
                <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                    {form.error}
                </div>
            {/if}

            <form
                method="POST"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ result, update }) => {
                        if (result.type === 'redirect') {
                            // redirect는 자동 처리됨
                            await update();
                        } else {
                            await update();
                            isSubmitting = false;
                        }
                    };
                }}
            >
                <div class="space-y-4">
                    <div class="space-y-2">
                        <Label for="siteName">사이트 이름 *</Label>
                        <Input
                            id="siteName"
                            name="siteName"
                            placeholder="My Angple Site"
                            required
                        />
                        <p class="text-muted-foreground text-sm">사이트 제목으로 표시됩니다.</p>
                    </div>

                    <div class="space-y-2">
                        <Label for="siteDescription">사이트 설명</Label>
                        <Textarea
                            id="siteDescription"
                            name="siteDescription"
                            placeholder="나만의 커뮤니티를 만들어보세요"
                            rows={3}
                        />
                        <p class="text-muted-foreground text-sm">
                            사이트에 대한 간단한 설명입니다.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <Label for="siteUrl">사이트 URL</Label>
                        <Input
                            id="siteUrl"
                            name="siteUrl"
                            type="url"
                            placeholder="https://example.com"
                        />
                        <p class="text-muted-foreground text-sm">
                            사이트의 접속 주소입니다. (선택사항)
                        </p>
                    </div>

                    <div class="space-y-2">
                        <Label for="language">사이트 언어 *</Label>
                        <select
                            id="language"
                            name="language"
                            class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm outline-none transition-colors focus-visible:ring-[3px]"
                            required
                        >
                            {#each languages as lang}
                                <option value={lang.code} selected={lang.code === 'ko'}>
                                    {lang.label}
                                </option>
                            {/each}
                        </select>
                        <p class="text-muted-foreground text-sm">사이트의 기본 표시 언어입니다.</p>
                    </div>

                    <!-- 테마 선택 섹션 -->
                    {#if themes.length > 0}
                        <div class="space-y-2 pt-4">
                            <Label>테마 선택 *</Label>
                            <p class="text-muted-foreground mb-3 text-sm">
                                사이트에 적용할 기본 테마를 선택하세요. 나중에 변경할 수 있습니다.
                            </p>
                            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {#each themes as theme (theme.id)}
                                    <button
                                        type="button"
                                        class="relative rounded-lg border-2 p-2 text-left transition-all hover:shadow-md {selectedTheme ===
                                        theme.id
                                            ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                                            : 'border-muted hover:border-muted-foreground/30'}"
                                        onclick={() => (selectedTheme = theme.id)}
                                    >
                                        <!-- 선택 표시 -->
                                        {#if selectedTheme === theme.id}
                                            <div
                                                class="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full"
                                            >
                                                <Check class="h-3 w-3" />
                                            </div>
                                        {/if}

                                        <!-- 스크린샷 영역 -->
                                        <div
                                            class="bg-muted mb-2 flex aspect-video items-center justify-center overflow-hidden rounded"
                                        >
                                            {#if theme.screenshot}
                                                <img
                                                    src="/themes/{theme.id}/{theme.screenshot}"
                                                    alt={theme.name}
                                                    class="h-full w-full object-cover"
                                                />
                                            {:else}
                                                <div
                                                    class="text-muted-foreground flex h-full w-full items-center justify-center text-xs"
                                                >
                                                    미리보기 없음
                                                </div>
                                            {/if}
                                        </div>

                                        <!-- 테마 이름 -->
                                        <div class="truncate text-sm font-medium">{theme.name}</div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- 선택된 테마 값을 hidden input으로 전송 -->
                    <input type="hidden" name="activeTheme" value={selectedTheme} />
                </div>

                <div class="mt-8 flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '처리 중...' : '다음 단계'}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>
</div>
