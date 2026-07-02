/**
 * 마음메시지 공유 스토어
 *
 * CelebrationRolling(텍스트)과 DamoangBanner(이미지)가
 * 동일한 데이터와 인덱스를 공유하여 싱크 롤링
 *
 * 표시 순서 정책:
 *   - shuffledOrder 가 celebrations 배열의 인덱스 순열을 보관한다.
 *   - 매 tick 마다 position 을 증가시키고 shuffledOrder[position] 을 currentIndex 로 발행한다.
 *   - position 이 shuffledOrder.length 에 도달하면 (= 풀 로테이션 완료)
 *     재셔플 후 position=0 부터 다시 시작 → 모든 메시지의 균등 노출 보장.
 */
import { browser } from '$app/environment';

export interface CelebrationBanner {
    id: number;
    title: string;
    content: string;
    image_url: string;
    link_url: string;
    target_member_nick?: string;
    target_member_photo?: string;
    external_link?: string;
    link_target?: string;
    display_type?: 'image' | 'text';
    alt_text?: string;
    target?: string;
}

let celebrations = $state<CelebrationBanner[]>([]);
let currentIndex = $state(0);
// 셔플된 표시 순서. celebrations 배열의 인덱스를 가리킨다.
// 풀 로테이션이 끝나면 재셔플하여 모든 메시지가 균등하게 노출되도록 한다.
let shuffledOrder: number[] = [];
let position = 0; // shuffledOrder 내의 현재 위치
let fetched = false;
let ready = false;
let fetchPromise: Promise<void> | null = null;
let refCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
// 마지막으로 데이터를 로드한 KST 날짜(YYYY-MM-DD). 자정 롤오버 감지용.
let loadedDateKST = '';
// visibilitychange 리스너 중복 등록 방지 (스토어는 앱 수명 동안 단일 인스턴스).
let visibilityBound = false;
// 롤링 주기. 사용자 요청으로 3s → 2s 로 추가 단축 (메시지 6개 기준 한 바퀴 12s).
const CELEBRATION_ROTATION_INTERVAL_MS = 2_000;

/**
 * KST(Asia/Seoul) 기준 오늘 YYYY-MM-DD.
 * 서버 `$lib/server/celebration.ts` 의 getTodayKST 와 동일 기준 — 마음메시지는
 * display_date(KST 날짜) 단위로 00:00~00:00 노출되므로 클라이언트도 KST 로 날짜 경계를 판단한다.
 */
