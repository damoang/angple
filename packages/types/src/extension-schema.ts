/**
 * ExtensionManifest Zod Validation Schema
 *
 * runtime 검증이 가능한 Zod 스키마를 ExtensionManifest에 추가합니다.
 * 기존 extension.ts의 TypeScript 타입과 1:1 매핑됩니다.
 */

import { z } from 'zod';
import {
    ExtensionCategory,
    PluginType,
    ExtensionPermission,
    ExtensionSettingType
} from './extension';

// ============================================================================
// 기본 스키마
// ============================================================================

/**
 * Extension 작성자 정보
 */
export const ExtensionAuthorSchema = z.object({
    name: z.string().min(1, '작성자 이름은 필수입니다'),
    email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
    url: z.string().url('유효한 URL 형식이어야 합니다').optional(),
    github: z.string().optional()
});

/**
 * Extension 저장소 정보
 */
export const ExtensionRepositorySchema = z.object({
    type: z.enum(['git', 'svn', 'mercurial']),
    url: z.string().url('유효한 저장소 URL이어야 합니다'),
    directory: z.string().optional()
});

/**
 * Extension 엔진 요구사항
 */
export const ExtensionEnginesSchema = z.object({
    node: z.string().optional(),
    sveltekit: z.string().optional(),
    angple: z.string().optional()
});

// ============================================================================
// 설정 필드 스키마
// ============================================================================

/**
 * Extension 설정 필드 정의
 */
export const ExtensionSettingFieldSchema = z.object({
    type: z.enum([
        'string',
        'number',
        'boolean',
        'select',
        'multiselect',
        'textarea',
        'email',
        'url',
        'color',
        'date',
        'time',
        'datetime'
    ] as const),
    label: z.string().min(1, '설정 라벨은 필수입니다'),
    description: z.string().optional(),
    default: z.any().optional(),
    required: z.boolean().optional(),
    secret: z.boolean().optional(),
    options: z
        .array(
            z.union([
                z.string(),
                z.object({
                    label: z.string(),
                    value: z.string()
                })
            ])
        )
        .optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    placeholder: z.string().optional()
});

// ============================================================================
// Hook 시스템 스키마
// ============================================================================

/**
 * Extension Hook 정의
 */
export const ExtensionHookSchema = z.object({
    name: z.string().min(1, 'Hook 이름은 필수입니다'),
    handler: z.string().min(1, 'Hook 핸들러 경로는 필수입니다'),
    priority: z.number().int().min(0).max(100).default(10)
});

// ============================================================================
// API 스키마
// ============================================================================

/**
 * Extension API 라우트 정의
 */
export const ExtensionAPIRouteSchema = z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string().regex(/^\//, 'API 경로는 /로 시작해야 합니다'),
    handler: z.string().min(1, '핸들러 경로는 필수입니다'),
    permissions: z.array(z.nativeEnum(ExtensionPermission)).optional(),
    authenticated: z.boolean().optional(),
    rateLimit: z.number().int().positive().optional()
});

/**
 * Extension REST API 설정
 */
