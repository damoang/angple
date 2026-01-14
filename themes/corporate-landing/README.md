# Corporate Landing Theme

**회사 홈페이지 + 커뮤니티를 하나로!**

Modern corporate landing page theme with community features for Angple.

---

## 🎯 사용 사례

이 테마 하나로 다양한 회사 사이트를 운영할 수 있습니다:

-   **Angple 공식 사이트**: 랜딩 + 개발자 커뮤니티
-   **SDK Corp.**: 기업 소개 + 고객 지원 커뮤니티
-   **SDK Labs**: 연구소 소개 + 기술 블로그

---

## ✨ 주요 기능

### 1. 하이브리드 레이아웃

-   **Landing Mode**: 순수 회사 소개 페이지
-   **Hybrid Mode**: 랜딩 + 커뮤니티 (권장)
-   **Community Mode**: 커뮤니티만

### 2. Block 기반 콘텐츠 편집

-   `content/blocks.json`에서 콘텐츠 관리
-   Admin에서 드래그 & 드롭 편집 (Phase 3)
-   코드 수정 없이 페이지 구성 변경

### 3. 파티클 효과

-   Canvas 기반 파티클 애니메이션
-   마우스 인터랙션
-   성능 최적화

### 4. 반응형 디자인

-   Desktop / Tablet / Mobile 완벽 지원
-   Tailwind CSS 기반 유틸리티 클래스

---

## 🚀 빠른 시작

### 1. 테마 설치

**방법 A: ZIP 업로드 (권장)**

