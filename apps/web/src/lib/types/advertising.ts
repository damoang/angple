/**
 * GAM (Google Ad Manager) 광고 관련 타입 정의
 */

/** GAM 네트워크 설정 */
export interface GAMConfig {
    network_code: string; // "22996793498"
    enable_gam: boolean;
    enable_fallback: boolean;
}

/** GAM 광고 유닛 설정 */
export interface AdUnitConfig {
    unit: string; // GAM unit path (e.g., "/22996793498/main")
    sizes: number[][]; // [[728,90], [300,250]]
    responsive?: ResponsiveMapping[];
}

/** 반응형 사이즈 매핑 */
export interface ResponsiveMapping {
    viewport: number; // min-width
    sizes: number[][]; // 해당 뷰포트에서 사용할 사이즈들
}

/** AdSense 설정 */
export interface AdSenseConfig {
    client_id: string; // "ca-pub-5124617752473025"
    slot: string; // 위치별 슬롯 ID
}

/** 위치별 광고 설정 */
export interface AdPositionConfig {
    position: string;
    gam?: AdUnitConfig;
    adsense?: AdSenseConfig;
    rotation_index?: number;
}

/** 광고 사이즈 프리셋 */
export const AD_SIZES = {
    // 가로형
    LEADERBOARD: [728, 90],
    LARGE_LEADERBOARD: [970, 90],
    BILLBOARD: [970, 250],

    // 정사각형/직사각형
    MEDIUM_RECTANGLE: [300, 250],
    LARGE_RECTANGLE: [336, 280],
    HALF_PAGE: [300, 600],

    // 세로형
    WIDE_SKYSCRAPER: [160, 600],
    SKYSCRAPER: [120, 600]
} as const;

/** 광고 위치별 기본 사이즈 매핑 */
export const POSITION_SIZES: Record<string, number[][]> = {
    'wing-left': [[160, 600]],
    'wing-right': [[160, 600]],
    'index-head': [
        [728, 90],
        [970, 250]
    ],
    'index-top': [[728, 90]],
    'index-middle-1': [
        [728, 90],
        [300, 250]
    ],
    'index-middle-2': [
        [728, 90],
        [300, 250]
    ],
    'index-middle-3': [
        [728, 90],
        [300, 250]
    ],
    'index-bottom': [
        [728, 90],
        [970, 90]
    ],
    sidebar: [[300, 250]],
    halfpage: [
        [300, 600],
        [160, 600]
    ],
    'board-head': [[728, 90]],
    'board-content': [
        [300, 250],
        [336, 280]
    ]
};

/** AdSense 슬롯 매핑 */
export const ADSENSE_SLOTS: Record<string, string> = {
    'index-head': '7466402991',
    'index-top': '7466402991',
    'index-middle-1': '7466402991',
    'index-middle-2': '7466402991',
    'index-middle-3': '7466402991',
    'index-bottom': '7466402991',
    sidebar: '7466402991',
    halfpage: '7464730194',
    'wing-left': '7464730194',
    'wing-right': '1774011047',
    'board-head': '7466402991',
    'board-content': '7466402991'
};

/** Google Publisher Tag 타입 정의 */
export interface GoogleTag {
    cmd: Array<() => void>;
    pubads(): PubAdsService;
    defineSlot(adUnitPath: string, size: number[] | number[][], divId: string): Slot | null;
    enableServices(): void;
    display(divId: string): void;
    destroySlots(slots?: Slot[]): boolean;
    sizeMapping(): SizeMappingBuilder;
}

export interface PubAdsService {
    enableSingleRequest(): void;
    collapseEmptyDivs(collapse?: boolean): void;
    setTargeting(key: string, value: string | string[]): PubAdsService;
    refresh(slots?: Slot[], options?: { changeCorrelator: boolean }): void;
    addEventListener(eventType: string, listener: (event: SlotRenderEndedEvent) => void): void;
}

export interface Slot {
    addService(service: PubAdsService): Slot;
    defineSizeMapping(sizeMapping: SizeMapping[]): Slot;
    setTargeting(key: string, value: string | string[]): Slot;
    getSlotElementId(): string;
}

export interface SizeMappingBuilder {
    addSize(viewportSize: number[], slotSize: number[] | number[][]): SizeMappingBuilder;
    build(): SizeMapping[];
}

export type SizeMapping = [number[], number[] | number[][]];

export interface SlotRenderEndedEvent {
    isEmpty: boolean;
    size: number[] | null;
    slot: Slot;
    serviceName: string;
}
