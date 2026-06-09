import { env } from '$env/dynamic/private';

/**
 * IP 보호 — Go backend `internal/middleware/ip_protection.go` 와 동일 규칙.
 *
 * 글/댓글 작성 등 Go backend 를 경유하는 쓰기는 IPProtection 미들웨어가
 * super admin / 지정 멤버의 실제 IP 를 치환하지만, 추천(g5_board_good.bg_ip)·
 * 리액션(chosen_ip)처럼 SvelteKit 라우트가 DB 에 직접 기록하는 경로는
 * 미들웨어를 거치지 않아 실제 IP 가 그대로 남는다. 기록 직전 이 헬퍼로 치환한다.
 *
 * - super admin (mb_level >= 10) → KG_IPPROTECT_ADMIN_IP (예: 127.0.0.1)
 * - KG_IPPROTECT_LIST="mb_id:ip,mb_id:ip" 지정 멤버 → 지정 IP
 * - env 미설정 시 원본 IP 그대로 (backend 미들웨어와 동일한 무동작 기준)
 */
export function protectClientIp(
    user: { mb_id?: string; mb_level?: number } | null | undefined,
    realIp: string
): string {
    if (!user) return realIp;

    const adminIp = env.KG_IPPROTECT_ADMIN_IP;
    if (adminIp && (user.mb_level ?? 0) >= 10) {
        return adminIp;
    }

    const list = env.KG_IPPROTECT_LIST || '';
    if (list && user.mb_id) {
        for (const entry of list.split(',')) {
            const [id, ip] = entry.split(':').map((s) => s?.trim());
            if (id && ip && id === user.mb_id) {
                return ip;
            }
        }
    }

    return realIp;
}
