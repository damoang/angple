/**
 * Content Format Registry
 *
 * board_type 기반으로 본문 콘텐츠 형식(HTML | Markdown)을 결정하는 레지스트리.
 * 플러그인이 자신의 board_type을 'markdown'으로 opt-in 하면,
 * 글쓰기/편집 화면에서 에디터가 마크다운 소스 모드로 동작하고 마크다운 원문을 저장한다.
 *
 * 기본값은 'html' 이므로, 등록하지 않은 일반 게시판(damoang.net 등)은 기존 동작(WYSIWYG/HTML 저장) 그대로다.
 *
 * @example
 * ```ts
 * // 플러그인에서 등록 (예: 위키)
 * contentFormatRegistry.register('wiki', 'markdown');
 *
 * // 코어에서 resolve
 * const format = contentFormatRegistry.resolve(board.board_type);
 * // → 'markdown' 또는 'html'(기본)
 * ```
 */

export type ContentFormat = 'html' | 'markdown';

interface ContentFormatEntry {
    format: ContentFormat;
    source: 'core' | 'plugin';
}

class ContentFormatRegistry {
    private static instance: ContentFormatRegistry;
    private formats: Map<string, ContentFormatEntry> = new Map();

    private constructor() {}

    static getInstance(): ContentFormatRegistry {
        if (!ContentFormatRegistry.instance) {
            ContentFormatRegistry.instance = new ContentFormatRegistry();
        }
        return ContentFormatRegistry.instance;
    }

    /**
     * board_type 의 본문 콘텐츠 형식 등록
     *
     * @param boardType - 게시판 타입 (예: 'wiki')
     * @param format - 'html' | 'markdown'
     * @param source - 등록 소스 ('core' | 'plugin'), plugin이 core를 오버라이드
     */
    register(boardType: string, format: ContentFormat, source: 'core' | 'plugin' = 'plugin'): void {
        const existing = this.formats.get(boardType);

        // plugin 소스가 core를 오버라이드
        if (existing && existing.source === 'plugin' && source === 'core') {
            return;
        }

        this.formats.set(boardType, { format, source });
    }

    /**
     * board_type 에 해당하는 콘텐츠 형식 resolve
     *
     * @param boardType - 게시판 타입 (없거나 미등록이면 'html')
     * @returns 'html' | 'markdown'
     */
    resolve(boardType: string | undefined | null): ContentFormat {
        if (!boardType) return 'html';
        return this.formats.get(boardType)?.format ?? 'html';
    }

    /**
     * 특정 소스의 모든 등록 제거 (플러그인 비활성화 시)
     */
    removeBySource(source: 'core' | 'plugin'): void {
        for (const [key, entry] of this.formats) {
            if (entry.source === source) {
                this.formats.delete(key);
            }
        }
    }
}

/** 싱글톤 인스턴스 */
export const contentFormatRegistry = ContentFormatRegistry.getInstance();
