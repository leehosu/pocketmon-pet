# 포켓몬 데스크톱 마스콧 — 설계 스펙

작성일: 2026-08-16

## 개요

데스크톱 화면에 떠다니는 8비트 포켓몬 마스콧. Claude Code로 코딩할수록
경험치가 쌓여 레벨업·진화한다. codex-pets.net 컨셉을 참고하되, 골드버전
스타팅 3종 + 피카츄 라인으로 로스터를 한정한 개인용 데스크톱 앱.

## 포지셔닝 (차별화)

이 앱은 "뽑기 카탈로그"가 아니라 **화면에 살아 움직이는 육성 버디**다. 유사
레퍼런스(POKETOKENBAR: 328종 리세마라 가챠 카탈로그)와 소재만 겹치고 코어
경험이 다르다 — 우리는 **1마리를 영구히 키우는 다마고치형 데스크톱 컴패니언**이며,
차별점은 (1) 화면을 돌아다니는 **살아있는 모션**, (2) 코딩 활동에 반응하는
**활동 연동 애니메이션**(바쁠 때 달리기/기술), (3) 진화 연출, (4) 치팅 방지.
첫 스타터 지정은 "가챠 뽑기"가 아니라 **"버디와의 첫 만남"**으로 연출한다(1회성 영구).

## 모션 / 애니메이션 (핵심 차별화)

펫은 평상시에도 정지해 있지 않고 살아 움직인다. 애니메이션 상태 머신:

- **idle** — 숨쉬기/눈 깜빡, 가끔 작은 폴짝. 제자리.
- **walk** — 가끔 화면을 어슬렁 이동(창이 천천히 수평 드리프트).
- **run** — Claude Code가 프롬프트 처리 중(바쁨)일 때 신나게 달리기.
- **skill(기술)** — 도구 사용(PostToolUse) 순간 짧은 "기술 쓰기" 연출.
- **react** — 레벨업/진화 순간의 강한 팝 연출.

**활동 감지**: Claude Code hook으로 상태를 만든다 — `UserPromptSubmit`→busy 시작
(run), `Stop`→busy 종료(idle/walk 복귀), `PostToolUse`→skill 1회 트리거,
`SessionStart`→등장 인사. 상태 우선순위: react > skill(전이) > run(busy) > walk > idle.

## 목표 (MVP)

- 최초 1회 랜덤 스타터 지정 (영구·재설치 유지) + 뽑기 연출
- Claude Code Hook 실시간 반응 + 세션 로그 파싱으로 XP 성장/레벨업
- 진화 (1→2→3단계)
- 투명·항상 위 플로팅 데스크톱 마스콧
- 우클릭 상태창/설정 메뉴
- 8비트 픽셀 아트 스프라이트 (코드로 직접 제작)

## 비목표 (다음 버전)

- 대결(배틀) 시스템
- 추가 뽑기 / 컬렉션(보유목록)
- 멀티 포켓몬 동시 보유

## 로스터

| 뽑기 대상 | 1단계 | 2단계 | 3단계 | 진화 레벨 |
|---|---|---|---|---|
| 🌿 풀 | 치코리타 | 베이리프 | 메가니움 | 16 / 32 |
| 🔥 불 | 브케인 | 마그케인 | 블레이범 | 16 / 36 |
| 💧 물 | 리아코 | 엘리게이 | 장크로다일 | 18 / 30 |
| ⚡ 전기 | 피츄 | 피카츄 | 라이츄 | 10 / 25 |

- 스타터는 항상 1단계에서 시작.
- 진화 레벨은 상수로 분리해 튜닝 가능(위 값은 초기 기본값).

## 기술 스택

- **Electron** — 투명 창 + always-on-top + 로컬 파일 접근 + canvas 렌더링.
- **픽셀 아트**: 외부 PNG 없이 JS 2D 색상 매트릭스(팔레트 인덱스 그리드)로
  스프라이트 정의. canvas에 `imageSmoothingEnabled=false`로 확대 렌더.
- **애니메이션**: 프레임 배열(idle 깜빡임, 반응 시 점프).

## 컴포넌트 (독립 단위)

