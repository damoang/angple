<script lang="ts">
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import { toast } from 'svelte-sonner';
    import { Toaster } from '$lib/components/ui/sonner';
    import {
        Plus,
        Pencil,
        Trash2,
        Loader2,
        Image,
        Save,
        X,
        CalendarDays,
        Repeat,
        Star
    } from '@lucide/svelte/icons';
    import {
        listLogos,
        createLogo,
        createPresetLogos,
        updateLogo,
        deleteLogo,
        SEASONAL_PRESETS,
        type SiteLogo,
        type CreateLogoRequest,
        type UpdateLogoRequest
    } from '$lib/api/admin-logos';
    import { apiClient } from '$lib/api';
    import {
        buildLogoPreviews,
        dateInputToRecurringMmdd,
        normalizeRecurringDateInput,
        recurringMmddToDateInput
    } from '$lib/utils/logo-schedule';

    let isLoading = $state(true);
    let logos = $state<SiteLogo[]>([]);
    let previewNow = $state(new Date());

    // 다이얼로그 상태
    let showDialog = $state(false);
    let editingLogo = $state<SiteLogo | null>(null);
    let isSaving = $state(false);
    let isUploading = $state(false);
    let isPresetSaving = $state(false);
    let isPresetUploading = $state(false);

    // 폼 상태
    let formName = $state('');
    let formLogoUrl = $state('');
    let formScheduleType = $state<'recurring' | 'date_range' | 'default'>('default');
    let formStartDate = $state('');
    let formEndDate = $state('');
    let formRecurringMode = $state<'single' | 'range'>('single');
    let formRecurringSingleDate = $state('');
    let formRecurringStartDate = $state('');
    let formRecurringEndDate = $state('');
    let formDateRangeMode = $state<'single' | 'range'>('range');
    let formSingleDate = $state('');
    let formPriority = $state(0);
    let formIsActive = $state(true);
    let presetLogoUrl = $state('');
    let presetPriority = $state(0);
    let presetIsActive = $state(true);
    let selectedPresetKeys = $state<string[]>([]);
    let presetNames = $state<Record<string, string>>(
        Object.fromEntries(SEASONAL_PRESETS.map((preset) => [preset.key, preset.default_name]))
    );
    const previews = $derived(
        buildLogoPreviews(
            logos.filter((logo) => logo.is_active),
            previewNow
        )
    );
    const selectedPresets = $derived(
        SEASONAL_PRESETS.filter((preset) => selectedPresetKeys.includes(preset.key))
    );
    const pickerYear = new Date().getFullYear();

    function resetRecurringForm() {
        formRecurringMode = 'single';
        formRecurringSingleDate = '';
        formRecurringStartDate = '';
        formRecurringEndDate = '';
    }

    function resetDateRangeForm() {
        formDateRangeMode = 'range';
        formSingleDate = '';
        formStartDate = '';
        formEndDate = '';
    }

    function populateRecurringForm(recurringDate?: string) {
        resetRecurringForm();
        if (!recurringDate) return;

        const normalized = normalizeRecurringDateInput(recurringDate);
        if (normalized.includes('~')) {
            const [start, end] = normalized.split('~');
            formRecurringMode = 'range';
            formRecurringStartDate = recurringMmddToDateInput(start, pickerYear);
            formRecurringEndDate = recurringMmddToDateInput(end, pickerYear);
            return;
        }

        formRecurringMode = 'single';
        formRecurringSingleDate = recurringMmddToDateInput(normalized, pickerYear);
    }

    function populateDateRangeForm(startDate?: string, endDate?: string) {
        resetDateRangeForm();
        if (!startDate || !endDate) return;

        if (startDate === endDate) {
            formDateRangeMode = 'single';
            formSingleDate = startDate;
            return;
        }

        formDateRangeMode = 'range';
        formStartDate = startDate;
        formEndDate = endDate;
    }

    function getRecurringDateForSave(): string {
        if (formRecurringMode === 'single') {
            return dateInputToRecurringMmdd(formRecurringSingleDate);
        }

        const start = dateInputToRecurringMmdd(formRecurringStartDate);
        const end = dateInputToRecurringMmdd(formRecurringEndDate);
        if (!start || !end) return '';
        return `${start}~${end}`;
    }

    function getDateRangeForSave(): { start: string; end: string } {
        if (formDateRangeMode === 'single') {
            return {
                start: formSingleDate,
                end: formSingleDate
            };
        }

        return {
            start: formStartDate,
            end: formEndDate
        };
    }

    function resetForm() {
        formName = '';
        formLogoUrl = '';
        formScheduleType = 'default';
        resetRecurringForm();
        resetDateRangeForm();
        formPriority = 0;
        formIsActive = true;
        editingLogo = null;
    }

    function openCreate() {
        resetForm();
        showDialog = true;
    }

    function openEdit(logo: SiteLogo) {
        editingLogo = logo;
        formName = logo.name;
        formLogoUrl = logo.logo_url;
        formScheduleType = logo.schedule_type;
        populateRecurringForm(logo.recurring_date);
        populateDateRangeForm(logo.start_date, logo.end_date);
        formPriority = logo.priority;
        formIsActive = logo.is_active;
        showDialog = true;
    }

    async function loadLogos() {
        isLoading = true;
        try {
            logos = await listLogos();
        } catch {
            toast.error('로고 목록을 불러올 수 없습니다.');
        } finally {
            isLoading = false;
        }
    }

    async function handleSave() {
        if (!formName.trim() || !formLogoUrl.trim()) {
            toast.error('제목과 로고 URL은 필수입니다.');
            return;
        }

        let recurringDateValue = '';
        let startDateValue = '';
        let endDateValue = '';

        if (formScheduleType === 'recurring') {
            recurringDateValue = getRecurringDateForSave();
            if (!recurringDateValue) {
                toast.error('매년 반복 일정의 날짜 또는 기간을 선택해 주세요.');
                return;
            }
        }

        if (formScheduleType === 'date_range') {
            const range = getDateRangeForSave();
            startDateValue = range.start;
            endDateValue = range.end;
            if (!startDateValue || !endDateValue) {
                toast.error('기간 지정 일정의 날짜를 선택해 주세요.');
                return;
            }
        }

        isSaving = true;
        try {
            if (editingLogo) {
                const req: UpdateLogoRequest = {
                    name: formName,
                    logo_url: formLogoUrl,
                    schedule_type: formScheduleType,
                    recurring_date: formScheduleType === 'recurring' ? recurringDateValue : '',
                    start_date: formScheduleType === 'date_range' ? startDateValue : '',
                    end_date: formScheduleType === 'date_range' ? endDateValue : '',
                    priority: formPriority,
                    is_active: formIsActive
                };
                await updateLogo(editingLogo.id, req);
                toast.success('로고가 수정되었습니다.');
            } else {
                const req: CreateLogoRequest = {
                    name: formName,
                    logo_url: formLogoUrl,
                    schedule_type: formScheduleType,
                    recurring_date: formScheduleType === 'recurring' ? recurringDateValue : '',
                    start_date: formScheduleType === 'date_range' ? startDateValue : '',
                    end_date: formScheduleType === 'date_range' ? endDateValue : '',
                    priority: formPriority,
                    is_active: formIsActive
                };
                await createLogo(req);
                toast.success('로고가 생성되었습니다.');
            }
            showDialog = false;
            resetForm();
            await loadLogos();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete(logo: SiteLogo) {
        if (!confirm(`"${logo.name}" 로고를 삭제하시겠습니까?`)) return;
        try {
            await deleteLogo(logo.id);
            toast.success('로고가 삭제되었습니다.');
            await loadLogos();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.');
        }
    }

    async function handleToggleActive(logo: SiteLogo) {
        try {
            await updateLogo(logo.id, { is_active: !logo.is_active });
            await loadLogos();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
        }
    }

    async function handleImageUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error('이미지 파일만 업로드 가능합니다.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('파일 크기는 5MB를 초과할 수 없습니다.');
            return;
        }

        isUploading = true;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = apiClient.getAccessToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/media/images', {
                method: 'POST',
                credentials: 'include',
                headers,
                body: formData
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            formLogoUrl = result.data?.url || result.url || '';
            if (formLogoUrl) {
                toast.success('이미지가 업로드되었습니다.');
            }
        } catch {
            toast.error('이미지 업로드에 실패했습니다.');
        } finally {
            isUploading = false;
            input.value = '';
        }
    }

    async function handlePresetImageUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error('이미지 파일만 업로드 가능합니다.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('파일 크기는 5MB를 초과할 수 없습니다.');
            return;
        }

        isPresetUploading = true;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = apiClient.getAccessToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/media/images', {
                method: 'POST',
                credentials: 'include',
                headers,
                body: formData
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            presetLogoUrl = result.data?.url || result.url || '';
            if (presetLogoUrl) {
                toast.success('절기 프리셋 이미지가 업로드되었습니다.');
            }
        } catch {
            toast.error('이미지 업로드에 실패했습니다.');
        } finally {
            isPresetUploading = false;
            input.value = '';
        }
    }

    function togglePreset(key: string) {
        if (selectedPresetKeys.includes(key)) {
            selectedPresetKeys = selectedPresetKeys.filter((presetKey) => presetKey !== key);
            return;
        }

        selectedPresetKeys = [...selectedPresetKeys, key];
    }

    function updatePresetName(key: string, value: string) {
        presetNames = { ...presetNames, [key]: value };
    }

    async function handlePresetSave() {
        if (!presetLogoUrl.trim()) {
            toast.error('절기 프리셋 공통 로고 URL은 필수입니다.');
            return;
        }
        if (selectedPresets.length === 0) {
            toast.error('등록할 절기 프리셋을 하나 이상 선택해 주세요.');
            return;
        }

        const items = selectedPresets.map((preset) => ({
            name: (presetNames[preset.key] || '').trim(),
            recurring_date: preset.recurring_date
        }));

        if (items.some((item) => !item.name)) {
            toast.error('선택한 절기 프리셋 이름은 비워둘 수 없습니다.');
            return;
        }

        isPresetSaving = true;
        try {
            const result = await createPresetLogos({
                logo_url: presetLogoUrl,
                priority: presetPriority,
                is_active: presetIsActive,
                items
            });

            const createdCount = result.created.length;
            const skippedCount = result.skipped.length;

            if (createdCount > 0 && skippedCount > 0) {
                toast.success(
                    `${createdCount}개 생성, ${skippedCount}개는 중복으로 건너뛰었습니다.`
                );
            } else if (createdCount > 0) {
                toast.success(`${createdCount}개의 절기 로고를 생성했습니다.`);
            } else {
                toast.error('생성된 절기 로고가 없습니다. 이미 등록된 날짜인지 확인해 주세요.');
            }

            if (skippedCount > 0) {
                const skippedSummary = result.skipped
                    .map((item) => `${item.recurring_date} ${item.name}`)
                    .join(', ');
                toast.info(`건너뜀: ${skippedSummary}`);
            }

            selectedPresetKeys = [];
            presetLogoUrl = '';
            presetPriority = 0;
            presetIsActive = true;
            presetNames = Object.fromEntries(
                SEASONAL_PRESETS.map((preset) => [preset.key, preset.default_name])
            );
            await loadLogos();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '절기 프리셋 생성에 실패했습니다.');
        } finally {
            isPresetSaving = false;
        }
    }

    function getScheduleLabel(type: string): string {
        switch (type) {
            case 'recurring':
                return '매년 반복';
            case 'date_range':
                return '기간 지정';
            case 'default':
                return '기본 로고';
            default:
                return type;
        }
    }

    function getScheduleDetail(logo: SiteLogo): string {
        switch (logo.schedule_type) {
            case 'recurring':
                return logo.recurring_date?.includes('~')
                    ? `매년 ${logo.recurring_date}`
                    : logo.recurring_date || '';
            case 'date_range':
                if (logo.start_date && logo.end_date && logo.start_date === logo.end_date) {
                    return logo.start_date;
                }
                return `${logo.start_date || ''} ~ ${logo.end_date || ''}`;
            default:
                return '항상';
        }
    }

    function isPreviewActive(logo: SiteLogo): boolean {
        return previews.some((preview) => preview.activeLogoId === logo.id);
    }

    onMount(() => {
        loadLogos();
        const timer = window.setInterval(() => {
            previewNow = new Date();
        }, 60_000);

        return () => window.clearInterval(timer);
    });
