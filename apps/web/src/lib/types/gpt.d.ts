/**
 * Google Publisher Tag (GPT) 타입 정의
 */

declare namespace googletag {
    interface Slot {
        addService(service: Service): Slot;
        defineSizeMapping(sizeMapping: SizeMappingArray): Slot;
        get(key: string): string | null;
        getAdUnitPath(): string;
        getAttributeKeys(): string[];
        getCategoryExclusions(): string[];
        getResponseInformation(): ResponseInformation | null;
        getSlotElementId(): string;
        getTargeting(key: string): string[];
        getTargetingKeys(): string[];
        set(key: string, value: string): Slot;
        setCategoryExclusion(categoryExclusion: string): Slot;
        setClickUrl(value: string): Slot;
        setCollapseEmptyDiv(collapse: boolean, collapseBeforeAdFetch?: boolean): Slot;
        setForceSafeFrame(forceSafeFrame: boolean): Slot;
        setSafeFrameConfig(config: SafeFrameConfig): Slot;
        setTargeting(key: string, value: string | string[]): Slot;
    }

    interface Service {
        addEventListener<K extends keyof events.EventTypeMap>(
            eventType: K,
            listener: (event: events.EventTypeMap[K]) => void
        ): Service;
        getSlots(): Slot[];
        removeEventListener<K extends keyof events.EventTypeMap>(
            eventType: K,
            listener: (event: events.EventTypeMap[K]) => void
        ): Service;
    }

    interface PubAdsService extends Service {
        clear(slots?: Slot[]): boolean;
        clearCategoryExclusions(): PubAdsService;
        clearTargeting(key?: string): PubAdsService;
        collapseEmptyDivs(collapseBeforeAdFetch?: boolean): boolean;
        disableInitialLoad(): void;
        display(adUnitPath: string, size: GeneralSize, optDiv?: string | Element, optClickUrl?: string): Slot;
        enableAsyncRendering(): boolean;
        enableLazyLoad(config?: LazyLoadOptionsConfig): void;
        enableSingleRequest(): boolean;
        enableVideoAds(): void;
        get(key: string): string | null;
        getAttributeKeys(): string[];
        getTargeting(key: string): string[];
        getTargetingKeys(): string[];
        refresh(slots?: Slot[], options?: { changeCorrelator: boolean }): void;
        set(key: string, value: string): PubAdsService;
        setCategoryExclusion(categoryExclusion: string): PubAdsService;
        setCentering(centerAds: boolean): void;
        setForceSafeFrame(forceSafeFrame: boolean): PubAdsService;
        setLocation(address: string): PubAdsService;
        setPrivacySettings(privacySettings: PrivacySettingsConfig): PubAdsService;
        setPublisherProvidedId(ppid: string): PubAdsService;
        setRequestNonPersonalizedAds(nonPersonalizedAds: 0 | 1): PubAdsService;
        setSafeFrameConfig(config: SafeFrameConfig): PubAdsService;
        setTargeting(key: string, value: string | string[]): PubAdsService;
        setVideoContent(videoContentId: string, videoCmsId: string): void;
        updateCorrelator(): PubAdsService;
    }

    interface CompanionAdsService extends Service {
        enableSyncLoading(): void;
        setRefreshUnfilledSlots(value: boolean): void;
    }

    interface ResponseInformation {
        advertiserId: number | null;
        campaignId: number | null;
        creativeId: number | null;
        creativeTemplateId: number | null;
        lineItemId: number | null;
    }

    interface SafeFrameConfig {
        allowOverlayExpansion?: boolean;
        allowPushExpansion?: boolean;
        sandbox?: boolean;
    }

    interface LazyLoadOptionsConfig {
        fetchMarginPercent?: number;
        mobileScaling?: number;
        renderMarginPercent?: number;
    }

    interface PrivacySettingsConfig {
        childDirectedTreatment?: boolean | null;
        limitedAds?: boolean;
        restrictDataProcessing?: boolean;
        underAgeOfConsent?: boolean | null;
    }

    type SingleSize = [number, number];
    type MultiSize = SingleSize[];
    type GeneralSize = SingleSize | MultiSize | 'fluid';
    type SizeMapping = [SingleSize[], GeneralSize];
    type SizeMappingArray = SizeMapping[];

    namespace events {
        interface SlotRenderEndedEvent {
            advertiserId: number | null;
            campaignId: number | null;
            creativeId: number | null;
            creativeTemplateId: number | null;
            isEmpty: boolean;
            lineItemId: number | null;
            serviceName: string;
            size: [number, number] | string | null;
            slot: Slot;
            sourceAgnosticCreativeId: number | null;
            sourceAgnosticLineItemId: number | null;
        }

        interface SlotRequestedEvent {
            serviceName: string;
            slot: Slot;
        }

        interface SlotResponseReceivedEvent {
            serviceName: string;
            slot: Slot;
        }

        interface SlotOnloadEvent {
            serviceName: string;
            slot: Slot;
        }

        interface SlotVisibilityChangedEvent {
            inViewPercentage: number;
            serviceName: string;
            slot: Slot;
        }

        interface ImpressionViewableEvent {
            serviceName: string;
            slot: Slot;
        }

        interface EventTypeMap {
            slotRenderEnded: SlotRenderEndedEvent;
            slotRequested: SlotRequestedEvent;
            slotResponseReceived: SlotResponseReceivedEvent;
            slotOnload: SlotOnloadEvent;
            slotVisibilityChanged: SlotVisibilityChangedEvent;
            impressionViewable: ImpressionViewableEvent;
        }
    }

    const cmd: Array<() => void>;
    const apiReady: boolean;
    const pubadsReady: boolean;

    function companionAds(): CompanionAdsService;
    function defineOutOfPageSlot(adUnitPath: string, optDiv?: string): Slot | null;
    function defineSlot(adUnitPath: string, size: GeneralSize, optDiv?: string): Slot | null;
    function destroySlots(slots?: Slot[]): boolean;
    function display(divOrSlot: string | Element | Slot): void;
    function enableServices(): void;
    function getVersion(): string;
    function openConsole(optDiv?: string): void;
    function pubads(): PubAdsService;
    function setAdIframeTitle(title: string): void;
    function sizeMapping(): SizeMappingBuilder;

    interface SizeMappingBuilder {
        addSize(viewportSize: SingleSize, slotSize: GeneralSize): SizeMappingBuilder;
        build(): SizeMappingArray | null;
    }
}

interface Window {
    googletag: typeof googletag & { cmd: Array<() => void>; apiReady?: boolean };
}
