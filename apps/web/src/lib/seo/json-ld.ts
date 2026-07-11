/**
 * JSON-LD 확장 헬퍼
 *
 * Organization, DiscussionForumPosting 등 추가 구조화 데이터 생성
 */

import type {
    JsonLdOrganization,
    JsonLdDiscussionForumPosting,
    JsonLdFAQPage,
    JsonLdFAQItem,
    JsonLdQAPage,
    JsonLdVideoObject
} from './types';

/**
 * QAPage JSON-LD 생성 — 질문/답변 게시판(qa) 리치 결과
 *
 * FAQPage 는 사이트 자체 작성 FAQ 전용(구글이 노출을 크게 제한)이라, 사용자
 * 질문+답변 커뮤니티에는 QAPage 가 올바른 타입이다. 리치 결과에는 답변이
 * 필요하므로 유효한 답변이 1개 이상일 때만 출력(null = 블록 생략).
 */
export function createQAPageJsonLd(options: {
    /** 질문 제목 (필수) */
    name: string;
    /** 질문 본문 요약 */
    text?: string;
    author?: string;
    /** 질문 작성자 프로필 URL — GSC "mainEntity.author 의 url 누락" 대응 */
    authorUrl?: string;
    dateCreated?: string;
    /** 전체 답변(댓글) 수 */
    answerCount: number;
    answers: Array<{
        text: string;
        /** 답변(댓글) 앵커 URL — GSC "suggestedAnswer 의 url 누락" 대응 */
        url?: string;
        author?: string;
        authorUrl?: string;
        dateCreated?: string;
        upvoteCount?: number;
    }>;
}): JsonLdQAPage | null {
    if (!options.name?.trim()) return null;
    const answers = options.answers
        .filter((a) => a.text?.trim())
        .slice(0, 3)
        .map((a) => ({
            '@type': 'Answer' as const,
            text: a.text.trim(),
            ...(a.url ? { url: a.url } : {}),
            ...(a.dateCreated ? { dateCreated: a.dateCreated } : {}),
            ...(a.upvoteCount !== undefined ? { upvoteCount: a.upvoteCount } : {}),
            ...(a.author?.trim()
                ? {
                      author: {
                          '@type': 'Person' as const,
                          name: a.author.trim(),
                          ...(a.authorUrl ? { url: a.authorUrl } : {})
                      }
                  }
                : {})
        }));
    if (!answers.length) return null;

    return {
        '@type': 'QAPage',
        mainEntity: {
            '@type': 'Question',
            name: options.name.trim(),
            ...(options.text ? { text: options.text } : {}),
            answerCount: Math.max(options.answerCount, answers.length),
            ...(options.dateCreated ? { dateCreated: options.dateCreated } : {}),
            ...(options.author?.trim()
                ? {
                      author: {
                          '@type': 'Person' as const,
                          name: options.author.trim(),
                          ...(options.authorUrl ? { url: options.authorUrl } : {})
                      }
                  }
                : {}),
            suggestedAnswer: answers
        }
    };
}

/** 본문에서 추출된 동영상 (유튜브 임베드 또는 업로드 파일) */
export type ExtractedVideo =
    | { type: 'youtube'; id: string }
    | { type: 'file'; url: string; poster?: string };

