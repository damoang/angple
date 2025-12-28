/**
 * Hook 시스템 테스트
 *
 * 검증 기준:
 * 1. registerHook()로 Hook 등록 성공
 * 2. doAction() 호출 시 등록된 모든 callback 실행
 * 3. applyFilter() 호출 시 value가 순차적으로 변환됨
 * 4. Priority 순서대로 실행됨
 * 5. Hook 에러 발생 시 다른 Hook에 영향 없음
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerHook,
	doAction,
	applyFilter,
	clearHooks,
	getHooks,
	removeHooksBySource
} from './registry';

describe('Hook Registry', () => {
	beforeEach(() => {
		// 각 테스트 전에 Hook 초기화
		clearHooks();
	});

	it('1. registerHook()로 Hook 등록 성공', () => {
		registerHook('test_action', () => console.log('test'), 10);

		const hooks = getHooks('test_action');
		expect(hooks).toHaveLength(1);
		expect(hooks[0].name).toBe('test_action');
		expect(hooks[0].priority).toBe(10);
	});

	it('2. doAction() 호출 시 등록된 모든 callback 실행', async () => {
		const results: string[] = [];

		registerHook('page_loaded', () => {
			results.push('callback1');
		});

		registerHook('page_loaded', () => {
			results.push('callback2');
		});

		await doAction('page_loaded');

		expect(results).toEqual(['callback1', 'callback2']);
	});

	it('3. applyFilter() 호출 시 value가 순차적으로 변환됨', async () => {
		registerHook(
			'post_title',
			(title: string) => {
				return `[Filtered1] ${title}`;
			},
			10,
			undefined,
			'filter'
		);

		registerHook(
			'post_title',
			(title: string) => {
				return `[Filtered2] ${title}`;
			},
			20,
			undefined,
			'filter'
		);

		let title = 'Original Title';
		title = await applyFilter('post_title', title);

		expect(title).toBe('[Filtered2] [Filtered1] Original Title');
	});

	it('4. Priority 순서대로 실행됨', async () => {
		const executionOrder: number[] = [];

		registerHook(
			'priority_test',
			() => {
				executionOrder.push(30);
			},
			30
		);

		registerHook(
			'priority_test',
			() => {
				executionOrder.push(10);
			},
			10
		);

		registerHook(
			'priority_test',
			() => {
				executionOrder.push(20);
			},
			20
		);

		await doAction('priority_test');

		expect(executionOrder).toEqual([10, 20, 30]);
	});

	it('5. Hook 에러 발생 시 다른 Hook에 영향 없음', async () => {
		const results: string[] = [];

		registerHook('error_test', () => {
			results.push('before_error');
		});

		registerHook('error_test', () => {
			throw new Error('Intentional error');
		});

		registerHook('error_test', () => {
			results.push('after_error');
		});

		// 에러가 발생해도 예외가 throw되지 않아야 함
		await expect(doAction('error_test')).resolves.toBeUndefined();

		// 에러 전후의 Hook은 모두 실행되어야 함
		expect(results).toEqual(['before_error', 'after_error']);
	});

	it('6. removeHooksBySource로 특정 소스의 Hook 제거', () => {
		registerHook('test', () => {}, 10, 'theme-a');
		registerHook('test', () => {}, 10, 'theme-b');
		registerHook('test', () => {}, 10, 'theme-a');

		expect(getHooks('test')).toHaveLength(3);

		removeHooksBySource('theme-a');

		expect(getHooks('test')).toHaveLength(1);
		expect(getHooks('test')[0].source).toBe('theme-b');
	});

	it('7. async callback 지원', async () => {
		let value = 0;

		registerHook('async_test', async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			value = 100;
		});

		await doAction('async_test');

		expect(value).toBe(100);
	});

	it('8. applyFilter에서 undefined 반환 시 값 유지', async () => {
		registerHook(
			'undefined_test',
			(val: string) => {
				// 값을 변환하지 않고 undefined 반환
				return undefined;
			},
			10,
			undefined,
			'filter'
		);

		const result = await applyFilter('undefined_test', 'original');

		// undefined가 반환되면 원본 값 유지
		expect(result).toBe('original');
	});
});
