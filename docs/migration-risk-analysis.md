# 그누보드 → SvelteKit 마이그레이션 위험 분석

> 작성일: 2026-02-27
> 코드 검증 기반 (추측 아닌 실제 코드 참조)

---

## 1. 포인트/경험치 이중 시스템 (가장 큰 위험)

### 현재 상태 — 코드 기반 분석

#### 포인트 시스템: 읽기 ✅ / 쓰기 ❌ (테이블 불일치)

| 동작                   | PHP (damoang.net)    | Go (web.damoang.net)    | 참조 파일                                                   |
| ---------------------- | -------------------- | ----------------------- | ----------------------------------------------------------- |
| **포인트 내역 조회**   | `g5_point` 직접      | `g5_point` 직접 ✅      | `angple-backend/internal/repository/v2/my_point_repo.go:46` |
| **보유 포인트 조회**   | `g5_member.mb_point` | `g5_member.mb_point` ✅ | `my_point_repo.go:33`                                       |
| **글쓰기 포인트 적립** | `g5_point` INSERT    | `v2_points` INSERT ❌   | `angple-backend/internal/repository/v2/point_repo.go:52-53` |
| **댓글 포인트 적립**   | `g5_point` INSERT    | `v2_points` INSERT ❌   | `point_repo.go:52-53`, `handler.go:381`                     |
| **보유 잔액 업데이트** | `g5_member.mb_point` | `v2_users.point` ❌     | `point_repo.go:39-41`                                       |

**구체적 코드 증거:**

```go
// point_repo.go — Go가 글쓰기 포인트를 v2_points에 저장
func (r *pointRepository) AddPoint(userID uint64, point int, ...) error {
    return r.db.Transaction(func(tx *gorm.DB) error {
        // v2_users.point 업데이트 (g5_member.mb_point가 아님!)
        tx.Model(&v2.V2User{}).Where("id = ?", userID).
            UpdateColumn("point", gorm.Expr("point + ?", point))
        // v2_points 테이블에 로그 INSERT (g5_point가 아님!)
        log := &v2.V2Point{UserID: userID, Point: point, ...}
        return tx.Create(log).Error
    })
}
```

```go
// my_point_repo.go — Go가 포인트 내역을 g5_point에서 조회
func (r *myPointRepository) GetHistory(mbID string, ...) ([]v2.G5Point, ...) {
    err = r.db.Where("mb_id = ?", mbID).Order("po_id DESC").Find(&items).Error
    // → g5_point 테이블에서 읽음
}
```

**문제 시나리오:**

1. 사용자가 **web.damoang.net**에서 글을 씀
2. Go가 `v2_points`에 "+100 포인트" 기록, `v2_users.point` 업데이트
3. 사용자가 `/my/points` 페이지에서 포인트 내역 확인
4. Go가 `g5_point`에서 내역 조회 → **방금 적립한 100 포인트가 안 보임**
5. 보유 포인트도 `g5_member.mb_point` 기준이므로 변하지 않음

**영향**: 사용자 시점에서 "글을 썼는데 포인트가 안 쌓인다" → 직접적 이탈 원인

#### 경험치 시스템: 읽기 ✅ / 쓰기 ❌ (미구현)

| 동작             | PHP                                | Go         | 상태                            |
| ---------------- | ---------------------------------- | ---------- | ------------------------------- |
| 경험치 요약 조회 | `g5_member.as_exp/as_level/as_max` | 동일 ✅    | `my_exp_repo.go:37-38`          |
| 경험치 내역 조회 | `g5_na_xp`                         | 동일 ✅    | `my_exp_repo.go:62-76`          |
| 경험치 적립      | `na_insert_xp()` + hook            | **미구현** | `cmd/api/main.go:269` TODO 주석 |
| 자동 레벨업      | `na_chk_xp()`                      | **미구현** | 코드 없음                       |

```go
// cmd/api/main.go:269-271 — 경험치 서비스 TODO
// TODO: 경험치 서비스 구현 후 활성화
// expSvc := v2svc.NewExpService(v2UserRepo)
// v2Handler.SetExpService(expSvc)
```

**문제**: 차세대에서 글을 쓰면 경험치가 전혀 안 쌓임. 레벨업 불가.

---

## 2. 조용한 실패 패턴 — 코드 증거

### 캐치올: ✅ 이미 수정됨

```go
// cmd/api/main.go:688-695 — 미매핑 v1 API에 501 반환 (이미 구현)
router.NoRoute(func(c *gin.Context) {
    if strings.HasPrefix(c.Request.URL.Path, "/api/v1/") {
        c.JSON(http.StatusNotImplemented, gin.H{"success": false, "error": "미구현 API"})
        return
    }
    c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
})
```

### 여전히 남아있는 문제: 에러를 200 OK로 반환하는 v1 라우트

