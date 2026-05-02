<!--
  ProgressBar.svelte — 건축 진행률 바.
  current / target 백분율을 시각화.
-->
<script lang="ts">
    interface Props {
        current: number;
        target: number;
        label?: string;
    }
    let { current, target, label = '진행률' }: Props = $props();

    let percent = $derived(target > 0 ? Math.min(100, (current / target) * 100) : 0);
</script>

<div class="progress-bar">
    <div class="progress-bar__header">
        <span class="progress-bar__label">{label}</span>
        <span class="progress-bar__value">
            {current.toLocaleString()} / {target.toLocaleString()}
            <small>({percent.toFixed(1)}%)</small>
        </span>
    </div>
    <div class="progress-bar__track">
        <div class="progress-bar__fill" style="width: {percent}%"></div>
    </div>
</div>

<style>
    .progress-bar {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-size: 0.875rem;
    }
    .progress-bar__header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }
    .progress-bar__label {
        font-weight: 600;
    }
    .progress-bar__value {
        color: #555;
    }
    .progress-bar__track {
        height: 12px;
        background: #eee;
        border-radius: 6px;
        overflow: hidden;
    }
    .progress-bar__fill {
        height: 100%;
        background: linear-gradient(90deg, #c84c32, #ffd700);
        transition: width 0.3s ease;
    }
</style>
