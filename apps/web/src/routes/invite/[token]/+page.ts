export const ssr = false;

export function load({ params }: { params: { token: string } }) {
    return { token: params.token };
}
