/**
 * 벽돌 등급/구매 컨텍스트.
 */
import { brickangApi, type BrickTypeDto } from '../lib/api.js';

class BrickStore {
    brickTypes = $state<BrickTypeDto[]>([]);
    selectedSlug = $state<string | null>(null);
    quantity = $state(1);
    message = $state('');

    selected = $derived(
        this.selectedSlug
            ? (this.brickTypes.find((t) => t.slug === this.selectedSlug) ?? null)
            : null
    );

    totalAmountKrw = $derived(this.selected ? this.selected.price_krw * this.quantity : 0);

    async load(): Promise<void> {
        const res = await brickangApi.listBrickTypes();
        this.brickTypes = res.brick_types;
    }

    select(slug: string): void {
        this.selectedSlug = slug;
        const t = this.brickTypes.find((x) => x.slug === slug);
        if (t?.is_anonymous) this.message = '';
    }

    setQuantity(q: number): void {
        this.quantity = Math.max(1, Math.min(100, q));
    }

    setMessage(m: string): void {
        if (this.selected?.is_anonymous) {
            this.message = '';
            return;
        }
        this.message = m.slice(0, 100);
    }
}

export const brickStore = new BrickStore();
