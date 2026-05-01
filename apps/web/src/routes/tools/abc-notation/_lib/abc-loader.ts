type AbcModule = typeof import('abcjs');

let _abc: AbcModule | null = null;

export async function getAbc(): Promise<AbcModule> {
    if (!_abc) {
        const mod = await import('abcjs');
        _abc = (mod as unknown as { default?: AbcModule }).default ?? (mod as unknown as AbcModule);
    }
    return _abc;
}
