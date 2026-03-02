<script lang="ts">
    // 쇼핑 바로가기 배너 - economy 게시판 전용
    const shops = [
        { name: '쿠팡', href: 'https://link.coupang.com/a/cSFTV0' },
        {
            name: '알리익스프레스',
            href: 'https://s.click.aliexpress.com/e/_oFaTsCc'
        },
        { name: '아마존', href: 'https://www.amazon.com/?tag=damoang0c-20' },
        {
            name: 'G마켓',
            href: 'https://click.linkprice.com/click.php?m=gmarket&a=A100694456&l=9999&l_cd2=0&tu=https%3A%2F%2Fwww.gmarket.co.kr%2F'
        },
        {
            name: '11번가',
            href: 'https://click.linkprice.com/click.php?m=11st&a=A100694456&l=9999&l_cd2=0&tu=https%3A%2F%2Fwww.11st.co.kr%2F'
        },
        {
            name: '옥션',
            href: 'https://click.linkprice.com/click.php?m=auction&a=A100694456&l=9999&l_cd2=0&tu=https%3A%2F%2Fwww.auction.co.kr%2F'
        },
        {
            name: 'SSG',
            href: 'https://click.linkprice.com/click.php?m=emart&a=A100694456&l=9999&l_cd2=0&tu=https%3A%2F%2Fwww.ssg.com%2F'
        },
        {
            name: '교보문고',
            href: 'https://click.linkprice.com/click.php?m=kbbook&a=A100694456&l=9999&l_cd2=0&tu=https%3A%2F%2Fwww.kyobobook.co.kr%2F'
        }
    ];
</script>

<div class="bg-muted/50 mb-3 rounded-lg border p-3">
    <div class="flex flex-wrap items-center gap-2">
        <span class="text-foreground mr-2 text-sm font-semibold">쇼핑 바로가기</span>
        {#each shops as shop}
            <a
                href={shop.href}
                target="_blank"
                rel="nofollow noreferrer"
                class="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            >
                {shop.name}
            </a>
        {/each}
    </div>
</div>
