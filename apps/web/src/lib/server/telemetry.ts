/**
 * OpenTelemetry Node.js 초기화 (SvelteKit SSR용)
 *
 * 활성화: OTEL_ENABLED=true 환경변수
 * 엔드포인트: OTEL_EXPORTER_OTLP_ENDPOINT (기본: otel-collector.observability.svc.cluster.local:4317)
 * 샘플링: OTEL_TRACES_SAMPLER_ARG (기본: 0.1 = 10%)
 *
 * W3C traceparent 헤더 자동 전파 → Go backend 분산 trace 연결
 *
 * 실행: NODE_OPTIONS=--import=./instrumentation.js node build/index.js
 */

export {};

import { writeHeapSnapshot } from 'node:v8';
import { ssrCache } from '$lib/server/ssr-cache.js';

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

/**
 * SIGUSR2 → heap snapshot 강제 캡처 (Tier 4 audit, 2026-04-28)
 * 사용: kubectl exec <pod> -- kill -USR2 1   →  /tmp/heap-{ts}.heapsnapshot
 * Chrome DevTools Memory > Load 로 분석. avg vs p95 spike pod 비교.
 */
process.on('SIGUSR2', () => {
    const filename = `/tmp/heap-${Date.now()}.heapsnapshot`;
    try {
        writeHeapSnapshot(filename);
        // eslint-disable-next-line no-console
        console.log(`[telemetry] heap snapshot saved: ${filename}`);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[telemetry] heap snapshot error:', err);
    }
});

/**
 * Auto heap-watch — 4/30 OOM 사고 후속 (수동 SIGUSR2 영구 폐기, 1+ GB pod OOMKill 위험).
 *
 * 임계 OR 조건:
 *   - rss > HEAP_RSS_THRESHOLD_MB MB (default 1280, container limit 1536 Mi 의 83%)
 *   - heapUsed + external > HEAP_HEAP_THRESHOLD_MB MB (default 935, max-old 1100 의 85%)
 *
 * heapUsed 단독은 Buffer/external 누수 (4/24 gzip Buffer 누수 케이스) 못 잡음 — smoke test 검증.
 * 두 임계 OR 로 V8 JS heap 누수 + external memory 누수 모두 capture.
 *
 * HEAP_WATCH_DIR 미설정 시 비활성 (feature flag, dev/test 환경 영향 0).
 * 12h cooldown — pod 당 반복 fire 방지.
 */
const HEAP_WATCH_INTERVAL_MS = 30_000;
const HEAP_RSS_THRESHOLD = parseInt(process.env.HEAP_RSS_THRESHOLD_MB || '1280', 10) * 1024 * 1024;
const HEAP_HEAP_THRESHOLD = parseInt(process.env.HEAP_HEAP_THRESHOLD_MB || '935', 10) * 1024 * 1024;
const HEAP_WATCH_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const HEAP_WATCH_DIR = process.env.HEAP_WATCH_DIR;
let lastHeapDumpAt = 0;

if (HEAP_WATCH_DIR) {
    const heapWatchTimer = setInterval(() => {
        const m = process.memoryUsage();
        const now = Date.now();
        const trigger = m.rss > HEAP_RSS_THRESHOLD || m.heapUsed + m.external > HEAP_HEAP_THRESHOLD;
        if (!trigger) return;
        if (now - lastHeapDumpAt < HEAP_WATCH_COOLDOWN_MS) return;
        lastHeapDumpAt = now;
        const filename = `${HEAP_WATCH_DIR}/heap-${process.env.HOSTNAME || 'unknown'}-${now}.heapsnapshot`;
        try {
            writeHeapSnapshot(filename);
            // eslint-disable-next-line no-console
            console.log(
                `[telemetry] auto heap-watch dump: ${filename} ` +
                    `(rss=${(m.rss / 1e6).toFixed(0)}MB heapUsed=${(m.heapUsed / 1e6).toFixed(0)}MB external=${(m.external / 1e6).toFixed(0)}MB)`
            );
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[telemetry] auto heap-watch error:', err);
        }
    }, HEAP_WATCH_INTERVAL_MS);
    heapWatchTimer.unref?.();
}