```go
// cmd/api/main.go:401-410 — 게시글 상세 조회
v1Boards.GET("/:slug/posts/:id", func(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 64)
    if err != nil {
        c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})  // ← 200 OK + null
        return
    }
    post, err := v2PostRepo.FindByID(id)
    if err != nil {
        c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})  // ← 200 OK + null
        return
    }
```

**영향**: 프론트엔드가 `success: true`를 보고 에러를 감지하지 못함. 사용자는 "데이터가 없다"고 인식.

### 빈 데이터를 반환하는 스텁 엔드포인트

| 엔드포인트                              | 반환값       | 위치              |
| --------------------------------------- | ------------ | ----------------- |
| `GET /api/v1/boards/:slug/notices`      | `[]` 빈 배열 | `main.go:316`     |
| `GET /api/ads/celebration/today`        | `null`       | `main.go:319`     |
| `GET /api/v1/recommended/index-widgets` | 빈 객체      | `main.go:322-333` |
| `GET /api/v1/recommended/ai/:period`    | 빈 섹션      | `main.go:455-468` |

---

## 3. 완성도 재평가 — 코드 검증 후

기존 분석에서 "포인트/경험치 조회 API 미구현"으로 평가했으나, 실제 코드 확인 결과:

| 항목            | 기존 평가      | 코드 검증 결과                                                                    |
| --------------- | -------------- | --------------------------------------------------------------------------------- |
| 포인트 조회 API | ❌ 미구현      | ✅ 구현 완료 (`my_point_repo.go` → `g5_point` 읽기)                               |
| 경험치 조회 API | ❌ 미구현      | ✅ 구현 완료 (`my_exp_repo.go` → `g5_na_xp` 읽기)                                 |
| Go v1 캐치올    | ❌ null 반환   | ✅ 501 반환으로 이미 수정 (`main.go:688-695`)                                     |
| 포인트 적립     | ⚠️ 이중 테이블 | ❌ **더 나쁨** — `v2_points`에 쓰면서 조회는 `g5_point`에서 하므로 적립 기록 소실 |
| 경험치 적립     | ❌ 미구현      | ❌ 확인됨 — TODO 주석만 존재                                                      |

**수정된 완성도**: 약 62% (기존 58%에서 조회 API 완료로 상향)
**하지만 진짜 위험**: 포인트 적립의 테이블 불일치가 기존 분석보다 심각

---

## 4. 롤백 불가능한 구조

현재 아키텍처:

```
damoang.net      → 100% PHP (g5_point, g5_member.mb_point)
web.damoang.net  → PHP + SvelteKit 혼합
                   - 조회: g5_point 읽기 ✅
                   - 적립: v2_points 쓰기 ❌ (다른 테이블!)
```

전환 시나리오:

```
1. damoang.net을 SvelteKit으로 전환
2. 사용자가 글 쓰기 → v2_points에 포인트 적립
3. 포인트 내역 조회 → g5_point에서 읽기 → 안 보임
4. 문제 발견 후 PHP로 롤백
5. v2_points에 쌓인 포인트 데이터 → g5_point로 역마이그레이션 필요
6. 두 테이블 간 user_id 체계도 다름 (g5: mb_id 문자열, v2: uint64 숫자)
```

**핵심**: user_id 체계가 다르므로 (g5_point.mb_id = "사용자ID문자열" vs v2_points.user_id = 숫자) 역마이그레이션이 복잡함.

---

## 5. 미구현 필수 기능 (사용자가 매일 쓰는 기능)

| 미구현 기능             | 사용 빈도     | 현재 상태                   | 불만 예상        |
| ----------------------- | ------------- | --------------------------- | ---------------- |
| 경험치 적립             | 글/댓글마다   | TODO 주석만 (`main.go:269`) | 레벨업 불가      |
| 포인트 적립 (일관성)    | 글/댓글마다   | 잘못된 테이블에 쓰기        | 포인트 누락      |
| 프로필 수정             | 회원 기본     | 미구현                      | 기본 기능 누락   |
| 비밀번호 변경           | 회원 기본     | 미구현                      | 기본 기능 누락   |
| 회원탈퇴                | 법적 의무     | 미구현                      | 법적 이슈        |
| 자동저장/임시저장       | 글쓰기마다    | 미구현                      | 글 날아감 → 이탈 |
| @멘션 알림              | 댓글마다      | 미구현                      | 소통 단절        |
| 이벤트 보상 (주사위 등) | 커뮤니티 핵심 | 미구현                      | 참여도 급감      |
| 신고 사유 선택          | 신고마다      | 미구현                      | 운영 품질 저하   |

---

## 6. 종합: 위험의 핵심 원인

