import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
    handleGuestCheckout,
    type GuestCheckoutInput
} from '$plugins/ad-free/server/guest-checkout';

// Shim — 본문은 $plugins/ad-free/server/guest-checkout.ts
export const POST: RequestHandler = async ({ request }) => {
    let body: GuestCheckoutInput;
    try {
        body = (await request.json()) as GuestCheckoutInput;
    } catch {
        return json({ status: 'error', message: '잘못된 요청 형식입니다.' }, { status: 400 });
    }
    const result = await handleGuestCheckout(body);
    const status = result.status === 'error' ? 400 : 200;
    return json(result, { status });
};
