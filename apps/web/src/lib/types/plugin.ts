/**
 * 플러그인 매니페스트 타입 정의 및 Zod 검증 스키마
 *
 * plugin.json 파일의 구조를 정의하고 런타임 검증을 제공합니다.
 * 테마 시스템과 동일한 패턴으로 구현되었습니다.
 */

import { z } from 'zod';

/**
 * 플러그인 작성자 정보 스키마
 */
const PluginAuthorSchema = z.object({
    name: z.string().min(1, '작성자 이름은 필수입니다'),
    email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
    url: z.string().url('유효한 URL 형식이어야 합니다').optional()
});

/**
 * Hook 정의 스키마
 */
const PluginHookSchema = z.object({
    name: z.string().min(1, 'Hook 이름은 필수입니다'),
    type: z.enum(['action', 'filter'], {
        message: 'Hook 타입은 action 또는 filter여야 합니다'
    }),
    callback: z.string().min(1, 'Hook 콜백 경로는 필수입니다'),
    priority: z.number().int().min(0).max(100).default(10)
});

/**
 * Component 정의 스키마
 */
const PluginComponentSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'Component ID는 소문자, 숫자, 하이픈만 사용 가능합니다'),
    name: z.string().min(1, 'Component 이름은 필수입니다'),
    slot: z.string().min(1, 'Slot 이름은 필수입니다'),
    path: z.string().min(1, 'Component 경로는 필수입니다'),
    priority: z.number().int().min(0).max(100).default(10),
    props: z.record(z.string(), z.any()).optional()
});

/**
 * 플러그인 설정 필드 스키마
 */
const PluginSettingFieldSchema = z.object({
    label: z.string().min(1, '설정 라벨은 필수입니다'),
    type: z.enum(['text', 'color', 'boolean', 'number', 'select', 'textarea', 'url'], {
        message: '지원되지 않는 설정 타입입니다'
    }),
    default: z.any(),
    description: z.string().optional(),
    // select 타입의 경우 options 필요
    options: z
        .array(
            z.object({
                label: z.string(),
                value: z.any()
            })
        )
        .optional(),
    // number 타입의 경우 범위 지정
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    // 비밀 정보 여부 (API 키 등)
    secret: z.boolean().optional()
});

/**
 * 플러그인 매니페스트 메인 스키마
 */
export const PluginManifestSchema = z.object({
    /** 플러그인 ID (kebab-case) */
    id: z
        .string()
        .regex(
            /^[a-z0-9-]+$/,
            '플러그인 ID는 소문자, 숫자, 하이픈만 사용 가능합니다 (예: my-plugin)'
        )
        .min(3, '플러그인 ID는 최소 3자 이상이어야 합니다')
        .max(50, '플러그인 ID는 최대 50자까지 가능합니다'),

    /** 플러그인 이름 */
    name: z
        .string()
        .min(1, '플러그인 이름은 필수입니다')
        .max(100, '플러그인 이름은 최대 100자까지 가능합니다'),

    /** 플러그인 버전 (semver) */
    version: z.string().regex(/^\d+\.\d+\.\d+$/, '버전은 semver 형식이어야 합니다 (예: 1.0.0)'),

    /** 작성자 정보 */
    author: PluginAuthorSchema,

    /** 플러그인 설명 */
    description: z.string().max(500, '설명은 최대 500자까지 가능합니다').optional(),

    /** 스크린샷 경로 */
    screenshot: z.string().optional(),

    /** Hook 정의 */
    hooks: z.array(PluginHookSchema).optional(),

    /** Component 정의 */
    components: z.array(PluginComponentSchema).optional(),

    /** 플러그인 설정 스키마 */
    settings: z.record(z.string(), PluginSettingFieldSchema).optional(),

    /** 필요한 Angple 버전 */
    angpleVersion: z
        .string()
        .regex(/^\d+\.\d+\.\d+$/, 'Angple 버전은 semver 형식이어야 합니다 (예: 0.1.0)')
        .optional(),

    /** 태그 (검색/필터링용) */
    tags: z.array(z.string()).optional(),

    /** 의존하는 다른 플러그인 */
    dependencies: z
        .record(
            z.string(), // 패키지 이름
            z.string() // 버전 범위
        )
        .optional()
});

/**
 * TypeScript 타입 추론
 */
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginAuthor = z.infer<typeof PluginAuthorSchema>;
export type PluginHook = z.infer<typeof PluginHookSchema>;
export type PluginComponent = z.infer<typeof PluginComponentSchema>;
export type PluginSettingField = z.infer<typeof PluginSettingFieldSchema>;

/**
 * plugin.json 데이터 검증 함수
 *
 * @param data - 검증할 JSON 데이터
 * @returns 검증된 PluginManifest 객체
 * @throws ZodError - 검증 실패 시
 *
 * @example
 * ```typescript
 * try {
 *   const manifest = validatePluginManifest(jsonData);
 *   console.log('플러그인 검증 성공:', manifest.name);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error('플러그인 검증 실패:', error.issues);
 *   }
 * }
 * ```
 */
export function validatePluginManifest(data: unknown): PluginManifest {
    return PluginManifestSchema.parse(data);
}

/**
 * plugin.json 데이터 안전 검증 함수 (에러를 반환)
 *
 * @param data - 검증할 JSON 데이터
 * @returns 성공 시 { success: true, data }, 실패 시 { success: false, error }
 *
 * @example
 * ```typescript
 * const result = safeValidatePluginManifest(jsonData);
 * if (result.success) {
 *   console.log('플러그인:', result.data.name);
 * } else {
 *   console.error('검증 에러:', result.error.issues);
 * }
 * ```
 */
export function safeValidatePluginManifest(data: unknown) {
    return PluginManifestSchema.safeParse(data);
}

/**
 * 부분 매니페스트 검증 (일부 필드만 업데이트하는 경우)
 */
export const PartialPluginManifestSchema = PluginManifestSchema.partial();
export type PartialPluginManifest = z.infer<typeof PartialPluginManifestSchema>;
