/**
 * 소셜 회원가입 로직
 * PHP register_form_update.php 호환
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Adler-32 체크섬 구현 (PHP의 hash('adler32') 호환)
 * Node.js에는 내장 adler32가 없으므로 직접 구현
 */
export function adler32(buf: Buffer): number {
    let a = 1;
    let b = 0;
    const MOD = 65521;

    for (let i = 0; i < buf.length; i++) {
        a = (a + buf[i]) % MOD;
        b = (b + a) % MOD;
    }

    return (b << 16) | a;
}

/**
 * PHP 호환 소셜 mb_id 생성
 * PHP: strtolower(provider) . '_' . hash('adler32', md5(identifier))
 */
export function generateSocialMbId(provider: string, identifier: string): string {
    const md5Hash = createHash('md5').update(identifier).digest('hex');
    const adlerValue = adler32(Buffer.from(md5Hash, 'utf-8')) >>> 0;
    return `${provider.toLowerCase()}_${adlerValue.toString(16).padStart(8, '0')}`;
}

/** g5_member.mb_id 컬럼 길이. 이 값을 넘기면 DB가 조용히 절단한다. */
export const MB_ID_MAX_LENGTH = 20;

/**
 * mb_id가 이미 점유됐을 때 붙이는 충돌 회피 접미사.
 *
 * ⚠️ 접미사를 길게 잡으면 안 된다. g5_member.mb_id는 varchar(20)이라 넘치는 부분이
 * 조용히 잘려 저장되는데, g5_member_social_profiles.mb_id는 varchar(255)라
 * 잘리지 않는다. 두 테이블의 mb_id가 어긋나면 findSocialProfile이 존재하지 않는
 * 회원을 가리켜 **그 계정은 소셜 로그인이 영구히 불가능해진다**.
 * (2026-07-23 실측: 그렇게 갇힌 계정 62건, 최근 두 달에만 46건)
 *
 * base는 `provider_adler32` 형태로 최대 15자(google_)이므로 4자 접미사까지 안전하다.
 */
export function appendMbIdSuffix(baseMbId: string): string {
    const suffix = randomBytes(2).toString('hex'); // 4자
    const candidate = `${baseMbId}_${suffix}`;
    if (candidate.length > MB_ID_MAX_LENGTH) {
        // base 자체가 이미 길면 접미사 자리를 확보하기 위해 base를 줄인다.
        return `${baseMbId.slice(0, MB_ID_MAX_LENGTH - suffix.length - 1)}_${suffix}`;
    }
    return candidate;
}

/**
 * 소셜 재가입 시 이미 그 소셜 계정으로 만들어진 계정이 있는지 판정한다.
 *
 * ⛔ 2026-08-27 정정. 예전 주석에는 이렇게 적혀 있었고, **거짓이었다**:
 *   「generateSocialMbId는 결정적이라 mb_id가 충돌한다는 것은 같은 소셜 계정이라는 뜻이다」
 * 결정적인 것과 충돌하지 않는 것은 다르다. `generateSocialMbId`는 adler32를 md5의
 * **hex 문자열 32자**('0'~'f')에 걸기 때문에 출력 공간이 무너져 있다(충돌 체감 키공간 약 205만).
 * 서로 다른 소셜 계정이 같은 mb_id를 만들어내고, 실제로 남의 계정이
 * 「당신의 이전 계정입니다」로 안내되어 넘어간 사고가 있었다.
 *
 * 근거로 쓰였던 「2026-07-23 실측: 둘 이상이 활동한 묶음 0개」도 뒤집혔다 — 2026-08-26에 1건 나왔다.
 *
 * 그러므로 **mb_id 일치는 후보일 뿐**이고, 소유는 `g5_member_social_profiles`에서 확인한다:
 * (점유 mb_id, provider, **들어온 identifier**) 행이 실제로 있어야 동일인이다.
 *
 * - `none`        점유 없음 → 정상 가입
 * - `blocked`     이용제한 중 → 계정 생성 금지. 제재 회피 재가입 통로를 막는다
 * - `owned`       소유 확인됨 → 복구 안내 대상
 * - `unverified`  해시만 같고 소유 미확인 → ⛔ 복구 안내 금지
 */
export type OccupantKind = 'none' | 'blocked' | 'owned' | 'unverified';

