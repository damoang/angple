/**
 * 서버 전용 환경 변수
 * 클라이언트에 노출되지 않음
 *
 * SSR 시에만 사용되며, 내부 Docker 네트워크로 API 호출
 */
export const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080/api/v1';
