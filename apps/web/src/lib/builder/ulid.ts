// Minimal ULID generator for block IDs (M1 A1 PoC, RFC §10).
// 26-char Crockford Base32 — first 10 = timestamp (sortable), last 16 = random.
// Inlined to avoid an external dependency at PoC scope.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIMESTAMP_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(time: number): string {
    let out = '';
    for (let i = TIMESTAMP_LEN; i > 0; i--) {
        out = ENCODING[time % 32] + out;
        time = Math.floor(time / 32);
    }
    return out;
}

function encodeRandom(): string {
    const buf = new Uint8Array(RANDOM_LEN);
    crypto.getRandomValues(buf);
    let out = '';
    for (const b of buf) {
        out += ENCODING[b & 0x1f];
    }
    return out;
}

export function ulid(time = Date.now()): string {
    return encodeTime(time) + encodeRandom();
}