export interface OccupantInfo {
    kind: OccupantKind;
    mbId: string;
    nick: string;
    joinedAt: string;
    postCount: number;
    withdrawn: boolean;
    /**
     * 점유 계정에 이 provider 의 소셜 프로필 행이 하나라도 있는지.
     *
     * `unverified` 를 두 갈래로 나누기 위해 필요하다.
     * - `false` = 대조할 것이 아예 없다. 본인일 가능성이 높지만 자동으로 내줄 수는 없다 → 사람이 확인한다.
     *   ⛔ 2026-07 **이전** 탈퇴 경로가 프로필 행을 하드삭제했다. 그 경로(`processMemberLeave`)는
     *   지금 죽어 있고, 라이브 탈퇴(Go `member_leave_handler`)는 프로필을 건드리지 않는다.
     *   그래서 이 칸은 **레거시 재고이고 시간이 지날수록 비어간다**:
     *   ~2026-06 탈퇴 100% 결손 → 2026-07 4% → 2026-08 6%.
     * - `true`  = 다른 신원이 이미 등록돼 있는데 내 신원은 없다. **남의 계정일 가능성이 높다.**
     */
    hasProfileRows: boolean;
}

export async function inspectSocialMbIdOccupant(
    provider: string,
    identifier: string
): Promise<OccupantInfo> {
    const mbId = generateSocialMbId(provider, identifier);
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_nick, mb_datetime, mb_leave_date, mb_intercept_date
		   FROM g5_member WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    const row = rows[0];
    if (!row) {
        return {
            kind: 'none',
            mbId,
            nick: '',
            joinedAt: '',
            postCount: 0,
            withdrawn: false,
            hasProfileRows: false
        };
    }

    // mb_intercept_date는 YYYYMMDD 문자열. 99991231 = 영구.
    // 만료된 제재는 차단 대상이 아니다.
    const intercept = String(row.mb_intercept_date || '');
    const today = new Date();
    const todayStr =
        `${today.getFullYear()}` +
        `${String(today.getMonth() + 1).padStart(2, '0')}` +
        `${String(today.getDate()).padStart(2, '0')}`;
    const blocked = intercept.length === 8 && intercept >= todayStr;

    // ⛔ 소유 확인. 해시 일치는 후보일 뿐이므로 여기서 동일인 여부가 갈린다.
    //    같은 provider 라도 identifier 가 다르면 **다른 사람**이다.
    const [prof] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total,
		        SUM(identifier = ?) AS mine
		   FROM g5_member_social_profiles
		  WHERE mb_id = ? AND provider = ?`,
        [identifier, mbId, provider.toLowerCase()]
    );
    const owned = Number(prof[0]?.mine || 0) > 0;
    const hasProfileRows = Number(prof[0]?.total || 0) > 0;

    const [cnt] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM g5_board_new WHERE mb_id = ?',
        [mbId]
    );

    // ⛔ blocked 는 소유 확인보다 앞선다 — 종전과 정확히 같게 막는다.
    //    제재중 소셜계정 529개 중 105개(그중 영구 104개)가 프로필 행이 없어서,
    //    소유 확인을 통과 조건으로 걸면 그 진짜 본인들이 unverified 로 떨어져
    //    접미사를 붙인 새 계정을 받게 된다 = **제재 회피 통로가 열린다.**
    //    「우연히 해시가 겹친 남이 가입하지 못한다」는 부작용은 남는다(잔존 결함).
    //    identifier 는 adler32(md5(...)) 역산이 불가능하므로 프로필 백필로 해소할 수 없다.
    const kind: OccupantKind = blocked ? 'blocked' : owned ? 'owned' : 'unverified';

    return {
        kind,
        mbId,
        nick: row.mb_nick || '',
        joinedAt: row.mb_datetime ? String(row.mb_datetime) : '',
        postCount: Number(cnt[0]?.cnt || 0),
        withdrawn: Boolean(row.mb_leave_date),
        hasProfileRows
    };
}

/**
 * 탈퇴 상태인 옛 계정을 되살린다. 소셜 로그인 자기증명이 본인 확인을 대신한다
 * (같은 소셜 sub이어야만 이 경로에 도달하므로 DI보다 강한 근거다).
 */
export async function reactivateMember(mbId: string, reason: string): Promise<void> {
    await pool.query(
        `UPDATE g5_member
		    SET mb_leave_date = '',
		        mb_leave_reason = '',
		        mb_memo = CONCAT(IFNULL(mb_memo,''), '\\n', DATE_FORMAT(NOW(),'%Y%m%d'), ' ', ?)
		  WHERE mb_id = ?`,
        [reason, mbId]
    );
}

/** g5_config에서 가입 레벨 조회 */
export async function getRegisterLevel(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT cf_register_level FROM g5_config LIMIT 1'
    );
    return rows[0]?.cf_register_level ?? 2;
}

/** g5_config에서 금지 닉네임/아이디 목록 조회 */
export async function getProhibitList(): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT cf_prohibit_id FROM g5_config LIMIT 1'
    );
    const list = rows[0]?.cf_prohibit_id || '';
    return list
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
}

/** 닉네임 중복 체크 */
export async function isNicknameTaken(nickname: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM g5_member WHERE mb_nick = ?',
        [nickname]
    );
    return (rows[0]?.cnt || 0) > 0;
}

/** mb_id 중복 체크 */
export async function isMbIdTaken(mbId: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM g5_member WHERE mb_id = ?',
        [mbId]
    );
    return (rows[0]?.cnt || 0) > 0;
}

/**
 * 광고주 초대 플로우에서 이전에 생성된 임시 계정 찾기.
 * 같은 소셜 identifier로 생성된 tmp_ 닉네임 계정이 있으면 재사용하여 중복 방지.
 */
export async function findExistingTempAccount(baseMbId: string): Promise<{ mb_id: string } | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id FROM g5_member
         WHERE (mb_id = ? OR mb_id LIKE ?) AND mb_nick LIKE 'tmp\\_%' AND mb_leave_date = ''
         ORDER BY mb_datetime DESC LIMIT 1`,
        [baseMbId, `${baseMbId}_%`]
    );
    return rows[0] ? { mb_id: rows[0].mb_id as string } : null;
}

