/**
 * @angple/theme-engine - 동적 테마 로딩 및 관리 엔진
 */

import { ThemeManager as ThemeManagerClass } from './theme-manager.js';

export { ThemeLoader } from './theme-loader.js';
export { ThemeManager } from './theme-manager.js';

// 싱글톤 인스턴스
export const themeManager = new ThemeManagerClass();