</script>

<svelte:head>
    <title>로고 관리 - Angple Admin</title>
</svelte:head>

<Toaster />

<div class="mx-auto max-w-5xl p-6">
    <div class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">로고 관리</h1>
            <p class="text-muted-foreground text-sm">
                사이트 로고를 관리하고 특별한 날짜에 자동으로 로고를 변경할 수 있습니다.
            </p>
            <p class="text-muted-foreground mt-1 text-xs">
                헤더 로고는 모바일 40px, 데스크톱 48px 높이의 고정 영역에 계속 노출됩니다. SVG
                애니메이션을 사용할 경우 Safari와 모바일 실기기에서 CPU 사용량을 꼭 확인해 주세요.
            </p>
            <p class="text-muted-foreground mt-1 text-xs">
                매년 반복은 하루(`03-01`) 또는 기간(`03-20~04-02`)으로 등록할 수 있습니다.
            </p>
        </div>
        <Button onclick={openCreate}>
            <Plus class="mr-1.5 h-4 w-4" />
            로고 추가
        </Button>
    </div>

    <Card.Root class="mb-6">
        <Card.Content class="py-5">
            <div class="mb-3 flex items-center justify-between gap-3">
                <div>
                    <h2 class="text-base font-semibold">시간대별 현재 로고</h2>
                    <p class="text-muted-foreground text-xs">
                        같은 로고 스케줄도 각 지역의 현지 날짜에 따라 지금 보이는 결과가 달라집니다.
                    </p>
                </div>
                <p class="text-muted-foreground text-xs">
                    기준 시각: {previewNow.toLocaleString()}
                </p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {#each previews as preview}
                    <div class="bg-muted/40 rounded-lg border p-3">
                        <div class="mb-1 flex items-center justify-between gap-2">
                            <span class="text-sm font-medium">{preview.flag} {preview.label}</span>
                            <span class="text-muted-foreground text-xs">{preview.region}</span>
                        </div>
                        <p class="text-sm font-semibold">{preview.currentDate}</p>
                        <p class="text-muted-foreground text-xs">
                            {preview.currentTime} · {preview.timeZone}
                        </p>
                        <p class="mt-2 text-sm">{preview.activeLogoName || '노출 로고 없음'}</p>
                    </div>
                {/each}
            </div>
        </Card.Content>
    </Card.Root>

    <Card.Root class="mb-6">
        <Card.Content class="py-5">
            <div class="mb-4">
                <h2 class="text-base font-semibold">절기 프리셋 등록</h2>
                <p class="text-muted-foreground text-xs">
                    삼일절, 4.16 기억일, 어린이날 같은 고정 날짜 로고를 미리 한 번에 등록합니다.
                </p>
            </div>

            <div class="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <div class="space-y-4">
                    <div class="grid gap-2">
                        <Label for="preset-logo-url">공통 로고 이미지</Label>
                        <div class="flex gap-2">
                            <Input
                                id="preset-logo-url"
                                bind:value={presetLogoUrl}
                                placeholder="https://..."
                                class="flex-1"
                            />
                            <Button variant="outline" disabled={isPresetUploading} class="shrink-0">
                                <label class="flex cursor-pointer items-center gap-1.5">
                                    {#if isPresetUploading}
                                        <Loader2 class="h-4 w-4 animate-spin" />
                                    {:else}
                                        <Image class="h-4 w-4" />
                                    {/if}
                                    업로드
                                    <input
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        onchange={handlePresetImageUpload}
                                    />
                                </label>
                            </Button>
                        </div>
                        {#if presetLogoUrl}
                            <div
                                class="bg-muted flex h-20 items-center justify-center overflow-hidden rounded-lg border"
                            >
                                <img
                                    src={presetLogoUrl}
                                    alt="절기 프리셋 미리보기"
                                    class="max-h-full max-w-full object-contain"
                                />
                            </div>
                        {/if}
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <Label for="preset-priority">우선순위</Label>
                            <Input
                                id="preset-priority"
                                type="number"
                                bind:value={presetPriority}
                                min="0"
                            />
                        </div>
                        <div class="flex items-center gap-3 pt-6">
                            <Switch bind:checked={presetIsActive} />
                            <Label>활성</Label>
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label>절기 선택</Label>
                        <div class="grid gap-2 sm:grid-cols-2">
                            {#each SEASONAL_PRESETS as preset}
                                <button
                                    type="button"
                                    class={`rounded-lg border p-3 text-left transition ${
                                        selectedPresetKeys.includes(preset.key)
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'hover:bg-muted/40'
                                    }`}
                                    onclick={() => togglePreset(preset.key)}
                                >
                                    <div class="flex items-center justify-between gap-2">
                                        <span class="text-sm font-medium">{preset.label}</span>
                                        <span class="text-muted-foreground text-xs">
                                            {preset.recurring_date}
                                        </span>
                                    </div>
                                    <p class="text-muted-foreground mt-1 text-xs">
                                        기본 이름: {preset.default_name}
                                    </p>
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>

                <div class="space-y-3">
                    <div>
                        <h3 class="text-sm font-semibold">생성 예정 항목</h3>
                        <p class="text-muted-foreground text-xs">
                            선택한 절기별 이름을 저장 전에 수정할 수 있습니다.
                        </p>
                    </div>

                    {#if selectedPresets.length === 0}
                        <div
                            class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
                        >
                            아직 선택한 절기가 없습니다.
                        </div>
                    {:else}
                        <div class="space-y-3">
                            {#each selectedPresets as preset}
                                <div class="rounded-lg border p-3">
                                    <div class="mb-2 flex items-center justify-between gap-2">
                                        <span class="text-sm font-medium">{preset.label}</span>
                                        <span class="text-muted-foreground text-xs">
                                            {preset.recurring_date}
                                        </span>
                                    </div>
                                    <Input
                                        value={presetNames[preset.key]}
                                        oninput={(event) =>
                                            updatePresetName(
                                                preset.key,
                                                (event.currentTarget as HTMLInputElement).value
                                            )}
                                        placeholder="로고 이름"
                                    />
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <Button
                        class="w-full"
                        onclick={handlePresetSave}
                        disabled={isPresetSaving || selectedPresets.length === 0}
                    >
                        {#if isPresetSaving}
                            <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                            생성 중...
                        {:else}
                            <Plus class="mr-1.5 h-4 w-4" />
                            절기 프리셋 일괄 생성
                        {/if}
                    </Button>
                </div>
            </div>
        </Card.Content>
    </Card.Root>

    {#if isLoading}
        <div class="flex items-center justify-center py-24">
            <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
    {:else if logos.length === 0}
        <Card.Root>
            <Card.Content class="py-16">
                <div class="text-muted-foreground flex flex-col items-center">
                    <Image class="mb-3 h-12 w-12 opacity-40" />
                    <p class="mb-1 text-sm font-medium">등록된 로고가 없습니다.</p>
                    <p class="mb-4 text-xs">
                        로고를 추가하여 특별한 날짜에 자동으로 변경해 보세요.
                    </p>
                    <Button variant="outline" onclick={openCreate}>
                        <Plus class="mr-1.5 h-4 w-4" />
                        첫 로고 추가하기
                    </Button>
                </div>
            </Card.Content>
        </Card.Root>
    {:else}
        <div class="space-y-3">
            {#each logos as logo (logo.id)}
                <Card.Root class={!logo.is_active ? 'opacity-50' : ''}>
                    <Card.Content class="flex items-center gap-4 py-4">
                        <!-- 썸네일 -->
                        <div
                            class="bg-muted flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
                        >
                            <img
                                src={logo.logo_url}
                                alt={logo.name}
                                class="max-h-full max-w-full object-contain"
                            />
                        </div>

                        <!-- 정보 -->
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="font-medium">{logo.name}</span>
                                <span
                                    class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                                >
                                    {#if logo.schedule_type === 'recurring'}
                                        <Repeat class="mr-0.5 inline h-3 w-3" />
                                    {:else if logo.schedule_type === 'date_range'}
                                        <CalendarDays class="mr-0.5 inline h-3 w-3" />
                                    {:else}
                                        <Star class="mr-0.5 inline h-3 w-3" />
                                    {/if}
                                    {getScheduleLabel(logo.schedule_type)}
                                </span>
                            </div>
                            <p class="text-muted-foreground mt-0.5 text-sm">
                                {getScheduleDetail(logo)}
                            </p>
                            <p class="text-muted-foreground text-xs">우선순위: {logo.priority}</p>
                            {#if isPreviewActive(logo)}
                                <p class="mt-1 text-xs font-medium text-emerald-600">
                                    현재 일부 시간대에서 노출 중
                                </p>
                            {/if}
                        </div>

                        <!-- 액션 -->
                        <div class="flex items-center gap-2">
                            <Switch
                                checked={logo.is_active}
                                onCheckedChange={() => handleToggleActive(logo)}
                            />
                            <Button variant="ghost" size="icon" onclick={() => openEdit(logo)}>
                                <Pencil class="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onclick={() => handleDelete(logo)}>
                                <Trash2 class="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    </Card.Content>
                </Card.Root>
            {/each}
        </div>
    {/if}
</div>

<!-- 생성/수정 다이얼로그 -->
{#if showDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="bg-foreground/50 absolute inset-0"
            onclick={() => {
                showDialog = false;
                resetForm();
            }}
        ></div>
        <div class="bg-background relative z-10 w-full max-w-lg rounded-xl border p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
                <h2 class="text-lg font-bold">
                    {editingLogo ? '로고 수정' : '로고 추가'}
                </h2>
                <button
                    class="hover:bg-accent rounded-lg p-1"
                    onclick={() => {
                        showDialog = false;
                        resetForm();
                    }}
                >
                    <X class="h-5 w-5" />
                </button>
            </div>

            <div class="space-y-4">
                <div class="grid gap-2">
                    <Label for="logo-name">제목</Label>
                    <Input id="logo-name" bind:value={formName} placeholder="삼일절 로고" />
                </div>

                <div class="grid gap-2">
                    <Label for="logo-url">로고 이미지</Label>
                    <div class="flex gap-2">
                        <Input
                            id="logo-url"
                            bind:value={formLogoUrl}
                            placeholder="https://..."
                            class="flex-1"
                        />
                        <Button variant="outline" disabled={isUploading} class="shrink-0">
                            <label class="flex cursor-pointer items-center gap-1.5">
                                {#if isUploading}
                                    <Loader2 class="h-4 w-4 animate-spin" />
                                {:else}
                                    <Image class="h-4 w-4" />
                                {/if}
                                업로드
                                <input
                                    type="file"
                                    accept="image/*"
                                    class="hidden"
                                    onchange={handleImageUpload}
                                />
                            </label>
                        </Button>
                    </div>
                    {#if formLogoUrl}
                        <div
                            class="bg-muted flex h-20 items-center justify-center overflow-hidden rounded-lg border"
                        >
                            <img
                                src={formLogoUrl}
                                alt="미리보기"
                                class="max-h-full max-w-full object-contain"
                            />
                        </div>
                    {/if}
                </div>

                <div class="grid gap-2">
                    <Label for="schedule-type">스케줄 타입</Label>
                    <select
                        id="schedule-type"
                        bind:value={formScheduleType}
                        class="border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                    >
                        <option value="default">기본 로고 (폴백)</option>
                        <option value="recurring">매년 반복 (MM-DD 또는 MM-DD~MM-DD)</option>
                        <option value="date_range">기간 지정</option>
                    </select>
                </div>

                {#if formScheduleType === 'recurring'}
                    <div class="grid gap-3">
                        <div class="grid gap-2">
                            <Label>반복 방식</Label>
                            <div class="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={formRecurringMode === 'single' ? 'default' : 'outline'}
                                    onclick={() => (formRecurringMode = 'single')}
                                >
                                    하루
                                </Button>
                                <Button
                                    type="button"
                                    variant={formRecurringMode === 'range' ? 'default' : 'outline'}
                                    onclick={() => (formRecurringMode = 'range')}
                                >
                                    기간
                                </Button>
                            </div>
                        </div>

                        {#if formRecurringMode === 'single'}
                            <div class="grid gap-2">
                                <Label for="recurring-single-date">매년 반복 날짜</Label>
                                <Input
                                    id="recurring-single-date"
                                    type="date"
                                    bind:value={formRecurringSingleDate}
                                />
                            </div>
                        {:else}
                            <div class="grid grid-cols-2 gap-4">
                                <div class="grid gap-2">
                                    <Label for="recurring-start-date">반복 시작일</Label>
                                    <Input
                                        id="recurring-start-date"
                                        type="date"
                                        bind:value={formRecurringStartDate}
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="recurring-end-date">반복 종료일</Label>
                                    <Input
                                        id="recurring-end-date"
                                        type="date"
                                        bind:value={formRecurringEndDate}
                                    />
                                </div>
                            </div>
                        {/if}

                        <p class="text-muted-foreground text-xs">
                            연도는 저장하지 않고 월-일만 사용합니다. 저장 형식:
                            {getRecurringDateForSave() || '03-01 또는 03-20~04-02'}
                        </p>
                    </div>
                {:else if formScheduleType === 'date_range'}
                    <div class="grid gap-3">
                        <div class="grid gap-2">
                            <Label>기간 방식</Label>
                            <div class="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={formDateRangeMode === 'single' ? 'default' : 'outline'}
                                    onclick={() => (formDateRangeMode = 'single')}
                                >
                                    하루
                                </Button>
                                <Button
                                    type="button"
                                    variant={formDateRangeMode === 'range' ? 'default' : 'outline'}
                                    onclick={() => (formDateRangeMode = 'range')}
                                >
                                    기간
                                </Button>
                            </div>
                        </div>

                        {#if formDateRangeMode === 'single'}
                            <div class="grid gap-2">
                                <Label for="single-date">날짜</Label>
                                <Input id="single-date" type="date" bind:value={formSingleDate} />
                            </div>
                        {:else}
                            <div class="grid grid-cols-2 gap-4">
                                <div class="grid gap-2">
                                    <Label for="start-date">시작일</Label>
                                    <Input id="start-date" type="date" bind:value={formStartDate} />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="end-date">종료일</Label>
                                    <Input id="end-date" type="date" bind:value={formEndDate} />
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-2">
                        <Label for="priority">우선순위</Label>
                        <Input id="priority" type="number" bind:value={formPriority} min="0" />
                        <p class="text-muted-foreground text-xs">같은 타입 내 높을수록 우선</p>
                    </div>
                    <div class="flex items-center gap-3 pt-6">
                        <Switch bind:checked={formIsActive} />
                        <Label>활성</Label>
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <Button
                        variant="outline"
                        onclick={() => {
                            showDialog = false;
                            resetForm();
                        }}
                    >
                        취소
                    </Button>
                    <Button onclick={handleSave} disabled={isSaving}>
                        {#if isSaving}
                            <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                            저장 중...
                        {:else}
                            <Save class="mr-1.5 h-4 w-4" />
                            저장
                        {/if}
                    </Button>
                </div>
            </div>
        </div>
    </div>
{/if}
