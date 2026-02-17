import path from 'node:path';
import fs from 'node:fs';
import { toKebabCase, findProjectRoot, writeFile, success, info, error } from '../utils.js';

interface Options {
    description?: string;
    author?: string;
    type?: string;
    dir?: string;
}

const PLUGIN_TYPES = [
    'board', 'editor', 'auth', 'seo', 'media',
    'social', 'notification', 'analytics', 'payment', 'ai', 'custom'
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
    board: ['posts:read', 'posts:write'],
    editor: ['posts:read', 'posts:write'],
    auth: ['users:read', 'users:write'],
    seo: ['posts:read', 'settings:write'],
    media: ['files:read', 'files:write'],
    social: ['posts:read', 'api:external'],
    notification: ['users:read'],
    analytics: ['posts:read', 'settings:read'],
    payment: ['users:read', 'api:external'],
    ai: ['posts:read', 'api:external'],
    custom: ['posts:read']
};

export function createPlugin(name: string, options: Options): void {
    const id = toKebabCase(name);
    const pluginType = options.type || 'custom';
    const root = findProjectRoot();
    const baseDir = options.dir || path.join(root, 'custom-plugins');
    const pluginDir = path.join(baseDir, id);

    if (!PLUGIN_TYPES.includes(pluginType)) {
        error(`유효하지 않은 플러그인 타입: ${pluginType}`);
        info(`사용 가능한 타입: ${PLUGIN_TYPES.join(', ')}`);
        process.exit(1);
    }

    if (fs.existsSync(pluginDir)) {
        error(`플러그인 "${id}"가 이미 존재합니다: ${pluginDir}`);
        process.exit(1);
    }

    info(`플러그인 "${id}" (${pluginType}) 생성 중...`);

    const permissions = DEFAULT_PERMISSIONS[pluginType] || ['posts:read'];

    // extension.json
    const manifest = {
        id,
        name,
        version: '1.0.0',
        description: options.description || `${name} 플러그인`,
        author: {
            name: options.author || 'Angple Developer',
            email: ''
        },
        license: 'MIT',
        category: 'plugin',
        pluginType,
        tags: [pluginType, 'custom'],
        angpleVersion: '>=0.1.0',
        main: './src/index.ts',
        permissions,
        active: false,
        isCustom: true,
        hooks: [
            {
                name: 'page_loaded',
                type: 'action',
                callback: './src/hooks/on-page-load.ts',
                priority: 10
            }
        ],
        components: [],
        settings: {
            enabled: {
                label: '활성화',
                type: 'boolean',
                default: true,
                description: '플러그인 활성화 여부'
            }
        }
    };

    writeFile(path.join(pluginDir, 'extension.json'), JSON.stringify(manifest, null, 4));

    // src/index.ts
    writeFile(
        path.join(pluginDir, 'src', 'index.ts'),
        `/**
 * ${name} 플러그인
 * 타입: ${pluginType}
 */

import type { ExtensionContext } from '@angple/plugin-engine';

export function activate(context: ExtensionContext): void {
    console.log('[${id}] 플러그인 활성화됨');

    // Hook 등록 예시
    context.hooks.addAction('page_loaded', async () => {
        console.log('[${id}] 페이지 로드 감지');
    });

    // Filter 등록 예시
    context.hooks.addFilter('post_title', async (title: string) => {
        // 게시글 제목을 변환하는 필터
        return title;
    });
}

export function deactivate(): void {
    console.log('[${id}] 플러그인 비활성화됨');
}
`
    );

    // src/hooks/on-page-load.ts
    writeFile(
        path.join(pluginDir, 'src', 'hooks', 'on-page-load.ts'),
        `/**
 * 페이지 로드 시 실행되는 Hook
 */
export default async function onPageLoad(): Promise<void> {
    // 페이지 로드 시 실행할 로직
}
`
    );

    success(`플러그인 "${id}" 생성 완료!`);
    console.log('');
    info(`경로: ${pluginDir}`);
    info(`타입: ${pluginType}`);
    info(`권한: ${permissions.join(', ')}`);
    info('구조:');
    console.log(`  ${id}/`);
    console.log('  ├── extension.json');
    console.log('  └── src/');
    console.log('      ├── index.ts');
    console.log('      └── hooks/');
    console.log('          └── on-page-load.ts');
    console.log('');
    info('다음 단계:');
    console.log('  1. extension.json에서 permissions, settings를 수정하세요');
    console.log('  2. src/index.ts에서 activate()에 로직을 추가하세요');
    console.log('  3. 관리자 > 플러그인에서 활성화하세요');
}
