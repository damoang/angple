// 개발: CSR, 배포: SSR (.env 파일에서 제어)
export const ssr = import.meta.env.PUBLIC_SSR === 'true';
export const prerender = false;
