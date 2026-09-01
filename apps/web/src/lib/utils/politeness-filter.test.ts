import { describe, expect, it } from 'vitest';

/**
 * 작성 시점 경어체/비속어 넛지 필터 (#politeness-nudge).
 *
 * ⛔ 이 테스트는 **실제 구현을 import 한다.** 로직을 복제하면 구현이 바뀌어도
 *    영원히 초록이 된다(계약이 아니라 계약의 사본을 고정하는 것).
 *
 * checkContent 는 순수함수다. 아래는 "잡아야 하는 것"과 "잡으면 안 되는 것"을
 * 대칭으로 세운 대조군이다 — 한쪽만 통과하면 로직이 진짜로 재지지 않은 것.
 */
import { checkContent } from './politeness-filter';

const politeness = (t: string) => checkContent(t).politeness;
const profanity = (t: string) => checkContent(t).profanity;

describe('C. 부적절한 표현(비속어/초성)', () => {
    it('완성형 비속어를 잡는다', () => {
        expect(profanity('이거 병신 같네')).toBe(true);
        expect(profanity('씨발 진짜')).toBe(true);
        expect(profanity('시발 뭐야')).toBe(true);
        expect(profanity('지랄하네')).toBe(true);
        expect(profanity('닥쳐')).toBe(true);
        expect(profanity('개새끼야')).toBe(true);
    });

    it('존나/졸라(세기 표현)를 잡는다', () => {
        expect(profanity('존나 별로임')).toBe(true);
        expect(profanity('졸라 마음에 안 듦')).toBe(true);
        expect(profanity('조낸 별로')).toBe(true);
    });

    it('초성 조합 비속어를 잡는다', () => {
        expect(profanity('완전 ㅂㅅ 같음')).toBe(true);
        expect(profanity('ㅅㅂ 뭐냐')).toBe(true);
        expect(profanity('ㅈㄹ하고 있네')).toBe(true);
        expect(profanity('ㅁㅊ 진짜')).toBe(true);
        expect(profanity('ㄲㅈ')).toBe(true);
        expect(profanity('ㅄ')).toBe(true);
    });

    it('초성 변형(ㅅ끼·ㅈ만)도 잡는다 — 필수 케이스', () => {
        expect(profanity('ㅈ만한 ㅅ끼')).toBe(true);
    });

    it('⛔ "ㅈ" 단독은 잡지 않는다 (오탐 폭발 방지)', () => {
        expect(profanity('ㅈ 이거 뭐지')).toBe(false);
        expect(profanity('ㅋㅈㅋ')).toBe(false);
    });

    it('⛔ 함정: 졸라매/졸라서(끈)는 비속어가 아니다', () => {
        expect(profanity('끈을 졸라맸어요')).toBe(false);
        expect(profanity('신발끈을 졸라매고 뛰었다')).toBe(false);
        expect(profanity('허리띠를 졸라서 고정했음')).toBe(false);
    });
});

describe('A. 예의없음(반말) 검출', () => {
    it('서술형 반말 종결을 잡는다', () => {
        expect(politeness('이거 완전 좋다')).toBe(true);
        expect(politeness('그건 아니다')).toBe(true);
        expect(politeness('내가 볼때 걍 뭍힐듯 싶다')).toBe(true); // 필수 케이스
        expect(politeness('밥 먹었다')).toBe(true);
    });

    it('의문형 반말을 잡는다', () => {
        expect(politeness('이게 맞냐')).toBe(true);
        expect(politeness('뭐 하니?')).toBe(true);
        expect(politeness('너 밥 먹었어?')).toBe(true);
    });

    it('명령·청유 반말을 잡는다', () => {
        expect(politeness('빨리 해라')).toBe(true);
        expect(politeness('그만 좀 해')).toBe(true);
        expect(politeness('우리 같이 가자')).toBe(true);
    });

    it('기타 반말 어미(네·군·더라·잖아·는데)를 잡는다', () => {
        expect(politeness('생각보다 괜찮네')).toBe(true);
        expect(politeness('완전 크구나')).toBe(true);
        expect(politeness('전에도 그랬더라')).toBe(true);
    });
});

