<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    // Dialog는 Svelte 5 호환 문제로 임시 제외
    // import {
    // 	Dialog,
    // 	DialogContent,
    // 	DialogDescription,
    // 	DialogHeader,
    // 	DialogTitle,
    // 	DialogTrigger
    // } from '$lib/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
    import { Toaster } from '$lib/components/ui/sonner';
    import { toast } from 'svelte-sonner';
    import { Info, CheckCircle, AlertTriangle, XCircle } from '@lucide/svelte';

    function showToast(type: 'success' | 'error' | 'info' | 'warning') {
        switch (type) {
            case 'success':
                toast.success('성공!', { description: 'Success toast 테스트입니다.' });
                break;
            case 'error':
                toast.error('오류 발생', { description: 'Error toast 테스트입니다.' });
                break;
            case 'info':
                toast.info('정보', { description: 'Info toast 테스트입니다.' });
                break;
            case 'warning':
                toast.warning('경고', { description: 'Warning toast 테스트입니다.' });
                break;
        }
    }
</script>

<Toaster />

<div class="container mx-auto max-w-6xl p-8">
    <h1 class="mb-8 text-4xl font-bold">🎨 UI 컴포넌트 테스트</h1>

    <!-- Badge 테스트 -->
    <Card class="mb-6">
        <CardHeader>
            <CardTitle>1. Badge 컴포넌트</CardTitle>
        </CardHeader>
        <CardContent>
            <div class="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
            </div>
        </CardContent>
    </Card>

    <!-- Dialog 테스트 (Svelte 5 호환 문제로 임시 제외) -->
    <Card class="mb-6">
        <CardHeader>
            <CardTitle>2. Dialog 컴포넌트</CardTitle>
        </CardHeader>
        <CardContent>
            <div class="rounded-md bg-yellow-50 p-4">
                <p class="text-sm text-yellow-800">
                    ⚠️ Dialog 컴포넌트는 Svelte 5의 <code>let:</code> 디렉티브 호환 문제로 인해 현재
                    테스트에서 제외되었습니다.
                    <br />
                    shadcn-svelte 팀에서 수정 중입니다.
                </p>
            </div>
        </CardContent>
    </Card>

    <!-- Tabs 테스트 -->
    <Card class="mb-6">
        <CardHeader>
            <CardTitle>3. Tabs 컴포넌트</CardTitle>
        </CardHeader>
        <CardContent>
            <Tabs value="tab1" class="w-full">
                <TabsList class="grid w-full grid-cols-3">
                    <TabsTrigger value="tab1">탭 1</TabsTrigger>
                    <TabsTrigger value="tab2">탭 2</TabsTrigger>
                    <TabsTrigger value="tab3">탭 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1" class="mt-4">
                    <p class="text-sm text-gray-600">첫 번째 탭의 내용입니다.</p>
                </TabsContent>
                <TabsContent value="tab2" class="mt-4">
                    <p class="text-sm text-gray-600">두 번째 탭의 내용입니다.</p>
                </TabsContent>
                <TabsContent value="tab3" class="mt-4">
                    <p class="text-sm text-gray-600">세 번째 탭의 내용입니다.</p>
                </TabsContent>
            </Tabs>
        </CardContent>
    </Card>

    <!-- Alert 테스트 -->
    <Card class="mb-6">
        <CardHeader>
            <CardTitle>4. Alert 컴포넌트</CardTitle>
        </CardHeader>
        <CardContent>
            <div class="space-y-4">
                <Alert>
                    <Info class="h-4 w-4" />
                    <AlertTitle>정보</AlertTitle>
                    <AlertDescription>기본 Alert 컴포넌트입니다.</AlertDescription>
                </Alert>

                <Alert variant="destructive">
                    <XCircle class="h-4 w-4" />
                    <AlertTitle>오류</AlertTitle>
                    <AlertDescription>Destructive variant Alert입니다.</AlertDescription>
                </Alert>
            </div>
        </CardContent>
    </Card>

    <!-- Sonner (Toast) 테스트 -->
    <Card class="mb-6">
        <CardHeader>
            <CardTitle>5. Sonner (Toast) 컴포넌트</CardTitle>
        </CardHeader>
        <CardContent>
            <div class="flex flex-wrap gap-2">
                <Button onclick={() => showToast('success')}>
                    <CheckCircle class="mr-2 h-4 w-4" />
                    Success Toast
                </Button>
                <Button variant="destructive" onclick={() => showToast('error')}>
                    <XCircle class="mr-2 h-4 w-4" />
                    Error Toast
                </Button>
                <Button variant="outline" onclick={() => showToast('info')}>
                    <Info class="mr-2 h-4 w-4" />
                    Info Toast
                </Button>
                <Button variant="secondary" onclick={() => showToast('warning')}>
                    <AlertTriangle class="mr-2 h-4 w-4" />
                    Warning Toast
                </Button>
            </div>
        </CardContent>
    </Card>

    <!-- 테스트 가이드 -->
    <Card>
        <CardHeader>
            <CardTitle>테스트 가이드</CardTitle>
        </CardHeader>
        <CardContent>
            <div class="space-y-2 text-sm text-gray-600">
                <p>✅ <strong>Badge:</strong> 다양한 variant가 표시되는지 확인</p>
                <p>✅ <strong>Dialog:</strong> 버튼 클릭 시 모달이 열리고 닫히는지 확인</p>
                <p>✅ <strong>Tabs:</strong> 탭 전환이 정상 작동하는지 확인</p>
                <p>✅ <strong>Alert:</strong> 아이콘과 텍스트가 제대로 표시되는지 확인</p>
                <p>
                    ✅ <strong>Sonner:</strong> 버튼 클릭 시 toast 알림이 우측 상단에 나타나는지 확인
                </p>
            </div>
        </CardContent>
    </Card>
</div>
