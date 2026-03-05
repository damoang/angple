/**
 * content-transform.ts 보안 수정 테스트
 * #63 - Incomplete multi-character sanitization (태그 제거 반복)
 */
import { describe, it, expect } from 'vitest';
import { transformVideos, transformEmoticons, transformBracketImages } from './content-transform';

describe('transformVideos - 태그 제거 보안', () => {
    it('중첩 태그 조각이 합쳐지지 않아야 함', () => {
        // <scr + ipt> 가 <script>로 합쳐지면 안 됨
        const input = '{video: <scr<b>ipt>alert(1)</scr<b>ipt>}';
        const result = transformVideos(input);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('</script>');
    });

    it('정상 YouTube URL 변환은 유지', () => {
        const input = '{video: https://www.youtube.com/watch?v=dQw4w9WgXcQ}';
        const result = transformVideos(input);
        expect(result).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('a 태그에서 href 추출은 정상 동작', () => {
        const input = '{video: <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">link</a>}';
        const result = transformVideos(input);
        expect(result).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('Vimeo URL 변환 정상 동작', () => {
        const input = '{동영상: https://vimeo.com/123456789}';
        const result = transformVideos(input);
        expect(result).toContain('player.vimeo.com/video/123456789');
    });

    it('직접 비디오 파일 URL 변환 정상 동작', () => {
        const input = '{video: https://example.com/video.mp4}';
        const result = transformVideos(input);
        expect(result).toContain('<video');
        expect(result).toContain('example.com/video.mp4');
    });

    it('빈 URL은 빈 문자열 반환', () => {
        const input = '{video: }';
        const result = transformVideos(input);
        expect(result).toBe('');
    });

    it('다중 중첩 태그 조각도 제거', () => {
        const input = '{video: <a<b<c>d>e>https://example.com/v.mp4}';
        const result = transformVideos(input);
        expect(result).not.toContain('<a');
        expect(result).toContain('example.com/v.mp4');
    });

    it('태그가 없는 plain URL은 그대로 처리', () => {
        const input = '{video: https://example.com/video.webm}';
        const result = transformVideos(input);
        expect(result).toContain('<video');
    });

    it('YouTube shorts URL 변환', () => {
        const input = '{video: https://youtube.com/shorts/dQw4w9WgXcQ}';
        const result = transformVideos(input);
        expect(result).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('패턴이 아닌 텍스트는 그대로 반환', () => {
        const input = '일반 텍스트입니다';
        expect(transformVideos(input)).toBe(input);
    });
});

describe('transformEmoticons - 기존 동작 유지', () => {
    it('이모티콘 패턴을 img 태그로 변환', () => {
        const result = transformEmoticons('{emo:smile.gif:30}');
        expect(result).toContain('<img src="/emoticons/smile.gif"');
        expect(result).toContain('width="30"');
    });

    it('경로 탐색 시도 차단', () => {
        const result = transformEmoticons('{emo:../../etc/passwd:30}');
        expect(result).not.toContain('passwd');
    });

    it('패턴 없으면 원본 반환', () => {
        const result = transformEmoticons('hello world');
        expect(result).toBe('hello world');
    });
});

describe('transformBracketImages - 기존 동작 유지', () => {
    it('대괄호 이미지 URL을 img 태그로 변환', () => {
        const result = transformBracketImages('[https://example.com/image.jpg]');
        expect(result).toContain('<img src="https://example.com/image.jpg"');
    });

    it('이미지 확장자가 아니면 변환 안 함', () => {
        const result = transformBracketImages('[https://example.com/page.html]');
        expect(result).toBe('[https://example.com/page.html]');
    });
});
