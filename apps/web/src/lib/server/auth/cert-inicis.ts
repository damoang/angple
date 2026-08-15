/**
 * KG이니시스 실명인증 설정 및 유틸리티
 * g5_config 테이블에서 cf_cert_* 설정값을 읽어옴
 */
import pool, { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { createHash, randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';
import { formatLeaveDate } from './member-leave.js';

/** SEED IV를 base64로 반환 (런타임에 env 읽기) */
export function getSeedIV(): string {
    const raw = env.CERT_INICIS_SEED_IV || '';
    return raw ? Buffer.from(raw).toString('base64') : '';
}

/**
 * dupinfo 생성용 키 (런타임에 env 읽기) — fail-closed.
 * ⛔ 빈 문자열 폴백 금지: 키가 없으면 buildDupinfo가 SHA256(ci+'')로 **다른 DI**를 만들어
 * 재가입 중복차단(checkDupinfo)이 통째로 무력화된다(같은 사람=다른 DI). 조용한 오염 대신 즉시 throw.
 * ⛔ 이 키는 절대 rotate 금지 — 바뀌면 기존 회원 전원의 DI가 달라진다. 주입=k8s secret `angple-secrets`.
 */
function getCertTokenKey(): string {
    const key = env.CERT_TOKEN_ENCRYPTION_KEY;
    if (!key) {
        throw new Error(
            'CERT_TOKEN_ENCRYPTION_KEY 미설정 — 실명인증(DI 생성) 차단(fail-closed). 빈 키로 DI를 만들면 재가입 중복차단이 무력화됩니다.'
        );
    }
    return key;
}

/**
 * DI 보조 키 — 2026-07-19 키 전환 대응.
 *
 * ⛔ 배경: 2026-07-19 경 DI 생성 키가 교체됐다. PHP(G5_TOKEN_ENCRYPTION_KEY)와
 *    같은 키를 쓰던 것이 다른 값으로 바뀌면서, **같은 사람인데 다른 DI** 가
 *    만들어져 재가입 중복차단이 25일간 무력화됐다
 *    (실측: 같은 소셜계정 3쌍의 DI 상이 · 재가입 4명 통과).
 *
 *    원본 CI 는 저장되지 않아(단방향 해시) 소급 백필이 불가능하다. 그래서
 *    **두 키로 각각 계산해 둘 다 저장·조회**한다. 그러면 어느 시기에 인증한
 *    기존 계정이든 걸린다.
 *
 *      mb_dupinfo  = 주 키(PHP 와 동일)   → 2026-07-19 이전 인증 32,692명
 *      mb_dupinfo2 = 보조 키(전환기 키)   → 2026-07-19~08-13 인증 1,292명
 *
 * ⛔ 주 키와 달리 fail-closed 로 막지 않는다. 미설정이면 보조 값을 만들지 않을 뿐,
 *    주 키 경로(다수)는 정상 동작해야 한다. 없다고 인증 전체를 세우면 안 된다.
 */
function getCertTokenKeyAlt(): string {
    return env.CERT_DUPINFO_ALT_KEY || '';
}

interface CertConfigRow extends RowDataPacket {
    cf_cert_use: number;
    cf_cert_req: number;
    cf_cert_kg_mid: string;
    cf_cert_kg_cd: string;
}

export interface CertConfig {
    /** 인증 사용 여부 (0=미사용, 1=테스트, 2=운영) */
    certUse: number;
    /** 인증 필수 여부 (0=선택, 1=필수) */
    certReq: number;
    /** KG이니시스 상점 MID */
    kgMid: string;
    /** KG이니시스 상점 코드 */
    kgCd: string;
}

/** g5_config에서 실명인증 설정 조회 */
export async function getCertConfig(): Promise<CertConfig> {
    const [rows] = await readPool.query<CertConfigRow[]>(
        'SELECT cf_cert_use, cf_cert_req, cf_cert_kg_mid, cf_cert_kg_cd FROM g5_config LIMIT 1'
    );

    if (rows[0]) {
        return {
            certUse: Number(rows[0].cf_cert_use) || 0,
            certReq: Number(rows[0].cf_cert_req) || 0,
            kgMid: String(rows[0].cf_cert_kg_mid || ''),
            kgCd: String(rows[0].cf_cert_kg_cd || '')
        };
    }

    return { certUse: 0, certReq: 0, kgMid: '', kgCd: '' };
}

/** 인증 요청에 필요한 MID, apiKey, authHash 등 생성 */
export async function buildCertRequest(): Promise<{
    mid: string;
    apiKey: string;
    mTxId: string;
    authHash: string;
    reqSvcCd: string;
    reservedMsg: string;
}> {
    const config = await getCertConfig();

    let mid: string;
    let apiKey: string;

    if (config.certUse === 2) {
        // 운영
        mid = 'SRA' + config.kgMid;
        apiKey = config.kgCd;
    } else {
        // 테스트
        mid = env.CERT_INICIS_TEST_MID || '';
        apiKey = env.CERT_INICIS_TEST_API_KEY || '';
    }

    const mTxId = ('SIR' + Date.now().toString(36) + randomBytes(3).toString('hex')).substring(
        0,
        20
    );
    const reqSvcCd = '01'; // 간편인증
    const authHash = createHash('sha256')
        .update(mid + mTxId + apiKey)
        .digest('hex');
    const reservedMsg = 'isUseToken=Y'; // SEED 암호화 응답 요청

    return { mid, apiKey, mTxId, authHash, reqSvcCd, reservedMsg };
}

/** 인증 요청 시 mTxId → mbId 매핑 저장 (DB 기반, 5분 TTL) */
export async function storeCertPending(mTxId: string, mbId: string): Promise<void> {
    await pool.query(
        `INSERT INTO g5_cert_pending (cp_mtxid, cp_mb_id, cp_datetime) VALUES (?, ?, NOW())
		 ON DUPLICATE KEY UPDATE cp_mb_id = ?, cp_datetime = NOW()`,
        [mTxId, mbId, mbId]
    );
    // 만료된 항목 정리 (5분 이상)
    await pool.query(
        `DELETE FROM g5_cert_pending WHERE cp_datetime < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
    );
}

/** 인증 콜백에서 mTxId로 mbId 조회 (1회용) */
export async function getCertPendingMbId(mTxId: string): Promise<string | null> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT cp_mb_id FROM g5_cert_pending WHERE cp_mtxid = ? AND cp_datetime > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [mTxId]
    );
    if (!rows[0]) return null;
    // 1회용 삭제
    await pool.query('DELETE FROM g5_cert_pending WHERE cp_mtxid = ?', [mTxId]);
    return rows[0].cp_mb_id as string;
}

/**
 * DI 값이 현재 체계(SHA-256 64자 hex)인지. 명의 동일성 비교의 전제다.
 * ⛔ mb_dupinfo 에는 2024-06-11 초기 마이그레이션분 **SHA-1 40자가 41건** 섞여 있다.
 *    그 값은 어떤 키로도 재현되지 않으므로 비교 대상에서 제외해야 한다.
 */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** CI 기반 mb_dupinfo 생성 (PHP 호환) */
export function buildDupinfo(ci: string): string {
    return createHash('sha256')
        .update(ci + getCertTokenKey())
        .digest('hex');
}

/**
 * 보조 DI 생성. 보조 키가 없으면 빈 문자열을 돌려준다(저장·조회에서 제외됨).
 * ⛔ 빈 값이 저장되면 빈 값끼리 매칭될 수 있으므로, 호출부는 반드시 공백을 걸러야 한다.
 */
export function buildDupinfoAlt(ci: string): string {
    const altKey = getCertTokenKeyAlt();
    if (!altKey) return '';
    return createHash('sha256')
        .update(ci + altKey)
        .digest('hex');
}

/** 이니시스 결과 URL 검증 */
export function isValidInicisUrl(url: string): boolean {
    return url.startsWith('https://kssa.inicis.com') || url.startsWith('https://fcsa.inicis.com');
}

interface DupCollisionRow extends RowDataPacket {
    mb_id: string;
    mb_level: number;
    mb_intercept_date: string;
    mb_leave_date: string;
}

/**
 * DI(mb_dupinfo) 충돌 하드닝(구멍②).
 *
 * 동일 DI 를 가진 다른 계정을 조회한다(주 DI + 보조 DI × mb_dupinfo + mb_dupinfo2 —
 * checkDupinfo 와 동일 범위). mb_dupinfo = 본인확인(CI)의 단방향 해시라
 * 충돌 = 동일인. 매칭 계정이 **제재중(mb_intercept_date≠'') 또는 탈퇴(mb_leave_date≠'')**면
 * 징계회피/다중이 재가입 정황 → durable 운영 플래그를 재인증 시도 계정 mb_memo 에 기록하고
 * `blocked=true` 를 반환한다(호출부가 본인인증 거부·dupinfo 미저장에 사용).
 *
 * ⚠️ 밴/탈퇴 "유효" 판정은 코드베이스 관례와 일치 — 값이 비어있지 않으면 제재/탈퇴로 본다.
 *    (제재: api/members/search/+server.ts:49, admin/members/[mbId]/+page.svelte:187 /
 *     탈퇴: auth/oauth/member.ts:142 isMemberActive, auth/password-reset.ts:26)
 *    어디에서도 현재시각과 날짜비교를 하지 않고 '비어있지 않음'만으로 판정하므로 동일 기준 사용.
 *
 * ⚠️ 정상(활성) 계정 매칭은 여기서 추가 차단하지 않는다 — 차단은 호출부 checkDupinfo 가
 *    이미 1차 게이트로 담당하며(정상회원 회귀 방지), 이 함수는 감사 로그만 남긴다.
 *
 * 운영 플래그 기록처: mb_memo 앞줄 prepend (member-leave.ts 의 처리와 동일한 durable
 *    per-member 운영 메모, 관리자 회원관리 화면에 노출). 별도 audit/security 테이블은
 *    web 코드베이스에 없어(grep 0건) mb_memo 를 재사용한다.
 */
export async function flagDupinfoCollision(
    mbId: string,
    dupinfo: string,
    dupinfoAlt = ''
): Promise<{ matched: boolean; blocked: boolean }> {
    // ⛔ checkDupinfo 와 **같은 범위**를 봐야 한다. 예전엔 주 DI(mb_dupinfo) 하나만 조회해서,
    //    보조 DI 로만 걸린 충돌은 차단은 되는데 mb_memo 에 기록이 남지 않았다 —
    //    2026-07-19~08-13 키 전환기 계정과의 매칭이 정확히 그 경우라, 재인증을 권장하면
    //    정작 잡으려던 신호(다중이·징계회피)가 통째로 새어 나간다.
    // ⛔ 빈 문자열은 반드시 제외한다 — mb_dupinfo2 미채움 행이 3만 건이라 공백끼리 매칭되면
    //    전원이 충돌로 잡힌다.
    // ⛔ OR 로 묶지 않는다 — 옵티마이저가 인덱스를 포기해 풀스캔이 된다(checkDupinfo 주석 참조).
    //    UNION 으로 갈라야 mb_dupinfo2 가 idx_mb_dupinfo2 를 탄다.
    const candidates = [dupinfo, dupinfoAlt].filter((v) => v);
    if (candidates.length === 0) {
        return { matched: false, blocked: false };
    }
    const ph = candidates.map(() => '?').join(',');

    const [rows] = await readPool.query<DupCollisionRow[]>(
        `SELECT mb_id, mb_level,
                COALESCE(mb_intercept_date, '') AS mb_intercept_date,
                COALESCE(mb_leave_date, '')     AS mb_leave_date
           FROM g5_member
          WHERE mb_id <> ? AND mb_dupinfo IN (${ph})
         UNION
         SELECT mb_id, mb_level,
                COALESCE(mb_intercept_date, '') AS mb_intercept_date,
                COALESCE(mb_leave_date, '')     AS mb_leave_date
           FROM g5_member
          WHERE mb_id <> ? AND mb_dupinfo2 IN (${ph})`,
        [mbId, ...candidates, mbId, ...candidates]
    );

    if (rows.length === 0) {
        return { matched: false, blocked: false };
    }

    // 코드베이스 관례: mb_intercept_date/mb_leave_date 가 비어있지 않으면 제재/탈퇴.
    const blockingRows = rows.filter(
        (r) => (r.mb_intercept_date ?? '') !== '' || (r.mb_leave_date ?? '') !== ''
    );

    if (blockingRows.length === 0) {
        // 정상(활성) 계정 매칭: 차단하지 않되, "이전 계정을 잊고 새로 가입"한 회원의
        // 계정 복구 안내를 위해 매칭 계정을 durable 하게 기록한다.
        // ⚠️다중이/징계회피가 아니므로 중립 문구를 쓴다. mb_id 만 남기며 DI·이메일은
        // 저장하지 않는다(개인정보방침 제2조3항 '중복가입 방지 및 계정 복구' 목적 범위).
        const activeIds = rows.map((r) => r.mb_id).join(', ');
        const memo =
            `${formatLeaveDate()} [기존계정확인] 동일 본인확인정보의 기존 활성 계정 ` +
            `${activeIds} 존재 — 계정 복구 안내 대상`;
        try {
            // ⛔ 같은 날 같은 사유가 이미 있으면 덧붙이지 않는다 — 재시도할 때마다 기록이 쌓인다
            //    (실측: 한 회원에 [DI충돌차단] 4줄까지 누적돼 있었다).
            await pool.query(
                `UPDATE g5_member
                    SET mb_memo = CONCAT(?, IF(mb_memo IS NULL OR mb_memo = '', '', CONCAT('\n', mb_memo)))
                  WHERE mb_id = ? AND (mb_memo IS NULL OR mb_memo NOT LIKE ?)`,
                [memo, mbId, `%${memo}%`]
            );
        } catch (e) {
            console.error('[Cert][DI-guard] active-collision memo write failed:', e);
        }
        console.warn('[Cert][DI-guard] DI collision with active account(s) — recovery candidate', {
            mbId,
            dupinfoPrefix: dupinfo.slice(0, 16),
            collisions: rows.map((r) => r.mb_id)
        });
        return { matched: true, blocked: false };
    }

    const flaggedAt = formatLeaveDate();
    const detail = blockingRows
        .map((r) => `${r.mb_id}(${(r.mb_leave_date ?? '') !== '' ? '탈퇴' : '제재'})`)
        .join(', ');
    const memo = `${flaggedAt} [DI충돌차단] 동일 본인확인정보 계정 ${detail} 존재 — 재인증 거부(다중이/징계회피 정황)`;

    // durable 운영 플래그: 재인증 시도 계정 mb_memo 앞줄에 기록(관리자 회원관리 화면 노출).
    // 실패해도 차단 판정 자체는 유지(로그만).
    try {
        // ⛔ 중복 억제 — 위와 같은 이유.
        await pool.query(
            `UPDATE g5_member
                SET mb_memo = CONCAT(?, IF(mb_memo IS NULL OR mb_memo = '', '', CONCAT('\n', mb_memo)))
              WHERE mb_id = ? AND (mb_memo IS NULL OR mb_memo NOT LIKE ?)`,
            [memo, mbId, `%${memo}%`]
        );
    } catch (e) {
        console.error('[Cert][DI-guard] mb_memo flag write failed:', e);
    }

    console.warn('[Cert][DI-guard] blocked re-certification on DI collision', {
        mbId,
        dupinfoPrefix: dupinfo.slice(0, 16),
        collisions: blockingRows.map((r) => ({
            mb_id: r.mb_id,
            mb_level: r.mb_level,
            banned: (r.mb_intercept_date ?? '') !== '',
            withdrawn: (r.mb_leave_date ?? '') !== ''
        }))
    });

    return { matched: true, blocked: true };
}

/**
 * 재인증 시 **명의 동일성** 검증 (구멍③).
 *
 * 이미 DI 가 있는 계정이 **다른 사람 명의로** 재인증하는 것을 막는다.
 * 기존 코드는 `mb_id <> ?` 로 **다른 계정과의 충돌만** 봤고, 자기 계정의 DI 는
 * `saveCertResult` 가 무조건 덮어썼다. 즉 빌린 명의의 주인이 다모앙 회원만 아니면
 * DI 를 갈아치울 수 있었다(명의 세탁). 지금까지 안 터진 것은 인증 완료 회원에게
 * 재인증 진입점이 없었기 때문이고, 재인증을 유도하면 그 막이 사라진다.
 *
 * ⭐ 판별은 이미 있는 값으로 된다 — 새 컬럼도 DDL 도 필요 없다.
 *   같은 사람이면 두 축 중 **하나는 반드시 일치**한다.
 *     · 2026-07-19 이전 인증자 → 기존 mb_dupinfo 가 현재 키 값     → 새 **주 DI** 와 일치
 *     · 키 전환기(07-19~08-13) → 기존 mb_dupinfo 가 전환기 키 값   → 새 **보조 DI** 와 일치
 *     · 명의가 다르면                                              → **둘 다 불일치**
 *
 * ⚠️ 기존 DI 가 없으면(최초 인증·탈퇴로 비워진 계정) 검증 대상이 아니다 — 통과시킨다.
 *    그 경우의 방어는 checkDupinfo(다른 계정 충돌) 가 담당한다.
 */
export async function verifySameIdentity(
    mbId: string,
    dupinfo: string,
    dupinfoAlt = ''
): Promise<{ hasPrior: boolean; sameIdentity: boolean }> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT COALESCE(mb_dupinfo, '') AS di, COALESCE(mb_dupinfo2, '') AS di2
           FROM g5_member WHERE mb_id = ?`,
        [mbId]
    );
    // ⛔ 비교 가능한 값만 후보로 삼는다. mb_dupinfo 에는 **세 체계**가 섞여 있다:
    //      SHA-1 40자(2024-06-11 초기 마이그레이션 41명) / 주 키 SHA-256 / 전환기 키 SHA-256.
    //    SHA-1 값은 어떤 키로도 재현되지 않아, 그대로 비교하면 그 41명이 **영원히 차단**되고
    //    [명의불일치] 낙인까지 찍힌다. 전원 정상 활성 회원이다. 포맷이 다르면 판정하지 않는다.
    const prior = [rows[0]?.di, rows[0]?.di2].filter((v) => SHA256_HEX.test(v ?? ''));
    // ⛔ 주 DI 가 없으면 판정하지 않는다. buildDupinfo 가 fail-closed 라 현재는 도달하지 않지만,
    //    비교 기준의 절반이 빠진 채 "불일치"로 떨어지면 정상 회원이 차단된다.
    if (prior.length === 0 || !dupinfo) {
        return { hasPrior: false, sameIdentity: true };
    }

    // ⭐ 주 DI 부터 비교한다. 전환기 이전 인증자(31,887명)는 보조 키 없이도 여기서 판정된다.
    const fresh = [dupinfo, dupinfoAlt].filter((v) => v);
    if (prior.some((p) => fresh.includes(p))) {
        return { hasPrior: true, sameIdentity: true };
    }

    // ⛔ 여기까지 왔으면 불일치다. 그런데 보조 키가 없으면 **판정할 수 없다** —
    //    전환기(2026-07-19~08-13) 인증자의 기존 DI 는 전환기 키 값이라 주 DI 와는 원래 안 맞는다.
    //    그대로 막으면 정상 회원 1,300여 명이 전부 차단된다. 명의 세탁보다 이쪽 피해가 크다.
    //    ⚠️ 이 경로로 빠지면 구멍③ 가드가 꺼진 것이다 — 보조 키가 사라지면 조용히 무방비가 되므로
    //       로그를 반드시 남긴다. 다른 계정과의 충돌은 checkDupinfo 가 계속 막는다.
    if (!dupinfoAlt) {
        console.warn(
            '[Cert][DI-guard] 보조 키(CERT_DUPINFO_ALT_KEY) 미설정 — 명의 동일성 판정 불가, 통과시킴',
            { mbId }
        );
        return { hasPrior: true, sameIdentity: true };
    }

    return { hasPrior: true, sameIdentity: false };
}

/**
 * 명의 불일치를 운영 플래그로 남긴다(감사용).
 * ⛔ DI 값 자체는 저장하지 않는다 — mb_id 와 사실만 남긴다(개인정보방침 제2조3항 목적 범위).
 */
export async function flagIdentityMismatch(mbId: string): Promise<void> {
    // ⛔ 문구는 **사실만** 쓴다. "다른 명의로 시도" 라고 단정하면, 실제 원인이 값 포맷·키 문제일 때
    //    정상 회원에게 명의도용 낙인이 남는다. 관리자 화면에 그대로 노출되는 기록이다.
    const memo = `${formatLeaveDate()} [명의불일치] 기존 본인확인정보와 일치하지 않아 재인증을 거부함`;
    try {
        // ⛔ 같은 날 같은 사유가 이미 있으면 덧붙이지 않는다 — 재시도할 때마다 낙인이 쌓인다.
        await pool.query(
            `UPDATE g5_member
                SET mb_memo = CONCAT(?, IF(mb_memo IS NULL OR mb_memo = '', '', CONCAT('\n', mb_memo)))
              WHERE mb_id = ? AND (mb_memo IS NULL OR mb_memo NOT LIKE ?)`,
            [memo, mbId, `%${memo}%`]
        );
    } catch (e) {
        console.error('[Cert][DI-guard] identity-mismatch memo write failed:', e);
    }
    console.warn('[Cert][DI-guard] blocked re-certification on identity mismatch', { mbId });
}

/** 인증 결과를 DB에 저장 (g5_member 업데이트 + 인증 이력) */
export async function saveCertResult(
    mbId: string,
    dupinfo: string,
    birthDay: string,
    dupinfoAlt = ''
): Promise<void> {
    // DI 충돌 하드닝(구멍②) — 방어선(defense-in-depth).
    // 호출부(cert/inicis/result)는 이미 checkDupinfo 로 모든 dupinfo 충돌을 1차 차단하지만,
    // 그 게이트가 우회되더라도 제재/탈퇴 계정과 동일 DI 인 경우 dupinfo 를 절대 저장하지 않는다.
    // 정상 저장(충돌 없음/활성계정만)은 기존과 100% 동일하게 진행된다.
    // ⛔ 보조 DI 도 함께 넘긴다 — 주 DI 만 보면 키 전환기 계정과의 충돌을 이 방어선이 놓친다.
    const { blocked } = await flagDupinfoCollision(mbId, dupinfo, dupinfoAlt);
    if (blocked) {
        throw new Error('DI_COLLISION_BLOCKED');
    }

    // 명의 동일성 방어선(구멍③) — 호출부가 이미 걸렀더라도, DI 를 덮어쓰기 직전에 한 번 더 본다.
    // 이 검사가 없으면 다른 명의로 인증해 mb_dupinfo 를 갈아치울 수 있다.
    const identity = await verifySameIdentity(mbId, dupinfo, dupinfoAlt);
    if (identity.hasPrior && !identity.sameIdentity) {
        await flagIdentityMismatch(mbId);
        throw new Error('IDENTITY_MISMATCH');
    }

    const adult_day = new Date();
    adult_day.setFullYear(adult_day.getFullYear() - 19);
    const adultDayStr = adult_day.toISOString().slice(0, 10).replace(/-/g, '');
    const adult = parseInt(birthDay) <= parseInt(adultDayStr) ? 1 : 0;

    // ⛔ mb_dupinfo2 는 키 전환기(2026-07-19~08-13) 인증분과 대조하기 위한 보조 값이다.
    //    보조 키가 없으면 빈 문자열이 들어가고, 조회 시 공백은 제외된다.
    await pool.query(
        `UPDATE g5_member SET mb_certify = 'simple', mb_dupinfo = ?, mb_dupinfo2 = ?, mb_adult = ? WHERE mb_id = ?`,
        [dupinfo, dupinfoAlt, adult, mbId]
    );

    // 인증 이력 저장.
    // ⚠️ ch_ci 컬럼에는 원본 CI가 아니라 dupinfo(단방향 해시)를 저장한다 — 의도된 설계.
    //    checkDupinfo()도 이 값으로 중복을 조회하며, 이 이력은 탈퇴 시에도 삭제되지
    //    않아 사실상 DI 영구백업 역할을 한다(원본 CI는 어디에도 저장하지 않음).
    //    실제 CI로 바꾸지 말 것 — 중복차단(dedup)이 깨지고 DI 복구 경로가 사라진다.
    await pool.query(
        `INSERT INTO g5_member_cert_history (mb_id, ch_type, ch_ci, ch_datetime) VALUES (?, 'simple', ?, NOW())`,
        [mbId, dupinfo]
    );
}

/** 이미 인증된 dupinfo가 존재하는지 체크 */
export async function checkDupinfo(
    mbId: string,
    dupinfo: string,
    dupinfoAlt = ''
): Promise<string | null> {
    // ⛔ 두 값 × 두 컬럼을 모두 본다. 하나라도 걸리면 중복이다.
    //    mb_dupinfo 컬럼에는 2026-07-19 키 전환 때문에 **두 체계가 섞여** 있다
    //    (이전 32,692명 = 주 키 값 / 전환기 1,292명 = 보조 키 값).
    //    그래서 주 값만 조회하면 전환기 인증자를 놓치고, 보조 값만 조회하면
    //    그 이전 전원을 놓친다.
    // ⛔ 빈 문자열은 반드시 제외한다 — mb_dupinfo2 미채움 행이 3만 건이라
    //    공백끼리 매칭되면 전원이 중복으로 잡힌다.
    const candidates = [dupinfo, dupinfoAlt].filter((v) => v);
    // ⛔ 후보가 없으면 `IN ()` 구문 에러가 난다. 주 키는 fail-closed 라 현재는 도달하지 않지만,
    //    flagDupinfoCollision 과 방어 수준을 맞춘다.
    if (candidates.length === 0) {
        return null;
    }
    const ph = candidates.map(() => '?').join(',');

    // ⛔ OR 로 묶으면 옵티마이저가 인덱스를 포기해 62,388행 풀스캔이 된다(EXPLAIN 확인).
    //    UNION 으로 갈라야 mb_dupinfo2 가 idx_mb_dupinfo2 를 탄다(type: range).
    //    ⚠️ mb_dupinfo 에는 인덱스가 없어 그쪽은 여전히 스캔이다 — 기존과 동일하며,
    //       인증 빈도가 낮아 병목은 아니다. 필요하면 인덱스를 별도로 추가할 것.
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT mb_id FROM g5_member WHERE mb_id <> ? AND mb_dupinfo IN (${ph})
         UNION
         SELECT mb_id FROM g5_member WHERE mb_id <> ? AND mb_dupinfo2 IN (${ph})
         LIMIT 1`,
        [mbId, ...candidates, mbId, ...candidates]
    );
    if (rows[0]) {
        return rows[0].mb_id as string;
    }

    // history 테이블에서도 체크 (탈퇴·삭제 계정 커버)
    const [histRows] = await readPool.query<RowDataPacket[]>(
        `SELECT count(*) as cnt FROM g5_member_cert_history
          WHERE mb_id <> ? AND ch_ci IN (${ph})`,
        [mbId, ...candidates]
    );
    if (histRows[0]?.cnt > 0) {
        return '(탈퇴 또는 기존 계정)';
    }

    return null;
}
