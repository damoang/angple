<script lang="ts">
    import * as Card from '$lib/components/ui/card/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { cn } from '$lib/utils.js';
    import type { HTMLAttributes } from 'svelte/elements';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        class?: string;
        id?: string;
    }

    let { class: className, id = 'admin-login-form', ...restProps }: Props = $props();
</script>

<div class={cn('flex flex-col gap-6', className)} {...restProps}>
    <Card.Root class="overflow-hidden p-0">
        <Card.Content class="grid p-0 md:grid-cols-2">
            <form class="p-6 md:p-8" action="/admin/dashboard" method="GET">
                <div class="flex flex-col gap-6">
                    <div class="flex flex-col items-center text-center">
                        <h1 class="text-2xl font-bold">Angple Admin</h1>
                        <p class="text-muted-foreground text-balance">관리자 계정으로 로그인</p>
                    </div>
                    <div class="grid gap-3">
                        <Label for="email-{id}">이메일</Label>
                        <Input
                            id="email-{id}"
                            type="email"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>
                    <div class="grid gap-3">
                        <div class="flex items-center">
                            <Label for="password-{id}">비밀번호</Label>
                        </div>
                        <Input id="password-{id}" type="password" required />
                    </div>
                    <Button type="submit" class="w-full">로그인</Button>
                </div>
            </form>
            <div class="bg-muted relative hidden items-center justify-center md:flex">
                <div class="p-8 text-center">
                    <h2 class="mb-4 text-4xl font-bold">Angple</h2>
                    <p class="text-muted-foreground">커뮤니티를 위한 오픈소스 플랫폼</p>
                </div>
            </div>
        </Card.Content>
    </Card.Root>
    <div class="text-muted-foreground text-balance text-center text-xs">Powered by Angple</div>
</div>
