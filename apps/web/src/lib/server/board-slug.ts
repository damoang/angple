import { redirect } from '@sveltejs/kit';

function replaceBoardSegment(pathname: string, canonicalBoardId: string): string {
    const segments = pathname.split('/');
    if (segments.length > 1) {
        segments[1] = canonicalBoardId;
    }
    return segments.join('/');
}

export function enforceCanonicalBoardPath(boardId: string, url: URL): void {
    const canonicalBoardId = boardId.toLowerCase();
    if (boardId === canonicalBoardId) return;

    const pathname = replaceBoardSegment(url.pathname, canonicalBoardId);
    const search = url.searchParams.toString();
    throw redirect(308, `${pathname}${search ? `?${search}` : ''}`);
}
