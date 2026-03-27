/**
 * 축하 confetti 효과 유틸리티
 * canvas-confetti를 dynamic import하여 사용
 */

export interface ConfettiPreset {
    name: 'celebration' | 'sides' | 'top';
}

const ANNIVERSARY_COLORS = ['#0f766e', '#14b8a6', '#f59e0b', '#fb923c', '#fef3c7', '#fff7ed'];

/**
 * 양쪽에서 터지는 축하 confetti (2주년 스타일)
 */
export async function launchCelebrationConfetti(): Promise<void> {
    try {
        const confetti = (await import('canvas-confetti')).default;

        confetti({
            particleCount: 90,
            spread: 72,
            origin: { x: 0.18, y: 0.58 },
            colors: ANNIVERSARY_COLORS.slice(0, 5)
        });

        setTimeout(() => {
            confetti({
                particleCount: 100,
                spread: 86,
                origin: { x: 0.82, y: 0.58 },
                colors: ['#0f766e', '#0ea5e9', '#facc15', '#fb923c', '#fff7ed']
            });
        }, 180);

        setTimeout(() => {
            confetti({
                particleCount: 120,
                spread: 150,
                startVelocity: 26,
                origin: { x: 0.5, y: 0 },
                colors: ANNIVERSARY_COLORS
            });
        }, 420);
    } catch {
        // canvas-confetti 로드 실패 시 무시
    }
}

/**
 * 간단한 양쪽 confetti (뽑기 결과 등)
 */
export async function launchSidesConfetti(): Promise<void> {
    try {
        const confetti = (await import('canvas-confetti')).default;

        confetti({
            particleCount: 90,
            spread: 72,
            origin: { x: 0.18, y: 0.6 },
            colors: ANNIVERSARY_COLORS.slice(0, 5)
        });

        setTimeout(() => {
            confetti({
                particleCount: 110,
                spread: 92,
                origin: { x: 0.82, y: 0.58 },
                colors: ['#0f766e', '#0ea5e9', '#facc15', '#fb923c', '#fff7ed']
            });
        }, 180);
    } catch {
        // canvas-confetti 로드 실패 시 무시
    }
}
