<script lang="ts">
    import { onMount } from 'svelte';

    /**
     * Particles Background Component
     *
     * Canvas 기반 파티클 효과
     * - sdkcorp의 Particles.tsx를 Svelte로 변환
     * - 마우스 인터랙션
     * - 성능 최적화
     */

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;
    let animationFrameId: number;

    // Particle 클래스
    class Particle {
        x: number;
        y: number;
        size: number;
        speedX: number;
        speedY: number;
        opacity: number;

        constructor(canvasWidth: number, canvasHeight: number) {
            this.x = Math.random() * canvasWidth;
            this.y = Math.random() * canvasHeight;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.opacity = Math.random() * 0.5 + 0.2;
        }

        update(canvasWidth: number, canvasHeight: number) {
            this.x += this.speedX;
            this.y += this.speedY;

            // 경계 체크 및 래핑
            if (this.x > canvasWidth) this.x = 0;
            if (this.x < 0) this.x = canvasWidth;
            if (this.y > canvasHeight) this.y = 0;
            if (this.y < 0) this.y = canvasHeight;
        }

        draw(context: CanvasRenderingContext2D) {
            context.fillStyle = `rgba(96, 165, 250, ${this.opacity})`; // blue-400
            context.beginPath();
            context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            context.fill();
        }
    }

    let particles: Particle[] = [];
    let mouseX = 0;
    let mouseY = 0;
    let isMouseInCanvas = false;

    function initParticles() {
        if (!canvas) return;

        const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
        particles = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(canvas.width, canvas.height));
        }
    }

    function drawConnections() {
        if (!ctx) return;

        const maxDistance = 120;

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.2;
                    ctx.strokeStyle = `rgba(96, 165, 250, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }

            // 마우스와 파티클 연결
            if (isMouseInCanvas) {
                const dx = particles[i].x - mouseX;
                const dy = particles[i].y - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    const opacity = (1 - distance / 150) * 0.5;
                    ctx.strokeStyle = `rgba(147, 197, 253, ${opacity})`; // blue-300
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mouseX, mouseY);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 파티클 업데이트 및 그리기
        particles.forEach((particle) => {
            particle.update(canvas.width, canvas.height);
            particle.draw(ctx!);
        });

        // 연결선 그리기
        drawConnections();

        animationFrameId = requestAnimationFrame(animate);
    }

    function handleResize() {
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initParticles();
    }

    function handleMouseMove(event: MouseEvent) {
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;
    }

    function handleMouseEnter() {
        isMouseInCanvas = true;
    }

    function handleMouseLeave() {
        isMouseInCanvas = false;
    }

    onMount(() => {
        console.log('✨ Particles Background 마운트됨');

        if (!canvas) {
            console.error('❌ Canvas 요소를 찾을 수 없습니다');
            return;
        }

        ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('❌ Canvas 2D 컨텍스트를 가져올 수 없습니다');
            return;
        }

        // 초기 설정
        handleResize();

        // 이벤트 리스너
        window.addEventListener('resize', handleResize);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseenter', handleMouseEnter);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        // 애니메이션 시작
        animate();

        console.log(`✅ Particles 초기화 완료 (${particles.length}개)`);

        return () => {
            // cleanup
            window.removeEventListener('resize', handleResize);
            if (canvas) {
                canvas.removeEventListener('mousemove', handleMouseMove);
                canvas.removeEventListener('mouseenter', handleMouseEnter);
                canvas.removeEventListener('mouseleave', handleMouseLeave);
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            console.log('🧹 Particles cleanup 완료');
        };
    });
</script>

<!-- Canvas element for particle rendering -->
<canvas bind:this={canvas} class="pointer-events-auto fixed inset-0 -z-10" aria-hidden="true"
></canvas>