1. Admin 대시보드 접속 (http://localhost:5174)
2. 테마 > 테마 업로드
3. `corporate-landing.zip` 업로드

**방법 B: Git Clone**

```bash
cd themes/
git clone https://github.com/your-repo/corporate-landing.git
```

### 2. 테마 활성화

1. Admin 대시보드 > 테마
2. "Corporate Landing" 찾기
3. "활성화" 버튼 클릭

### 3. 설정 커스터마이징

1. Admin 대시보드 > 테마 > Corporate Landing > 설정
2. 회사 정보 입력:
    - Company Name
    - Tagline
    - Hero Title/Subtitle
3. 색상 커스터마이징:
    - Primary Color
    - Accent Color
    - Gradient Colors
4. 레이아웃 모드 선택:
    - Landing Only
    - **Hybrid (권장)**
    - Community Only
5. 저장 후 미리보기

---

## 📁 디렉토리 구조

```
themes/corporate-landing/
├── theme.json                      # 테마 매니페스트
├── README.md                       # 사용 가이드 (이 파일)
├── layouts/
│   ├── main-layout.svelte         # 메인 레이아웃 (하이브리드)
│   ├── landing-layout.svelte      # 랜딩 전용 레이아웃
│   └── community-layout.svelte    # 커뮤니티 전용 레이아웃
├── components/
│   ├── particles-background.svelte # 파티클 배경 효과
│   ├── hero-section.svelte         # 히어로 섹션
│   ├── services-section.svelte     # 서비스 섹션
│   ├── projects-section.svelte     # 프로젝트 섹션
│   └── contact-section.svelte      # 문의 섹션
├── content/
│   └── blocks.json                 # 콘텐츠 블록 데이터
├── hooks/
│   └── on-landing-load.js          # 랜딩 페이지 로드 훅
└── assets/
    └── (이미지, 폰트 등)
```

---

## 🎨 커스터마이징 가이드

### 1. 회사 정보 변경

**Admin 설정에서 변경 (권장):**

-   Admin > 테마 > Corporate Landing > 설정 > Branding

**또는 blocks.json 직접 수정:**

```json
{
    "landing": [
        {
            "type": "hero",
            "data": {
                "title": "SDK Corp.",
                "subtitle": "혁신적인 IT 솔루션 기업"
            }
        }
    ]
}
```

### 2. 색상 변경

**Admin 설정에서 변경:**

-   Primary Color: `#3b82f6` (파란색)
-   Accent Color: `#8b5cf6` (보라색)
-   Gradient: `from-white via-blue-50 to-white`

### 3. 파티클 효과 조정

**Admin 설정에서 변경:**

-   Enable Particles: `true/false`
-   Particle Count: `50-300` (기본 150)
-   Particle Color: `#ffffff`

### 4. 레이아웃 모드 전환

**Admin 설정 > Layout > Layout Mode:**

-   **Landing Only**: 회사 소개만
-   **Hybrid**: 랜딩 + 커뮤니티 (권장)
-   **Community Only**: 커뮤니티만

---

## 🔧 개발자 가이드

### 새 섹션 추가하기

#### 1. 컴포넌트 생성

```svelte
<!-- components/team-section.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';

    onMount(() => {
        console.log('👥 Team Section 마운트됨');
    });

    // TODO: Phase 3에서 blocks.json으로 데이터 관리
    const team = [{ name: 'John Doe', role: 'CEO' }];
</script>

<section class="px-4 py-24">
    <h2>Our Team</h2>
    {#each team as member}
        <div>{member.name} - {member.role}</div>
    {/each}
</section>
```

#### 2. theme.json에 등록

```json
{
    "components": [
        {
            "id": "team-section",
            "name": "Team Section",
            "slot": "landing-content",
            "path": "components/team-section.svelte",
            "priority": 35
        }
    ]
}
```

#### 3. blocks.json에 데이터 추가

```json
{
    "landing": [
        {
            "type": "team",
            "id": "team-1",
            "enabled": true,
            "data": {
                "title": "Our Team",
                "members": [{ "name": "John Doe", "role": "CEO" }]
            }
        }
    ]
}
```

---

## 📦 Phase별 개발 계획

### ✅ Phase 1: 테마 구조 생성 (완료)

-   디렉토리 생성
-   theme.json 작성
-   레이아웃 플레이스홀더
-   컴포넌트 플레이스홀더

### 🚧 Phase 2: sdkcorp 컴포넌트 변환 (진행 예정)

-   Hero 섹션 스타일링
-   Services 그리드
-   Projects 갤러리
-   Contact 폼
-   Navigation 컴포넌트

### 🔜 Phase 3: Block 시스템 구현

-   blocks.json 파서
-   Admin Block Editor UI
-   드래그 & 드롭
-   실시간 미리보기

### 🔜 Phase 4: 라우팅 & 레이아웃 전환

-   조건부 레이아웃 렌더링
-   `/` → Landing Layout
-   `/community/*` → Community Layout
-   URL 기반 자동 전환

### 🔜 Phase 5: Particles 효과 구현

-   Canvas API
-   Particle 클래스
-   마우스 인터랙션
-   RAF 애니메이션

### 🔜 Phase 6: API 엔드포인트 추가

-   `GET /api/themes/[id]/blocks`
-   `PUT /api/themes/[id]/blocks`
-   Contact 폼 이메일 전송

---

## 🌐 실제 사용 예시

### Angple 공식 사이트

```json
{
    "companyName": "Angple",
    "heroTitle": "오픈소스 커뮤니티 플랫폼",
    "layoutMode": "hybrid"
}
```

### SDK Corp.

```json
{
    "companyName": "SDK Corp.",
    "heroTitle": "혁신적인 IT 솔루션",
    "layoutMode": "landing"
}
```

### SDK Labs

```json
{
    "companyName": "SDK Labs",
    "heroTitle": "Research & Development",
    "layoutMode": "hybrid"
}
```

---

## 📞 지원

-   GitHub Issues: https://github.com/damoang/angple/issues
-   Discord: (준비 중)
-   Email: team@sdklabs.kr

---

## 📄 라이선스

MIT License

---

**마지막 업데이트**: 2025-12-31
**버전**: 1.0.0
**제작**: SDK Labs
