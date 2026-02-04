# Angple TODO List

## 우선순위: 높음

### [ ] 이미지 URL 자동 렌더링 플러그인
- **위치**: 댓글, 게시글 본문
- **현상**: `[https://media.tenor.com/...gif]` 형태의 텍스트가 그대로 표시됨
- **기대 동작**:
  - 이미지 URL (jpg, png, gif, webp) 자동 감지
  - 미리보기 이미지로 렌더링
  - 클릭 시 원본 이미지 열기
- **구현 방안**:
  1. 플러그인으로 개발 (`plugins/image-url-renderer/`)
  2. Hook System 활용 (`content_render` 필터)
  3. 정규식으로 URL 패턴 감지
  4. Lazy loading 적용 (성능 최적화)
- **참고**: 디스코드, 슬랙 스타일 자동 임베드
- **생성일**: 2026-02-04

---

## 우선순위: 중간

### [ ] 테스트 계정 관리 개선
- **현상**: 프론트엔드 `.env` 파일 누락으로 SSR API URL 불일치
- **해결**: `.env` 파일 생성 완료 (`INTERNAL_API_URL=http://localhost:8081/api/v2`)
- **추가 작업**:
  - [ ] `.env.example` 파일 포트 수정 (8082 → 8081)
  - [ ] 개발 환경 설정 문서 업데이트
- **생성일**: 2026-02-04

---

## 완료됨

### [x] QA 테스트 자동화 (2026-02-04)
- Playwright 기반 QA 스크립트 작성
- MCP Playwright 실시간 테스트 완료
- 21개 테스트 통과

### [x] MCP Playwright 서버 설정 (2026-02-04)
- `claude mcp add playwright` 완료
- 브라우저 직접 제어 테스트 완료

---

## 메모

### 테스트 계정 정보
| 아이디 | 비밀번호 | 레벨 | 권한 |
|--------|----------|------|------|
| admin | test1234 | 10 | 관리자 |
| test1~5 | test1234 | 2 | 일반 사용자 |
| power1~2 | test1234 | 5 | 파워유저 |
| moderator | test1234 | 8 | 부관리자 |

### 환경 정보
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8081/api/v2
- 관리자: http://localhost:5174
