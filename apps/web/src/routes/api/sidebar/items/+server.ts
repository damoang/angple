// Ad-blocker 회피 alias — EasyList `||*/ads/*` 매칭 회피용.
// 본체 핸들러는 `/api/ads/banners/+server.ts` 와 동일.
// 30일 후 기존 path 제거 시 본체를 여기로 이동.
export { GET } from '../../ads/banners/+server';
