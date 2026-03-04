<script lang="ts">
    // 장기 게임 - Korean Chess (Janggi)
    // 포팅: /home/damoang/www/janggi/janggi.js

    /* ── 타입 정의 ── */
    interface Point {
        x: number;
        y: number;
    }
    interface Piece {
        kind: number;
        team: number;
        x: number;
        y: number;
        alive: boolean;
        text: string;
        score: number;
    }
    type Board = (Piece | null)[][];

    /* ── 상수 ── */
    const COLS = 9;
    const ROWS = 10;
    const CELL = 64;
    const PAD = 40;
    const W = PAD * 2 + (COLS - 1) * CELL; // 552
    const H = PAD * 2 + (ROWS - 1) * CELL; // 656

    const KIND = { GUNG: 1, CHA: 2, SANG: 3, MA: 4, SA: 5, PO: 6, JOLE: 7 } as const;
    const TEAM = { USER: 1, COM: 2 } as const;

    const SCORES: Record<number, number> = {
        [KIND.GUNG]: 20000,
        [KIND.CHA]: 1000,
        [KIND.SANG]: 450,
        [KIND.MA]: 700,
        [KIND.SA]: 600,
        [KIND.PO]: 850,
        [KIND.JOLE]: 400
    };

    const TEXT_USER: Record<number, string> = {
        [KIND.GUNG]: '楚',
        [KIND.CHA]: '車',
        [KIND.SANG]: '象',
        [KIND.MA]: '馬',
        [KIND.SA]: '士',
        [KIND.PO]: '包',
        [KIND.JOLE]: '卒'
    };
    const TEXT_COM: Record<number, string> = {
        [KIND.GUNG]: '漢',
        [KIND.CHA]: '車',
        [KIND.SANG]: '象',
        [KIND.MA]: '馬',
        [KIND.SA]: '士',
        [KIND.PO]: '包',
        [KIND.JOLE]: '兵'
    };

    /* ── 크기 분류 ── */
    function pieceRadius(kind: number): number {
        if (kind === KIND.GUNG) return 28;
        if (kind === KIND.SA || kind === KIND.JOLE) return 18;
        return 23;
    }
    function fontSize(kind: number): number {
        if (kind === KIND.GUNG) return 32;
        if (kind === KIND.SA || kind === KIND.JOLE) return 16;
        return 22;
    }

    /* ── 상태 ── */
    let canvas: HTMLCanvasElement;
    let pieces = $state<Piece[]>([]);
    let selected = $state<Piece | null>(null);
    let validMoves = $state<Point[]>([]);
    let turn = $state<number>(TEAM.USER);
    let gameOver = $state(false);
    let winner = $state<number | null>(null);
    let thinking = $state(false);
    let isSingle = $state(true);
    let lastComMove = $state<{ from: Point; to: Point } | null>(null);
    let message = $state('');

    /* ── 초기 배치 ── */
    function makePiece(kind: number, team: number, x: number, y: number): Piece {
        return {
            kind,
            team,
            x,
            y,
            alive: true,
            text: team === TEAM.USER ? TEXT_USER[kind] : TEXT_COM[kind],
            score: SCORES[kind]
        };
    }

    function initPieces(): Piece[] {
        const p: Piece[] = [];
        // 한(COM) - 상단
        p.push(makePiece(KIND.CHA, TEAM.COM, 0, 0));
        p.push(makePiece(KIND.SANG, TEAM.COM, 1, 0));
        p.push(makePiece(KIND.MA, TEAM.COM, 2, 0));
        p.push(makePiece(KIND.SA, TEAM.COM, 3, 0));
        p.push(makePiece(KIND.SA, TEAM.COM, 5, 0));
        p.push(makePiece(KIND.SANG, TEAM.COM, 6, 0));
        p.push(makePiece(KIND.MA, TEAM.COM, 7, 0));
        p.push(makePiece(KIND.CHA, TEAM.COM, 8, 0));
        p.push(makePiece(KIND.GUNG, TEAM.COM, 4, 1));
        p.push(makePiece(KIND.PO, TEAM.COM, 1, 2));
        p.push(makePiece(KIND.PO, TEAM.COM, 7, 2));
        for (let i = 0; i < 5; i++) p.push(makePiece(KIND.JOLE, TEAM.COM, i * 2, 3));

        // 초(USER) - 하단
        p.push(makePiece(KIND.CHA, TEAM.USER, 0, 9));
        p.push(makePiece(KIND.SANG, TEAM.USER, 1, 9));
        p.push(makePiece(KIND.MA, TEAM.USER, 2, 9));
        p.push(makePiece(KIND.SA, TEAM.USER, 3, 9));
        p.push(makePiece(KIND.SA, TEAM.USER, 5, 9));
        p.push(makePiece(KIND.SANG, TEAM.USER, 6, 9));
        p.push(makePiece(KIND.MA, TEAM.USER, 7, 9));
        p.push(makePiece(KIND.CHA, TEAM.USER, 8, 9));
        p.push(makePiece(KIND.GUNG, TEAM.USER, 4, 8));
        p.push(makePiece(KIND.PO, TEAM.USER, 1, 7));
        p.push(makePiece(KIND.PO, TEAM.USER, 7, 7));
        for (let i = 0; i < 5; i++) p.push(makePiece(KIND.JOLE, TEAM.USER, i * 2, 6));

        return p;
    }

    /* ── 보드 상태 → 2D 배열 ── */
    function getBoard(pcs: Piece[]): Board {
        const b: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        for (const p of pcs) {
            if (p.alive) b[p.y][p.x] = p;
        }
        return b;
    }

    /* ── 궁성 체크 ── */
    function inPalace(x: number, y: number, team: number): boolean {
        if (x < 3 || x > 5) return false;
        if (team === TEAM.COM) return y >= 0 && y <= 2;
        return y >= 7 && y <= 9;
    }

    // 궁성 대각선 위 점인지
    function onPalaceDiag(x: number, y: number): boolean {
        // 상단 궁: (3,0)-(5,2), 중심 (4,1)
        if (x >= 3 && x <= 5 && y >= 0 && y <= 2) {
            return (x - 3 === y && y <= 2) || (5 - x === y && y <= 2);
        }
        // 하단 궁: (3,7)-(5,9), 중심 (4,8)
        if (x >= 3 && x <= 5 && y >= 7 && y <= 9) {
            return x - 3 === y - 7 || 5 - x === y - 7;
        }
        return false;
    }

    /* ── 이동 규칙 ── */
    function getMoves(piece: Piece, board: Board): Point[] {
        const moves: Point[] = [];
        const { kind, x, y, team } = piece;

        function addIf(nx: number, ny: number) {
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
            const target = board[ny][nx];
            if (target && target.team === team) return;
            moves.push({ x: nx, y: ny });
        }

        if (kind === KIND.GUNG || kind === KIND.SA) {
            // 궁/사 - 궁성 내 한 칸 이동
            const dirs = [
                [0, -1],
                [0, 1],
                [-1, 0],
                [1, 0]
            ];
            // 대각선 이동 (궁성 대각선 위에 있을 때)
            if (onPalaceDiag(x, y)) {
                dirs.push([-1, -1], [1, -1], [-1, 1], [1, 1]);
            }
            for (const [dx, dy] of dirs) {
                const nx = x + dx,
                    ny = y + dy;
                if (inPalace(nx, ny, team)) addIf(nx, ny);
            }
        } else if (kind === KIND.CHA) {
            // 차 - 직선 이동
            for (const [dx, dy] of [
                [0, -1],
                [0, 1],
                [-1, 0],
                [1, 0]
            ]) {
                let nx = x + dx,
                    ny = y + dy;
                while (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
                    const target = board[ny][nx];
                    if (target) {
                        if (target.team !== team) moves.push({ x: nx, y: ny });
                        break;
                    }
                    moves.push({ x: nx, y: ny });
                    nx += dx;
                    ny += dy;
                }
            }
            // 궁성 대각선 이동
            if (onPalaceDiag(x, y)) {
                for (const [dx, dy] of [
                    [-1, -1],
                    [1, -1],
                    [-1, 1],
                    [1, 1]
                ]) {
                    let nx = x + dx,
                        ny = y + dy;
                    while (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
                        if (!onPalaceDiag(nx, ny) && !(nx === 4 && (ny === 1 || ny === 8))) break;
                        const target = board[ny][nx];
                        if (target) {
                            if (target.team !== team) moves.push({ x: nx, y: ny });
                            break;
                        }
                        moves.push({ x: nx, y: ny });
                        nx += dx;
                        ny += dy;
                    }
                }
            }
        } else if (kind === KIND.MA) {
            // 마 - 직선 한 칸 + 대각선 한 칸 (경로 막히면 불가)
            const maMoves: [number, number, number, number][] = [
                [0, -1, -1, -2],
                [0, -1, 1, -2],
                [0, 1, -1, 2],
                [0, 1, 1, 2],
                [-1, 0, -2, -1],
                [-1, 0, -2, 1],
                [1, 0, 2, -1],
                [1, 0, 2, 1]
            ];
            for (const [bx, by, tx, ty] of maMoves) {
                const blockX = x + bx,
                    blockY = y + by;
                if (blockX < 0 || blockX >= COLS || blockY < 0 || blockY >= ROWS) continue;
                if (board[blockY][blockX]) continue; // 경로 막힘
                addIf(x + tx, y + ty);
            }
        } else if (kind === KIND.SANG) {
            // 상 - 직선 한 칸 + 대각선 두 칸 (경로 막히면 불가)
            const sangMoves: [number, number, number, number, number, number][] = [
                [0, -1, -1, -2, -2, -3],
                [0, -1, 1, -2, 2, -3],
                [0, 1, -1, 2, -2, 3],
                [0, 1, 1, 2, 2, 3],
                [-1, 0, -2, -1, -3, -2],
                [-1, 0, -2, 1, -3, 2],
                [1, 0, 2, -1, 3, -2],
                [1, 0, 2, 1, 3, 2]
            ];
            for (const [b1x, b1y, b2x, b2y, tx, ty] of sangMoves) {
                const bx1 = x + b1x,
                    by1 = y + b1y;
                const bx2 = x + b2x,
                    by2 = y + b2y;
                if (bx1 < 0 || bx1 >= COLS || by1 < 0 || by1 >= ROWS) continue;
                if (bx2 < 0 || bx2 >= COLS || by2 < 0 || by2 >= ROWS) continue;
                if (board[by1][bx1] || board[by2][bx2]) continue;
                addIf(x + tx, y + ty);
            }
        } else if (kind === KIND.PO) {
            // 포 - 직선으로 하나 뛰어넘어야 이동 (포 뛰어넘기 불가)
            for (const [dx, dy] of [
                [0, -1],
                [0, 1],
                [-1, 0],
                [1, 0]
            ]) {
                let nx = x + dx,
                    ny = y + dy;
                let jumped = false;
                while (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
                    const target = board[ny][nx];
                    if (!jumped) {
                        if (target) {
                            if (target.kind === KIND.PO) break; // 포 못 뛰어넘음
                            jumped = true;
                        }
                    } else {
                        if (target) {
                            if (target.team !== team && target.kind !== KIND.PO)
                                moves.push({ x: nx, y: ny });
                            break;
                        }
                        moves.push({ x: nx, y: ny });
                    }
                    nx += dx;
                    ny += dy;
                }
            }
            // 궁성 대각선 포 이동
            if (onPalaceDiag(x, y)) {
                for (const [dx, dy] of [
                    [-1, -1],
                    [1, -1],
                    [-1, 1],
                    [1, 1]
                ]) {
                    const mx = x + dx,
                        my = y + dy;
                    const tx = x + dx * 2,
                        ty = y + dy * 2;
                    if (mx < 0 || mx >= COLS || my < 0 || my >= ROWS) continue;
                    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) continue;
                    if (!onPalaceDiag(mx, my) && !(mx === 4 && (my === 1 || my === 8))) continue;
                    if (!onPalaceDiag(tx, ty) && !(tx === 4 && (ty === 1 || ty === 8))) continue;
                    const mid = board[my][mx];
                    if (!mid || mid.kind === KIND.PO) continue; // 중간에 포 아닌 기물 필요
                    const target = board[ty][tx];
                    if (!target) moves.push({ x: tx, y: ty });
                    else if (target.team !== team && target.kind !== KIND.PO)
                        moves.push({ x: tx, y: ty });
                }
            }
        } else if (kind === KIND.JOLE) {
            // 졸/병 - 앞, 좌, 우 한 칸
            const forward = team === TEAM.USER ? -1 : 1;
            addIf(x, y + forward);
            addIf(x - 1, y);
            addIf(x + 1, y);
            // 궁성 대각선 이동
            if (onPalaceDiag(x, y)) {
                addIf(x - 1, y + forward);
                addIf(x + 1, y + forward);
            }
        }

        return moves;
    }

    /* ── 장군 체크 ── */
    function isCheck(pcs: Piece[], targetTeam: number): boolean {
        const board = getBoard(pcs);
        const king = pcs.find((p) => p.alive && p.kind === KIND.GUNG && p.team === targetTeam);
        if (!king) return true;
        for (const p of pcs) {
            if (!p.alive || p.team === targetTeam) continue;
            const moves = getMoves(p, board);
            if (moves.some((m) => m.x === king.x && m.y === king.y)) return true;
        }
        return false;
    }

    /* ── AI (Minimax) ── */
    function evaluate(pcs: Piece[]): number {
        let score = 0;
        for (const p of pcs) {
            if (!p.alive) continue;
            const val = p.score;
            score += p.team === TEAM.COM ? val : -val;
        }
        return score;
    }

    function getAllMoves(pcs: Piece[], team: number): { piece: Piece; to: Point }[] {
        const board = getBoard(pcs);
        const result: { piece: Piece; to: Point }[] = [];
        for (const p of pcs) {
            if (!p.alive || p.team !== team) continue;
            for (const m of getMoves(p, board)) {
                result.push({ piece: p, to: m });
            }
        }
        return result;
    }

    function applyMove(pcs: Piece[], piece: Piece, to: Point): Piece[] {
        return pcs.map((p) => {
            if (p === piece) return { ...p, x: to.x, y: to.y };
            if (p.alive && p.x === to.x && p.y === to.y && p.team !== piece.team)
                return { ...p, alive: false };
            return { ...p };
        });
    }

    function minimax(
        pcs: Piece[],
        depth: number,
        alpha: number,
        beta: number,
        maximizing: boolean
    ): number {
        if (depth === 0) return evaluate(pcs);
        const team = maximizing ? TEAM.COM : TEAM.USER;
        const moves = getAllMoves(pcs, team);
        if (moves.length === 0) return maximizing ? -99999 : 99999;

        if (maximizing) {
            let best = -Infinity;
            for (const { piece, to } of moves) {
                const next = applyMove(pcs, piece, to);
                const val = minimax(next, depth - 1, alpha, beta, false);
                best = Math.max(best, val);
                alpha = Math.max(alpha, val);
                if (beta <= alpha) break;
            }
            return best;
        } else {
            let best = Infinity;
            for (const { piece, to } of moves) {
                const next = applyMove(pcs, piece, to);
                const val = minimax(next, depth - 1, alpha, beta, true);
                best = Math.min(best, val);
                beta = Math.min(beta, val);
                if (beta <= alpha) break;
            }
            return best;
        }
    }

    function aiMove() {
        thinking = true;
        message = 'AI 생각 중...';

        requestAnimationFrame(() => {
            setTimeout(() => {
                const moves = getAllMoves(pieces, TEAM.COM);
                if (moves.length === 0) {
                    gameOver = true;
                    winner = TEAM.USER;
                    thinking = false;
                    message = '승리!';
                    return;
                }

                let bestScore = -Infinity;
                let bestMove = moves[0];

                for (const move of moves) {
                    const next = applyMove(pieces, move.piece, move.to);
                    const score = minimax(next, 2, -Infinity, Infinity, false);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                }

                lastComMove = {
                    from: { x: bestMove.piece.x, y: bestMove.piece.y },
                    to: bestMove.to
                };

                // 기물 잡기
                const captured = pieces.find(
                    (p) =>
                        p.alive &&
                        p.x === bestMove.to.x &&
                        p.y === bestMove.to.y &&
                        p.team !== TEAM.COM
                );
                if (captured) {
                    captured.alive = false;
                    if (captured.kind === KIND.GUNG) {
                        gameOver = true;
                        winner = TEAM.COM;
                        thinking = false;
                        message = '패배...';
                        pieces = [...pieces];
                        return;
                    }
                }

                bestMove.piece.x = bestMove.to.x;
                bestMove.piece.y = bestMove.to.y;
                pieces = [...pieces];

                if (isCheck(pieces, TEAM.USER)) {
                    message = '장군!';
                } else {
                    message = '';
                }

                turn = TEAM.USER;
                thinking = false;
            }, 100);
        });
    }

    /* ── 클릭 핸들링 ── */
    function handleClick(e: MouseEvent) {
        if (gameOver || thinking) return;
        if (isSingle && turn !== TEAM.USER) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const gx = Math.round((cx - PAD) / CELL);
        const gy = Math.round((cy - PAD) / CELL);

        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

        // 이동 위치 클릭
        if (selected && validMoves.some((m) => m.x === gx && m.y === gy)) {
            const captured = pieces.find(
                (p) => p.alive && p.x === gx && p.y === gy && p.team !== selected!.team
            );
            if (captured) {
                captured.alive = false;
                if (captured.kind === KIND.GUNG) {
                    gameOver = true;
                    winner = selected!.team;
                    message = selected!.team === TEAM.USER ? '승리!' : '패배...';
                }
            }

            selected!.x = gx;
            selected!.y = gy;
            pieces = [...pieces];

            if (!gameOver && isCheck(pieces, turn === TEAM.USER ? TEAM.COM : TEAM.USER)) {
                message = '장군!';
            } else if (!gameOver) {
                message = '';
            }

            selected = null;
            validMoves = [];

            if (!gameOver) {
                turn = turn === TEAM.USER ? TEAM.COM : TEAM.USER;
                if (isSingle && turn === TEAM.COM) {
                    aiMove();
                }
            }
            return;
        }

        // 기물 선택
        const board = getBoard(pieces);
        const clickedPiece = board[gy]?.[gx];
        if (clickedPiece && clickedPiece.team === turn) {
            selected = clickedPiece;
            validMoves = getMoves(clickedPiece, board);
        } else {
            selected = null;
            validMoves = [];
        }
    }

    /* ── 그리기 ── */
    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, W, H);

        // 보드 배경
        ctx.fillStyle = '#D0B48E';
        ctx.fillRect(0, 0, W, H);

        // 그리드 선
        ctx.strokeStyle = '#5C4033';
        ctx.lineWidth = 1;
        for (let r = 0; r < ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(PAD, PAD + r * CELL);
            ctx.lineTo(PAD + (COLS - 1) * CELL, PAD + r * CELL);
            ctx.stroke();
        }
        for (let c = 0; c < COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(PAD + c * CELL, PAD);
            ctx.lineTo(PAD + c * CELL, PAD + (ROWS - 1) * CELL);
            ctx.stroke();
        }

        // 궁성 대각선
        ctx.strokeStyle = '#5C4033';
        ctx.lineWidth = 1;
        // 상단 궁
        ctx.beginPath();
        ctx.moveTo(PAD + 3 * CELL, PAD);
        ctx.lineTo(PAD + 5 * CELL, PAD + 2 * CELL);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(PAD + 5 * CELL, PAD);
        ctx.lineTo(PAD + 3 * CELL, PAD + 2 * CELL);
        ctx.stroke();
        // 하단 궁
        ctx.beginPath();
        ctx.moveTo(PAD + 3 * CELL, PAD + 7 * CELL);
        ctx.lineTo(PAD + 5 * CELL, PAD + 9 * CELL);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(PAD + 5 * CELL, PAD + 7 * CELL);
        ctx.lineTo(PAD + 3 * CELL, PAD + 9 * CELL);
        ctx.stroke();

        // 한강 (河) 표시
        ctx.fillStyle = '#D0B48E';
        ctx.fillRect(PAD + 1, PAD + 4 * CELL + 1, (COLS - 1) * CELL - 2, CELL - 2);
        ctx.font = 'bold 20px serif';
        ctx.fillStyle = '#2E8B57';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('楚', PAD + 2 * CELL, PAD + 4.5 * CELL);
        ctx.fillStyle = '#C41E3A';
        ctx.fillText('漢', PAD + 6 * CELL, PAD + 4.5 * CELL);

        // 컴퓨터 마지막 수 표시
        if (lastComMove) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.fillRect(
                PAD + lastComMove.from.x * CELL - 15,
                PAD + lastComMove.from.y * CELL - 15,
                30,
                30
            );
            ctx.fillRect(
                PAD + lastComMove.to.x * CELL - 15,
                PAD + lastComMove.to.y * CELL - 15,
                30,
                30
            );
        }

        // 이동 가능 위치
        for (const m of validMoves) {
            ctx.fillStyle = 'rgba(0, 128, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(PAD + m.x * CELL, PAD + m.y * CELL, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        // 기물 그리기
        for (const p of pieces) {
            if (!p.alive) continue;
            const px = PAD + p.x * CELL;
            const py = PAD + p.y * CELL;
            const r = pieceRadius(p.kind);

            // 선택 하이라이트
            if (selected === p) {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
                ctx.beginPath();
                ctx.arc(px, py, r + 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // 기물 배경
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
            grad.addColorStop(0, '#FFF8DC');
            grad.addColorStop(1, '#C4A265');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = '#8B6914';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 글자
            ctx.font = `bold ${fontSize(p.kind)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.team === TEAM.USER ? '#2E8B57' : '#C41E3A';
            ctx.fillText(p.text, px, py + 1);
        }
    }

    $effect(() => {
        // 반응형 의존성 트리거
        pieces;
        selected;
        validMoves;
        lastComMove;
        draw();
    });

    /* ── 게임 시작/리셋 ── */
    function startGame() {
        pieces = initPieces();
        selected = null;
        validMoves = [];
        turn = TEAM.USER;
        gameOver = false;
        winner = null;
        thinking = false;
        lastComMove = null;
        message = '';
    }

    function init(_node: HTMLCanvasElement) {
        startGame();
    }
</script>

<div class="flex flex-col items-center gap-4">
    <!-- 모드/컨트롤 -->
    <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm">
            <input type="radio" bind:group={isSingle} value={true} />
            <span>1인 (vs AI)</span>
        </label>
        <label class="flex items-center gap-2 text-sm">
            <input type="radio" bind:group={isSingle} value={false} />
            <span>2인 대전</span>
        </label>
        <button
            onclick={startGame}
            class="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium"
        >
            다시 시작
        </button>
    </div>

    <!-- 상태 표시 -->
    <div class="text-sm font-medium">
        {#if gameOver}
            <span class="text-destructive text-lg font-bold"
                >{winner === TEAM.USER ? '🎉 승리!' : '😢 패배...'}</span
            >
        {:else if thinking}
            <span class="text-muted-foreground animate-pulse">AI 생각 중...</span>
        {:else if message}
            <span class="text-destructive font-bold">{message}</span>
        {:else}
            <span class="text-foreground"
                >{turn === TEAM.USER ? '🟢 초(楚) 차례' : '🔴 한(漢) 차례'}</span
            >
        {/if}
    </div>

    <!-- 캔버스 -->
    <canvas
        bind:this={canvas}
        width={W}
        height={H}
        class="max-w-full cursor-pointer rounded-lg border shadow-md"
        style="aspect-ratio: {W}/{H};"
        onclick={handleClick}
        use:init
    ></canvas>
</div>

<style>
    canvas {
        touch-action: none;
    }
</style>
