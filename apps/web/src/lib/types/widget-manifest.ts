/**
 * 위젯 매니페스트 타입 정의 및 Zod 검증 스키마
 *
 * widget.json 파일의 구조를 정의하고 런타임 검증을 제공합니다.
 */

import { z } from 'zod';

/**
 * 위젯 작성자 정보 스키마
 */
const WidgetAuthorSchema = z.object({
    name: z.string().min(1, '작성자 이름은 필수입니다'),
    email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
    url: z.string().url('유효한 URL 형식이어야 합니다').optional()
});

/**
 * 위젯 설정 필드 스키마
 */
const WidgetSettingFieldSchema = z.object({
    label: z.string().min(1, '설정 라벨은 필수입니다'),
    type: z.enum(['text', 'color', 'boolean', 'number', 'select'], {
        message: '지원되지 않는 설정 타입입니다'
    }),
    default: z.any(),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    options: z
        .array(
            z.object({
                label: z.string(),
                value: z.any()
            })
        )
        .optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    /** 동적으로 옵션을 로드할지 여부 (select 타입에서 사용) */
    dynamic: z.boolean().default(false).optional(),
    /** 동적 옵션 로드 API 경로 */
    dynamicEndpoint: z.string().optional()
});

/**
 * 위젯 카테고리
 */
export const WidgetCategorySchema = z.enum([
    'content',
    'sidebar',
    'ad',
    'social',
    'utility',
    'layout'
]);

/**
 * 위젯 슬롯
 */
export const WidgetSlotSchema = z.enum(['main', 'sidebar', 'header', 'footer']);

/**
 * 위젯 매니페스트 메인 스키마
 */
export const WidgetManifestSchema = z.object({
    /** 위젯 ID (kebab-case) */
    id: z
        .string()
        .regex(/^[a-z0-9-]+$/, '위젯 ID는 소문자, 숫자, 하이픈만 사용 가능합니다 (예: my-widget)')
        .min(3, '위젯 ID는 최소 3자 이상이어야 합니다')
        .max(50, '위젯 ID는 최대 50자까지 가능합니다'),

    /** 위젯 이름 */
    name: z
        .string()
        .min(1, '위젯 이름은 필수입니다')
        .max(100, '위젯 이름은 최대 100자까지 가능합니다'),

    /** 위젯 버전 (semver) */
    version: z.string().regex(/^\d+\.\d+\.\d+$/, '버전은 semver 형식이어야 합니다 (예: 1.0.0)'),

    /** 위젯 설명 */
    description: z.string().max(500, '설명은 최대 500자까지 가능합니다').optional(),

    /** 작성자 정보 */
    author: WidgetAuthorSchema,

    /** 위젯 카테고리 */
    category: WidgetCategorySchema,

    /** 사용 가능한 슬롯 */
    slots: z.array(WidgetSlotSchema).min(1, '최소 하나의 슬롯이 필요합니다'),

    /** 위젯 아이콘 (Lucide 아이콘 이름) */
    icon: z.string().optional(),

    /** 위젯 설정 스키마 */
    settings: z.record(z.string(), WidgetSettingFieldSchema).optional(),

    /** 호환 Angple 버전 */
    angpleVersion: z.string().optional(),

    /** 스크린샷 경로 */
    screenshot: z.string().optional(),

    /** 메인 컴포넌트 파일 */
    main: z.string().default('index.svelte'),

    /** 다중 인스턴스 허용 여부 */
    allowMultiple: z.boolean().default(false),

    /** @deprecated slots[] 기반으로 전환됨. 하위 호환성을 위해 유지 */
    sidebarOnly: z.boolean().default(false).optional()
});

/**
 * 위젯 매니페스트 타입
 */
export type WidgetManifest = z.infer<typeof WidgetManifestSchema>;

/**
 * 위젯 카테고리 타입
 */
export type WidgetCategory = z.infer<typeof WidgetCategorySchema>;

/**
 * 위젯 슬롯 타입
 */
export type WidgetSlot = z.infer<typeof WidgetSlotSchema>;

/**
 * 위젯 매니페스트 검증 (안전한 버전 - 오류 시 결과 객체 반환)
 */
export function safeValidateWidgetManifest(data: unknown) {
    return WidgetManifestSchema.safeParse(data);
}

/**
 * 위젯 매니페스트 검증 (오류 시 예외 발생)
 */
export function validateWidgetManifest(data: unknown): WidgetManifest {
    return WidgetManifestSchema.parse(data);
}

/**
 * 확장된 위젯 정보 (스캔 결과)
 */
export interface WidgetInfo extends WidgetManifest {
    /** 위젯 경로 */
    path: string;
    /** 커스텀 위젯 여부 */
    isCustom: boolean;
    /** 활성화 여부 */
    enabled?: boolean;
}

/**
 * 카테고리별 한글 이름
 */
export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
    content: '콘텐츠',
    sidebar: '사이드바',
    ad: '광고',
    social: '소셜',
    utility: '유틸리티',
    layout: '레이아웃'
};

/**
 * 슬롯별 한글 이름
 */
export const WIDGET_SLOT_LABELS: Record<WidgetSlot, string> = {
    main: '메인 영역',
    sidebar: '사이드바',
    header: '헤더',
    footer: '푸터'
};
