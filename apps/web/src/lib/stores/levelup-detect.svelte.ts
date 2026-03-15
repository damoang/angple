/**
 * localStorage 기반 레벨업 감지
 *
 * SSR에서 받은 현재 레벨과 localStorage에 저장된 이전 레벨을 비교하여
 * 레벨 상승을 감지합니다. 서버 추가 요청 0, 100% 클라이언트 사이드.
 */

const LEVEL_KEY = 'angple_lastKnownLevel';
const CELEBRATED_KEY = 'angple_levelupCelebrated';

// 축하 모달 상태
let showCelebration = $state(false);
let newLevel = $state(0);
let previousLevel = $state(0);

/**
 * 레벨업 여부 확인
 * - localStorage에 값이 없으면 (첫 방문) → 현재 레벨만 저장, 축하 안 띄움
 * - 이전 레벨보다 현재 레벨이 높으면 → 축하 모달 표시
 * - 동일 전환에 대해 중복 표시 방지 (CELEBRATED_KEY)
 */
function checkLevelUp(currentLevel: number): void {
    if (typeof localStorage === 'undefined' || !currentLevel) return;

    const stored = localStorage.getItem(LEVEL_KEY);

    if (stored === null) {
        // 첫 방문: 현재 레벨 저장만 하고 축하 안 띄움
        localStorage.setItem(LEVEL_KEY, String(currentLevel));
        return;
    }

    const lastLevel = parseInt(stored, 10);

    if (currentLevel > lastLevel) {
        // 동일 전환 중복 표시 방지
        const celebratedKey = `${CELEBRATED_KEY}_${lastLevel}_${currentLevel}`;
        if (localStorage.getItem(celebratedKey)) {
            // 이미 축하한 전환 → 레벨만 갱신
            localStorage.setItem(LEVEL_KEY, String(currentLevel));
            return;
        }

        previousLevel = lastLevel;
        newLevel = currentLevel;
        showCelebration = true;

        // 중복 방지 마킹
        localStorage.setItem(celebratedKey, '1');
        localStorage.setItem(LEVEL_KEY, String(currentLevel));
    } else if (currentLevel !== lastLevel) {
        // 레벨이 내려간 경우 (관리자 수동 변경 등) → 저장만
        localStorage.setItem(LEVEL_KEY, String(currentLevel));
    }
}

/**
 * 축하 모달 닫기
 */
function dismissCelebration(): void {
    showCelebration = false;
}

/**
 * SSE 등 외부 트리거로 축하 표시
 */
function triggerCelebration(level: number): void {
    newLevel = level;
    previousLevel = 0;
    showCelebration = true;
}

export function getShowCelebration() {
    return showCelebration;
}

export function getNewLevel() {
    return newLevel;
}

export function getPreviousLevel() {
    return previousLevel;
}

export const levelupDetect = {
    get showCelebration() {
        return showCelebration;
    },
    get newLevel() {
        return newLevel;
    },
    get previousLevel() {
        return previousLevel;
    },
    checkLevelUp,
    dismissCelebration,
    triggerCelebration
};