describe('A. 존댓말 마커가 하나라도 있으면 통과', () => {
    it('~요 로 끝나면 통과', () => {
        expect(politeness('이거 정말 좋아요')).toBe(false);
        expect(politeness('그렇게 하면 안 돼요')).toBe(false);
        expect(politeness('감사해요')).toBe(false);
        expect(politeness('맞나요?')).toBe(false);
    });

    it('~ㅂ니다/습니다 면 통과', () => {
        expect(politeness('부탁드립니다')).toBe(false); // 필수 케이스
        expect(politeness('감사합니다')).toBe(false);
        expect(politeness('잘 모르겠습니다')).toBe(false);
        expect(politeness('여기 있습니다')).toBe(false);
    });

    // ── lookbehind → (^|[^아]) 경계그룹 재작성(iOS<16.4) 회귀 방지 ──
    it('합니다 감지는 재작성 후에도 유지(존댓=통과)', () => {
        expect(politeness('합니다')).toBe(false);
    });

    it("'아니다' 는 여전히 반말(존댓 미감지)", () => {
        expect(politeness('그건 아니다')).toBe(true);
    });

    it('문두 니다 는 ^ 경계로 존댓 감지(통과)', () => {
        // '니다'로 시작(앞글자 없음) = 아니다 아님 → 존댓 마커로 인식
        expect(politeness('니다')).toBe(false);
    });

    it('~세요/십시오 면 통과', () => {
        expect(politeness('꼭 확인해 주세요')).toBe(false);
        expect(politeness('여기 앉으십시오')).toBe(false);
    });

    it('죠→져 귀여운 변형(시져 등)은 존댓이라 통과', () => {
        expect(politeness('오늘은 비 안오시져? 설마?요')).toBe(false); // 필수 케이스
        expect(politeness('그러시져')).toBe(false);
        expect(politeness('이거 하져?')).toBe(false);
    });

    it('반말과 존댓이 섞여도 존댓이 하나 있으면 통과', () => {
        expect(politeness('이건 별로다. 그래도 감사합니다')).toBe(false);
    });
});

describe('B. 음슴체/체언 종결 = 중립(flag 안 함)', () => {
    it('~음/~슴/~ㅁ 은 반말로 잡지 않는다', () => {
        expect(politeness('확인했음')).toBe(false); // 필수 케이스
        expect(politeness('이거 좋음')).toBe(false);
        expect(politeness('그냥 그런 것 같음')).toBe(false);
        expect(politeness('다녀왔슴')).toBe(false);
        expect(politeness('내 생각임')).toBe(false);
    });

    it('~듯/~것/~중/~예정/~완료 는 중립', () => {
        expect(politeness('비가 올 듯')).toBe(false);
        expect(politeness('먹고 있는 중')).toBe(false);
        expect(politeness('내일 방문 예정')).toBe(false);
        expect(politeness('업로드 완료')).toBe(false);
    });

    it('음슴체지만 비속어가 있으면 profanity 는 잡되 politeness 는 중립', () => {
        const r = checkContent('존나 별로임');
        expect(r.profanity).toBe(true);
        expect(r.politeness).toBe(false);
    });
});

