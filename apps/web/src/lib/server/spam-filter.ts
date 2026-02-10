/**
 * 스팸 필터링
 *
 * g5_config 금지어 + 패턴 기반 스팸 탐지
 */
import { getProhibitList } from '$lib/server/auth/register.js';

interface SpamCheckResult {
    isSpam: boolean;
    reason?: string;
}

/** 도박/성인/불법 키워드 패턴 */
const SPAM_PATTERNS = [
    /카지노/,
    /바카라/,
    /슬롯머신/,
    /토토사이트/,
    /먹튀검증/,
    /스포츠토토/,
    /온라인카지노/,
    /파워볼/,
    /룰렛/,
    /블랙잭/,
    /홀덤/,
    /포커사이트/,
    /베팅사이트/,
    /배팅사이트/,
    /성인용품/,
    /출장안마/,
    /출장마사지/,
    /대출상담/,
    /무직자대출/,
    /당일대출/
];

/**
 * 스팸 체크
 * @param title 제목
 * @param content 본문 (HTML 태그 제거 후 검사)
 */
export async function checkSpam(title: string, content: string): Promise<SpamCheckResult> {
    // HTML 태그 제거 (순수 텍스트로 검사)
    const plainContent = content.replace(/<[^>]*>/g, ' ').trim();
    const combined = `${title} ${plainContent}`;

    // 1. g5_config 금지어 매칭
    try {
        const prohibitList = await getProhibitList();
        const lowerCombined = combined.toLowerCase();
        for (const word of prohibitList) {
            if (word && lowerCombined.includes(word)) {
                return { isSpam: true, reason: '금지어가 포함되어 있습니다.' };
            }
        }
    } catch {
        // DB 조회 실패 시 건너뜀
    }

    // 2. URL 도배 (동일 URL 3회+ 반복)
    const urls = combined.match(/https?:\/\/[^\s<>"']+/gi) || [];
    if (urls.length >= 3) {
        const urlCounts = new Map<string, number>();
        for (const url of urls) {
            const normalized = url.toLowerCase().replace(/\/+$/, '');
            urlCounts.set(normalized, (urlCounts.get(normalized) || 0) + 1);
        }
        for (const [, count] of urlCounts) {
            if (count >= 3) {
                return { isSpam: true, reason: '동일 URL이 과도하게 반복되었습니다.' };
            }
        }
    }

    // 3. 반복 문자 (같은 문자 20회+ 연속)
    if (/(.)\1{19,}/.test(plainContent)) {
        return { isSpam: true, reason: '반복 문자가 과도하게 포함되어 있습니다.' };
    }

    // 4. 도박/성인 패턴 키워드
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(combined)) {
            return { isSpam: true, reason: '스팸으로 감지된 내용이 포함되어 있습니다.' };
        }
    }

    return { isSpam: false };
}
