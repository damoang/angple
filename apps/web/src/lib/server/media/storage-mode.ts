/**
 * 업로드 저장 모드 판정 (순수 함수 — 환경변수를 직접 읽지 않아 시험할 수 있다)
 *
 * 모드는 둘이다.
 * - Lambda 파이프라인: `raw/` 에 올리면 S3 이벤트로 Lambda 가 `data/` 로 변환하고
 *   썸네일·WebP 를 만들고 R2 에도 기록한다.
 * - 직접 업로드: Lambda 가 없는 저장소(예: Cloudflare R2 단독 사이트)라 `data/` 에 바로 쓴다.
 *
 * ## ⛔ `S3_ENDPOINT` 가 있다는 것만으로 직접 업로드로 보면 안 된다
 *
 * 처음 판정은 `S3_DIRECT_UPLOAD === 'true' || Boolean(S3_ENDPOINT)` 였다. 그런데 AWS S3 를
 * 쓰는 사이트도 `S3_ENDPOINT=https://s3.ap-northeast-2.amazonaws.com` 처럼 AWS 자체 주소를
 * 적어 두는 경우가 있다. 그 사이트는 직접 업로드로 판정돼 `raw/` 를 건너뛰었고, Lambda 가
 * 한 번도 호출되지 않아 **썸네일·WebP 변환·R2 기록이 전부 조용히 멈췄다**(오류 0, 업로드는 성공).
 *
 * 판정 순서:
 * 1. `S3_DIRECT_UPLOAD` 가 `true`/`false` 로 명시돼 있으면 그대로 따른다.
 * 2. 없으면, endpoint 가 지정돼 있고 **AWS 주소가 아닐 때만** 직접 업로드다.
 */

/** AWS 파티션의 도메인 접미사 — 표준, 중국 리전. */
const AWS_SUFFIXES = ['amazonaws.com', 'amazonaws.com.cn'];

/**
 * AWS S3 자체 endpoint 인가 (`s3.<region>.amazonaws.com`, `<bucket>.s3.amazonaws.com`, 중국 리전 등).
 *
 * ⛔ 반드시 호스트를 파싱해서 본다. 원문 문자열을 `endsWith` 로 보면 끝 슬래시·포트·경로가
 *    붙은 주소(`https://s3.ap-northeast-2.amazonaws.com/`)를 놓쳐 다시 직접 업로드가 된다.
 */
export function isAwsS3Endpoint(endpoint: string): boolean {
    const raw = endpoint.trim().replace(/^["']|["']$/g, '');
    if (!raw) return false;
    let host: string;
    try {
        // 스킴 없이 호스트만 적은 값도 받아 준다
        host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
    } catch {
        return false;
    }
    host = host.toLowerCase().replace(/\.$/, '');
    return AWS_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** `true`/`false` 를 대소문자·앞뒤 공백 무시하고 읽는다. 그 밖의 값은 「지정 안 함」이다. */
function parseFlag(flag: string | undefined): boolean | undefined {
    const v = flag?.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
}

export function resolveDirectUpload(endpoint: string, flag: string | undefined): boolean {
    const explicit = parseFlag(flag);
    if (explicit !== undefined) return explicit;
    return Boolean(endpoint.trim()) && !isAwsS3Endpoint(endpoint);
}
