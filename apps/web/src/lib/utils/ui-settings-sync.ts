/**
 * 서버(L2)에 저장된 UI 설정 blob 이 알려진 설정 키 중 일부를 빠뜨렸는지.
 *
 * 설정 항목이 새로 추가되면 예전에 저장된 서버 blob 에는 그 키가 없다. 그럴 때만
 * 병합 후 서버로 한 번 올려(backfill) 다른 기기에서도 같은 값을 보게 한다.
 * 키가 모두 있으면 false — 서버에서 받은 값을 그대로 다시 저장하지 않는다.
 *
 * ⛔ knownKeys 는 기본값(DEFAULTS)의 키만 넘긴다. localStorage 에 남은 옛 키까지 넣으면
 *    서버 화이트리스트가 그 키를 버리므로 매 로드마다 다시 올리게 된다.
 */
export function serverBlobLacksKeys(
    knownKeys: readonly string[],
    server: object | null | undefined
): boolean {
    if (!server || typeof server !== 'object') return false;
    return knownKeys.some((k) => !Object.prototype.hasOwnProperty.call(server, k));
}
