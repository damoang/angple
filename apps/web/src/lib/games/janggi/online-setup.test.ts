/**
 * 온라인 상차림 선택 단계 — 메시지 해석·남은 시간·상대 상차림 표시
 */
import { describe, it, expect } from 'vitest';
import { TEAM } from './rules';
import {
    SETUP_SECONDS,
    opponentSetup,
    parseSetupChoose,
    parseSetups,
    secondsLeft,
    setupText,
    teamDefaultSetup
} from './online-setup';

describe('parseSetupChoose', () => {
    it('정상 메시지를 그대로 읽는다', () => {
        const r = parseSetupChoose({
            type: 'setup_choose',
            roomId: 'r1',
            playerTeam: 2,
            seconds: 20,
            remainingMs: 12_345,
            mySetup: '마상상마'
        });
        expect(r).toEqual({
            roomId: 'r1',
            playerTeam: TEAM.HAN,
            seconds: 20,
            remainingMs: 12_345,
            mySetup: '마상상마'
        });
    });

    it('mySetup 이 없거나 잘못되면 null', () => {
        const base = { type: 'setup_choose', roomId: 'r', playerTeam: 1, seconds: 20 };
        expect(parseSetupChoose({ ...base, remainingMs: 5000 })?.mySetup).toBeNull();
        expect(
            parseSetupChoose({ ...base, remainingMs: 5000, mySetup: '차포' })?.mySetup
        ).toBeNull();
    });

    it('남은 시간은 0 ~ seconds 로 자르고, 없으면 seconds 전체', () => {
        const base = { type: 'setup_choose', roomId: 'r', playerTeam: 1, seconds: 20 };
        expect(parseSetupChoose({ ...base, remainingMs: -50 })?.remainingMs).toBe(0);
        expect(parseSetupChoose({ ...base, remainingMs: 99_000 })?.remainingMs).toBe(20_000);
        expect(parseSetupChoose(base)?.remainingMs).toBe(20_000);
    });

    it('seconds 가 없으면 기본 20초', () => {
        const r = parseSetupChoose({ type: 'setup_choose', roomId: 'r', playerTeam: 1 });
        expect(r?.seconds).toBe(SETUP_SECONDS);
        expect(r?.remainingMs).toBe(SETUP_SECONDS * 1000);
    });

    it('다른 type·잘못된 입력은 null', () => {
        expect(parseSetupChoose({ type: 'game_start' })).toBeNull();
        expect(parseSetupChoose(null)).toBeNull();
        expect(parseSetupChoose('setup_choose')).toBeNull();
    });

    it('알 수 없는 진영은 0', () => {
        expect(parseSetupChoose({ type: 'setup_choose', playerTeam: 7 })?.playerTeam).toBe(0);
    });
});

describe('parseSetups', () => {
    it('둘 다 올바를 때만 읽는다', () => {
        expect(parseSetups({ cho: '상마상마', han: '마상마상' })).toEqual({
            cho: '상마상마',
            han: '마상마상'
        });
        expect(parseSetups({ cho: '상마상마' })).toBeNull();
        expect(parseSetups({ cho: '상마상마', han: 'x' })).toBeNull();
        expect(parseSetups(undefined)).toBeNull();
    });
});

describe('secondsLeft', () => {
    it('올림하고 0 아래로 내려가지 않는다', () => {
        expect(secondsLeft(20_000, 0)).toBe(20);
        expect(secondsLeft(20_000, 1)).toBe(20);
        expect(secondsLeft(20_000, 19_001)).toBe(1);
        expect(secondsLeft(20_000, 20_000)).toBe(0);
        expect(secondsLeft(20_000, 25_000)).toBe(0);
    });
});

describe('진영별 기본값·상대 상차림', () => {
    it('미선택 기본값 = 현행 배치(초 상마상마·한 마상마상)', () => {
        expect(teamDefaultSetup(TEAM.CHO)).toBe('상마상마');
        expect(teamDefaultSetup(TEAM.HAN)).toBe('마상마상');
    });

    it('상대 진영 값을 고른다', () => {
        const s = { cho: '상마상마', han: '마상상마' } as const;
        expect(opponentSetup(s, TEAM.CHO)).toBe('마상상마');
        expect(opponentSetup(s, TEAM.HAN)).toBe('상마상마');
        expect(opponentSetup(s, 0)).toBeNull();
        expect(opponentSetup(null, TEAM.CHO)).toBeNull();
    });

    it('표시 문구', () => {
        expect(setupText('마상상마')).toBe('안상(마상상마)');
    });
});
