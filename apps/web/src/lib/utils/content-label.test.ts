import { describe, it, expect } from 'vitest';
import {
    getPostLabel,
    getCommentLabel,
    LABEL_DELETED_POST,
    LABEL_DELETED_COMMENT,
    LABEL_NO_TITLE
} from './content-label';

describe('getPostLabel — 글 제목 표기', () => {
    it('삭제된 글은 제목을 노출하지 않고 링크도 걸지 않는다', () => {
        const r = getPostLabel({ deleted_at: '2026-07-25T10:00:00Z', wr_subject: '원래 제목' });
        expect(r.text).toBe(LABEL_DELETED_POST);
        expect(r.linkable).toBe(false);
        expect(r.muted).toBe(true);
        // soft delete 라 제목이 남아 있어도 절대 새어나가면 안 된다
        expect(r.text).not.toContain('원래 제목');
    });

    it('제목이 비면 (제목 없음), 링크는 유지', () => {
        const r = getPostLabel({ deleted_at: null, wr_subject: '' });
        expect(r.text).toBe(LABEL_NO_TITLE);
        expect(r.linkable).toBe(true);
    });

    it('정상 글은 제목 그대로', () => {
        const r = getPostLabel({ deleted_at: null, wr_subject: '안녕하세요' });
        expect(r.text).toBe('안녕하세요');
        expect(r.muted).toBe(false);
    });
});

describe('getCommentLabel — 댓글 미리보기 표기', () => {
    it('삭제된 댓글은 내용을 노출하지 않는다', () => {
        const r = getCommentLabel({ deleted_at: '2026-07-25T10:00:00Z', preview: '남아있는 원문' });
        expect(r.text).toBe(LABEL_DELETED_COMMENT);
        expect(r.linkable).toBe(false);
        expect(r.text).not.toContain('남아있는 원문');
    });

    it('원글만 삭제되면 댓글 내용은 유지하고 배지만 붙인다 (#12965 정책)', () => {
        const r = getCommentLabel({
            deleted_at: null,
            post_deleted_at: '2026-07-25T10:00:00Z',
            preview: '살아있는 댓글'
        });
        expect(r.text).toBe('살아있는 댓글');
        expect(r.badge).toBe(LABEL_DELETED_POST);
        expect(r.linkable).toBe(true); // 댓글은 살아있어 이동 가능
    });

    it('이모티콘 댓글은 (이모티콘)', () => {
        expect(getCommentLabel({ preview: '', content_kind: 'emoticon' }).text).toBe('(이모티콘)');
    });

    it('이미지 댓글은 (이미지)', () => {
        expect(getCommentLabel({ preview: '', content_kind: 'image' }).text).toBe('(이미지)');
    });

    it('동영상·링크도 각각 표기', () => {
        expect(getCommentLabel({ preview: '', content_kind: 'video' }).text).toBe('(동영상)');
        expect(getCommentLabel({ preview: '', content_kind: 'link' }).text).toBe('(링크)');
    });

    it('빈 댓글은 (빈 댓글)', () => {
        expect(getCommentLabel({ preview: '', content_kind: 'empty' }).text).toBe('(빈 댓글)');
    });

    it('점자공백(U+2800)만 있어도 빈 댓글로 본다 — 실측 1,791건', () => {
        const r = getCommentLabel({ preview: '⠀', content_kind: 'empty' });
        expect(r.text).toBe('(빈 댓글)');
    });

    it('백엔드 미배포(content_kind 없음)여도 폴백으로 깨지지 않는다', () => {
        const r = getCommentLabel({ preview: '' });
        expect(r.text).toBe('(빈 댓글)');
        expect(r.muted).toBe(true);
    });

    it('텍스트가 있으면 content_kind 와 무관하게 내용 우선', () => {
        const r = getCommentLabel({ preview: '실제 댓글', content_kind: 'text' });
        expect(r.text).toBe('실제 댓글');
        expect(r.muted).toBe(false);
    });

    it('댓글·원글 둘 다 삭제면 댓글 삭제가 우선', () => {
        const r = getCommentLabel({
            deleted_at: '2026-07-25T10:00:00Z',
            post_deleted_at: '2026-07-25T09:00:00Z',
            preview: '원문'
        });
        expect(r.text).toBe(LABEL_DELETED_COMMENT);
        expect(r.linkable).toBe(false);
    });
});
