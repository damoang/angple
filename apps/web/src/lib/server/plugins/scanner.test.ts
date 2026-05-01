import { describe, it, expect } from 'vitest';
import { safeValidateExtensionManifest } from '@angple/types';

describe('plugin manifest schema (#1289 L1 regression)', () => {
    it('새 migrations 필드는 옵셔널 — 누락해도 검증 통과', () => {
        expect.hasAssertions();
        const minimal = {
            id: 'test-plugin',
            name: 'Test',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'a' },
            license: 'MIT',
            category: 'plugin' as const,
            main: 'index.ts'
        };
        const result = safeValidateExtensionManifest(minimal);
        expect(result.success).toBe(true);
    });

    it('migrations 배열 검증 통과', () => {
        expect.hasAssertions();
        const withMigrations = {
            id: 'test-plugin',
            name: 'Test',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'a' },
            license: 'MIT',
            category: 'plugin' as const,
            main: 'index.ts',
            migrations: [
                {
                    version: '001',
                    description: 'create table',
                    up: 'migrations/001_up.sql',
                    down: 'migrations/001_down.sql'
                }
            ]
        };
        const result = safeValidateExtensionManifest(withMigrations);
        expect(result.success).toBe(true);
    });

    it('migrations down은 옵셔널', () => {
        expect.hasAssertions();
        const withoutDown = {
            id: 'test-plugin',
            name: 'Test',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'a' },
            license: 'MIT',
            category: 'plugin' as const,
            main: 'index.ts',
            migrations: [
                {
                    version: '001',
                    description: 'create table',
                    up: 'migrations/001_up.sql'
                }
            ]
        };
        const result = safeValidateExtensionManifest(withoutDown);
        expect(result.success).toBe(true);
    });

    it('migrations version/description/up은 필수', () => {
        expect.hasAssertions();
        const invalid = {
            id: 'test-plugin',
            name: 'Test',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'a' },
            license: 'MIT',
            category: 'plugin' as const,
            main: 'index.ts',
            migrations: [
                {
                    description: 'missing version and up'
                }
            ]
        };
        const result = safeValidateExtensionManifest(invalid);
        expect(result.success).toBe(false);
    });

    it('기존 plugin.json 형태(routes/admin/migrations 없음)도 통과', () => {
        expect.hasAssertions();
        const legacy = {
            id: 'wiki',
            name: '위키',
            version: '0.1.0',
            description: '위키 플러그인',
            author: { name: 'Angple', url: 'https://angple.com' },
            license: 'MIT',
            category: 'plugin' as const,
            main: 'index.ts',
            tags: ['wiki'],
            components: [
                {
                    id: 'wiki-board',
                    name: '위키 문서 목록',
                    slot: 'board-list',
                    path: 'components/wiki-board.svelte',
                    priority: 10
                }
            ],
            hooks: [
                {
                    name: 'board.layout.register',
                    type: 'action' as const,
                    callback: 'hooks/register-wiki.ts',
                    priority: 10
                }
            ]
        };
        const result = safeValidateExtensionManifest(legacy);
        expect(result.success).toBe(true);
    });
});
