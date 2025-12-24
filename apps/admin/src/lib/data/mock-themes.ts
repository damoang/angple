import type { ThemeWithStatus } from '$lib/types/theme';

/**
 * Mock 테마 데이터
 * Phase 3 개발 중 실제 API 없이 UI 테스트를 위해 사용
 */
export const mockThemes: ThemeWithStatus[] = [
	{
		manifest: {
			id: 'sample-theme',
			name: 'Sample Theme',
			version: '1.0.0',
			author: {
				name: 'Angple Team',
				email: 'team@angple.com'
			},
			description: '테마 시스템 테스트용 샘플 테마입니다. 기본 Hook과 컴포넌트를 포함합니다.',
			screenshot: '/themes/sample-theme/screenshot.png',
			hooks: [
				{
					name: 'page_loaded',
					type: 'action',
					callback: 'hooks/on-page-load.js',
					priority: 15
				},
				{
					name: 'post_title',
					type: 'filter',
					callback: 'hooks/filter-post-title.js',
					priority: 10
				}
			],
			components: [
				{
					id: 'custom-banner',
					name: 'Custom Banner',
					slot: 'content-before',
					path: 'components/banner.svelte',
					priority: 5
				}
			],
			settings: {
				appearance: {
					primaryColor: {
						label: 'Primary Color',
						type: 'color',
						default: '#3b82f6'
					},
					showBanner: {
						label: 'Show Banner',
						type: 'boolean',
						default: true
					}
				}
			},
			angpleVersion: '0.1.0',
			tags: ['sample', 'test', 'basic']
		},
		status: 'active',
		installedAt: new Date('2024-12-20'),
		activatedAt: new Date('2024-12-20'),
		currentSettings: {
			appearance: {
				primaryColor: '#3b82f6',
				showBanner: true
			}
		},
		source: 'local',
		downloadCount: 0
	},
	{
		manifest: {
			id: 'modern-dark',
			name: 'Modern Dark',
			version: '2.1.0',
			author: {
				name: 'DarkMode Studio',
				url: 'https://darkmode.studio'
			},
			description:
				'세련된 다크 모드 테마입니다. 눈의 피로를 줄이고 집중력을 높이는 디자인을 제공합니다.',
			screenshot: '/themes/modern-dark/screenshot.png',
			hooks: [
				{
					name: 'theme_activated',
					type: 'action',
					callback: 'hooks/on-activate.js',
					priority: 10
				}
			],
			components: [
				{
					id: 'dark-header',
					name: 'Dark Header',
					slot: 'header',
					path: 'components/header.svelte',
					priority: 10
				},
				{
					id: 'dark-footer',
					name: 'Dark Footer',
					slot: 'footer',
					path: 'components/footer.svelte',
					priority: 10
				}
			],
			settings: {
				colors: {
					background: {
						label: 'Background Color',
						type: 'color',
						default: '#1a1a1a'
					},
					text: {
						label: 'Text Color',
						type: 'color',
						default: '#e0e0e0'
					},
					accent: {
						label: 'Accent Color',
						type: 'color',
						default: '#ff6b6b'
					}
				},
				typography: {
					fontSize: {
						label: 'Base Font Size',
						type: 'select',
						default: 'medium',
						options: [
							{ label: 'Small', value: 'small' },
							{ label: 'Medium', value: 'medium' },
							{ label: 'Large', value: 'large' }
						]
					}
				}
			},
			angpleVersion: '0.1.0',
			tags: ['dark', 'modern', 'popular']
		},
		status: 'inactive',
		installedAt: new Date('2024-12-22'),
		source: 'marketplace',
		downloadCount: 1250
	},
	{
		manifest: {
			id: 'minimal-light',
			name: 'Minimal Light',
			version: '1.5.2',
			author: {
				name: 'MinimalDesign',
				email: 'hello@minimal.design'
			},
			description:
				'미니멀한 라이트 테마입니다. 깔끔하고 심플한 디자인으로 콘텐츠에 집중할 수 있습니다.',
			screenshot: '/themes/minimal-light/screenshot.png',
			components: [
				{
					id: 'minimal-sidebar',
					name: 'Minimal Sidebar',
					slot: 'sidebar-left',
					path: 'components/sidebar.svelte',
					priority: 5
				}
			],
			settings: {
				layout: {
					maxWidth: {
						label: 'Max Content Width',
						type: 'text',
						default: '1200px'
					},
					spacing: {
						label: 'Content Spacing',
						type: 'select',
						default: 'normal',
						options: [
							{ label: 'Compact', value: 'compact' },
							{ label: 'Normal', value: 'normal' },
							{ label: 'Relaxed', value: 'relaxed' }
						]
					}
				}
			},
			angpleVersion: '0.1.0',
			tags: ['minimal', 'light', 'clean']
		},
		status: 'inactive',
		installedAt: new Date('2024-12-23'),
		source: 'github',
		downloadCount: 890
	},
	{
		manifest: {
			id: 'colorful-blog',
			name: 'Colorful Blog',
			version: '3.0.0',
			author: {
				name: 'BlogThemes Co.',
				url: 'https://blogthemes.co'
			},
			description:
				'다채로운 블로그 테마입니다. 생동감 넘치는 색상과 다양한 레이아웃 옵션을 제공합니다.',
			screenshot: '/themes/colorful-blog/screenshot.png',
			hooks: [
				{
					name: 'post_content',
					type: 'filter',
					callback: 'hooks/enhance-content.js',
					priority: 5
				}
			],
			components: [
				{
					id: 'featured-posts',
					name: 'Featured Posts',
					slot: 'content-before',
					path: 'components/featured.svelte',
					priority: 15
				},
				{
					id: 'social-share',
					name: 'Social Share',
					slot: 'content-after',
					path: 'components/share.svelte',
					priority: 10
				}
			],
			settings: {
				colors: {
					primary: {
						label: 'Primary Color',
						type: 'color',
						default: '#ff6b6b'
					},
					secondary: {
						label: 'Secondary Color',
						type: 'color',
						default: '#4ecdc4'
					}
				},
				social: {
					showShareButtons: {
						label: 'Show Share Buttons',
						type: 'boolean',
						default: true
					}
				}
			},
			angpleVersion: '0.1.0',
			tags: ['blog', 'colorful', 'feature-rich']
		},
		status: 'inactive',
		installedAt: new Date('2024-12-24'),
		updatedAt: new Date('2024-12-24'),
		source: 'marketplace',
		downloadCount: 2340
	},
	{
		manifest: {
			id: 'installing-theme',
			name: 'Installing Theme',
			version: '1.0.0',
			author: {
				name: 'Test Author'
			},
			description: '설치 중 상태 테스트용 테마',
			angpleVersion: '0.1.0',
			tags: ['test']
		},
		status: 'installing',
		installedAt: new Date(),
		source: 'github'
	},
	{
		manifest: {
			id: 'error-theme',
			name: 'Error Theme',
			version: '0.5.0',
			author: {
				name: 'Error Test'
			},
			description: '에러 상태 테스트용 테마',
			angpleVersion: '0.1.0',
			tags: ['test']
		},
		status: 'error',
		installedAt: new Date('2024-12-24'),
		source: 'github',
		errorMessage: '호환되지 않는 Angple 버전입니다. (필요: 0.2.0, 현재: 0.1.0)'
	}
];

/**
 * 테마 ID로 Mock 테마 찾기
 */
export function getMockThemeById(id: string): ThemeWithStatus | undefined {
	return mockThemes.find((theme) => theme.manifest.id === id);
}

/**
 * 활성화된 테마 가져오기
 */
export function getActiveMockTheme(): ThemeWithStatus | undefined {
	return mockThemes.find((theme) => theme.status === 'active');
}

/**
 * 상태별 테마 필터링
 */
export function getMockThemesByStatus(status: ThemeWithStatus['status']): ThemeWithStatus[] {
	return mockThemes.filter((theme) => theme.status === status);
}