```
조회는 g5 테이블에서 읽음 ✅
        ↓
적립은 v2 테이블에 씀 ❌
        ↓
"포인트가 적립되는데 안 보인다"
        ↓
경험치는 아예 적립 안 됨
        ↓
사용자 불만 + 롤백 시 역마이그레이션 난이도 높음
        ↓
user_id 체계도 다름 (mb_id 문자열 vs uint64)
```

**한마디로**: "조회는 되는데 적립이 잘못된 곳에 쌓인다. 경험치는 아예 안 쌓인다."

---

## 7. 위험을 줄이는 방향 — 구체적 액션

### 최우선 (P0) — 이것 없이 전환 불가

#### 1. 포인트 적립을 g5_point 테이블로 통합

**변경 대상**: `angple-backend/internal/repository/v2/point_repo.go`

현재:

```go
// v2_users.point 업데이트 + v2_points INSERT
```

변경 후:

```go
// g5_member.mb_point 업데이트 + g5_point INSERT
```

**주의**: user_id 매핑 필요 (v2_users.id → g5_member.mb_id)

#### 2. 경험치 적립 서비스 구현

**변경 대상**: `angple-backend/cmd/api/main.go:269` (TODO 주석 해제 + 서비스 구현)

필요한 작업:

-   `na_insert_xp()` PHP 함수를 Go로 이식
-   `na_chk_xp()` 레벨 체크 로직 이식
-   g5_na_xp 테이블에 직접 INSERT
-   g5_member.as_exp/as_level/as_max 업데이트

#### 3. v1 라우트 에러 처리 수정

**변경 대상**: `angple-backend/cmd/api/main.go:401-410`

현재: `200 OK + data: nil`
변경 후: `404 Not Found + success: false`

### 중요 (P1) — 전환 후 사용자 불만

4. 프로필 수정, 비밀번호 변경, 회원탈퇴 구현
5. 이벤트 보상 시스템 이식 (`EventReward.php` 620행)
6. @멘션 알림 구현
7. 자동저장/임시저장 구현
8. 신고 워크플로우 구현

### 점진적 전환 전략 (권장)

```
Phase 1: Go point_repo.go를 g5_point 직접 쓰기로 변경 (1-2일)
         → 포인트 이중 시스템 즉시 해소
         → 기존 PHP와 완전 호환

Phase 2: 경험치 서비스 구현 (3-5일)
         → na_insert_xp() 이식
         → g5_na_xp 직접 쓰기

Phase 3: 필수 회원 기능 구현 (1주)
         → 프로필 수정, 비밀번호 변경, 회원탈퇴

Phase 4: 게시판별 점진 전환 (nginx 라우팅)
         → 트래픽 낮은 게시판부터 SvelteKit으로 이동
         → 문제 발생 시 해당 게시판만 PHP로 복귀 가능
```

---

## 부록: 주요 코드 경로 참조

| 기능                               | 파일 경로                                                | 라인      |
| ---------------------------------- | -------------------------------------------------------- | --------- |
| 포인트 적립 (v2_points 쓰기)       | `angple-backend/internal/repository/v2/point_repo.go`    | 36-62     |
| 포인트 조회 (g5_point 읽기)        | `angple-backend/internal/repository/v2/my_point_repo.go` | 30-80     |
| 경험치 조회 (g5_na_xp 읽기)        | `angple-backend/internal/repository/v2/my_exp_repo.go`   | 31-81     |
| 경험치 적립 TODO                   | `angple-backend/cmd/api/main.go`                         | 269-271   |
| v1 캐치올 (501 반환)               | `angple-backend/cmd/api/main.go`                         | 688-695   |
| v1 게시글 조회 (null 반환 문제)    | `angple-backend/cmd/api/main.go`                         | 401-410   |
| 포인트 내역 UI                     | `angple/apps/web/src/routes/my/points/+page.svelte`      | 전체      |
| 경험치 내역 UI                     | `angple/apps/web/src/routes/my/exp/+page.svelte`         | 전체      |
| API 클라이언트 (포인트 호출)       | `angple/apps/web/src/lib/api/client.ts`                  | 1386-1391 |
| API 클라이언트 (경험치 호출)       | `angple/apps/web/src/lib/api/client.ts`                  | 1507-1512 |
| V2Point 모델 (v2_points 테이블)    | `angple-backend/internal/domain/v2/models.go`            | 54-66     |
| G5Point 모델 (g5_point 테이블)     | `angple-backend/internal/domain/v2/g5_point.go`          | 4-19      |
| G5NaXp 모델 (g5_na_xp 테이블)      | `angple-backend/internal/domain/v2/g5_na_xp.go`          | 4-15      |
| damoang-backend 포인트 (읽기 전용) | `damoang-backend/internal/repository/point_repo.go`      | 전체      |
| Migration 포인트 (미완)            | `angple-backend/cmd/migrate/main.go`                     | 372-383   |
