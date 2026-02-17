import path from 'node:path';
import fs from 'node:fs';
import { toKebabCase, findProjectRoot, writeFile, success, info, error } from '../utils.js';

interface Options {
    description?: string;
    author?: string;
    category?: string;
    slots?: string;
    dir?: string;
}

const CATEGORIES = ['content', 'sidebar', 'ad', 'social', 'utility', 'layout'];

export function createWidget(name: string, options: Options): void {
    const id = toKebabCase(name);
    const category = options.category || 'sidebar';
    const slots = (options.slots || 'sidebar').split(',').map((s) => s.trim());
    const root = findProjectRoot();
    const baseDir = options.dir || path.join(root, 'custom-widgets');
    const widgetDir = path.join(baseDir, id);

    if (!CATEGORIES.includes(category)) {
        error(`유효하지 않은 카테고리: ${category}`);
        info(`사용 가능한 카테고리: ${CATEGORIES.join(', ')}`);
        process.exit(1);
    }

    if (fs.existsSync(widgetDir)) {
        error(`위젯 "${id}"가 이미 존재합니다: ${widgetDir}`);
        process.exit(1);
    }

    info(`위젯 "${id}" (${category}) 생성 중...`);

    // widget.json
    const manifest = {
        id,
        name,
        version: '1.0.0',
        description: options.description || `${name} 위젯`,
        author: { name: options.author || 'Angple Developer' },
        category,
        slots,
        icon: 'LayoutGrid',
        allowMultiple: false,
        main: 'index.svelte',
        settings: {
            title: {
                label: '제목',
                type: 'text',
                default: name,
                description: '위젯에 표시되는 제목'
            },
            showTitle: {
                label: '제목 표시',
                type: 'boolean',
                default: true,
                description: '제목 표시 여부'
            },
            count: {
                label: '표시 개수',
                type: 'number',
                default: 5,
                min: 1,
                max: 20,
                description: '항목 수'
            }
        }
    };

    writeFile(path.join(widgetDir, 'widget.json'), JSON.stringify(manifest, null, 4));

    // index.svelte
    writeFile(
        path.join(widgetDir, 'index.svelte'),
        `<script lang="ts">
    /**
     * ${name} 위젯
     * 카테고리: ${category}
     * 슬롯: ${slots.join(', ')}
     */

    interface Props {
        config?: {
            title?: string;
            showTitle?: boolean;
            count?: number;
        };
    }

    let { config = {} }: Props = $props();

    const title = $derived(config.title || '${name}');
    const showTitle = $derived(config.showTitle ?? true);
    const count = $derived(config.count ?? 5);
</script>

<div class="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
    {#if showTitle}
        <h3 class="mb-3 font-bold text-gray-900 dark:text-white">{title}</h3>
    {/if}

    <ul class="space-y-2">
        {#each Array.from({ length: count }, (_, i) => i + 1) as item}
            <li class="text-sm text-gray-600 dark:text-gray-400">
                항목 {item}
            </li>
        {/each}
    </ul>

    <p class="mt-3 text-xs text-gray-400">
        이 위젯을 수정하세요: custom-widgets/${id}/index.svelte
    </p>
</div>
`
    );

    success(`위젯 "${id}" 생성 완료!`);
    console.log('');
    info(`경로: ${widgetDir}`);
    info(`카테고리: ${category}`);
    info(`슬롯: ${slots.join(', ')}`);
    info('구조:');
    console.log(`  ${id}/`);
    console.log('  ├── widget.json');
    console.log('  └── index.svelte');
    console.log('');
    info('다음 단계:');
    console.log('  1. widget.json에서 settings를 커스터마이즈하세요');
    console.log('  2. index.svelte에서 UI를 구현하세요');
    console.log('  3. 관리자 > 위젯에서 레이아웃에 추가하세요');
}
