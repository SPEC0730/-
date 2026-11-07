/*
 * Stage 3: real-life story problems (30 levels, >= 2 parameterized templates
 * each). Levels 1-15 focus on addition/subtraction, 16-30 introduce
 * multiplication/division. The arithmetic formula is never part of the text.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).Stories = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function ri(rng, lo, hi, step) {
    step = step || 1;
    const n = Math.floor((hi - lo) / step);
    return lo + step * Math.floor(rng() * (n + 1));
  }
  function pk(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  // Each template returns { text, answer, unit, icon, kind } where kind is
  // only internal metadata (never shown).
  const LEVELS = [
    // ---------- 1-15: addition / subtraction ----------
    {
      name: '사탕과 풍선 모으기',
      templates: [
        (g) => {
          const a = ri(g, 3, 15), b = ri(g, 2, 12);
          return { icon: '🍬', unit: '개', answer: a + b, text: `사탕 ${a}개가 있어요. 친구가 사탕 ${b}개를 더 주었어요. 사탕은 모두 몇 개일까요?` };
        },
        (g) => {
          const a = ri(g, 4, 18), b = ri(g, 3, 15);
          return { icon: '🎈', unit: '개', answer: a + b, text: `빨간 풍선 ${a}개와 파란 풍선 ${b}개가 있어요. 풍선은 모두 몇 개일까요?` };
        },
      ],
    },
    {
      name: '먹고 남은 것',
      templates: [
        (g) => {
          const a = ri(g, 10, 30), b = ri(g, 2, a - 2);
          return { icon: '🍪', unit: '개', answer: a - b, text: `쿠키 ${a}개 중에서 ${b}개를 먹었어요. 남은 쿠키는 몇 개일까요?` };
        },
        (g) => {
          const a = ri(g, 12, 36), b = ri(g, 3, a - 3);
          return { icon: '✏️', unit: '자루', answer: a - b, text: `연필 ${a}자루 중에서 동생에게 ${b}자루를 주었어요. 남은 연필은 몇 자루일까요?` };
        },
      ],
    },
    {
      name: '용돈 받기',
      templates: [
        (g) => {
          const a = ri(g, 500, 5000, 100), b = ri(g, 1000, 10000, 500);
          return { icon: '💰', unit: '원', answer: a + b, text: `지갑에 ${a}원이 있어요. 할머니께 용돈 ${b}원을 받았어요. 이제 지갑에는 모두 얼마가 있을까요?` };
        },
        (g) => {
          const a = ri(g, 1200, 8000, 100), b = ri(g, 500, 3000, 100);
          return { icon: '🐷', unit: '원', answer: a + b, text: `저금통에 ${a}원이 있었어요. 오늘 ${b}원을 더 넣었어요. 저금통에는 모두 얼마가 있을까요?` };
        },
      ],
    },
    {
      name: '과자 사고 남은 돈',
      templates: [
        (g) => {
          const a = pk(g, [1000, 2000, 3000, 5000]), b = ri(g, 300, a - 100, 100);
          return { icon: '🍫', unit: '원', answer: a - b, text: `${a}원을 가지고 가게에 갔어요. ${b}원짜리 과자를 샀어요. 남은 돈은 얼마일까요?` };
        },
        (g) => {
          const a = pk(g, [2000, 5000, 10000]), b = ri(g, 800, 1900, 100);
          return { icon: '🥤', unit: '원', answer: a - b, text: `${b}원짜리 음료수를 사고 ${a}원을 냈어요. 거스름돈은 얼마일까요?` };
        },
      ],
    },
    {
      name: '물건 두 개 사기',
      templates: [
        (g) => {
          const x = ri(g, 1200, 2500, 100), y = ri(g, 1500, 4500, 100);
          return { icon: '🥛', unit: '원', answer: x + y, text: `${x}원짜리 우유와 ${y}원짜리 빵을 샀어요. 모두 얼마를 내야 할까요?` };
        },
        (g) => {
          const x = ri(g, 800, 3000, 100), y = ri(g, 300, 1200, 100);
          return { icon: '📒', unit: '원', answer: x + y, text: `공책은 ${x}원이고 지우개는 ${y}원이에요. 둘 다 사면 모두 얼마일까요?` };
        },
      ],
    },
    {
      name: '사람이 더 와요',
      templates: [
        (g) => {
          const a = ri(g, 8, 30), b = ri(g, 3, 15);
          return { icon: '🚌', unit: '명', answer: a + b, text: `버스에 ${a}명이 타고 있었어요. 정류장에서 ${b}명이 더 탔어요. 버스에는 모두 몇 명이 있을까요?` };
        },
        (g) => {
          const a = ri(g, 9, 16), b = ri(g, 8, 16);
          return { icon: '🏫', unit: '명', answer: a + b, text: `교실에 남학생 ${a}명과 여학생 ${b}명이 있어요. 교실에는 모두 몇 명이 있을까요?` };
        },
      ],
    },
    {
      name: '사람이 떠나요',
      templates: [
        (g) => {
          const a = ri(g, 15, 40), b = ri(g, 3, a - 4);
          return { icon: '🚏', unit: '명', answer: a - b, text: `버스에 ${a}명이 있었어요. 정류장에서 ${b}명이 내렸어요. 버스에 남은 사람은 몇 명일까요?` };
        },
        (g) => {
          const a = ri(g, 10, 25), b = ri(g, 2, a - 3);
          return { icon: '🛝', unit: '명', answer: a - b, text: `놀이터에서 친구 ${a}명이 놀고 있었어요. 그중 ${b}명이 집에 갔어요. 놀이터에 남은 친구는 몇 명일까요?` };
        },
      ],
    },
    {
      name: '책 읽기',
      templates: [
        (g) => {
          const a = ri(g, 60, 240, 2), b = ri(g, 15, a - 20);
          return { icon: '📖', unit: '쪽', answer: a - b, text: `책이 모두 ${a}쪽이에요. 지금까지 ${b}쪽을 읽었어요. 다 읽으려면 몇 쪽을 더 읽어야 할까요?` };
        },
        (g) => {
          const a = ri(g, 20, 60), b = ri(g, 30, 120);
          return { icon: '📚', unit: '쪽', answer: a + b, text: `오늘 그림책 ${a}쪽과 동화책 ${b}쪽을 읽었어요. 오늘 읽은 책은 모두 몇 쪽일까요?` };
        },
      ],
    },
    {
      name: '세 가지 사기',
      templates: [
        (g) => {
          const x = ri(g, 2500, 4500, 500), y = ri(g, 3000, 5000, 500), z = ri(g, 1000, 2000, 100);
          return { icon: '🍙', unit: '원', answer: x + y + z, text: `분식집에서 김밥 ${x}원, 라면 ${y}원, 주스 ${z}원어치를 샀어요. 모두 얼마일까요?` };
        },
        (g) => {
          const x = ri(g, 500, 1500, 100), y = ri(g, 600, 1200, 100), z = ri(g, 1500, 3000, 100);
          return { icon: '✂️', unit: '원', answer: x + y + z, text: `문구점에서 색종이 ${x}원, 풀 ${y}원, 가위 ${z}원짜리를 하나씩 샀어요. 모두 얼마일까요?` };
        },
      ],
    },
    {
      name: '끈 길이',
      templates: [
        (g) => {
          const a = ri(g, 25, 90), b = ri(g, 15, 80);
          return { icon: '🧶', unit: 'cm', answer: a + b, text: `빨간 끈은 ${a}cm이고 파란 끈은 ${b}cm예요. 두 끈을 이으면 모두 몇 cm일까요?` };
        },
        (g) => {
          const a = ri(g, 100, 200), b = ri(g, 20, a - 30);
          return { icon: '🎀', unit: 'cm', answer: a - b, text: `리본 ${a}cm 중에서 ${b}cm를 잘라서 선물을 묶었어요. 남은 리본은 몇 cm일까요?` };
        },
      ],
    },
    {
      name: '시간 계산',
      templates: [
        (g) => {
          const a = ri(g, 15, 50, 5), b = ri(g, 10, 40, 5);
          return { icon: '⏰', unit: '분', answer: a + b, text: `숙제를 ${a}분 동안 하고, 책을 ${b}분 동안 읽었어요. 모두 몇 분 동안 했을까요?` };
        },
        (g) => {
          const a = ri(g, 90, 130), b = ri(g, 20, a - 15);
          return { icon: '🎬', unit: '분', answer: a - b, text: `영화는 모두 ${a}분이에요. 지금까지 ${b}분을 보았어요. 영화가 끝나려면 몇 분이 남았을까요?` };
        },
      ],
    },
    {
      name: '얼마나 더 많을까',
      templates: [
        (g) => {
          const b = ri(g, 10, 40), a = b + ri(g, 5, 30);
          return { icon: '🃏', unit: '장', answer: a - b, text: `형은 딱지를 ${a}장 가지고 있고, 나는 ${b}장 가지고 있어요. 형은 나보다 몇 장 더 많을까요?` };
        },
        (g) => {
          const a = ri(g, 1000, 2500, 100), b = a + ri(g, 300, 2000, 100);
          return { icon: '🍐', unit: '원', answer: b - a, text: `사과는 한 개에 ${a}원이고, 배는 한 개에 ${b}원이에요. 배는 사과보다 얼마 더 비쌀까요?` };
        },
      ],
    },
    {
      name: '받고 쓰기',
      templates: [
        (g) => {
          const a = ri(g, 1000, 5000, 100), b = ri(g, 2000, 10000, 1000), c = ri(g, 1500, a + b - 500, 100);
          return { icon: '👛', unit: '원', answer: a + b - c, text: `지갑에 ${a}원이 있었어요. 용돈 ${b}원을 받고, ${c}원짜리 책을 샀어요. 남은 돈은 얼마일까요?` };
        },
        (g) => {
          const a = ri(g, 3000, 9000, 100), b = ri(g, 500, 3000, 100), c = ri(g, 1000, a, 100);
          return { icon: '🐷', unit: '원', answer: a + b - c, text: `저금통에 ${a}원이 있었어요. ${b}원을 더 넣고, ${c}원을 꺼내서 썼어요. 저금통에는 얼마가 남았을까요?` };
        },
      ],
    },
    {
      name: '마트에서 장보기',
      templates: [
        (g) => {
          const x = ri(g, 3000, 9000, 100), y = ri(g, 5000, 15000, 100);
          const pay = Math.ceil((x + y + 1) / 10000) * 10000;
          return { icon: '🛒', unit: '원', answer: pay - x - y, text: `마트에서 ${x}원짜리 과일과 ${y}원짜리 고기를 사고 ${pay}원을 냈어요. 거스름돈은 얼마일까요?` };
        },
        (g) => {
          const x = ri(g, 25000, 45000, 1000), y = ri(g, 2000, 5000, 500);
          const pay = Math.ceil((x + y + 1) / 10000) * 10000;
          return { icon: '👟', unit: '원', answer: pay - x - y, text: `${x}원짜리 운동화와 ${y}원짜리 양말을 사고 ${pay}원을 냈어요. 거스름돈은 얼마일까요?` };
        },
      ],
    },
    {
      name: '가게 물건 세기',
      templates: [
        (g) => {
          const a = ri(g, 80, 200), b = ri(g, 20, 70), c = ri(g, 30, 90);
          return { icon: '🏪', unit: '개', answer: a - b + c, text: `가게에 사탕이 ${a}개 있었어요. 오전에 ${b}개를 팔고, 오후에 ${c}개를 새로 들여왔어요. 지금 가게에 사탕은 몇 개일까요?` };
        },
        (g) => {
          const a = ri(g, 150, 400), b = ri(g, 20, 80), c = ri(g, 10, 60);
          return { icon: '🏛️', unit: '권', answer: a - b + c, text: `도서관에 동화책이 ${a}권 있었어요. 사람들이 ${b}권을 빌려 가고, ${c}권을 돌려주었어요. 지금 도서관에 동화책은 몇 권일까요?` };
        },
      ],
    },
    // ---------- 16-30: multiplication / division ----------
    {
      name: '친구들에게 나누어 주기',
      templates: [
        (g) => {
          const n = ri(g, 3, 9), k = ri(g, 2, 6);
          return { icon: '🍭', unit: '개', answer: n * k, text: `친구 ${n}명에게 사탕을 ${k}개씩 주었어요. 친구들에게 준 사탕은 모두 몇 개일까요?` };
        },
        (g) => {
          const n = ri(g, 3, 8), k = ri(g, 4, 9);
          return { icon: '🍓', unit: '개', answer: n * k, text: `접시 ${n}개에 딸기를 ${k}개씩 담았어요. 접시에 담은 딸기는 모두 몇 개일까요?` };
        },
      ],
    },
    {
      name: '공책 여러 권 사기',
      templates: [
        (g) => {
          const p = ri(g, 800, 2500, 100), n = ri(g, 3, 8);
          return { icon: '📓', unit: '원', answer: p * n, text: `한 권에 ${p}원인 공책을 ${n}권 샀어요. 모두 얼마일까요?` };
        },
        (g) => {
          const p = ri(g, 300, 900, 50), n = ri(g, 4, 12);
          return { icon: '✏️', unit: '원', answer: p * n, text: `한 자루에 ${p}원인 연필을 ${n}자루 샀어요. 모두 얼마일까요?` };
        },
      ],
    },
    {
      name: '표 사기',
      templates: [
        (g) => {
          const p = ri(g, 8000, 25000, 500), n = ri(g, 3, 6);
          return { icon: '🎡', unit: '원', answer: p * n, text: `놀이공원 표는 한 장에 ${p}원이에요. 우리 가족 ${n}명의 표를 사면 모두 얼마일까요?` };
        },
        (g) => {
          const p = ri(g, 7000, 14000, 500), n = ri(g, 2, 7);
          return { icon: '🎟️', unit: '원', answer: p * n, text: `영화표는 한 장에 ${p}원이에요. 영화표를 ${n}장 사면 모두 얼마일까요?` };
        },
      ],
    },
    {
      name: '똑같이 나누기',
      templates: [
        (g) => {
          const f = ri(g, 1, 5), n = f + 1, each = ri(g, 2, 9);
          return { icon: '🍬', unit: '개', answer: each, text: `사탕 ${each * n}개를 나와 친구 ${f}명이 똑같이 나누어 가지려고 해요. 나까지 모두 ${n}명이에요. 한 명이 몇 개씩 가질까요?` };
        },
        (g) => {
          const f = ri(g, 1, 3), n = f + 1, each = ri(g, 2, 4);
          return { icon: '🍕', unit: '조각', answer: each, text: `피자 ${each * n}조각을 나와 친구 ${f}명이 똑같이 나누어 먹어요. 나까지 모두 ${n}명이에요. 한 명이 몇 조각씩 먹을까요?` };
        },
      ],
    },
    {
      name: '묶음 만들기',
      templates: [
        (g) => {
          const k = ri(g, 4, 12), bags = ri(g, 3, 9);
          return { icon: '🔮', unit: '개', answer: bags, text: `구슬 ${k * bags}개를 한 봉지에 ${k}개씩 담으려고 해요. 봉지는 몇 개 필요할까요?` };
        },
        (g) => {
          const k = ri(g, 3, 6), groups = ri(g, 4, 8);
          return { icon: '👫', unit: '모둠', answer: groups, text: `학생 ${k * groups}명이 한 모둠에 ${k}명씩 모여 앉아요. 모둠은 모두 몇 모둠이 될까요?` };
        },
      ],
    },
    {
      name: '돈을 나누어 내기',
      templates: [
        (g) => {
          const n = ri(g, 2, 6), each = ri(g, 1500, 6000, 500);
          return { icon: '🎁', unit: '원', answer: each, text: `친구 생일 선물이 ${each * n}원이에요. 나를 포함해서 모두 ${n}명이 똑같이 나누어 내기로 했어요. 한 명이 얼마씩 내면 될까요?` };
        },
        (g) => {
          const n = ri(g, 2, 4), each = ri(g, 2000, 7000, 500);
          return { icon: '🚕', unit: '원', answer: each, text: `택시비가 ${each * n}원 나왔어요. 택시에 탄 ${n}명이 똑같이 나누어 내요. 한 명이 얼마씩 낼까요?` };
        },
      ],
    },
    {
      name: '매일 꾸준히',
      templates: [
        (g) => {
          const m = ri(g, 5, 20, 5), d = ri(g, 3, 14);
          return { icon: '🤸', unit: '분', answer: m * d, text: `하루에 줄넘기를 ${m}분씩 해요. ${d}일 동안 하면 줄넘기를 모두 몇 분 하게 될까요?` };
        },
        (g) => {
          const p = ri(g, 6, 25), d = ri(g, 4, 10);
          return { icon: '📘', unit: '쪽', answer: p * d, text: `하루에 책을 ${p}쪽씩 읽어요. ${d}일 동안 읽으면 모두 몇 쪽을 읽을까요?` };
        },
      ],
    },
    {
      name: '길이 나누기',
      templates: [
        (g) => {
          const k = ri(g, 8, 25), pieces = ri(g, 3, 9);
          return { icon: '🎀', unit: '개', answer: pieces, text: `리본 ${k * pieces}cm를 ${k}cm씩 잘라요. 잘린 리본은 몇 개가 될까요?` };
        },
        (g) => {
          const n = ri(g, 2, 6), each = ri(g, 12, 40);
          return { icon: '🧵', unit: 'cm', answer: each, text: `털실 ${each * n}cm를 ${n}명이 똑같이 나누어 가져요. 한 명이 몇 cm씩 가질까요?` };
        },
      ],
    },
    {
      name: '상자 속 개수',
      templates: [
        (g) => {
          const k = pk(g, [6, 10, 12, 15, 30]), n = ri(g, 2, 9);
          return { icon: '🥚', unit: '개', answer: k * n, text: `한 판에 달걀이 ${k}개씩 들어 있어요. ${n}판에 들어 있는 달걀은 모두 몇 개일까요?` };
        },
        (g) => {
          const k = pk(g, [12, 18, 24, 36]), n = ri(g, 2, 6);
          return { icon: '🖍️', unit: '자루', answer: k * n, text: `한 상자에 색연필이 ${k}자루씩 들어 있어요. ${n}상자에 들어 있는 색연필은 모두 몇 자루일까요?` };
        },
      ],
    },
    {
      name: '용돈 모으기',
      templates: [
        (g) => {
          const p = ri(g, 2000, 10000, 500), w = ri(g, 2, 8);
          return { icon: '🗓️', unit: '원', answer: p * w, text: `일주일에 용돈을 ${p}원씩 받아요. ${w}주 동안 하나도 쓰지 않고 모으면 모두 얼마일까요?` };
        },
        (g) => {
          const p = ri(g, 300, 1500, 100), d = ri(g, 5, 20);
          return { icon: '🐷', unit: '원', answer: p * d, text: `매일 ${p}원씩 저금해요. ${d}일 동안 저금하면 모두 얼마일까요?` };
        },
      ],
    },
    {
      name: '여러 개 사고 거스름돈',
      templates: [
        (g) => {
          const p = ri(g, 700, 1800, 100), n = ri(g, 2, 5);
          const pay = Math.ceil((p * n + 1) / 5000) * 5000;
          return { icon: '🍦', unit: '원', answer: pay - p * n, text: `한 개에 ${p}원인 아이스크림을 ${n}개 사고 ${pay}원을 냈어요. 거스름돈은 얼마일까요?` };
        },
        (g) => {
          const p = ri(g, 900, 2500, 100), n = ri(g, 3, 6);
          const pay = Math.ceil((p * n + 1) / 10000) * 10000;
          return { icon: '📒', unit: '원', answer: pay - p * n, text: `한 권에 ${p}원인 공책을 ${n}권 사고 ${pay}원을 냈어요. 거스름돈은 얼마일까요?` };
        },
      ],
    },
    {
      name: '똑같이 받기',
      templates: [
        (g) => {
          const n = ri(g, 2, 5), each = ri(g, 5000, 20000, 1000);
          return { icon: '🧧', unit: '원', answer: each, text: `할머니께서 손주 ${n}명에게 용돈 ${each * n}원을 똑같이 나누어 주셨어요. 손주 한 명이 얼마씩 받을까요?` };
        },
        (g) => {
          const n = ri(g, 3, 8), each = ri(g, 18, 30);
          return { icon: '🥛', unit: '개', answer: each, text: `학교에 우유 ${each * n}개가 왔어요. ${n}개 반에 똑같이 나누어 주면 한 반에 몇 개씩 줄 수 있을까요?` };
        },
      ],
    },
    {
      name: '사고 더하기',
      templates: [
        (g) => {
          const p = ri(g, 2500, 4000, 500), n = ri(g, 2, 5), q = ri(g, 1000, 2000, 100);
          return { icon: '🍙', unit: '원', answer: p * n + q, text: `한 줄에 ${p}원인 김밥 ${n}줄과 ${q}원짜리 음료수 1개를 샀어요. 모두 얼마일까요?` };
        },
        (g) => {
          const k = ri(g, 6, 12), n = ri(g, 3, 8), e = ri(g, 2, 10);
          return { icon: '🪑', unit: '개', answer: k * n + e, text: `강당에 의자가 한 줄에 ${k}개씩 ${n}줄 놓여 있어요. 의자 ${e}개를 더 가져왔어요. 의자는 모두 몇 개일까요?` };
        },
      ],
    },
    {
      name: '똑같이 담기',
      templates: [
        (g) => {
          const n = ri(g, 3, 6), each = ri(g, 10, 25, 5);
          return { icon: '⏱️', unit: '분', answer: each, text: `${each * n}분 동안 놀이 ${n}가지를 똑같은 시간씩 하려고 해요. 놀이 하나를 몇 분씩 하면 될까요?` };
        },
        (g) => {
          const n = ri(g, 3, 8), each = ri(g, 100, 300, 50);
          return { icon: '💧', unit: 'mL', answer: each, text: `물 ${each * n}mL를 컵 ${n}개에 똑같이 나누어 담아요. 컵 하나에 물을 몇 mL씩 담을까요?` };
        },
      ],
    },
    {
      name: '모험가의 계획',
      templates: [
        (g) => {
          const p = ri(g, 1500, 4000, 500), n = ri(g, 2, 5);
          const have = Math.ceil((p * n + 1000) / 5000) * 5000;
          return { icon: '🎫', unit: '원', answer: have - p * n, text: `지갑에 ${have}원이 있어요. 한 장에 ${p}원인 표를 ${n}장 사면 남는 돈은 얼마일까요?` };
        },
        (g) => {
          const f = ri(g, 2, 4), n = f + 1, each = ri(g, 4, 9), e = ri(g, 1, each - 1);
          return { icon: '🍬', unit: '개', answer: each - e, text: `사탕 ${each * n}개를 나와 친구 ${f}명이 똑같이 나누었어요. 나까지 모두 ${n}명이에요. 나는 내 사탕 중에서 ${e}개를 먹었어요. 나에게 남은 사탕은 몇 개일까요?` };
        },
      ],
    },
  ];

  let serial = 0;
  function generate(levelIndex, state, rng) {
    rng = rng || Math.random;
    state = state || {};
    const level = LEVELS[levelIndex];
    let q;
    for (let attempt = 0; attempt < 30; attempt++) {
      const tIndex = Math.floor(rng() * level.templates.length);
      const built = level.templates[tIndex](rng);
      const key = tIndex + '|' + built.text;
      if (key !== state.lastKey || attempt === 29) {
        q = Object.assign({ id: 's' + ++serial, key, template: tIndex }, built);
        break;
      }
    }
    state.lastKey = q.key;
    return q;
  }

  return { LEVELS, generate };
});
