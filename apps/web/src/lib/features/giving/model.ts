export type GivingStatus = 'active' | 'waiting' | 'paused' | 'ended' | 'no_giving';

export interface GivingMetaSource {
    extra_2?: string | null;
    extra_4?: string | null;
    extra_5?: string | null;
    extra_7?: string | null;
    participant_count?: number | null;
}

export interface GivingMeta {
    isGivingPost: boolean;
    givingStart: string | null;
    givingEnd: string | null;
    status: GivingStatus;
    isPaused: boolean;
    participantCount: number;
    isUrgent: boolean;
}

function parseCount(value?: string | number | null): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : 0;
    }
    const parsed = parseInt(value || '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseGivingTime(value?: string | null): number | null {
    if (!value) return null;
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
}

export function resolveGivingMeta(source: GivingMetaSource, now = Date.now()): GivingMeta {
    const givingStart = source.extra_4 || null;
    const givingEnd = source.extra_5 || null;
    const participantCount =
        source.participant_count != null
            ? parseCount(source.participant_count)
            : parseCount(source.extra_2);
    const isPaused = source.extra_7 === '1';
    const isForceEnded = source.extra_7 === '2';

    const startMs = parseGivingTime(givingStart);
    const endMs = parseGivingTime(givingEnd);
    const hasSchedule = startMs !== null && endMs !== null;

    let status: GivingStatus = 'no_giving';
    if (isForceEnded) {
        status = 'ended';
    } else if (isPaused) {
        status = hasSchedule ? 'paused' : 'no_giving';
    } else if (hasSchedule) {
        if (endMs !== null && now > endMs) {
            status = 'ended';
        } else if (startMs !== null && now >= startMs) {
            status = 'active';
        } else {
            status = 'waiting';
        }
    }

    const isGivingPost = status !== 'no_giving';
    const isUrgent =
        status === 'active' && endMs !== null && endMs > now && endMs - now <= 24 * 60 * 60 * 1000;

    return {
        isGivingPost,
        givingStart,
        givingEnd,
        status,
        isPaused: status === 'paused',
        participantCount,
        isUrgent
    };
}
