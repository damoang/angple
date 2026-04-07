// SSR 기본 활성화 (angple-web 공식 이미지와 동일)
export const ssr = import.meta.env.VITE_SSR !== 'false';
export const prerender = false;
