<script lang="ts">
    import { mode, toggleMode } from 'mode-watcher';
</script>
<header>
    <div class="top"><a class="brand" href="/대문">위키앙<span>함께 만드는 지식사전</span></a><form action="/Special:Search" method="GET"><input name="q" aria-label="위키 문서 검색" placeholder="문서 검색" required maxlength="200"/><button>검색</button></form><button class="theme" onclick={toggleMode} aria-label="화면 색상 전환">{mode.current === 'dark' ? '☀' : '☾'}</button></div>
    <nav aria-label="위키 메뉴"><a href="/대문">대문</a><a href="/Special:AllPages">모든 문서</a><a href="/Special:RecentChanges">최근 바뀜</a><a href="/Special:Categories">분류</a><a href="/Special:NewPage">새 문서</a><a href="/도움말">도움말</a><a href="https://damoang.net">다모앙 ↗</a></nav>
</header>
<style>
header { border-bottom:1px solid var(--border); background:var(--background); } .top { max-width:1400px; margin:auto; padding:1rem; display:flex; gap:1rem; align-items:center; } .brand { font-weight:800; font-size:1.6rem; color:var(--primary); white-space:nowrap; } .brand span { display:block; font-size:.7rem; font-weight:400; color:var(--muted-foreground); } form { display:flex; flex:1; max-width:600px; margin-left:auto; gap:.4rem; } input { min-width:0; width:100%; padding:.55rem .7rem; border:1px solid var(--border); border-radius:.4rem; background:var(--muted); } button { padding:.5rem .65rem; flex-shrink:0; border-radius:.4rem; background:var(--muted); cursor:pointer; } nav { display:flex; flex-wrap:wrap; gap:.3rem 1rem; max-width:1400px; padding:0 1rem .8rem; margin:auto; font-size:.85rem; } nav a { padding:.25rem 0; } nav a:hover { color:var(--primary); text-decoration:underline; } @media(max-width:500px) { .top { gap:.5rem; } .brand span { display:none; } .brand { font-size:1.3rem; } .theme { padding:.4rem; } }
</style>
