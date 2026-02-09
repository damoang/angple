// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// DamoangAds 타입 정의
interface DamoangAdsInterface {
    render: (position: string) => void;
    on: (
        event: 'render' | 'empty' | 'click' | 'impression',
        callback: (data: { position: string }) => void
    ) => void;
    off: (event: string, callback?: () => void) => void;
}

declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            user: { nickname?: string; level: number } | null;
            accessToken: string | null;
        }
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    interface Window {
        DamoangAds?: DamoangAdsInterface;
        adsbygoogle?: object[];
        googletag?: typeof googletag;
        turnstile?: {
            render: (
                element: HTMLElement,
                options: { sitekey: string; theme?: 'light' | 'dark' | 'auto'; callback?: (token: string) => void }
            ) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
        };
        [key: string]: unknown;
    }
}

export {};
