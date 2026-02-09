/**
 * 자동저장/복구 유틸리티
 * localStorage 기반, debounce 포함
 */
import { browser } from '$app/environment';

export interface AutosaveData {
	[key: string]: unknown;
	savedAt: string;
}

/**
 * 자동저장 키 생성
 */
export function getAutosaveKey(boardId: string, postId?: string | number): string {
	return `autosave:${boardId}:${postId || 'new'}`;
}

/**
 * 자동저장 데이터 저장
 */
export function saveAutosaveData(key: string, data: Record<string, unknown>): boolean {
	if (!browser) return false;

	try {
		const saveData: AutosaveData = {
			...data,
			savedAt: new Date().toISOString()
		};
		localStorage.setItem(key, JSON.stringify(saveData));
		return true;
	} catch {
		return false;
	}
}

/**
 * 자동저장 데이터 로드
 */
export function loadAutosaveData(key: string): AutosaveData | null {
	if (!browser) return null;

	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as AutosaveData;
	} catch {
		return null;
	}
}

/**
 * 자동저장 데이터 삭제
 */
export function clearAutosaveData(key: string): void {
	if (!browser) return;
	localStorage.removeItem(key);
}

/**
 * 자동저장 데이터 존재 여부
 */
export function hasAutosaveData(key: string): boolean {
	if (!browser) return false;
	return localStorage.getItem(key) !== null;
}

/**
 * Debounce 함수
 */
export function debounce<T extends (...args: unknown[]) => void>(
	fn: T,
	ms: number
): (...args: Parameters<T>) => void {
	let timer: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	};
}
