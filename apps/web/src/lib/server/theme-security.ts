/**
 * 테마 파일 보안 검증
 *
 * 업로드된 테마 파일의 보안을 검증합니다.
 */

import { readFile } from 'fs/promises';
import path from 'path';

/**
 * 허용된 파일 확장자 (화이트리스트)
 */
const ALLOWED_EXTENSIONS = [
	'.svelte',
	'.ts',
	'.js',
	'.json',
	'.css',
	'.png',
	'.jpg',
	'.jpeg',
	'.svg',
	'.webp',
	'.md'
];

/**
 * 파일 크기 제한
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 악성 패턴 (정규식)
 */
const MALICIOUS_PATTERNS = [
	/eval\s*\(/gi, // eval() 사용
	/Function\s*\(/gi, // Function() 생성자
	/dangerouslySetInnerHTML/gi, // React의 dangerouslySetInnerHTML
	/<script[^>]*>/gi, // 인라인 스크립트 태그
	/on\w+\s*=\s*["'][^"']*["']/gi, // 인라인 이벤트 핸들러 (onclick="...")
	/javascript:/gi, // javascript: 프로토콜
	/document\.cookie/gi, // 쿠키 접근
	/localStorage\./gi, // localStorage 접근 (일부 허용 필요할 수 있음)
	/sessionStorage\./gi // sessionStorage 접근
];

/**
 * 파일 확장자 검증
 */
function isAllowedExtension(filename: string): boolean {
	const ext = path.extname(filename).toLowerCase();
	return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * 파일 크기 검증
 */
export interface FileInfo {
	path: string;
	size: number;
}

export function validateFileSizes(files: FileInfo[]): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];
	let totalSize = 0;

	for (const file of files) {
		// 개별 파일 크기 체크
		if (file.size > MAX_FILE_SIZE) {
			errors.push(`파일 크기 초과: ${file.path} (${(file.size / 1024 / 1024).toFixed(2)}MB > 10MB)`);
		}

		totalSize += file.size;
	}

	// 전체 크기 체크
	if (totalSize > MAX_TOTAL_SIZE) {
		errors.push(
			`전체 테마 크기 초과: ${(totalSize / 1024 / 1024).toFixed(2)}MB > 50MB`
		);
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * 악성 코드 패턴 스캔
 */
async function scanFileContent(filePath: string): Promise<{
	safe: boolean;
	patterns: string[];
}> {
	const ext = path.extname(filePath).toLowerCase();

	// 텍스트 파일만 스캔 (.svelte, .ts, .js, .json, .css)
	const textExtensions = ['.svelte', '.ts', '.js', '.json', '.css', '.md'];
	if (!textExtensions.includes(ext)) {
		return { safe: true, patterns: [] };
	}

	try {
		const content = await readFile(filePath, 'utf-8');
		const detectedPatterns: string[] = [];

		for (const pattern of MALICIOUS_PATTERNS) {
			if (pattern.test(content)) {
				detectedPatterns.push(pattern.source);
			}
		}

		return {
			safe: detectedPatterns.length === 0,
			patterns: detectedPatterns
		};
	} catch (error) {
		console.error(`파일 읽기 실패: ${filePath}`, error);
		return { safe: false, patterns: ['FILE_READ_ERROR'] };
	}
}

/**
 * 테마 파일 전체 검증
 */
export async function validateThemeFiles(
	files: string[],
	extractPath: string
): Promise<{
	valid: boolean;
	errors: string[];
}> {
	const errors: string[] = [];

	// 1. 확장자 검증
	for (const file of files) {
		if (!isAllowedExtension(file)) {
			errors.push(`허용되지 않는 파일 확장자: ${file}`);
		}
	}

	// 2. 경로 검증 (디렉터리 탈출 방지)
	for (const file of files) {
		const normalizedPath = path.normalize(file);
		if (normalizedPath.includes('..')) {
			errors.push(`잘못된 파일 경로 (디렉터리 탈출 시도): ${file}`);
		}
	}

	// 3. 악성 코드 스캔
	for (const file of files) {
		const fullPath = path.join(extractPath, file);
		const scanResult = await scanFileContent(fullPath);

		if (!scanResult.safe) {
			errors.push(
				`악성 패턴 감지: ${file} - ${scanResult.patterns.join(', ')}`
			);
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * theme.json 존재 여부 확인
 */
export function hasThemeManifest(files: string[]): boolean {
	return files.some((file) => file === 'theme.json' || file.endsWith('/theme.json'));
}
