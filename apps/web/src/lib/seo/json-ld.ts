/**
 * JSON-LD 확장 헬퍼
 *
 * Organization, DiscussionForumPosting 등 추가 구조화 데이터 생성
 */

import type {
    JsonLdOrganization,
    JsonLdDiscussionForumPosting,
    JsonLdFAQPage,
    JsonLdFAQItem
} from './types';

/**
 * Organization JSON-LD 생성
 * 사이트 홈페이지에 사용
 */
export function createOrganizationJsonLd(options: {
    name: string;
    url: string;
    logo?: string;
    description?: string;
    sameAs?: string[];
    contactPoint?: {
        email?: string;
        telephone?: string;
    };
}): JsonLdOrganization {
    const data: JsonLdOrganization = {
        '@type': 'Organization',
        name: options.name,
        url: options.url
    };

    if (options.logo) data.logo = options.logo;
    if (options.description) data.description = options.description;
    if (options.sameAs?.length) data.sameAs = options.sameAs;

    if (options.contactPoint) {
        data.contactPoint = {
            '@type': 'ContactPoint',
            contactType: 'customer service'
        };
        if (options.contactPoint.email) data.contactPoint.email = options.contactPoint.email;
        if (options.contactPoint.telephone)
            data.contactPoint.telephone = options.contactPoint.telephone;
    }

    return data;
}

/**
 * DiscussionForumPosting JSON-LD 생성
 * 커뮤니티 게시글에 사용 (Google 포럼 검색 결과 강화)
 */
export function createDiscussionForumPostingJsonLd(options: {
    headline: string;
    text?: string;
    author: string;
    authorUrl?: string;
    datePublished: string;
    dateModified?: string;
    url: string;
    commentCount?: number;
    upvoteCount?: number;
    image?: string;
}): JsonLdDiscussionForumPosting {
    const data: JsonLdDiscussionForumPosting = {
        '@type': 'DiscussionForumPosting',
        headline: options.headline,
        author: {
            '@type': 'Person',
            name: options.author
        },
        datePublished: options.datePublished,
        url: options.url
    };

    if (options.text) data.text = options.text;
    if (options.authorUrl) data.author.url = options.authorUrl;
    if (options.dateModified) data.dateModified = options.dateModified;
    if (options.image) data.image = options.image;

    // 상호작용 통계 (댓글 수, 추천 수)
    if (options.commentCount !== undefined || options.upvoteCount !== undefined) {
        data.interactionStatistic = [];

        if (options.commentCount !== undefined) {
            data.interactionStatistic.push({
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/CommentAction',
                userInteractionCount: options.commentCount
            });
        }

        if (options.upvoteCount !== undefined) {
            data.interactionStatistic.push({
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/LikeAction',
                userInteractionCount: options.upvoteCount
            });
        }
    }

    return data;
}

/**
 * FAQPage JSON-LD 생성
 * FAQ 페이지에 사용 (Google FAQ 리치 결과)
 */
export function createFAQPageJsonLd(items: JsonLdFAQItem[]): JsonLdFAQPage {
    return {
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer
            }
        }))
    };
}
