/**
 * content-transform.ts 테스트
 * 코드 블록 변환 + 보안 수정 테스트 (#63 - Incomplete multi-character sanitization)
 */
import { describe, it, expect } from 'vitest';
import {
    transformCodeBlocks,
    transformBacktickCodeBlocks,
    transformInlineCode,
    transformInlineMarkdown,
    transformEmoticons,
    transformVideos,
    transformBracketImages
} from './content-transform';

describe('transformCodeBlocks', () => {
    it('기본 [code]...[/code] 변환', () => {
        const input = '[code]console.log("hello");[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code>console.log("hello");</code></pre>');
    });

    it('[code=lang] 언어 지정 변환', () => {
        const input = '[code=python]print("hello")[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code class="language-python">print("hello")</code></pre>');
    });

    it('[code=javascript] 변환', () => {
        const input = '[code=javascript]const x = 1;[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code class="language-javascript">const x = 1;</code></pre>');
    });

    it('여러 코드 블럭 변환', () => {
        const input = '앞 텍스트 [code]a[/code] 중간 [code=css]b[/code] 뒤 텍스트';
        const result = transformCodeBlocks(input);
        expect(result).toBe(
            '앞 텍스트 <pre><code>a</code></pre> 중간 <pre><code class="language-css">b</code></pre> 뒤 텍스트'
        );
    });

    it('여러 줄 코드 블럭', () => {
        const input = '[code]line1\nline2\nline3[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code>line1\nline2\nline3</code></pre>');
    });

    it('<br> 태그를 줄바꿈으로 변환', () => {
        const input = '[code]line1<br>line2<br/>line3<br />line4[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code>line1\nline2\nline3\nline4</code></pre>');
    });

    it('<p> 태그를 줄바꿈으로 변환', () => {
        const input = '[code]<p>line1</p><p>line2</p>[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code>line1\n\nline2</code></pre>');
    });

    it('기타 HTML 태그 제거', () => {
        const input = '[code]<span style="color:red">colored</span> text[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code>colored text</code></pre>');
    });

    it('앞뒤 빈 줄 제거', () => {
        const input = '[code]\n\nactual code\n\n[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code>actual code</code></pre>');
    });

    it('대소문자 무시 ([CODE]...[/CODE])', () => {
        const input = '[CODE]test[/CODE]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code>test</code></pre>');
    });

    it('[code] 패턴이 없으면 원본 반환', () => {
        const input = '일반 텍스트입니다';
        const result = transformCodeBlocks(input);
        expect(result).toBe('일반 텍스트입니다');
    });

    it('빈 문자열 처리', () => {
        expect(transformCodeBlocks('')).toBe('');
    });

    it('null/undefined 처리', () => {
        expect(transformCodeBlocks(null as unknown as string)).toBe(null);
        expect(transformCodeBlocks(undefined as unknown as string)).toBe(undefined);
    });

    it('언어명에 특수문자 허용 (c++, c#은 +만)', () => {
        const input = '[code=c++]int main()[/code]';
        const result = transformCodeBlocks(input);
        expect(result).toBe('<pre><code class="language-c++">int main()</code></pre>');
    });

    it('주변 콘텐츠 보존', () => {
        const input = '<p>설명:</p>[code=bash]echo hi[/code]<p>끝</p>';
        const result = transformCodeBlocks(input);
        expect(result).toBe(
            '<p>설명:</p><pre><code class="language-bash">echo hi</code></pre><p>끝</p>'
        );
    });
});

