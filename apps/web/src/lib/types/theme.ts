/**
 * 테마 매니페스트 타입 정의 및 Zod 검증 스키마
 *
 * theme.json 파일의 구조를 정의하고 런타임 검증을 제공합니다.
 */

import { z } from 'zod';

/**
 * 테마 작성자 정보 스키마
 */
const ThemeAuthorSchema = z.object({
	name: z.string().min(1, '작성자 이름은 필수입니다'),
	email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
	url: z.string().url('유효한 URL 형식이어야 합니다').optional()
});

/**
 * Hook 정의 스키마
 */
const ThemeHookSchema = z.object({
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
const ThemeComponentSchema = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/, 'Component ID는 소문자, 숫자, 하이픈만 사용 가능합니다'),
	name: z.string().min(1, 'Component 이름은 필수입니다'),
	slot: z.string().min(1, 'Slot 이름은 필수입니다'),
	path: z.string().min(1, 'Component 경로는 필수입니다'),
	priority: z.number().int().min(0).max(100).default(10)
});

/**
 * 테마 설정 필드 스키마
 */
const ThemeSettingFieldSchema = z.object({
	label: z.string().min(1, '설정 라벨은 필수입니다'),
	type: z.enum(['text', 'color', 'boolean', 'number', 'select'], {
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
	step: z.number().optional()
});

/**
 * 테마 매니페스트 메인 스키마
 */
export const ThemeManifestSchema = z.object({
	/** 테마 ID (kebab-case) */
	id: z
		.string()
		.regex(/^[a-z0-9-]+$/, '테마 ID는 소문자, 숫자, 하이픈만 사용 가능합니다 (예: my-theme)')
		.min(3, '테마 ID는 최소 3자 이상이어야 합니다')
		.max(50, '테마 ID는 최대 50자까지 가능합니다'),

	/** 테마 이름 */
	name: z
		.string()
		.min(1, '테마 이름은 필수입니다')
		.max(100, '테마 이름은 최대 100자까지 가능합니다'),

	/** 테마 버전 (semver) */
	version: z
		.string()
		.regex(
			/^\d+\.\d+\.\d+$/,
			'버전은 semver 형식이어야 합니다 (예: 1.0.0)'
		),

	/** 작성자 정보 */
	author: ThemeAuthorSchema,

	/** 테마 설명 */
	description: z.string().max(500, '설명은 최대 500자까지 가능합니다').optional(),

	/** 스크린샷 경로 */
	screenshot: z.string().optional(),

	/** Hook 정의 */
	hooks: z.array(ThemeHookSchema).optional(),

	/** Component 정의 */
	components: z.array(ThemeComponentSchema).optional(),

	/** 테마 설정 스키마 */
	settings: z
		.record(
			z.string(), // 카테고리 이름 (예: appearance, layout)
			z.record(
				z.string(), // 설정 필드 이름 (예: primaryColor)
				ThemeSettingFieldSchema
			)
		)
		.optional(),

	/** 필요한 Angple 버전 */
	angpleVersion: z
		.string()
		.regex(
			/^\d+\.\d+\.\d+$/,
			'Angple 버전은 semver 형식이어야 합니다 (예: 0.1.0)'
		),

	/** 태그 (검색/필터링용) */
	tags: z.array(z.string()).optional(),

	/** 의존하는 다른 테마 또는 플러그인 */
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
export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;
export type ThemeAuthor = z.infer<typeof ThemeAuthorSchema>;
export type ThemeHook = z.infer<typeof ThemeHookSchema>;
export type ThemeComponent = z.infer<typeof ThemeComponentSchema>;
export type ThemeSettingField = z.infer<typeof ThemeSettingFieldSchema>;

/**
 * theme.json 데이터 검증 함수
 *
 * @param data - 검증할 JSON 데이터
 * @returns 검증된 ThemeManifest 객체
 * @throws ZodError - 검증 실패 시
 *
 * @example
 * ```typescript
 * try {
 *   const manifest = validateThemeManifest(jsonData);
 *   console.log('테마 검증 성공:', manifest.name);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error('테마 검증 실패:', error.issues);
 *   }
 * }
 * ```
 */
export function validateThemeManifest(data: unknown): ThemeManifest {
	return ThemeManifestSchema.parse(data);
}

/**
 * theme.json 데이터 안전 검증 함수 (에러를 반환)
 *
 * @param data - 검증할 JSON 데이터
 * @returns 성공 시 { success: true, data }, 실패 시 { success: false, error }
 *
 * @example
 * ```typescript
 * const result = safeValidateThemeManifest(jsonData);
 * if (result.success) {
 *   console.log('테마:', result.data.name);
 * } else {
 *   console.error('검증 에러:', result.error.issues);
 * }
 * ```
 */
export function safeValidateThemeManifest(data: unknown) {
	return ThemeManifestSchema.safeParse(data);
}

/**
 * 부분 매니페스트 검증 (일부 필드만 업데이트하는 경우)
 */
export const PartialThemeManifestSchema = ThemeManifestSchema.partial();
export type PartialThemeManifest = z.infer<typeof PartialThemeManifestSchema>;
