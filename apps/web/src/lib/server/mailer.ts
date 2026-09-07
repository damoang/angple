/**
 * 이메일 발송 (nodemailer)
 *
 * ⛔ 2026-09-07 사고 — **설정이 하나도 없는데 아무도 몰랐다.**
 *    이전 구현은 `env.SMTP_HOST || 'localhost'` 로 폴백해 트랜스포터를 만들었다.
 *    운영 파드에는 SMTP 환경변수가 0개였고 MTA 도 없어서 전 발송이 실패했는데,
 *    호출부가 실패를 삼켜 **회원에게는 「발송했습니다」라고 답하고 있었다.**
 *    실측 피해: 이메일 변경 대기 111명(2026-03-27 ~ 09-07), 비밀번호 재설정 무응답.
 *
 * ⭐ 그래서 이 파일의 방침은 **fail-fast** 다.
 *    · 설정이 없으면 기본값으로 때우지 않고 **던진다**.
 *    · 트랜스포터를 모듈 로드 시점에 만들지 않는다 — 만들어 두면 「있는 것처럼」 보인다.
 *    · 실패는 **한 줄 마커 로그**로 남긴다. 감시 스크립트가 이걸 세서 경보한다
 *      (triage/tools/mail_send_watch.py). 앱에 경보 인프라를 새로 넣지 않는다.
 *
 * ⛔ 마커 로그에 **수신 주소를 넣지 않는다.** 파드 로그는 회원 개인정보 보관처가 아니다.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';

/** 발송 실패 시 로그에 남는 마커. 감시 스크립트가 이 문자열로 센다. */
export const MAIL_LOG_PREFIX = '[MAIL]';

/** 설정이 없어서 보낼 수 없는 경우. 호출부가 「일시적 실패」와 구분할 수 있게 별도 타입. */
export class MailNotConfiguredError extends Error {
    constructor(missing: string[]) {
        super(`메일 발송 설정이 없습니다: ${missing.join(', ')}`);
        this.name = 'MailNotConfiguredError';
    }
}

/** 설정이 갖춰졌는지. ⛔ 기본값으로 때우지 않는다 — 없으면 없는 것이다. */
function missingConfig(): string[] {
    const missing: string[] = [];
    if (!env.SMTP_HOST) missing.push('SMTP_HOST');
    if (!env.MAIL_FROM) missing.push('MAIL_FROM');
    // ⛔ 사용자만 있고 비밀번호가 비면 매번 EAUTH 로 실패한다. 그러면 감시 문구가
    //    「설정 누락」이 아니라 「SES 자격증명 문제」를 가리켜 **엉뚱한 곳을 보게 된다.**
    if (env.SMTP_USER && !env.SMTP_PASS) missing.push('SMTP_PASS');
    return missing;
}

/**
 * 오류 메시지에서 메일 주소를 지운다.
 *
 * ⛔ nodemailer 는 SMTP 서버 응답 원문을 `err.message` 에 이어 붙이고
 *    (`smtp-connection/index.js:921`), 거절 응답에는 **수신 주소가 그대로 들어 있다.**
 *    `'Invalid recipient ' + JSON.stringify(to)` 경로(같은 파일 1167)도 마찬가지다.
 *    이걸 그대로 찍으면 파드 로그가 회원 메일 주소 저장소가 된다.
 */
function maskEmails(text: string): string {
    return text.replace(/[^\s<>"'()[\],;:]+@[^\s<>"'()[\],;:]+/g, '<주소가림>');
}

/** 발송 가능한 상태인지. 호출부가 미리 확인해 분기할 때 쓴다. */
export function isMailConfigured(): boolean {
    return missingConfig().length === 0;
}

let cached: Transporter | null = null;

function getTransporter(): Transporter {
    const missing = missingConfig();
    if (missing.length > 0) throw new MailNotConfiguredError(missing);
    if (cached) return cached;

    const port = Number(env.SMTP_PORT) || 587;
    // 465 는 암묵적 TLS, 587 은 STARTTLS.
    const secure = env.SMTP_SECURE === 'true' || port === 465;

    cached = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure,
        // ⛔ STARTTLS 협상이 실패하면 **평문으로 이어가지 않고 끊는다.**
        //    이게 없으면 자격증명이 평문으로 나갈 수 있다.
        requireTLS: !secure,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } : undefined,
        // ⛔ 상한이 없으면 SMTP 가 멎었을 때 요청 스레드가 같이 매달린다.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000
    });
    return cached;
}

/**
 * 메일 발송.
 *
 * ⛔ 실패하면 **던진다.** 호출부가 모르고 지나가지 않게 하는 것이 이 함수의 계약이다.
 *    ⭐ 다만 비밀번호 재설정은 **알고도 회원에게 성공이라 답한다**(계정 존재 여부를 감추는
 *       의도된 설계다). 그 흐름의 유일한 신호는 아래 마커뿐이니 감시를 반드시 살려 둬라.
 * @param kind 어떤 흐름에서 보내는지. 마커 로그·감시 집계의 분류 키다(수신 주소 대신 이걸 쓴다).
 */
export async function sendMail(options: {
    to: string;
    subject: string;
    html: string;
    kind: string;
}): Promise<void> {
    const fromName = env.MAIL_FROM_NAME || '다모앙';
    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from: `"${fromName}" <${env.MAIL_FROM}>`,
            to: options.to,
            subject: options.subject,
            html: options.html
        });
        console.info(`${MAIL_LOG_PREFIX} ok kind=${options.kind}`);
    } catch (err) {
        // ⛔ 수신 주소·제목·본문은 남기지 않는다. 흐름 이름과 오류 종류만 남긴다.
        const reason =
            err instanceof MailNotConfiguredError
                ? 'not_configured'
                : ((err as NodeJS.ErrnoException)?.code ?? (err as Error)?.name ?? 'unknown');
        // ⛔ 인자를 하나로 합친다. 두 번째 인자로 Error 를 넘기면 Node 가 통째로 펼쳐
        //    `response`·`recipient` 까지 찍는다. 문자열 한 줄만, 그것도 가려서 남긴다.
        const detail = err instanceof Error ? maskEmails(err.message).slice(0, 200) : '';
        console.error(`${MAIL_LOG_PREFIX} fail kind=${options.kind} reason=${reason} ${detail}`);
        throw err;
    }
}
