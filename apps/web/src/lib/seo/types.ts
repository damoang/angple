/**
 * SEO 관련 타입 정의
 */

/** 기본 메타 정보 */
export interface SeoMeta {
	title: string;
	description?: string;
	keywords?: string[];
	canonicalUrl?: string;
	noIndex?: boolean;
	noFollow?: boolean;
}

/** Open Graph 메타 정보 */
export interface OgMeta {
	title?: string;
	description?: string;
	image?: string;
	imageWidth?: number;
	imageHeight?: number;
	url?: string;
	type?: 'website' | 'article' | 'profile';
	siteName?: string;
	locale?: string;
}

/** Twitter Card 메타 정보 */
export interface TwitterMeta {
	card?: 'summary' | 'summary_large_image';
	site?: string;
	creator?: string;
	title?: string;
	description?: string;
	image?: string;
}

/** JSON-LD 구조화 데이터 - WebSite */
export interface JsonLdWebSite {
	'@type': 'WebSite';
	name: string;
	url: string;
	description?: string;
	potentialAction?: {
		'@type': 'SearchAction';
		target: string;
		'query-input': string;
	};
}

/** JSON-LD 구조화 데이터 - Article */
export interface JsonLdArticle {
	'@type': 'Article';
	headline: string;
	author?: { '@type': 'Person'; name: string };
	datePublished?: string;
	dateModified?: string;
	image?: string;
	description?: string;
}

/** JSON-LD 구조화 데이터 - BreadcrumbList */
export interface JsonLdBreadcrumb {
	'@type': 'BreadcrumbList';
	itemListElement: Array<{
		'@type': 'ListItem';
		position: number;
		name: string;
		item?: string;
	}>;
}

export type JsonLdData = JsonLdWebSite | JsonLdArticle | JsonLdBreadcrumb;

/** SEO 헬퍼에 전달하는 통합 옵션 */
export interface SeoConfig {
	meta: SeoMeta;
	og?: OgMeta;
	twitter?: TwitterMeta;
	jsonLd?: JsonLdData[];
}
