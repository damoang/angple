/**
 * Component 슬롯 시스템 테스트
 *
 * 검증 기준:
 * 1. registerComponent()로 컴포넌트 등록 성공
 * 2. getComponentsForSlot()로 등록된 컴포넌트 조회
 * 3. Priority 순서대로 정렬됨
 * 4. removeComponentsBySource()로 특정 소스의 컴포넌트 제거
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Component } from 'svelte';
import {
	registerComponent,
	getComponentsForSlot,
	removeComponentsBySource,
	clearAllSlots
} from './slot-manager';

// Mock Svelte Component (테스트용)
const MockComponent1 = (() => {}) as unknown as Component;
const MockComponent2 = (() => {}) as unknown as Component;
const MockComponent3 = (() => {}) as unknown as Component;

describe('Slot Manager', () => {
	beforeEach(() => {
		// 각 테스트 전에 슬롯 초기화
		clearAllSlots();
	});

	it('1. registerComponent()로 컴포넌트 등록 성공', () => {
		registerComponent('content-before', MockComponent1, 10);

		const components = getComponentsForSlot('content-before');
		expect(components).toHaveLength(1);
		expect(components[0].component).toBe(MockComponent1);
		expect(components[0].priority).toBe(10);
	});

	it('2. 여러 컴포넌트를 같은 슬롯에 등록 가능', () => {
		registerComponent('content-before', MockComponent1, 10);
		registerComponent('content-before', MockComponent2, 20);
		registerComponent('content-before', MockComponent3, 5);

		const components = getComponentsForSlot('content-before');
		expect(components).toHaveLength(3);
	});

	it('3. Priority 순서대로 정렬됨 (낮은 숫자가 먼저)', () => {
		registerComponent('content-before', MockComponent1, 30, undefined, 'theme-a');
		registerComponent('content-before', MockComponent2, 10, undefined, 'theme-b');
		registerComponent('content-before', MockComponent3, 20, undefined, 'theme-c');

		const components = getComponentsForSlot('content-before');

		// Priority 순서: 10, 20, 30
		expect(components[0].priority).toBe(10);
		expect(components[0].component).toBe(MockComponent2);

		expect(components[1].priority).toBe(20);
		expect(components[1].component).toBe(MockComponent3);

		expect(components[2].priority).toBe(30);
		expect(components[2].component).toBe(MockComponent1);
	});

	it('4. 여러 슬롯에 독립적으로 컴포넌트 등록', () => {
		registerComponent('content-before', MockComponent1, 10);
		registerComponent('content-after', MockComponent2, 10);
		registerComponent('sidebar-left-top', MockComponent3, 10);

		expect(getComponentsForSlot('content-before')).toHaveLength(1);
		expect(getComponentsForSlot('content-after')).toHaveLength(1);
		expect(getComponentsForSlot('sidebar-left-top')).toHaveLength(1);
	});

	it('5. Props 전달 가능', () => {
		const testProps = { title: 'Test Title', count: 42 };
		registerComponent('content-before', MockComponent1, 10, testProps);

		const components = getComponentsForSlot('content-before');
		expect(components[0].props).toEqual(testProps);
	});

	it('6. removeComponentsBySource()로 특정 소스의 컴포넌트 제거', () => {
		registerComponent('content-before', MockComponent1, 10, undefined, 'theme-a');
		registerComponent('content-before', MockComponent2, 20, undefined, 'theme-b');
		registerComponent('content-before', MockComponent3, 30, undefined, 'theme-a');

		expect(getComponentsForSlot('content-before')).toHaveLength(3);

		// theme-a의 컴포넌트만 제거
		removeComponentsBySource('theme-a');

		const remaining = getComponentsForSlot('content-before');
		expect(remaining).toHaveLength(1);
		expect(remaining[0].source).toBe('theme-b');
	});

	it('7. 여러 테마의 컴포넌트가 동시에 등록 가능', () => {
		registerComponent('content-before', MockComponent1, 10, undefined, 'theme-a');
		registerComponent('content-before', MockComponent2, 15, undefined, 'theme-b');
		registerComponent('content-before', MockComponent3, 5, undefined, 'theme-c');

		const components = getComponentsForSlot('content-before');
		expect(components).toHaveLength(3);

		// 각 테마의 컴포넌트가 모두 존재
		expect(components.some((c) => c.source === 'theme-a')).toBe(true);
		expect(components.some((c) => c.source === 'theme-b')).toBe(true);
		expect(components.some((c) => c.source === 'theme-c')).toBe(true);
	});

	it('8. 등록되지 않은 슬롯은 빈 배열 반환', () => {
		const components = getComponentsForSlot('non-existent-slot' as any);
		expect(components).toEqual([]);
	});

	it('9. clearAllSlots()로 모든 슬롯 초기화', () => {
		registerComponent('content-before', MockComponent1, 10);
		registerComponent('content-after', MockComponent2, 10);
		registerComponent('sidebar-left-top', MockComponent3, 10);

		clearAllSlots();

		expect(getComponentsForSlot('content-before')).toEqual([]);
		expect(getComponentsForSlot('content-after')).toEqual([]);
		expect(getComponentsForSlot('sidebar-left-top')).toEqual([]);
	});

	it('10. 각 컴포넌트는 고유한 ID를 가짐', () => {
		registerComponent('content-before', MockComponent1, 10);
		registerComponent('content-before', MockComponent2, 10);

		const components = getComponentsForSlot('content-before');
		expect(components[0].id).not.toBe(components[1].id);
		expect(components[0].id).toBeTruthy();
		expect(components[1].id).toBeTruthy();
	});
});
