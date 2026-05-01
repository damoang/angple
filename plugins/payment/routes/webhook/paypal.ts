import type { RequestEvent } from '@sveltejs/kit';
import { handleWebhook } from './_handler.js';

export async function POST(event: RequestEvent): Promise<Response> {
    return handleWebhook('paypal', event);
}
