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

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

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
        // eslint-disable-next-line no-console
        console.log(
            JSON.stringify({
                event: 'heap_metrics',
                rss: m.rss,
                heapTotal: m.heapTotal,
                heapUsed: m.heapUsed,
                external: m.external,
                arrayBuffers: m.arrayBuffers,
                uptime_s: Math.round(process.uptime())
            })
        );
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