export const ExtensionRESTAPISchema = z.object({
    prefix: z.string().regex(/^\//, 'API prefix는 /로 시작해야 합니다'),
    routes: z.array(ExtensionAPIRouteSchema)
});

/**
 * Extension GraphQL API 설정
 */
export const ExtensionGraphQLAPISchema = z.object({
    schema: z.string().min(1, 'GraphQL 스키마 파일 경로는 필수입니다'),
    resolvers: z.string().min(1, 'Resolver 파일 경로는 필수입니다')
});

/**
 * Extension API 설정
 */
export const ExtensionAPISchema = z.object({
    rest: ExtensionRESTAPISchema.optional(),
    graphql: ExtensionGraphQLAPISchema.optional()
});

// ============================================================================
// UI 스키마
// ============================================================================

/**
 * Extension Admin UI 메뉴 설정
 */
export const ExtensionAdminMenuSchema = z.object({
    title: z.string().min(1, '메뉴 제목은 필수입니다'),
    icon: z.string().optional(),
    position: z.number().int().optional(),
    component: z.string().min(1, 'Svelte 컴포넌트 경로는 필수입니다')
});

/**
 * Extension Admin UI 설정
 */
export const ExtensionAdminUISchema = z.object({
    menu: ExtensionAdminMenuSchema.optional(),
    settings: z
        .object({
            component: z.string().min(1)
        })
        .optional()
});

/**
 * Extension Editor UI 설정
 */
export const ExtensionEditorUISchema = z.object({
    toolbar: z
        .object({
            component: z.string().min(1)
        })
        .optional(),
    sidebar: z
        .object({
            component: z.string().min(1)
        })
        .optional()
});

/**
 * Extension UI 설정
 */
export const ExtensionUISchema = z.object({
    admin: ExtensionAdminUISchema.optional(),
    editor: ExtensionEditorUISchema.optional()
});

// ============================================================================
// 메인 매니페스트 스키마
// ============================================================================

/**
 * ExtensionManifest 기본 스키마 (refine 적용 전)
 *
 * Note: .refine()으로 인해 ZodEffects가 되므로,
 * partial은 이 원본 객체 스키마에서 만들어야 합니다.
 */
const BaseExtensionManifestSchema = z.object({
    // 필수 필드
    id: z
        .string()
        .regex(
            /^[a-z0-9-]+$/,
            'Extension ID는 소문자, 숫자, 하이픈만 사용 가능합니다 (예: my-extension)'
        )
        .min(3, 'Extension ID는 최소 3자 이상이어야 합니다')
        .max(50, 'Extension ID는 최대 50자까지 가능합니다'),
    name: z
        .string()
        .min(1, 'Extension 이름은 필수입니다')
        .max(100, 'Extension 이름은 최대 100자까지 가능합니다'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, '버전은 semver 형식이어야 합니다 (예: 1.0.0)'),
    description: z.string().max(500, '설명은 최대 500자까지 가능합니다'),
    author: ExtensionAuthorSchema,
    license: z.string().min(1, '라이선스는 필수입니다'),
    category: z.enum(['theme', 'plugin'] as const, {
        message: 'category는 theme 또는 plugin이어야 합니다'
    }),
    main: z.string().min(1, 'Entry point (main)는 필수입니다'),

    // 선택 필드
    pluginType: z.nativeEnum(PluginType).optional(),
    tags: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    angpleVersion: z
        .string()
        .regex(/^[><=~^]*\d+\.\d+\.\d+$/, '유효한 버전 범위 형식이어야 합니다')
        .optional(),
    engines: ExtensionEnginesSchema.optional(),
    types: z.string().optional(),
    permissions: z.array(z.nativeEnum(ExtensionPermission)).optional(),
    hooks: z.record(z.string(), z.string()).optional(),
    api: ExtensionAPISchema.optional(),
    ui: ExtensionUISchema.optional(),
    settings: z.record(z.string(), ExtensionSettingFieldSchema).optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    homepage: z.string().url().optional(),
    repository: ExtensionRepositorySchema.optional(),
    bugs: z.string().url().optional(),
    screenshot: z.string().optional(),
    readme: z.string().optional(),
    changelog: z.string().optional(),
    price: z.number().min(0).optional(),
    downloads: z.number().int().min(0).optional(),
    rating: z.number().min(1).max(5).optional(),
    updatedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime().optional(),
    active: z.boolean().optional(),
    isCustom: z.boolean().optional()
});

/**
 * ExtensionManifest Zod 검증 스키마 (refine 적용)
 *
 * 테마와 플러그인 모두 이 스키마를 사용합니다.
 * category 필드로 구분하고, pluginType으로 플러그인 세부 분류합니다.
 */
export const ExtensionManifestSchema = BaseExtensionManifestSchema.refine(
    (data) => {
        // category가 'plugin'일 때만 pluginType 허용
        if (data.category === 'theme' && data.pluginType) {
            return false;
        }
        return true;
    },
    {
        message: 'pluginType은 category가 plugin일 때만 사용할 수 있습니다',
        path: ['pluginType']
    }
);

/**
 * 부분 매니페스트 검증 (일부 필드만 업데이트하는 경우)
 */
export const PartialExtensionManifestSchema = BaseExtensionManifestSchema.partial();
export type PartialExtensionManifest = z.infer<typeof PartialExtensionManifestSchema>;

/**
 * TypeScript 타입 추론 (extension.ts와 동일)
 */
export type ExtensionManifestValidated = z.infer<typeof ExtensionManifestSchema>;

// ============================================================================
// 검증 함수
// ============================================================================

/**
 * extension.json / plugin.json 데이터 검증 함수
 *
 * @param data - 검증할 JSON 데이터
 * @returns 검증된 ExtensionManifest 객체
 * @throws ZodError - 검증 실패 시
 */
export function validateExtensionManifest(data: unknown): ExtensionManifestValidated {
    return ExtensionManifestSchema.parse(data);
}

/**
 * extension.json / plugin.json 데이터 안전 검증 함수
 *
 * @param data - 검증할 JSON 데이터
 * @returns 성공 시 { success: true, data }, 실패 시 { success: false, error }
 */
export function safeValidateExtensionManifest(data: unknown) {
    return ExtensionManifestSchema.safeParse(data);
}
