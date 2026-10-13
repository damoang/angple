/**
 * 대국 끝 이유 → 화면 문구. 온라인(game_over.reason)과 로컬(AI·2인) 판이 같이 쓴다.
 *
 * 온라인 이유: checkmate·resign·timeout·disconnect·bikjang_score·stall_score.
 * 점수 판정은 늘 승자가 있다(한 덤 1.5). 로컬 전용: king_captured(궁 잡음)·no_moves(둘 수 없음).
 */
import { TEAM } from './rules';

export type EndReason =
    | 'checkmate'
    | 'resign'
    | 'timeout'
    | 'disconnect'
    | 'bikjang_score'
    | 'stall_score'
    | 'king_captured'
    | 'no_moves';

export interface EndScores {
    cho: number;
    /** 덤 포함 */
    han: number;
}

export interface EndOptions {
    /** 둔 수(모르면 null — 재접속 등) */
    moves?: number | null;
    /** 점수 판정 때 판 위 점수 */
    scores?: EndScores | null;
}

export interface EndText {
    /** 보드 위 큰 배너 */
    banner: string;
    /** 결과 상자 한 줄(이유 · 수 · 점수) */
    detail: string;
    tone: 'win' | 'lose' | 'neutral';
}

interface Phrase {
    winBanner: string;
    loseBanner: string;
    winDetail: string;
    loseDetail: string;
    /** 2인 판(진영 이름) — {t} = 이긴 진영 */
    neutralBanner: string;
    neutralDetail: string;
}

const PHRASES: Record<EndReason, Phrase> = {
    checkmate: {
        winBanner: '외통! 🎉 승리',
        loseBanner: '외통… 패배',
        winDetail: '외통으로 승리',
        loseDetail: '외통으로 패배',
        neutralBanner: '외통! {t} 승리',
        neutralDetail: '외통으로 {t} 승리'
    },
    resign: {
        winBanner: '기권승',
        loseBanner: '기권패',
        winDetail: '상대 기권으로 승리',
        loseDetail: '기권으로 패배',
        neutralBanner: '{t} 기권승',
        neutralDetail: '기권으로 {t} 승리'
    },
    timeout: {
        winBanner: '시간승',
        loseBanner: '시간패',
        winDetail: '상대 시간 초과로 승리',
        loseDetail: '시간 초과로 패배',
        neutralBanner: '{t} 시간승',
        neutralDetail: '시간 초과로 {t} 승리'
    },
    disconnect: {
        winBanner: '상대 이탈승',
        loseBanner: '이탈패',
        winDetail: '상대가 대국을 떠나 승리',
        loseDetail: '대국을 떠나 패배',
        neutralBanner: '{t} 이탈승',
        neutralDetail: '상대 이탈로 {t} 승리'
    },
    bikjang_score: {
        winBanner: '빅장 판정승',
        loseBanner: '빅장 판정패',
        winDetail: '빅장 점수 판정으로 승리',
        loseDetail: '빅장 점수 판정으로 패배',
        neutralBanner: '빅장 {t} 판정승',
        neutralDetail: '빅장 점수 판정으로 {t} 승리'
    },
    stall_score: {
        winBanner: '교착 판정승',
        loseBanner: '교착 판정패',
        winDetail: '교착 점수 판정으로 승리',
        loseDetail: '교착 점수 판정으로 패배',
        neutralBanner: '교착 {t} 판정승',
        neutralDetail: '교착 점수 판정으로 {t} 승리'
    },
    king_captured: {
        winBanner: '궁을 잡았습니다! 🎉 승리',
        loseBanner: '궁을 잡혔습니다… 패배',
        winDetail: '궁을 잡아 승리',
        loseDetail: '궁을 잡혀 패배',
        neutralBanner: '{t} 궁 잡고 승리',
        neutralDetail: '궁을 잡아 {t} 승리'
    },
    no_moves: {
        winBanner: '🎉 승리',
        loseBanner: '패배',
        winDetail: '상대가 둘 수 있는 수가 없어 승리',
        loseDetail: '둘 수 있는 수가 없어 패배',
        neutralBanner: '{t} 승리',
        neutralDetail: '상대가 둘 수 있는 수가 없어 {t} 승리'
    }
};

export function isEndReason(v: unknown): v is EndReason {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PHRASES, v);
}

export function isScoreReason(reason: string): boolean {
    return reason === 'bikjang_score' || reason === 'stall_score';
}

/** 점수 표기 — 한은 덤이 들어간 소수 한 자리. */
export function scoreText(s: EndScores): string {
    return `초 ${s.cho}점 · 한 ${s.han.toFixed(1)}점(덤 포함)`;
}

function tail(reason: string, opts: EndOptions): string {
    let s = '';
    if (typeof opts.moves === 'number' && opts.moves > 0) s += ` · ${opts.moves}수`;
    if (opts.scores && isScoreReason(reason)) s += ` · ${scoreText(opts.scores)}`;
    return s;
}

/** 내 시점(온라인·1인 AI) 문구. 알 수 없는 이유면 이유 없이 승/패만. */
export function endText(reason: string, won: boolean, opts: EndOptions = {}): EndText {
    const tone = won ? 'win' : 'lose';
    if (!isEndReason(reason)) {
        return {
            banner: won ? '🎉 승리' : '패배',
            detail: (won ? '승리' : '패배') + tail(reason, opts),
            tone
        };
    }
    const ph = PHRASES[reason];
    return {
        banner: won ? ph.winBanner : ph.loseBanner,
        detail: (won ? ph.winDetail : ph.loseDetail) + tail(reason, opts),
        tone
    };
}

export function teamName(team: number): string {
    return team === TEAM.CHO ? '초(楚)' : '한(漢)';
}

/** 2인 한 화면 판 — 이긴 진영 이름으로. */
export function endTextForTeam(reason: string, winner: number, opts: EndOptions = {}): EndText {
    const t = teamName(winner);
    if (!isEndReason(reason)) {
        return { banner: `${t} 승리`, detail: `${t} 승리` + tail(reason, opts), tone: 'neutral' };
    }
    const ph = PHRASES[reason];
    return {
        banner: ph.neutralBanner.replace('{t}', t),
        detail: ph.neutralDetail.replace('{t}', t) + tail(reason, opts),
        tone: 'neutral'
    };
}
