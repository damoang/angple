import Root from './neo-key-button.svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

// Props 타입 정의
type NeoKeyButtonSize = 'sm' | 'md' | 'lg';

interface NeoKeyButtonProps extends HTMLButtonAttributes {
    size?: NeoKeyButtonSize;
    liked?: boolean;
}

// Variants 함수 (옵션)
const NeoKeyButtonVariants = {
    size: {
        sm: { button: 'w-12 h-12 text-xl', radius: '6px', translate: '8px' },
        md: { button: 'w-14 h-14 text-2xl', radius: '7px', translate: '10px' },
        lg: { button: 'w-16 h-16 text-3xl', radius: '8px', translate: '12px' }
    }
};

export {
    Root,
    type NeoKeyButtonProps as Props,
    //
    Root as NeoKeyButton,
    NeoKeyButtonVariants,
    type NeoKeyButtonProps,
    type NeoKeyButtonSize
};