if (OTEL_ENABLED) {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-grpc');
    const { resourceFromAttributes } = await import('@opentelemetry/resources');
    const { TraceIdRatioBasedSampler, ParentBasedSampler } = await import(
        '@opentelemetry/sdk-trace-node'
    );
    const semconv = await import('@opentelemetry/semantic-conventions');
    const { getNodeAutoInstrumentations } = await import(
        '@opentelemetry/auto-instrumentations-node'
    );

    const endpoint =
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
        'otel-collector.observability.svc.cluster.local:4317';
    const samplerArg = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '0.1');

    const sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [semconv.ATTR_SERVICE_NAME]: 'damoang-web',
            [semconv.ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION || 'v1',
            'deployment.environment': process.env.DEPLOYMENT_ENV || 'prd'
        }),
        sampler: new ParentBasedSampler({
            root: new TraceIdRatioBasedSampler(samplerArg)
        }),
        traceExporter: new OTLPTraceExporter({
            url: endpoint.startsWith('http') ? endpoint : `http://${endpoint}`
        }),
        instrumentations: [
            getNodeAutoInstrumentations({
                // 과도한 span 방지 — fs 계측 비활성
                '@opentelemetry/instrumentation-fs': { enabled: false },
                // HTTP (fetch 포함)만 계측 → Go backend traceparent 자동 주입
                '@opentelemetry/instrumentation-http': { enabled: true }
            })
        ]
    });

    sdk.start();
    // eslint-disable-next-line no-console
    console.log(`[telemetry] OTel started: endpoint=${endpoint} sampler=${samplerArg}`);

    // Heap metrics logger — 4/22 OOM 이후 추가.
    // process.memoryUsage()를 60초마다 stdout에 JSON으로 출력 → OTel collector filelog receiver가
    // otel.logs 테이블에 수집 → Grafana 패널에서 heap 추이 관찰.
    // 별도 metrics 파이프라인 없이 기존 logs 파이프라인 재활용.
    const HEAP_LOG_INTERVAL_MS = 60_000;
    const heapLogTimer = setInterval(() => {
        const m = process.memoryUsage();
        const externalRatio = m.heapUsed > 0 ? m.external / m.heapUsed : 0;
        // eslint-disable-next-line no-console
        console.log(
            JSON.stringify({
                event: 'heap_metrics',
                // pod 식별 (4/30 cluster-wide alert pod-level 분리용). K8s 가 HOSTNAME = pod name 자동 set.
                pod: process.env.HOSTNAME || 'unknown',
                rss: m.rss,
                heapTotal: m.heapTotal,
                heapUsed: m.heapUsed,
                external: m.external,
                arrayBuffers: m.arrayBuffers,
                uptime_s: Math.round(process.uptime()),
                // Tier 4 audit (2026-04-28): cache size + external ratio diagnostic
                ssrCacheSize: ssrCache.size,
                externalRatio: Number(externalRatio.toFixed(3))
            })
        );
        // Alert: external > heap*0.5 + heap > 200MB → Buffer/gzip/SDK 외부 메모리 의심
        if (externalRatio > 0.5 && m.heapUsed > 200_000_000) {
            // eslint-disable-next-line no-console
            console.warn(
                `[telemetry] external/heap=${externalRatio.toFixed(2)} ` +
                    `(external=${(m.external / 1e6).toFixed(0)}MB heap=${(m.heapUsed / 1e6).toFixed(0)}MB) ` +
                    `— gzip/Buffer/AWS SDK/OTel BSP 외부 메모리 의심`
            );
        }
    }, HEAP_LOG_INTERVAL_MS);
    heapLogTimer.unref?.();

    process.on('SIGTERM', async () => {
        try {
            await sdk.shutdown();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[telemetry] shutdown error:', err);
        }
    });
}