describe('transformBacktickCodeBlocks', () => {
    it('기본 ```lang 코드 블록 변환', () => {
        const input = '```javascript\nconsole.log("hi");\n```';
        expect(transformBacktickCodeBlocks(input)).toBe(
            '<pre><code class="language-javascript">console.log("hi");</code></pre>'
        );
    });

    it('언어 미지정 ``` 블록', () => {
        const input = '```\nplain code\n```';
        expect(transformBacktickCodeBlocks(input)).toBe('<pre><code>plain code</code></pre>');
    });

    it('<br>로 줄바꿈된 경우 (댓글 파이프라인)', () => {
        const input = '```python<br>print("hello")<br>x = 1<br>```';
        expect(transformBacktickCodeBlocks(input)).toBe(
            '<pre><code class="language-python">print("hello")\nx = 1</code></pre>'
        );
    });

    it('여러 줄 코드', () => {
        const input = '```rust\nfn main() {\n    println!("hello");\n}\n```';
        expect(transformBacktickCodeBlocks(input)).toBe(
            '<pre><code class="language-rust">fn main() {\n    println!("hello");\n}</code></pre>'
        );
    });

    it('```가 없으면 원본 반환', () => {
        expect(transformBacktickCodeBlocks('일반 텍스트')).toBe('일반 텍스트');
    });

    it('빈/null 입력', () => {
        expect(transformBacktickCodeBlocks('')).toBe('');
        expect(transformBacktickCodeBlocks(null as unknown as string)).toBe(null);
    });

    it('주변 텍스트 보존', () => {
        const input = '앞 텍스트 ```js\nalert(1)\n``` 뒤 텍스트';
        expect(transformBacktickCodeBlocks(input)).toBe(
            '앞 텍스트 <pre><code class="language-js">alert(1)</code></pre> 뒤 텍스트'
        );
    });
});

describe('transformInlineCode', () => {
    it('기본 인라인 코드 변환', () => {
        expect(transformInlineCode('use `const x = 1` here')).toBe(
            'use <code>const x = 1</code> here'
        );
    });

    it('여러 인라인 코드', () => {
        expect(transformInlineCode('`a` and `b`')).toBe('<code>a</code> and <code>b</code>');
    });

    it('줄바꿈 포함 백틱은 변환하지 않음', () => {
        const input = '`line1\nline2`';
        expect(transformInlineCode(input)).toBe(input);
    });

    it('백틱이 없으면 원본 반환', () => {
        expect(transformInlineCode('plain text')).toBe('plain text');
    });

    it('빈/null 입력', () => {
        expect(transformInlineCode('')).toBe('');
        expect(transformInlineCode(null as unknown as string)).toBe(null);
    });

    it('빈 백틱은 변환하지 않음', () => {
        expect(transformInlineCode('``')).toBe('``');
    });
});

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

describe('transformInlineMarkdown', () => {
    it('**bold** 변환', () => {
        expect(transformInlineMarkdown('마크다운 **테스트**!')).toBe(
            '마크다운 <strong>테스트</strong>!'
        );
    });

    it('*italic* 변환', () => {
        expect(transformInlineMarkdown('이것은 *기울임*입니다')).toBe(
            '이것은 <em>기울임</em>입니다'
        );
    });

    it('~~strikethrough~~ 변환', () => {
        expect(transformInlineMarkdown('~~취소선~~ 텍스트')).toBe('<del>취소선</del> 텍스트');
    });

    it('혼합 사용', () => {
        const input = '**볼드** *이탤릭* ~~취소~~';
        const result = transformInlineMarkdown(input);
        expect(result).toContain('<strong>볼드</strong>');
        expect(result).toContain('<em>이탤릭</em>');
        expect(result).toContain('<del>취소</del>');
    });

    it('<code> 내부는 변환하지 않음', () => {
        const input = '<code>**코드 안**</code> **코드 밖**';
        const result = transformInlineMarkdown(input);
        expect(result).toContain('<code>**코드 안**</code>');
        expect(result).toContain('<strong>코드 밖</strong>');
    });

    it('<pre><code> 내부는 변환하지 않음', () => {
        const input = '<pre><code>**코드 블록**</code></pre> **밖**';
        const result = transformInlineMarkdown(input);
        expect(result).toContain('<pre><code>**코드 블록**</code></pre>');
        expect(result).toContain('<strong>밖</strong>');
    });

    it('마크다운 패턴이 없으면 원본 반환', () => {
        expect(transformInlineMarkdown('일반 텍스트')).toBe('일반 텍스트');
    });

    it('빈/null 입력', () => {
        expect(transformInlineMarkdown('')).toBe('');
        expect(transformInlineMarkdown(null as unknown as string)).toBe(null);
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
