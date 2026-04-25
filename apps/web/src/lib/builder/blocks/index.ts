// Builder block component map (M1 A1 PoC).
// Imports all PoC block components and exports a typed map.

import type { Component } from 'svelte';
import type { Block, BlockType } from '../types.js';
import HeaderBlock from './header.svelte';
import ParagraphBlock from './paragraph.svelte';
import ImageBlock from './image.svelte';
import ButtonBlock from './button.svelte';
import ListBlock from './list.svelte';
import EmbedBlock from './embed.svelte';
import DividerBlock from './divider.svelte';

export const BLOCK_COMPONENTS: Record<BlockType, Component<{ block: Block }>> = {
    header: HeaderBlock as unknown as Component<{ block: Block }>,
    paragraph: ParagraphBlock as unknown as Component<{ block: Block }>,
    image: ImageBlock as unknown as Component<{ block: Block }>,
    button: ButtonBlock as unknown as Component<{ block: Block }>,
    list: ListBlock as unknown as Component<{ block: Block }>,
    embed: EmbedBlock as unknown as Component<{ block: Block }>,
    divider: DividerBlock as unknown as Component<{ block: Block }>
};

export {
    HeaderBlock,
    ParagraphBlock,
    ImageBlock,
    ButtonBlock,
    ListBlock,
    EmbedBlock,
    DividerBlock
};
