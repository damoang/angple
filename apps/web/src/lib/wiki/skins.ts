export const WIKI_SKINS = [
    { value: 'standard', label: '기본형' },
    { value: 'classic', label: '클래식형' },
    { value: 'reading', label: '읽기형' },
    { value: 'encyclopedia', label: '백과사전형' }
] as const;

export type WikiSkin = (typeof WIKI_SKINS)[number]['value'];
export const WIKI_SKIN_COOKIE = 'wikiang_skin';

export function parseWikiSkin(value: string | undefined): WikiSkin {
    return WIKI_SKINS.find((skin) => skin.value === value)?.value ?? 'standard';
}

export const WIKI_TEXT_COOKIE = 'wikiang_text_size';
export type WikiTextSize = 'standard' | 'large';
export function parseWikiTextSize(value: string | undefined): WikiTextSize {
    return value === 'large' ? 'large' : 'standard';
}
