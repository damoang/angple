# dorico/1 YouTube 화면 초과 분석

## 콘텐츠 구조
```html
<p>텍스트...</p>
<pre><code>&lt;iframe width="1161" height="751" src="https://www.youtube.com/embed/hF6SWwMetnY"...&gt;&lt;/iframe&gt;</code></pre>
<p></p>
```

## 문제
1. iframe이 `&lt;iframe&gt;`로 HTML 이스케이프되어 `<pre><code>` 안에 텍스트로 저장됨
2. 브라우저는 이걸 코드 블록으로 렌더링 → 가로 스크롤 (긴 한 줄 텍스트)
3. `makeResponsive()`가 `<iframe`을 찾지만 `&lt;iframe`은 못 찾음
4. YouTube ID(hF6SWwMetnY)는 별도로 추출되어 반응형 임베드로 표시됨 → 이건 OK
5. **진짜 문제: `<pre><code>` 블록이 가로로 넘침**

## 해결
`<pre><code>` 안의 이스케이프된 iframe을 **제거**하거나,
`<pre>` 블록에 `overflow-x: auto; max-width: 100%;`를 CSS에서 강제.

이미 main-layout.svelte에 `.muzia-theme .prose pre { overflow-x: auto; max-width: 100%; }` 추가했지만,
**빌드 이미지에 반영 안 됐을 수 있음** 또는 **specificity 문제**.

## 가장 확실한 해결
processContent()에서 `<pre><code>` 안의 이스케이프된 iframe을 감지하여 제거.
YouTube ID는 이미 별도 임베드로 표시되므로, 중복된 코드 블록은 불필요.
