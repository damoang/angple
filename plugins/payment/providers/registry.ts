import type { PaymentProvider, PaymentProviderId } from '../types/index.js';
import { tossProvider } from './toss/index.js';
import { naverProvider } from './naver/index.js';
import { paypalProvider } from './paypal/index.js';

const providers: Record<PaymentProviderId, PaymentProvider> = {
    toss: tossProvider,
    naver: naverProvider,
    paypal: paypalProvider
};

export function getProvider(id: PaymentProviderId): PaymentProvider {
    const p = providers[id];
    if (!p) throw new Error(`Unknown payment provider: ${id}`);
    return p;
}

export function listProviders(): PaymentProvider[] {
    return Object.values(providers);
}