1. **hook/** — Claude Code에 설치하는 훅 스크립트.
   - `SessionStart`, `PostToolUse` 이벤트를 `~/.pocketmon/events.jsonl`에 append.
   - 각 이벤트에 고유 id 포함(dedup용).
   - 입력: Claude Code hook stdin(JSON). 출력: jsonl 라인 append. 의존: 없음(순수 파일 쓰기).

2. **xp-engine** — 순수 로직(테스트 가능).
   - 입력: 이벤트 목록 + 현재 세이브 상태.
   - 출력: 갱신된 XP / 레벨 / 진화단계.
   - 규칙: Hook 이벤트당 소량 XP, 세션 로그 토큰량 기반 XP(일일 상한).
   - 레벨업 필요 XP: `100 * level^1.5` (상수 분리).

3. **session-parser** — `~/.claude/projects/**/*.jsonl` 주기 파싱.
   - 입력: 세션 로그 파일. 출력: 정규화된 XP 이벤트(토큰량 기반).
   - 이벤트 id로 hook 이벤트와 dedup.

4. **sprites** — 8비트 픽셀 데이터 + 팔레트 + 프레임 애니메이션.
   - 12개 스프라이트(4라인 × 3단계). 우선순위: 1·2단계 먼저, 3단계 이어붙임.

5. **pet-window** — 투명 플로팅 렌더링 & 상호작용.
   - idle 애니메이션, XP 유입 시 반응 애니메이션, 드래그 이동.
   - **평상시에는 스프라이트만** 보인다. 마우스 hover 시 XP바+간단 상태(종/레벨)
     페이드인, 클릭 시 상세 상태창(누적 XP·다음 레벨까지·진화단계)이 pin되어 유지
     (재클릭 해제). HUD는 idle에 노출되지 않아 화면을 깔끔하게 유지.
   - 우클릭(트레이) → 상태/뽑기연출/설정/종료.

6. **store** — `~/.pocketmon/save.json` 로드/저장.
   - 스키마: `{ species, stage, level, xp, lastActiveAt, locked, rolledAt }`.
   - 홈 디렉터리에 저장 → 앱 재설치와 무관하게 유지.

## 데이터 흐름

```
Claude Code ──hook──> ~/.pocketmon/events.jsonl ─┐
                                                  ├─> xp-engine ─> save.json ─> pet-window
~/.claude/projects/**/*.jsonl ──session-parser───┘
```

- pet-window가 `events.jsonl`을 파일 감시(watch)해 실시간 반응.
- session-parser는 주기(예: 60초)로 세션 로그를 훑어 XP 보정.
- xp-engine이 레벨업/진화 판정 → save.json 갱신 → 스프라이트 교체.

## 뽑기(가챠) 규칙

- 최초 실행 & `save.json` 없음 → 4종 중 랜덤 1종 뽑아 `locked: true`로 저장.
- 이후 "뽑기"는 연출만 재생하고 항상 잠긴 스타터를 반환(재추첨 불가).
- 초기화: 사용자가 `~/.pocketmon/save.json`을 직접 삭제해야 함.

## 무결성 / 치팅 방지 (tamper-evident)

로컬 데스크톱 앱은 세이브 파일이 사용자 디스크에 있어 "절대 조작 불가"를
물리적으로 보장할 수 없다(완전 방지는 서버 권위 계산이 필요 — 다음 버전).
대신 **조작하면 감지되어 무효화되는(tamper-evident)** 가장 강한 로컬 방어를 둔다.

1. **레벨·진화단계는 저장 authority가 아니다** — 항상 XP에서 재계산
   (`levelForXp`, `stageForLevel`). 로드 시에도 재계산해 저장된 값을 덮어쓴다.
   → save 파일의 `level`/`stage`를 고쳐도 무시됨(독립 조작 불가).
2. **XP는 실제 Claude Code 세션 로그에서만 파생** + 이벤트 id dedup + 일일 상한.
   XP를 직접 설정하는 메뉴/API는 존재하지 않는다.
3. **save.json HMAC 서명** — `{ data, sig }` 형태로 저장. 로드 시 서명 검증,
   불일치(수기 편집)면 조작으로 간주해 **안전 초기화**(defaultState, 재추첨).
   조작 시 진행도 손실이 억지력이 된다.
4. **hook 이벤트 서명** — 각 이벤트에 HMAC `sig` 포함. 앱은 서명이 유효한
   이벤트만 XP·반응에 반영. `events.jsonl`에 손으로 가짜 줄을 넣어도 무시.
5. HMAC 비밀키는 앱/훅에 내장(로컬 앱 특성상 추출 가능 — 난독화 수준의
   억지력이며 완전 비밀은 아님을 명시). 키는 `src/core/integrity.js` 한 곳에서 관리.

## 에러 처리

- `events.jsonl` / `save.json` 손상 시: 파싱 실패 라인은 스킵, save 손상 시
  백업 후 안전 기본값으로 복구(단, locked 스타터는 최대한 보존).
- `~/.claude/projects` 부재/권한 문제: 세션 파싱은 조용히 건너뛰고 hook XP만 사용.
- Electron 투명창 미지원 환경: 불투명 폴백.

## 테스트

- **xp-engine**: 순수 함수 단위 테스트 — XP 환산, 레벨업 경계, 진화 트리거,
  일일 상한, dedup.
- **store**: save 로드/저장/손상복구, locked 유지.
- **session-parser**: 샘플 jsonl 픽스처로 토큰 집계·dedup 검증.
- **sprites**: 각 스프라이트 매트릭스가 팔레트 범위 내 유효 인덱스인지 검증.

## 디렉터리 구조(안)

```
pocketmon-desktop/
  package.json
  src/
    main/            # Electron main process
      index.js       # 창 생성, 트레이/우클릭 메뉴
      store.js
      session-parser.js
    renderer/        # pet-window (투명 창)
      pet-window.html
      pet-window.js
      canvas-render.js
    core/
      xp-engine.js   # 순수 로직
      roster.js      # 로스터 + 진화 곡선 상수
      sprites/       # 픽셀 데이터
  hook/
    pocketmon-hook.js
    install.md       # Claude Code settings에 훅 등록 안내
  test/
```
