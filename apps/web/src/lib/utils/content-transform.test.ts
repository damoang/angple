import { describe, it, expect } from 'vitest';
import {
	transformCodeBlocks,
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
		expect(result).toBe(
			'<pre><code class="language-javascript">const x = 1;</code></pre>'
		);
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
