/**
 * Google Publisher Tag (GPT) 타입 정의
 */

export interface GoogleTagPubAdsService {
    enableSingleRequest(): void;
    collapseEmptyDivs(collapse?: boolean): void;
    setTargeting(key: string, value: string | string[]): GoogleTagPubAdsService;
    refresh(slots?: GoogleTagSlot[], options?: { changeCorrelator: boolean }): void;
    addEventListener(
        eventType: string,
        listener: (event: GoogleTagSlotRenderEndedEvent) => void
    ): void;
}

export interface GoogleTagSlot {
    addService(service: GoogleTagPubAdsService): GoogleTagSlot;
    defineSizeMapping(sizeMapping: GoogleTagSizeMapping[]): GoogleTagSlot;
    setTargeting(key: string, value: string | string[]): GoogleTagSlot;
    getSlotElementId(): string;
}

export interface GoogleTagSizeMappingBuilder {
    addSize(viewportSize: number[], slotSize: number[] | number[][]): GoogleTagSizeMappingBuilder;
    build(): GoogleTagSizeMapping[];
}

export type GoogleTagSizeMapping = [number[], number[] | number[][]];

export interface GoogleTagSlotRenderEndedEvent {
    isEmpty: boolean;
    size: number[] | null;
    slot: GoogleTagSlot;
    serviceName: string;
}

export interface GoogleTagInterface {
    cmd: Array<() => void>;
    pubads(): GoogleTagPubAdsService;
    defineSlot(
        adUnitPath: string,
        size: number[] | number[][],
        divId: string
    ): GoogleTagSlot | null;
    enableServices(): void;
    display(divId: string): void;
    destroySlots(slots?: GoogleTagSlot[]): boolean;
    sizeMapping(): GoogleTagSizeMappingBuilder;
}
