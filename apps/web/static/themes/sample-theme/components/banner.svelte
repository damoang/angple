<script>
    // 테마에서 제공하는 커스텀 배너 컴포넌트
    let message = '🎨 이것은 테마에서 추가한 커스텀 배너입니다!';
</script>

<div class="custom-banner">
    <div class="container mx-auto px-4 py-3">
        <p class="text-center text-sm font-medium">{message}</p>
    </div>
</div>

<style>
    .custom-banner {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
</style>
