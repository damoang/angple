// Builder content data types (M1 A1 PoC, RFC §3-2).
// schema_version=1 — must be bumped when block-level changes break compatibility.

export const BUILDER_SCHEMA_VERSION = 1;

export type BlockType = 'header' | 'paragraph' | 'image' | 'button' | 'list' | 'embed' | 'divider';

/** Header block — anchored heading h1-h4. */
export interface HeaderBlockData {
    text: string;
    level: 1 | 2 | 3 | 4;
    anchor?: string;
}

/** Paragraph block — rich-text HTML or markdown. */
export interface ParagraphBlockData {
    text: string;
    format: 'html' | 'markdown';
}

/** Image block — external URL only (avoid uploading binary into blocks JSON). */
export interface ImageBlockData {
    url: string;
    alt: string;
    caption?: string;
    width?: number;
}

/** Button / CTA block. */
export interface ButtonBlockData {
    text: string;
    href: string;
    variant: 'primary' | 'secondary' | 'link';
}

/** Ordered/unordered list block. */
export interface ListBlockData {
    items: string[];
    style: 'ul' | 'ol';
    checklist?: boolean;
}

/** Embed block — third-party media. */
export interface EmbedBlockData {
    provider: 'youtube' | 'twitter' | 'map';
    source: string;
}

/** Divider block. */
export interface DividerBlockData {
    style: 'line' | 'space';
}

export type BlockData =
    | HeaderBlockData
    | ParagraphBlockData
    | ImageBlockData
    | ButtonBlockData
    | ListBlockData
    | EmbedBlockData
    | DividerBlockData;

export interface BlockMeta {
    created_at?: string;
    created_by?: string;
    lock?: boolean;
}

export interface Block<T extends BlockData = BlockData> {
    id: string;
    type: BlockType;
    data: T;
    meta?: BlockMeta;
}

export interface BuilderContent {
    schema_version: number;
    blocks: Block[];
}

/** Empty content factory — useful for new pages. */
export function createEmptyContent(): BuilderContent {
    return { schema_version: BUILDER_SCHEMA_VERSION, blocks: [] };
}

/** Type guard for runtime payloads coming from API/DB. */
export function isBuilderContent(value: unknown): value is BuilderContent {
    if (!value || typeof value !== 'object') return false;
    const v = value as Partial<BuilderContent>;
    return (
        typeof v.schema_version === 'number' &&
        Array.isArray(v.blocks) &&
        v.blocks.every(
            (b) =>
                b && typeof b.id === 'string' && typeof b.type === 'string' && b.data !== undefined
        )
    );
}
