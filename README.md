# pocketmon-pet

![pocketmon-pet — Claude Code / Codex로 코딩하며 키우는 8비트 포켓몬 데스크톱 펫](docs/assets/readme/overview.png)

Claude Code / Codex로 코딩하는 동안 화면 위를 떠다니는 8비트 포켓몬 데스크톱 펫입니다.

당신이 도구를 쓰고 세션을 진행할수록 XP를 얻어 레벨업하고, 일정 레벨에 도달하면 진화합니다.

Electron 기반 투명·항상-위(always-on-top) 창으로 동작하며, 상태는 `~/.pocketmon/`에 저장되어 앱을 재설치해도 같은 포켓몬·레벨을 유지합니다.

## 설치

```bash
npm install
```

## 실행

```bash
npm start
```

- macOS 기준(Dock 아이콘은 자동으로 숨겨지고 메뉴바 트레이 아이콘만 남습니다).
- 투명·프레임 없는 96×96 창이 화면 하단 중앙 근처에 뜨고, 항상 다른 창 위에 표시됩니다(always-on-top).
- 최초 실행 시 로스터 4계열 중 하나가 랜덤으로 영구 배정됩니다(아래 "로스터" 참고). 이 선택은 `~/.pocketmon/save.json`에 저장되므로 재설치해도 유지됩니다.

## Hook 설치 (XP/반응이 실제로 들어오게 하려면)

포켓몬이 반응하고 성장하려면 Claude Code hook을 등록해야 합니다.

자세한 절차는 [`hook/install.md`](hook/install.md)를 참고하세요.

요약하면 `~/.claude/settings.json`의 `hooks`에 같은 커맨드(`node <레포경로>/hook/pocketmon-hook.js`)를 4개 이벤트에 등록합니다:

| 이벤트 | 의미 |
|---|---|
| `SessionStart` | 세션 시작 — 펫 등장/인사 |
| `PostToolUse` | 도구 사용 — 기술(skill) 애니메이션 + XP |
| `UserPromptSubmit` | 프롬프트 처리 시작 — 달리기(busy) 시작 |
| `Stop` | 응답 종료 — idle/walk로 복귀 |

훅은 이벤트를 `~/.pocketmon/events.jsonl`에 append만 하고, 앱이 이를 4초 간격(tick)으로 읽어 XP와 애니메이션에 반영합니다.

## 성장 규칙 (요약)

XP는 두 경로로 들어옵니다 (`src/core/xp-engine.js`):

- **Hook 이벤트**: 도구 사용 +2 XP, 세션 시작 +5 XP
- **토큰 사용량**(권위 소스 = 에이전트 자신의 세션 로그): 1,000 토큰당 +1 XP
  - Claude Code: `~/.claude/projects/**/*.jsonl`의 `message.usage`
  - Codex: `~/.codex/sessions/**/rollout-*.jsonl`의 `token_count` 이벤트
  - 두 소스는 같은 XP 풀에 합산되며, 별도 설정 없이 자동으로 인식됩니다.

일일 상한(daily cap)은 **500 XP**로, 하루치 XP 유입을 이 값에서 클램프합니다.

레벨은 XP에서 매번 재계산합니다: `필요 XP = floor(100 × level^1.5)`.

## 로스터

4계열 × 3단계, 계열별 진화 레벨(`src/core/roster.js`):

| 계열 | 타입 | 1단계 | 2단계 (Lv) | 3단계 (Lv) |
|---|---|---|---|---|
| grass | 풀 | 치코리타 | 베이리프 (16) | 메가니움 (32) |
| fire | 불 | 브케인 | 마그케인 (16) | 블레이범 (36) |
| water | 물 | 리아코 | 엘리게이 (18) | 장크로다일 (30) |
| electric | 전기 | 피츄 | 피카츄 (10) | 라이츄 (25) |

최초 실행 시 이 4계열 중 하나가 랜덤으로 배정되며, 이후 고정됩니다.

## 상호작용

- **드래그**: 캔버스를 눌러서 끌면 창이 이동합니다(마우스다운~업 사이 이동량이 임계값 이상일 때 드래그로 인식).
- **호버**: 마우스를 올리면 XP 바와 상태 텍스트가 나타납니다.
- **클릭**: 이동량이 거의 없는 클릭이면 상태 표시를 고정(핀)합니다. 다시 클릭하면 핀 해제.
- 아무 조작이 없어도 펫은 idle일 때 가끔, busy(달리기)일 때는 크게 화면을 스스로 드리프트합니다.
- **트레이 메뉴**(메뉴바 아이콘): `상태 보기` / `첫 만남 다시보기` / `종료`.

## 수동 검증 체크리스트

- [ ] `npm start` 실행 → 투명 창에 포켓몬 1마리가 표시되고, 메뉴바에 트레이 아이콘이 뜬다.
- [ ] hook을 등록했거나(위 참고), 직접 이벤트를 하나 흘려본다: `echo '{"hook_event_name":"PostToolUse","session_id":"manual"}' | node hook/pocketmon-hook.js` → 다음 tick(최대 4초)에 펫이 반응하고 XP가 오른다.
- [ ] 앱을 종료 후 재실행 → 같은 포켓몬·레벨이 유지된다 (`~/.pocketmon/save.json` 존재 확인).

## 개발

```bash
npx vitest run   # 또는 npm test
```

## 포켓몬 스프라이트 · 울음소리 출처

- 포켓몬 스프라이트는 앱에 **번들하지 않고**, 공개 [PokéAPI/sprites](https://github.com/PokeAPI/sprites)에서 **런타임에 내려받아** `~/.pocketmon/dex/`에 로컬 캐시합니다. (트레이 메뉴 "포켓몬 스프라이트 받기" 또는 실행 시 현재 종의 진화 라인 자동 다운로드. 오프라인·실패 시 내장 오리지널 도트로 폴백.)
- 울음소리도 동일하게 공개 [PokéAPI/cries](https://github.com/PokeAPI/cries)에서 런타임에 받아 `~/.pocketmon/cries/`에 캐시하고, 펫을 클릭하면 재생합니다(앱 번들 미포함).

## 저작권 고지

이 앱은 Nintendo·Game Freak·Creatures Inc.·The Pokémon Company와 **제휴·보증·후원·승인 관계가 전혀 없는** 개인·비상업용 팬 프로젝트입니다.

소스 코드는 자유롭게 사용할 수 있으나, "포켓몬" 및 관련 명칭·캐릭터·스프라이트 등 제3자 상표/저작물의 권리는 각 권리자에게 있으며 본 프로젝트는 그에 대한 어떤 권리도 주장하지 않습니다.

스프라이트 등 IP 에셋은 앱에 포함하지 않고 런타임에 외부 공개 소스에서 받아 개인 기기에 캐시할 뿐입니다.

권리자의 요청이 있으면 즉시 관련 기능을 제거합니다.
