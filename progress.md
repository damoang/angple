# 이미지 업로드 500 수정 — 완료

## 근본 원인
1. 별도 라우트 `/api/v2/boards/[boardId]/upload/image/+server.ts`가 SvelteKit 빌드에 포함 안 됨
2. catch-all `/api/v2/[...path]/+server.ts`가 대신 처리 → muzia-api 프록시 → 502
3. BODY_SIZE_LIMIT 적용 후에도 별도 라우트가 빌드에 없어서 효과 없음

## 수정
- catch-all 프록시(`[...path]/+server.ts`)에서 `boards/*/upload/image` 패턴 감지
- 프록시 대신 **직접 파일 저장** (/app/gnuboard-data/editor/)
- 빌드 라우트 문제 우회

## 검증 필요
- 브라우저에서 /forum/write → 이미지 첨부 → 성공
