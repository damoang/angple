import { error, isHttpError } from '@sveltejs/kit';
import { validateWikiPath } from '$lib/wiki/paths';
import type { WikiPageInput } from './wiki';
export async function readWikiInput(request: Request, create: boolean): Promise<{ path: string; input: WikiPageInput }> {
    let body: Record<string, unknown>;
    try { const value: unknown = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) error(400, '올바른 JSON 문서를 보내주세요.'); body = value as Record<string, unknown>; }
    catch (err) { if (isHttpError(err)) throw err; error(400, '올바른 JSON 문서를 보내주세요.'); }
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 500) error(400, '제목은 1~500자로 입력해주세요.');
    if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 1_000_000) error(400, '본문은 1~1,000,000자로 입력해주세요.');
    if (body.content_type !== 'markdown' && body.content_type !== 'html' && body.content_type !== 'wikitext') error(400, '지원하지 않는 문서 형식입니다.');
    if (!create && (!Number.isInteger(body.base_revision) || Number(body.base_revision) < 0)) error(400, '편집 기준 버전이 필요합니다. 문서를 다시 열어주세요.');
    for (const key of ['description', 'comment']) if (body[key] != null && (typeof body[key] !== 'string' || String(body[key]).length > (key === 'comment' ? 500 : 2000))) error(400, '설명은 2,000자, 편집 요약은 500자 이내로 입력해주세요.');
    const path = create && typeof body.path === 'string' ? validateWikiPath(body.path) : '';
    if (create && !path) error(400, '사용할 수 없는 문서 경로입니다.');
    return { path: path || '', input: { title: body.title.trim(), content: body.content, content_raw: body.content, content_type: body.content_type, description: typeof body.description === 'string' ? body.description : undefined, comment: typeof body.comment === 'string' ? body.comment : '', is_minor: body.is_minor === true, base_revision: create ? undefined : Number(body.base_revision) } };
}
export function wikiWriteError(err: unknown): never {
    if (isHttpError(err)) throw err;
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ER_DUP_ENTRY') error(409, '같은 경로의 문서가 이미 있습니다. 해당 문서를 열어 편집해주세요.');
    console.error('[wiki] 문서 저장 실패', err instanceof Error ? err.name : 'UnknownError');
    error(500, '문서를 저장하지 못했습니다. 작성 내용은 유지됩니다. 잠시 후 다시 시도해주세요.');
}
