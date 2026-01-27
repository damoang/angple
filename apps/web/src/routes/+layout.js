// SSR 활성화 (Node.js adapter 사용 시)
// 개발 환경에서 CSR 필요 시 VITE_SSR=false로 설정
export const ssr = import.meta.env.VITE_SSR !== 'false';
export const prerender = false;