function getTodayKST(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** Fisher-Yates 셔플 (in-place). length<=1 이면 변경 없이 반환 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** celebrations 길이에 맞춰 shuffledOrder 를 새로 셔플하고 position/currentIndex 를 첫 항목으로 리셋 */
function reshuffleOrder(): void {
    const len = celebrations.length;
    if (len === 0) {
        shuffledOrder = [];
        position = 0;
        currentIndex = 0;
        return;
    }
    const order = Array.from({ length: len }, (_, i) => i);
    fisherYatesShuffle(order);
    shuffledOrder = order;
    position = 0;
    currentIndex = order[0] ?? 0;
}

/**
 * @param allowEmpty true 면 빈 응답(오늘 메시지 0건)일 때 기존 배너를 비운다.
 *   최초 로드는 false(빈 응답 시 깜박임 방지로 유지), 자정 롤오버 재요청은 true
 *   (새 날에 메시지가 없으면 어제 메시지를 계속 보여주면 안 되므로 비움).
 */
async function doFetch(allowEmpty = false): Promise<void> {
    if (!browser) return;

    try {
        const response = await fetch('/api/celebration/today', {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });

        if (!response.ok) return;

        const result = await response.json();
        const list = Array.isArray(result.data) ? result.data : [];

        if (list.length > 0) {
            // 원본 배열은 안정적으로 유지하고 표시 순서는 shuffledOrder 로 제어한다.
            celebrations = [...list];
            reshuffleOrder();
        } else if (allowEmpty) {
            celebrations = [];
            reshuffleOrder();
        }
        // 응답을 정상 수신한 KST 날짜를 기록 (이후 자정 롤오버 비교 기준).
        loadedDateKST = getTodayKST();
    } catch (error) {
        console.warn('CelebrationStore: 마음메시지 로드 실패', error);
    }
}

/**
 * 자정(KST) 롤오버 감지 → 오늘 메시지로 강제 재요청.
 * 페이지를 켜둔 채 자정을 넘기면 mount() 의 fetched 가드 때문에 어제 메시지가 계속 노출되는
 * 문제를 막는다. 롤링 인터벌(2s)과 탭 포커스 복귀 시 호출된다.
 */
function maybeRefetchForDateRollover(): void {
    if (!browser) return;
    if (!loadedDateKST) return; // 최초 로드 전
    if (fetchPromise) return; // 진행 중 요청 있으면 스킵
    if (getTodayKST() === loadedDateKST) return; // 같은 날 — 변화 없음

    fetchPromise = doFetch(true).then(() => {
        fetched = true;
        ready = true;
        fetchPromise = null;
    });
}

function startRotation(): void {
    if (intervalId) return;
    intervalId = setInterval(() => {
        // 자정(KST) 롤오버 시 오늘 메시지로 자동 교체 (메시지 수와 무관하게 매 tick 검사).
        maybeRefetchForDateRollover();

        const len = celebrations.length;
        if (len <= 1) return;
        // 다음 위치로 이동. shuffledOrder 의 끝에 도달하면 재셔플(풀 로테이션 후 새 셔플).
        const nextPos = position + 1;
        if (nextPos >= shuffledOrder.length) {
            reshuffleOrder();
        } else {
            position = nextPos;
            currentIndex = shuffledOrder[nextPos] ?? 0;
        }
    }, CELEBRATION_ROTATION_INTERVAL_MS);
}

function stopRotation(): void {
    // 로테이션을 멈추지 않음 — 페이지 전환 시에도 계속 회전
    // 첫 화면 ↔ 게시판 이동 시 멈춤 방지
}

export function getCelebrations(): CelebrationBanner[] {
    return celebrations;
}

export function getCurrentIndex(): number {
    return currentIndex;
}

export function isReady(): boolean {
    return ready;
}

export function setCurrentIndex(index: number): void {
    currentIndex = index;
}

/** 배너 링크: external_link 우선 → link_url → /message/{id} (현재창 내비게이션) */
export function getLink(banner: CelebrationBanner): string {
    const raw = banner.external_link || banner.link_url || `/message/${banner.id}`;
    // 절대 URL을 상대 경로로 변환 (SPA 내비게이션, 현재창)
    if (browser) {
        try {
            const url = new URL(raw, window.location.origin);
            if (url.hostname === window.location.hostname || url.hostname.endsWith('damoang.net')) {
                return url.pathname + url.search + url.hash;
            }
        } catch {
            // 파싱 실패 시 원본
        }
    }
    return raw;
}

/** 외부 데이터로 초기화 (app-init 스토어에서 주입 시 fetch 스킵) */
export function initFromData(data: CelebrationBanner[]): void {
    // 실 fetch(mount의 doFetch)가 완료된 뒤에는 시드가 데이터를 덮어쓰지 않는다.
    if (fetched) return;

    if (data.length > 0) {
        // 오늘자 SSR 시드로 첫 페인트를 즉시 채운다.
        celebrations = [...data];
        reshuffleOrder();
        loadedDateKST = getTodayKST();
        // fetched 는 설정하지 않는다 — mount()가 /api/celebration/today 로 1회 재검증해
        // (yearly_repeat·최신 이미지·cache-bust 보정) 정확성을 맞춘다. 무감지 스왑.
    }
    // 빈 시드여도 fallback 문구 렌더용으로 ready 만 올린다. celebrations·fetched·loadedDateKST 는
    // 건드리지 않아, 이미 시드된 데이터나 이후 실 fetch 를 막지 않는다(+layout 의 매 호출 무해화).
    ready = true;
}

/** 컴포넌트 마운트 시 호출. fetch + rotation 시작. cleanup 함수 반환 */
export function mount(): () => void {
    refCount++;

    if (!fetched && !fetchPromise) {
        fetchPromise = doFetch().then(() => {
            fetched = true;
            ready = true;
            fetchPromise = null;
        });
    }

    // 백그라운드 탭은 setInterval 이 throttle 되므로, 포커스 복귀 시에도 자정 롤오버를 즉시 확인.
    if (browser && !visibilityBound) {
        visibilityBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') maybeRefetchForDateRollover();
        });
    }

    startRotation();

    return () => {
        refCount--;
        if (refCount <= 0) {
            refCount = 0;
            stopRotation();
        }
    };
}
