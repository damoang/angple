import { describe, it, expect } from 'vitest';
import { sanitizePath, safeBasename, isPathSafe } from './path-utils';

describe('sanitizePath', () => {
	it('유효한 경로 통과', () => {
		expect(sanitizePath('valid-path')).toBe('valid-path');
		expect(sanitizePath('my_theme')).toBe('my_theme');
		expect(sanitizePath('Theme123')).toBe('Theme123');
	});

	it('경로 탐색 차단', () => {
		expect(() => sanitizePath('../etc/passwd')).toThrow('path traversal');
		expect(() => sanitizePath('foo/../../bar')).toThrow('path traversal');
	});

	it('백슬래시 차단', () => {
		expect(() => sanitizePath('path\\file')).toThrow('path traversal');
	});

	it('절대 경로 차단', () => {
		expect(() => sanitizePath('/etc/passwd')).toThrow('absolute paths');
	});

	it('null byte 차단', () => {
		expect(() => sanitizePath('file\0.txt')).toThrow('null byte');
	});

	it('허용되지 않은 문자 차단', () => {
		expect(() => sanitizePath('file with space')).toThrow('illegal characters');
		expect(() => sanitizePath('file;rm')).toThrow('illegal characters');
	});

	it('커스텀 정규식으로 슬래시 허용', () => {
		expect(sanitizePath('path/to/file', /^[a-zA-Z0-9\-_/]+$/)).toBe('path/to/file');
	});
});

describe('safeBasename', () => {
	it('파일명 추출', () => {
		expect(safeBasename('dir/file.txt')).toBe('file.txt');
		expect(safeBasename('file.txt')).toBe('file.txt');
	});

	it('잘못된 파일명 차단', () => {
		expect(() => safeBasename('..')).toThrow('Invalid filename');
		expect(() => safeBasename('.')).toThrow('Invalid filename');
	});
});

describe('isPathSafe', () => {
	it('내부 경로는 안전', () => {
		expect(isPathSafe('/base', '/base/child')).toBe(true);
		expect(isPathSafe('/base', '/base/deep/nested')).toBe(true);
	});

	it('외부 경로는 불안전', () => {
		expect(isPathSafe('/base', '/other')).toBe(false);
		expect(isPathSafe('/base', '/base/../other')).toBe(false);
	});
});
