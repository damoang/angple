// Block component registry (M1 A1 PoC, RFC §4-1).
// Server- and client-safe — only imports types.
// Concrete Svelte components are wired by callers (admin builder + renderer)
// to keep this module SSR-friendly.

import type { Component } from 'svelte';
import type { Block, BlockData, BlockType } from './types.js';

export interface BlockDefinition<T extends BlockData = BlockData> {
    /** Stable identifier matching block.type */
    type: BlockType;
    /** Korean label shown in toolbar */
    label: string;
    /** Initial data when a new block is inserted */
    createDefault: () => T;
    /** Renderer component for SSR + client (optional in PoC, registered by routes) */
    render?: Component<{ block: Block<T> }>;
}

const registry = new Map<BlockType, BlockDefinition>();

export function registerBlock(def: BlockDefinition): void {
    registry.set(def.type, def as BlockDefinition);
}

export function getBlock(type: BlockType): BlockDefinition | undefined {
    return registry.get(type);
}

export function listBlocks(): BlockDefinition[] {
    return [...registry.values()];
}

export function clearRegistry(): void {
    registry.clear();
}

/** Built-in PoC blocks — types only (renderers attached later). */
export const POC_BLOCK_DEFINITIONS: BlockDefinition[] = [
    {
        type: 'header',
        label: '제목',
        createDefault: () => ({ text: '제목을 입력하세요', level: 2 })
    },
    {
        type: 'paragraph',
        label: '본문',
        createDefault: () => ({ text: '', format: 'html' })
    },
    {
        type: 'image',
        label: '이미지',
        createDefault: () => ({ url: '', alt: '' })
    },
    {
        type: 'button',
        label: '버튼',
        createDefault: () => ({ text: '버튼', href: '#', variant: 'primary' })
    },
    {
        type: 'list',
        label: '목록',
        createDefault: () => ({ items: [''], style: 'ul' })
    },
    {
        type: 'embed',
        label: '임베드',
        createDefault: () => ({ provider: 'youtube', source: '' })
    },
    {
        type: 'divider',
        label: '구분선',
        createDefault: () => ({ style: 'line' })
    }
];

/** Bulk-register PoC blocks. Idempotent — safe to call multiple times. */
export function registerPoCBlocks(): void {
    for (const def of POC_BLOCK_DEFINITIONS) {
        registerBlock(def);
    }
}