// 유튜브 임베드 iframe 의 videoId — tiptap Youtube 확장이 embed/ 형태로 저장하지만,
// 과거 글의 nocookie·shorts 변형도 수용
const YOUTUBE_EMBED_ID_RE =
    /(?:youtube(?:-nocookie)?\.com\/(?:embed|shorts)\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/**
 * 본문 HTML 에서 동영상을 추출 (VideoObject 구조화 데이터용)
 *
 * 단순 링크(<a href>)는 플레이어가 아니므로 제외하고, 실제 재생 요소만 본다:
 * - <iframe src="...youtube.com/embed/ID...">  (tiptap Youtube 임베드)
 * - <video src="..."> 또는 <video><source src="..."></video>  (업로드 동영상)
 */
export function extractVideosFromContent(html: string): ExtractedVideo[] {
    if (!html) return [];
    const videos: ExtractedVideo[] = [];
    const seen = new Set<string>();

    for (const m of html.matchAll(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) {
        const id = m[1].match(YOUTUBE_EMBED_ID_RE)?.[1];
        if (id && !seen.has(`yt:${id}`)) {
            seen.add(`yt:${id}`);
            videos.push({ type: 'youtube', id });
        }
    }

    // <video src> 와 <video> 내부 <source src> — 에디터가 두 형태 모두 생성.
    // poster 속성(브라우저 캡처 첫 프레임)이 있으면 VideoObject 썸네일로 쓰도록 함께 추출
    for (const vm of html.matchAll(/<video\b[^>]*>[\s\S]*?(?:<\/video>|$)|<video\b[^>]*\/?>/gi)) {
        const block = vm[0];
        const openTag = block.match(/^<video\b[^>]*>/i)?.[0] ?? block;
        const poster = openTag.match(/\sposter\s*=\s*["']([^"']+)["']/i)?.[1];
        const url =
            openTag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1] ??
            block.match(/<source\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/i)?.[1];
        if (url && !seen.has(`file:${url}`)) {
            seen.add(`file:${url}`);
            videos.push(poster ? { type: 'file', url, poster } : { type: 'file', url });
        }
    }

    return videos;
}

/**
 * VideoObject JSON-LD 생성
 *
 * Google 동영상 색인은 name·thumbnailUrl·uploadDate 가 필수 — 하나라도 없으면
 * "제공된 썸네일 URL 없음" 류의 색인 제외가 되므로, 미충족 시 블록 자체를 생략(null)
 */
export function createVideoObjectJsonLd(options: {
    name: string;
    description?: string;
    thumbnailUrl?: string;
    uploadDate: string;
    embedUrl?: string;
    contentUrl?: string;
}): JsonLdVideoObject | null {
    if (!options.name?.trim() || !options.thumbnailUrl || !options.uploadDate) return null;
    if (!options.embedUrl && !options.contentUrl) return null;

    const data: JsonLdVideoObject = {
        '@type': 'VideoObject',
        name: options.name.trim(),
        thumbnailUrl: options.thumbnailUrl,
        uploadDate: options.uploadDate
    };
    if (options.description) data.description = options.description;
    if (options.embedUrl) data.embedUrl = options.embedUrl;
    if (options.contentUrl) data.contentUrl = options.contentUrl;
    return data;
}

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
    /** 상위 댓글 (Google 포럼 리치 결과의 comment 노드, 최대 3개 출력) */
    comments?: Array<{
        text: string;
        author: string;
        /** 작성자 프로필 URL — GSC "comment.author 의 url 누락" 개선 제안 대응 */
        authorUrl?: string;
        datePublished?: string;
    }>;
}): JsonLdDiscussionForumPosting {
    const data: JsonLdDiscussionForumPosting = {
        '@type': 'DiscussionForumPosting',
        headline: options.headline,
        author: {
            '@type': 'Person',
            // 삭제글 등에서 author 가 빈 값이면 name 누락 오류가 되므로 폴백
            name: options.author?.trim() || '익명'
        },
        datePublished: options.datePublished,
        url: options.url
    };

    if (options.text) data.text = options.text;
    if (options.authorUrl) data.author.url = options.authorUrl;
    if (options.dateModified) data.dateModified = options.dateModified;
    if (options.image) data.image = options.image;

    // GSC "comment 입력란 누락" 개선 — 유효한(내용·작성자 있는) 댓글만 최대 3개
    if (options.comments?.length) {
        const validComments = options.comments
            .filter((c) => c.text?.trim() && c.author?.trim())
            .slice(0, 3)
            .map((c) => ({
                '@type': 'Comment' as const,
                text: c.text.trim(),
                author: {
                    '@type': 'Person' as const,
                    name: c.author.trim(),
                    ...(c.authorUrl ? { url: c.authorUrl } : {})
                },
                ...(c.datePublished ? { datePublished: c.datePublished } : {})
            }));
        if (validComments.length) data.comment = validComments;
    }

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