describe('D. 예외(최우선)', () => {
    it('① 이미지/앙티콘 단독 — 텍스트 없으면 skip (도메인 무관)', () => {
        expect(
            checkContent('<img src="https://damoang.net/emoticons/ang-1.webp" alt="이모티콘">')
        ).toEqual({
            politeness: false,
            profanity: false
        });
        expect(
            checkContent('<img src="https://r2.damoang.net/data/editor/2026/photo.jpg">')
        ).toEqual({ politeness: false, profanity: false });
        // 이미지 + 존댓 텍스트 → 통과(반말 아님)
        expect(politeness('<img src="https://r2.damoang.net/data/editor/x.jpg"> 감사합니다')).toBe(
            false
        );
    });

    it('② 인용문(blockquote)은 검사에서 제외 — 남의 반말/욕은 넛지 대상 아님', () => {
        // 필수 케이스: 인용은 제외, 뒤의 "감사합니다"만 본다
        expect(checkContent('<blockquote>남의 반말 인용</blockquote> 감사합니다')).toEqual({
            politeness: false,
            profanity: false
        });
        // 인용 안의 욕은 내 표현이 아니다
        expect(profanity('<blockquote>씨발 이라고 하더라</blockquote> 그렇군요')).toBe(false);
        // 줄앞 > 인용 라인도 제외
        expect(politeness('> 저건 병신같다\n좋은 지적이네요')).toBe(false);
        expect(profanity('> 씨발\n감사합니다')).toBe(false);
    });

    it('③ 짧은 감탄사/자모 단독은 skip', () => {
        expect(checkContent('ㅋㅋ')).toEqual({ politeness: false, profanity: false }); // 필수
        expect(checkContent('ㅎㅎㅎ')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('ㄷㄷ')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('와')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('헐')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('ㅠㅠ')).toEqual({ politeness: false, profanity: false });
    });

    it('⑤ 링크/#태그/숫자만이면 skip', () => {
        expect(checkContent('https://example.com/foo')).toEqual({
            politeness: false,
            profanity: false
        });
        expect(checkContent('#태그 #모음')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('12345')).toEqual({ politeness: false, profanity: false });
    });
});

describe('종합 / 필수 대조군', () => {
    it('잡아야 하는 것', () => {
        expect(checkContent('ㅈ만한 ㅅ끼').profanity).toBe(true);
        expect(checkContent('존나 별로임').profanity).toBe(true);
        expect(checkContent('내가 볼때 걍 뭍힐듯 싶다').politeness).toBe(true);
    });

    it('잡으면 안 되는 것', () => {
        expect(checkContent('부탁드립니다')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('확인했음')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('ㅋㅋ')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('끈을 졸라맸어요')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('<blockquote>남의 반말 인용</blockquote> 감사합니다')).toEqual({
            politeness: false,
            profanity: false
        });
    });

    it('빈 입력/공백은 아무것도 잡지 않는다', () => {
        expect(checkContent('')).toEqual({ politeness: false, profanity: false });
        expect(checkContent('   \n  ')).toEqual({ politeness: false, profanity: false });
    });

    it('순수함수 — 같은 입력은 항상 같은 결과', () => {
        const t = '내가 볼때 걍 뭍힐듯 싶다';
        expect(checkContent(t)).toEqual(checkContent(t));
    });
});

describe('튜닝 — 실데이터 600건 FP 대응 (Evaluator 피드백)', () => {
    it('1) 단독 "새끼"(동물/신체) 오탐 제거 — 사람 지칭 조합만 잡는다', () => {
        // 잡으면 안 됨
        expect(profanity('강아지 새끼가 너무 귀여워요')).toBe(false);
        expect(profanity('고양이 새끼 세 마리')).toBe(false);
        expect(profanity('새끼손가락 다쳤어요')).toBe(false);
        // 여전히 잡아야 함
        expect(profanity('개새끼야')).toBe(true);
        expect(profanity('이새끼 진짜')).toBe(true);
        expect(profanity('저새끼 뭐냐')).toBe(true);
    });

    it('2) 요→여 / 니다→미다 오타를 존댓으로 흡수 (문장 끝)', () => {
        expect(politeness('그러네여')).toBe(false);
        expect(politeness('이거 맞나 인가여')).toBe(false);
        expect(politeness('저도 같아여')).toBe(false);
        expect(politeness('감사합미다')).toBe(false);
        expect(politeness('여기 있습미다')).toBe(false);
    });

    it('3) 혼합문 — 존댓 마커가 하나라도 있으면 전역으로 통과', () => {
        expect(politeness('잘 모르겠군요 진작 나왔어야지')).toBe(false);
        expect(politeness('그거 하는거죠 근데 깠으니 어쩔')).toBe(false);
        expect(politeness('좋네요 근데 별로다')).toBe(false);
        expect(politeness('맞을까요 아닐수도 있지')).toBe(false);
    });

    it('유지 — 진짜 반말은 그대로 잡는다 (과교정 금지)', () => {
        expect(politeness('표을 줄수가 없다')).toBe(true);
        expect(politeness('보장이 없다')).toBe(true);
        expect(politeness('볼거 같다')).toBe(true);
        expect(politeness('이랜다')).toBe(true);
    });
});
