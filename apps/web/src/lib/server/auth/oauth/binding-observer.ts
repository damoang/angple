/**
 * 소셜 계정 바인딩 이상징후 관측 (2026-08-03).
 *
 * ⛔ 관측 전용이다. 여기서 로그인을 막지 않는다.
 *    차단으로 전환하기 전에 "실제로 몇 명이 걸리는지"를 먼저 재기 위한 단계다.
 *    사전 계산이 불가능하다 — 소셜 프로필 테이블에 프로바이더 이메일이 없어서
 *    어떤 로그인이 이메일 매칭 경로를 타는지 DB 만으로는 알 수 없다.
 *
 * ⛔ 파드 로그(console)만 쓰면 안 된다. 파드가 재기동되면 이전 로그가 사라져
 *    "0건"이 "없었다"로 오독된다(2026-08-02 429 조사에서 실제로 겪음).
 *    그래서 재기동을 견디는 `audit_logs` 테이블에 남긴다.
 *
 * 개인정보는 넣지 않는다 — mb_id·provider·사유 코드까지만.
 *
 * ⛔ 2026-08-27 보강. 이 원칙 때문에 **판정이 불가능했다.**
 *    `identifier_mismatch` 흔적이 남은 45계정 중 11명을 「누가 시도했는가」를 못 밝혀
 *    피해 여부를 가리지 못했다. 남은 것이 `{"otherMbId":null}` 과 빈 client_ip 뿐이었다.
 *
 *    그래서 두 가지를 더 남긴다:
 *    - `client_ip` — 원래 파라미터에 있었는데 **호출부가 안 넘기고 있었다**
 *    - `idFp` — 시도한 신원의 **지문**(sha256 앞 16자). 원문 identifier 는 넣지 않는다.
 *      지문이면 「같은 신원인가/다른 신원인가」를 대조할 수 있고, 원문은 남지 않는다.
 */
import { createHash } from 'crypto';
import pool from '$lib/server/db.js';

export type BindingObservation =
    /** 이메일 매칭으로 들어가려는 계정이 이미 다른 신원과 연결돼 있음 (탈취 경로 후보) */
    | 'email_match_into_bound_account'
    /** 로그인한 신원과 계정에 저장된 신원이 다름 — 예전 코드는 여기서 덮어썼다 */
    | 'identifier_mismatch_write_skipped'
    /** 이 신원이 다른 회원에게 연결돼 있음 — 예전 코드는 그 행을 DELETE 했다 */
    | 'identifier_bound_other_member_delete_skipped'
    /** 해시만 겹친 점유 계정이라 복구를 내주지 않았음 (2026-08-27 소유 확인 도입) */
    | 'occupant_unverified_recovery_denied'
    /** 이미 소셜 프로필이 있는 **기존 계정**에 새 provider 신원이 붙었음 */
    | 'new_provider_attached_to_existing_member';

const ACTION = 'social_binding_observation';

/**
 * 신원 지문. 원문 identifier 는 저장하지 않고 대조만 가능하게 한다.
 * ⛔ 짧게 자르므로 이것만으로 원문을 되찾을 수는 없다(그게 목적이다).
 */
export function identifierFingerprint(identifier: string): string {
    return createHash('sha256').update(identifier).digest('hex').slice(0, 16);
}

/**
 * 관측 1건 기록. **실패해도 로그인에 영향을 주지 않는다.**
 * 기록 실패로 로그인이 깨지면 관측이 사고가 된다 — 반드시 삼킨다.
 */
export async function observeBinding(
    kind: BindingObservation,
    detail: {
        mbId: string;
        provider: string;
        otherMbId?: string;
        clientIp?: string;
        /** 로그인 시도에 쓰인 신원. 원문은 저장하지 않고 지문으로만 남는다. */
        identifier?: string;
    }
): Promise<void> {
    const idFp = detail.identifier ? identifierFingerprint(detail.identifier) : null;

    // 파드 로그에도 남긴다(실시간 확인용). 집계 근거는 audit_logs 다.
    console.warn(`[social-binding] ${kind}`, {
        mbId: detail.mbId,
        provider: detail.provider,
        otherMbId: detail.otherMbId,
        idFp
    });

    try {
        await pool.query(
            `INSERT INTO audit_logs
                 (created_at, user_id, action, resource, resource_id, details, client_ip)
             VALUES (NOW(3), ?, ?, 'social_profile', ?, ?, ?)`,
            [
                detail.mbId,
                ACTION,
                detail.provider,
                JSON.stringify({ kind, otherMbId: detail.otherMbId ?? null, idFp }),
                detail.clientIp ?? ''
            ]
        );
    } catch (err) {
        console.error(
            '[social-binding] 관측 기록 실패(무시)',
            err instanceof Error ? err.message : 'unknown'
        );
    }
}