/**
 * 닉네임 정규화에서 제거하는 "눈에 보이지 않는 문자"의 코드포인트 목록.
 * 각 항목은 [시작, 끝] 코드포인트 범위(단일 문자는 시작=끝)다.
 *
 * ⚠️ 일반 공백(U+0020)은 목록에 없다 — 닉 중간 공백을 거부하는 기존 정책을 그대로 유지하기 위함.
 *     여기 있는 것은 화면에 흔적이 없어 사용자가 의도하지 않은 문자들뿐이다.
 */
const INVISIBLE_CHAR_RANGES: ReadonlyArray<readonly [number, number]> = [
    [0x0000, 0x001f], // C0 제어문자
    [0x007f, 0x009f], // DEL · C1 제어문자
    [0x200b, 0x200d], // ZWSP · ZWNJ · ZWJ (제로폭)
    [0x2060, 0x2060], // Word joiner
    [0xfeff, 0xfeff], // BOM / ZWNBSP
    [0x3000, 0x3000] // 전각공백(눈에 보이지 않는 공백)
];

/**
 * 위 코드포인트로 문자 클래스를 조립한다. String.fromCharCode 로 만들기 때문에
 * 소스에는 눈에 안 보이는 문자가 직접 들어가지 않아 리뷰가 가능하다.
 */
const INVISIBLE_CHARS_RE = new RegExp(
    '[' +
        INVISIBLE_CHAR_RANGES.map(
            ([start, end]) => String.fromCharCode(start) + '-' + String.fromCharCode(end)
        ).join('') +
        ']',
    'g'
);

/**
 * 닉네임에서 눈에 보이지 않는 문자를 제거한다.
 *
 * 외부 사이트에서 닉네임을 복사·붙여넣기 하면 눈에 안 보이는 문자가 딸려 오는 경우가 있다.
 * 예를 들어 순수 한자 닉("山寂")을 붙여넣어도 앞뒤에 전각공백/제로폭 문자가 섞여
 * 허용 문자 정규식(`^[가-힣a-zA-Z0-9._一-鿿™]+$`)을 통과하지 못해 거부됐다.
 * (2026-08-19 실측: free/7070278 제보 — 딴지 등에서 복사한 한자 닉이 거부됨)
 *
 * 제거 대상은 INVISIBLE_CHAR_RANGES 참고. 일반 공백(U+0020)은 제거하지 않는다.
 */
export function stripInvisibleChars(value: string): string {
    return value.replace(INVISIBLE_CHARS_RE, '');
}

/**
 * 닉네임 검증 (PHP register.lib.php 호환)
 * - 빈 값 불가
 * - 2~20자
 * - 한글/한자/영문/숫자/점/밑줄 허용
 * - 연속 점 불가
 * - 금지어 불가
 * - 중복 불가
 *
 * 검증에 앞서 눈에 보이지 않는 문자(제로폭·전각공백·제어문자)를 제거하며,
 * 길이·정규식·금지어·중복 검증과 최종 저장은 모두 정규화된 값(`normalized`) 기준으로 한다.
 * 호출부는 검증 성공 시 `normalized` 값을 저장해야 한다.
 */
