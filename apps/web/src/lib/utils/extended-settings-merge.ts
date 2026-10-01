type SettingsRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is SettingsRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 기존 확장설정 위에 관리자 폼 값을 덮어쓴다.
 * 백엔드 PUT 은 settings 를 통째로 저장하므로, 폼이 모르는 키(섹션 안 키·최상위 섹션)를
 * 새 객체로 만들면 저장 한 번에 지워진다. 그래서 최상위와 섹션 안(1단계)까지 원본을 먼저 펼친다.
 * 배열·원시값 섹션은 병합할 수 없으므로 update 값으로 대체한다.
 */
export function mergeExtendedSettings<T extends object>(prev: T | null | undefined, update: T): T {
    const merged: SettingsRecord = { ...(prev ?? {}) };
    for (const [key, value] of Object.entries(update)) {
        // undefined 는 JSON 직렬화에서 빠져 키가 지워지므로 「안 보냄」으로 보고 원본을 둔다
        if (value === undefined) continue;
        const before = merged[key];
        merged[key] =
            isPlainObject(before) && isPlainObject(value) ? { ...before, ...value } : value;
    }
    return merged as T;
}
