/**
 * 결제 진행 상태.
 */
import {
    brickangApi,
    type StartOrderResponse,
    type ConfirmOrderResponse,
    type StartOrderBody,
    type ConfirmOrderBody
} from '../lib/api.js';

type PaymentStatus = 'idle' | 'starting' | 'awaiting_pg' | 'confirming' | 'success' | 'error';

class PaymentStore {
    status = $state<PaymentStatus>('idle');
    error = $state<string | null>(null);
    startResponse = $state<StartOrderResponse | null>(null);
    confirmResponse = $state<ConfirmOrderResponse | null>(null);

    async start(body: StartOrderBody): Promise<StartOrderResponse> {
        this.status = 'starting';
        this.error = null;
        try {
            const res = await brickangApi.startOrder(body);
            this.startResponse = res;
            this.status = 'awaiting_pg';
            return res;
        } catch (err) {
            this.status = 'error';
            this.error = (err as Error).message;
            throw err;
        }
    }

    async confirm(body: ConfirmOrderBody): Promise<ConfirmOrderResponse> {
        this.status = 'confirming';
        try {
            const res = await brickangApi.confirmOrder(body);
            this.confirmResponse = res;
            this.status = 'success';
            return res;
        } catch (err) {
            this.status = 'error';
            this.error = (err as Error).message;
            throw err;
        }
    }

    reset(): void {
        this.status = 'idle';
        this.error = null;
        this.startResponse = null;
        this.confirmResponse = null;
    }
}

export const paymentStore = new PaymentStore();