export async function validateNickname(
    nickname: string
): Promise<{ valid: boolean; error?: string; normalized?: string }> {
    if (!nickname || !nickname.trim()) {
        return { valid: false, error: '닉네임을 입력해주세요.' };
    }

    // 기존 trim → 안 보이는 문자 제거 순서. 이후 모든 검증·저장은 이 값 기준.
    const trimmed = stripInvisibleChars(nickname.trim());

    if (!trimmed) {
        return { valid: false, error: '닉네임을 입력해주세요.' };
    }

    if (trimmed.length < 2 || trimmed.length > 20) {
        return { valid: false, error: '닉네임은 2~20자로 입력해주세요.' };
    }

    // 허용 문자: 한글, 한자(CJK 통합 U+4E00–U+9FFF), 영문, 숫자, 점, 밑줄, ™(U+2122)
    if (!/^[가-힣a-zA-Z0-9._一-鿿™]+$/.test(trimmed)) {
        return {
            valid: false,
            error: '닉네임은 한글, 한자, 영문, 숫자, 점, 밑줄만 사용 가능합니다.'
        };
    }

    // 연속 점 불가
    if (/\.\./.test(trimmed)) {
        return { valid: false, error: '닉네임에 연속된 점(.)은 사용할 수 없습니다.' };
    }

    // 금지어 체크
    const prohibitList = await getProhibitList();
    if (prohibitList.includes(trimmed.toLowerCase())) {
        return { valid: false, error: '사용할 수 없는 닉네임입니다.' };
    }

    // 중복 체크
    if (await isNicknameTaken(trimmed)) {
        return { valid: false, error: '이미 사용 중인 닉네임입니다.' };
    }

    return { valid: true, normalized: trimmed };
}

/**
 * 아이디 검증 (초대 플로우에서 사용자가 직접 입력)
 * - 3~20자
 * - 영문 소문자, 숫자, 밑줄 허용
 * - 금지어 불가
 * - 중복 불가
 */
export async function validateMbId(mbId: string): Promise<{ valid: boolean; error?: string }> {
    if (!mbId || !mbId.trim()) {
        return { valid: false, error: '아이디를 입력해주세요.' };
    }

    const trimmed = mbId.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
        return { valid: false, error: '아이디는 3~20자로 입력해주세요.' };
    }

    if (!/^[a-z0-9_]+$/.test(trimmed)) {
        return { valid: false, error: '아이디는 영문 소문자, 숫자, 밑줄만 사용 가능합니다.' };
    }

    // 금지어 체크
    const prohibitList = await getProhibitList();
    if (prohibitList.includes(trimmed.toLowerCase())) {
        return { valid: false, error: '사용할 수 없는 아이디입니다.' };
    }

    // 중복 체크
    if (await isMbIdTaken(trimmed)) {
        return { valid: false, error: '이미 사용 중인 아이디입니다.' };
    }

    return { valid: true };
}

/**
 * g5_member에 새 회원 INSERT
 * PHP register_form_update.php 기반 필수 컬럼
 */
export async function createMember(params: {
    mb_id: string;
    mb_nick: string;
    mb_email: string;
    mb_name: string;
    mb_ip: string;
    skipNickLock?: boolean;
}): Promise<void> {
    // 모든 소셜 가입 경로가 이 함수를 지난다. 여기서 막으면 어느 경로로 오든
    // 절단된 mb_id로 계정이 만들어지지 않는다(조용한 절단 → 시끄러운 실패).
    if (params.mb_id.length > MB_ID_MAX_LENGTH) {
        throw new Error(
            `mb_id 길이 초과(${params.mb_id.length}자 > ${MB_ID_MAX_LENGTH}자): ${params.mb_id}`
        );
    }

    const registerLevel = await getRegisterLevel();

    // mb_password는 소셜 로그인이므로 랜덤 해시 (직접 로그인 불가)
    const randomPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    try {
        await pool.query<ResultSetHeader>(
            `INSERT INTO g5_member (
				mb_id, mb_password, mb_name, mb_nick, mb_email,
				mb_level, mb_datetime, mb_ip, mb_login_ip, mb_today_login,
				mb_nick_date, mb_open_date, mb_email_certify,
				mb_mailling, mb_sms, mb_open, mb_signature, mb_profile,
				mb_memo, mb_lost_certify, mb_homepage, mb_tel, mb_hp, mb_zip1, mb_zip2,
				mb_addr1, mb_addr2, mb_addr3, mb_addr_jibeon,
				mb_recommend, mb_point, mb_leave_date, mb_intercept_date
			) VALUES (
				?, ?, ?, ?, ?,
				?, NOW(), ?, ?, NOW(),
				?, CURDATE(), NOW(),
				0, 0, 0, '', '',
				'', '', '', '', '', '', '',
				'', '', '', '',
				'', 0, '', ''
			)`,
            [
                params.mb_id,
                randomPassword,
                params.mb_name,
                params.mb_nick,
                params.mb_email,
                registerLevel,
                params.mb_ip,
                params.mb_ip,
                params.skipNickLock ? '' : new Date().toISOString().slice(0, 10)
            ]
        );
    } catch (err: unknown) {
        const mysqlError = err as { code?: string };
        if (mysqlError.code === 'ER_DUP_ENTRY') {
            throw new Error('이미 가입된 회원이거나 사용 중인 닉네임입니다.');
        }
        throw err;
    }
}
