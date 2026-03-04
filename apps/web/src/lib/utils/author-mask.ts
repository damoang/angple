/**
 * 작성자 마스킹 유틸리티
 * 게시판 설정에 따라 작성자 이름/ID를 마스킹합니다.
 */

export interface AuthorDisplaySettings {
    /** 작성자 완전 숨김 (***로 표시) */
    hide_author?: boolean;
    /** 작성자 부분 마스킹 (홍** 형태) */
    mask_author_partial?: boolean;
    /** 작성자 ID 숨김 */
    hide_author_id?: boolean;
}

/**
 * 작성자 이름을 마스킹합니다.
 *
 * @param name - 원본 작성자 이름
 * @param settings - 마스킹 설정
 * @returns 마스킹된 이름
 *
 * @example
 * maskAuthorName('홍길동', { hide_author: true }) // '***'
 * maskAuthorName('홍길동', { mask_author_partial: true }) // '홍**'
 * maskAuthorName('김철수', { mask_author_partial: true }) // '김**'
 * maskAuthorName('AB', { mask_author_partial: true }) // 'A*'
 */
export function maskAuthorName(name: string, settings?: AuthorDisplaySettings): string {
    if (!settings || !name) return name;

    // 완전 숨김
    if (settings.hide_author) {
        return '***';
    }

    // 부분 마스킹: 첫 글자만 보이고 나머지는 *
    if (settings.mask_author_partial && name.length > 1) {
        return name[0] + '*'.repeat(name.length - 1);
    }

    return name;
}

/**
 * 작성자 ID를 마스킹합니다.
 *
 * @param id - 원본 작성자 ID
 * @param settings - 마스킹 설정
 * @returns 마스킹된 ID 또는 null (숨김 시)
 *
 * @example
 * maskAuthorId('user123', { hide_author_id: true }) // null
 * maskAuthorId('user123', { hide_author: true }) // null
 * maskAuthorId('user123', {}) // 'user123'
 */
export function maskAuthorId(id: string, settings?: AuthorDisplaySettings): string | null {
    if (!settings || !id) return id;

    // 완전 숨김이면 ID도 숨김
    if (settings.hide_author || settings.hide_author_id) {
        return null;
    }

    return id;
}

/**
 * 작성자 표시 문자열을 생성합니다.
 * 이름과 ID를 조합하여 표시합니다.
 *
 * @param name - 작성자 이름
 * @param id - 작성자 ID (optional)
 * @param settings - 마스킹 설정
 * @returns 표시용 문자열
 *
 * @example
 * formatAuthor('홍길동', 'hong', {}) // '홍길동 (hong)'
 * formatAuthor('홍길동', 'hong', { hide_author_id: true }) // '홍길동'
 * formatAuthor('홍길동', 'hong', { mask_author_partial: true }) // '홍** (hong)'
 * formatAuthor('홍길동', 'hong', { hide_author: true }) // '***'
 */
export function formatAuthor(
    name: string,
    id?: string | null,
    settings?: AuthorDisplaySettings
): string {
    const maskedName = maskAuthorName(name, settings);

    // 완전 숨김이면 이름만 반환
    if (settings?.hide_author) {
        return maskedName;
    }

    // ID가 없거나 숨김이면 이름만 반환
    const maskedId = id ? maskAuthorId(id, settings) : null;
    if (!maskedId) {
        return maskedName;
    }

    return `${maskedName} (${maskedId})`;
}
