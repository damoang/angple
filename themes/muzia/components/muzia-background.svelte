<script lang="ts">
    /**
     * Muzia Background — slot: background
     * Angple 코어의 CSS 변수를 muzia 색상으로 오버라이드합니다.
     * app.css를 수정하지 않고 런타임에 :root 변수를 덮어씁니다.
     */
</script>

<svelte:head>
    <style>
        :root {
            --muzia-gradient-from: #ec4899;
            --muzia-gradient-to: #9333ea;
        }

        /* 라이트 모드: muzia 톤으로 미세 조정 */
        :root:not(.dark):not(.amoled) {
            --color-primary: oklch(0.15 0.08 290);
            --color-accent: oklch(0.65 0.25 330);
        }

        /* 다크 모드: 딥 퍼플 배경 */
        .dark {
            --color-background: oklch(0.10 0.05 290);
            --color-card: oklch(0.14 0.04 290);
            --color-primary: oklch(0.80 0.15 330);
        }

        /* 그래디언트 유틸리티 */
        .muzia-gradient-text {
            background: linear-gradient(135deg, var(--muzia-gradient-from), var(--muzia-gradient-to));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .muzia-gradient-bg {
            background: linear-gradient(135deg, var(--muzia-gradient-from), var(--muzia-gradient-to));
        }
    </style>
</svelte:head>
