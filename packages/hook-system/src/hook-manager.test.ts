import { describe, it, expect, beforeEach } from 'vitest';
import { HookManager } from './hook-manager.js';

describe('HookManager', () => {
	let hookManager: HookManager;

	beforeEach(() => {
		hookManager = new HookManager();
	});

	describe('Actions', () => {
		it('should register and execute actions', () => {
			let executed = false;

			hookManager.addAction('test_action', () => {
				executed = true;
			});

			hookManager.doAction('test_action');

			expect(executed).toBe(true);
		});

		it('should execute actions in priority order', () => {
			const order: number[] = [];

			hookManager.addAction('test_action', () => order.push(2), 20);
			hookManager.addAction('test_action', () => order.push(1), 10);
			hookManager.addAction('test_action', () => order.push(3), 30);

			hookManager.doAction('test_action');

			expect(order).toEqual([1, 2, 3]);
		});

		it('should pass arguments to action callbacks', () => {
			let receivedArgs: any[] = [];

			hookManager.addAction('test_action', (...args) => {
				receivedArgs = args;
			});

			hookManager.doAction('test_action', 'arg1', 42, { key: 'value' });

			expect(receivedArgs).toEqual(['arg1', 42, { key: 'value' }]);
		});

		it('should remove actions', () => {
			let executed = false;
			const callback = () => {
				executed = true;
			};

			hookManager.addAction('test_action', callback);
			hookManager.removeAction('test_action', callback);
			hookManager.doAction('test_action');

			expect(executed).toBe(false);
		});

		it('should handle errors gracefully', () => {
			let secondExecuted = false;

			hookManager.addAction('test_action', () => {
				throw new Error('Test error');
			});

			hookManager.addAction('test_action', () => {
				secondExecuted = true;
			});

			expect(() => hookManager.doAction('test_action')).not.toThrow();
			expect(secondExecuted).toBe(true);
		});
	});

	describe('Filters', () => {
		it('should register and apply filters', () => {
			hookManager.addFilter('test_filter', (value: string) => {
				return value.toUpperCase();
			});

			const result = hookManager.applyFilters('test_filter', 'hello');

			expect(result).toBe('HELLO');
		});

		it('should chain filters in priority order', () => {
			hookManager.addFilter('test_filter', (value: number) => value + 10, 10);
			hookManager.addFilter('test_filter', (value: number) => value * 2, 5);
			hookManager.addFilter('test_filter', (value: number) => value - 3, 15);

			const result = hookManager.applyFilters('test_filter', 5);

			// 5 * 2 = 10 (priority 5)
			// 10 + 10 = 20 (priority 10)
			// 20 - 3 = 17 (priority 15)
			expect(result).toBe(17);
		});

		it('should pass additional arguments to filter callbacks', () => {
			hookManager.addFilter('test_filter', (value: string, prefix: string, suffix: string) => {
				return `${prefix}${value}${suffix}`;
			});

			const result = hookManager.applyFilters('test_filter', 'world', 'hello ', '!');

			expect(result).toBe('hello world!');
		});

		it('should remove filters', () => {
			const callback = (value: string) => value.toUpperCase();

			hookManager.addFilter('test_filter', callback);
			hookManager.removeFilter('test_filter', callback);

			const result = hookManager.applyFilters('test_filter', 'hello');

			expect(result).toBe('hello');
		});

		it('should handle errors gracefully and continue with next filters', () => {
			hookManager.addFilter('test_filter', () => {
				throw new Error('Test error');
			});

			hookManager.addFilter('test_filter', (value: string) => {
				return value.toUpperCase();
			});

			const result = hookManager.applyFilters('test_filter', 'hello');

			// 첫 번째 필터는 에러로 스킵, 두 번째 필터만 적용됨
			expect(result).toBe('HELLO');
		});
	});

	describe('Utility methods', () => {
		it('should get registered hooks', () => {
			hookManager.addAction('action1', () => {});
			hookManager.addAction('action2', () => {});
			hookManager.addFilter('filter1', (v) => v);

			const registered = hookManager.getRegisteredHooks();

			expect(registered.actions).toContain('action1');
			expect(registered.actions).toContain('action2');
			expect(registered.filters).toContain('filter1');
		});

		it('should get hook count', () => {
			hookManager.addAction('test', () => {});
			hookManager.addAction('test', () => {});
			hookManager.addAction('test', () => {});

			expect(hookManager.getHookCount('test', 'action')).toBe(3);
			expect(hookManager.getHookCount('nonexistent', 'action')).toBe(0);
		});

		it('should clear all hooks', () => {
			hookManager.addAction('action1', () => {});
			hookManager.addFilter('filter1', (v) => v);

			hookManager.clearAll();

			const registered = hookManager.getRegisteredHooks();
			expect(registered.actions).toHaveLength(0);
			expect(registered.filters).toHaveLength(0);
		});
	});
});
