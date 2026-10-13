import { WIKI_SKINS, type WikiSkin } from '$wikiangTheme/skins/registry';
import themePackage from '$wikiangTheme/skin-package.json';

// Renderer API 1 is implemented by the shared wiki document shell.
if (themePackage.rendererApi !== 1) throw new Error('Unsupported Wikiang theme renderer API');
export const WIKI_THEME_VERSION = themePackage.version;
export { WIKI_SKINS, type WikiSkin };

export const WIKI_SKIN_COOKIE = 'wikiang_skin';

export function parseWikiSkin(value: string | undefined): WikiSkin {
    return WIKI_SKINS.find((skin) => skin.value === value)?.value ?? 'standard';
}

export const WIKI_TEXT_COOKIE = 'wikiang_text_size';
export type WikiTextSize = 'standard' | 'large';
export function parseWikiTextSize(value: string | undefined): WikiTextSize {
    return value === 'large' ? 'large' : 'standard';
}
