# 2세대 야생 조우·전투 설계

## 목표

기존 Claude Code/Codex 활동 XP는 유지하면서, 앱이 실행 중일 때 예고 없이 야생
포켓몬이 나타나는 상호작용을 추가한다. 사용자는 야생 포켓몬을 클릭하고 현재
포켓몬의 기술을 선택해 실제 2세대 규칙으로 전투하며, 승리하면 경험치와 stat EXP를
얻는다.

단순한 1~3칸 체력이나 임의 데미지는 사용하지 않는다. 표시되는 HP와 데미지는
포켓몬 골드·실버의 종족값, 레벨, DV, stat EXP, 기술 위력과 명중률, 물리·특수 분류,
급소, STAB, 타입 상성, 상태 및 난수 계산 결과여야 한다.

## 기준 데이터

전투 수치의 권위 소스는 `pret/pokecrystal`의 역어셈블리 데이터와 계산 순서다.
PokéAPI의 현재 세대 수치가 2세대와 다르면 `pret/pokecrystal` 값을 우선한다.

- 종족값·타입·기본 경험치: `data/pokemon/base_stats/*.asm`
- 기술 위력·타입·명중·PP·부가효과: `data/moves/moves.asm`
- 데미지·급소·STAB·명중·상태 처리: `engine/battle/effect_commands.asm`
- 실능력치 계산: `engine/pokemon/move_mon.asm`
- 경험치·stat EXP 지급: `engine/battle/core.asm`
- 2세대 타입 상성: `data/types/type_matchups.asm`

PokéAPI는 골드 버전 스프라이트, 울음소리, 한국어 이름, 골드·실버 습득 기술,
진화·조우 메타데이터를 내려받아 로컬 캐시에 보강하는 용도로 사용한다. PokeAPI가
실패했을 때 최신 세대 수치로 대체하거나 임의 값을 만들지 않는다.

참조:

- https://github.com/pret/pokecrystal/blob/master/engine/battle/effect_commands.asm
- https://github.com/pret/pokecrystal/blob/master/engine/pokemon/move_mon.asm
- https://github.com/pret/pokecrystal/blob/master/engine/battle/core.asm
- https://github.com/pret/pokecrystal/blob/master/data/moves/moves.asm
- https://github.com/pret/pokecrystal/blob/master/data/types/type_matchups.asm
- https://pokeapi.co/docs/v2

## 채택 방식

골드·실버 전투 파이프라인을 앱 규모에 맞춰 재현한다. 데미지식만 흉내 내는 축약형과
현세대 PokeAPI 수치를 직접 사용하는 방식은 제외한다. 플레이어가 보유한 24개 기술은
데미지뿐 아니라 상태, 회복, 능력 변화, 선공, 충전, 장막, 급소 보정까지 구현한다.

야생 포켓몬은 골드·실버에서 레벨업으로 배울 수 있는 기술 중 구현 가능한 공격 기술을
사용한다. 야생 측의 모든 특수 기술을 한 번에 재현하는 것은 이번 범위에서 제외하며,
지원 기술이 없으면 2세대 `Struggle` 규칙을 사용한다. 이 제한은 임의 데미지를 허용한다는
뜻이 아니며, 야생 측에서 실행되는 모든 공격도 동일한 2세대 계산기를 통과한다.

## 상태 모델

기존 `save.json`에 다음 성장 상태를 추가한다.

```text
battleProfile:
  dvs: attack, defense, speed, special
  statExp: hp, attack, defense, speed, special
  wins, losses
  encounterCooldownUntil
```

- DV는 각각 0~15이며 부화 순간 한 번 생성해 영구 보존한다.
- HP DV는 원작처럼 나머지 네 DV의 최하위 비트로 계산한다.
- Special DV와 Special stat EXP는 특수공격·특수방어가 공유한다.
- 기존 세이브에 `battleProfile`이 없으면 최초 로드 시 한 번 생성하고 저장한다.
- stat EXP는 승리한 야생 포켓몬의 종족값을 원작 순서대로 더하며 각 항목은 65,535로
  제한한다.
- 전투 중 HP, 상태, 능력 단계와 장막은 세이브하지 않는다. 승리·패배·중단 뒤에는 모두
  회복된 상태로 돌아간다.
- 다음 조우까지의 예약은 실행 중 메모리에만 둔다. 재시작 시 새로 추첨해 종료 중 경과
  시간이 조우 확률에 포함되지 않게 한다.

## 실능력치 계산

각 능력치의 stat EXP 보정치는 원작의 `GetSquareRoot` 동작을 따라
`floor(ceil(sqrt(statExp)) / 4)`로 계산한다.

```text
common = floor(((base + DV) * 2 + statExpBonus) * level / 100)
HP     = common + level + 10
other  = common + 5
```

전투 레벨은 앱 레벨을 사용하되 2세대 최대치인 100으로 제한한다. 진화 후에는 해당 폼의
종족값을 즉시 사용하고 DV와 stat EXP는 그대로 유지한다. 야생 포켓몬의 레벨은 플레이어
전투 레벨 기준 -2~+2에서 정하며, 야생 DV는 조우마다 새로 생성하고 stat EXP는 0이다.

## 데미지·턴 계산

표준 공격은 원작의 정수 나눗셈 순서를 유지한다.

```text
core = floor(floor((floor(2 * level / 5) + 2) * power * attack / defense) / 50)
damage = floor(core * critical) + 2
damage = floor(damage * STAB)
damage = floor(damage * typeEffectiveness)
damage = floor(damage * randomFactor / 255)
```

- 급소는 2배, STAB은 1.5배다.
- 난수는 원작 범위 217~255를 사용한다.
- 타입 상성은 2세대 표를 사용하며 이중 타입은 두 번 적용한다.
- 기술 타입으로 물리·특수를 결정한다. 2세대에서 Normal/Fighting/Flying/Poison/Ground/
  Rock/Bug/Ghost/Steel은 물리, Fire/Water/Grass/Electric/Psychic/Ice/Dragon/Dark는 특수다.
- 물리는 Attack/Defense, 특수는 Sp. Atk/Sp. Def를 사용한다.
- 화상은 물리 Attack을 절반으로 만들고, 마비는 Speed를 1/4로 만든다.
- 능력 단계는 -6~+6과 2세대 배율표를 적용한다.
- 명중 판정은 2세대 accuracy/evasion 단계와 0~255 판정을 사용한다. Swift 같은 필중기는
  명중 난수를 건너뛴다. 명중률 100 기술도 원작과 동일하게 1/256 확률로 빗나갈 수 있다.
- 일반 급소율은 1/16으로 단순화하지 않고 원작의 1/15 테이블을 쓴다. Razor Leaf와
  Slash는 고급소 기술 보정을 적용하며, 급소 시 공격·방어 능력 단계를 무시하는 원작
  조건도 적용한다.
- 우선도, 보정 Speed, 동률 난수 순으로 행동 순서를 정한다.
- 모든 난수 함수는 주입 가능하게 만들어 테스트에서 결과를 고정한다.

## 24개 기술 처리

현재 단계별 두 기술은 캐시 메타데이터의 표시명만 신뢰하지 않고 2세대 기술 테이블의
수치와 효과 ID로 실행한다.

- 직접 공격: Water Gun, Hydro Pump 등은 위력·명중·타입을 그대로 사용한다.
- 부가 상태: Ember/Flamethrower/Fire Blast의 화상, ThunderShock/Thunderbolt/Thunder와
  Body Slam의 마비, Ice Punch의 얼음, Bite의 풀죽음을 원작 확률로 판정한다.
- 상태기: PoisonPowder, Smokescreen, Scary Face, Sweet Kiss, Thunder Wave를 실제 명중,
  면역, 상태 중복, 능력 단계 규칙으로 처리한다.
- 회복·방어: Synthesis는 날씨가 없는 기준으로 최대 HP의 1/2를 회복하고, Light Screen은
  5턴 동안 받는 특수 데미지를 줄인다.
- 특수 흐름: SolarBeam은 충전 후 다음 행동에 공격하고, Quick Attack은 선공하며,
  Swift는 필중, Razor Leaf와 Slash는 고급소율을 사용한다.
- 상태 이상은 독·화상 턴 종료 피해, 마비 행동 불능, 얼음 행동 제한, 혼란 자해와 지속
  턴을 포함한다.

PP와 아이템, 날씨, 교체, 포획, 트레이너전은 이번 범위에 포함하지 않는다. PP가 없으므로
사용자는 현재 두 기술을 횟수 제한 없이 선택할 수 있다.

## 야생 조우

- 부화가 끝난 상태에서만 조우 스케줄이 작동한다.
- 앱이 실행 중이고 전투 중이 아닐 때만 시간이 흐르며, 종료 중 놓친 조우를 재실행하지
  않는다.
- 앱을 다시 실행하면 이전 예약을 이어받지 않고 다음 조우 대기 시간을 새로 추첨한다.
- 다음 조우는 최소 대기 후 매 분 독립 확률로 판정하고 최대 대기 시 강제 예약해, 고정
  주기처럼 느껴지지 않게 한다. 기본값은 최소 10분, 분당 1/30, 최대 120분이다.
- 예약 시각과 난수 결과는 메인 프로세스가 관리하며 동시에 한 마리만 존재한다.
- 야생 포켓몬은 임의 화면 위치의 투명 창에 15~45초 동안 나타난다.
- 클릭하지 않으면 도망가며 XP 차감이나 재사용 대기시간은 없다.
- 클릭하면 조우 타이머를 멈추고 전투를 시작한다.
- 야생 후보는 PokéAPI의 골드 버전 조우 기록이 있는 1·2세대 일반 포켓몬으로 제한한다.
  전설·환상 포켓몬은 제외하고, 원작 최소 야생 레벨보다 낮게 생성하지 않는다.
- PokeAPI 데이터나 스프라이트가 캐시에 없고 네트워크 조회도 실패하면 해당 조우를
  취소하고 다음 일정을 잡는다. 빈 창이나 임의 포켓몬은 표시하지 않는다.

## 전투 UX

전투는 배경을 그리지 않는 전체 화면 투명 오버레이에서 진행한다. 기존 펫과 야생
포켓몬, 각자의 이름·레벨·실제 HP 바, 현재 행동 메시지, 플레이어의 두 기술만 표시한다.

기술 이펙트는 기존 원칙대로 플레이어 포켓몬의 몸 중심에서 시작해 화면 전체로 퍼진다.
조준선이나 십자선, 별도의 우측 타깃 포인트는 사용하지 않는다. 데미지 숫자와 상성·급소·
빗나감 메시지는 계산 결과가 확정된 뒤 표시하며, 애니메이션 중 중복 입력은 잠근다.

한 턴은 기술 선택, 행동 순서 결정, 첫 행동, 기절 확인, 두 번째 행동, 턴 종료 상태 피해,
기절 확인 순으로 진행한다. 플레이어가 이기면 결과를 저장하고, 지면 야생 포켓몬이
도망가며 XP를 주지 않는다. 패배해도 XP 차감이나 영구 부상은 없고 전투 상태를 즉시
회복한 뒤 10분 동안 새 조우만 막는다.

## 보상

승리 XP는 야생전 원작식 `floor(baseExp * wildLevel / 7)`을 사용한다. 트레이너전,
교환 포켓몬, 행복의알 보정은 적용하지 않는다. 이 XP를 기존 총 XP에 더한 뒤 기존 앱의
레벨·수동 진화 판정을 그대로 사용한다.

야생전 XP는 Claude Code/Codex 활동의 일일 500 XP 상한과 분리한다. 활동 XP 상한을
소비하지 않으며, 조우 빈도 자체가 획득 속도를 제한한다. 승리 시 XP와 함께 해당 야생
종족값만큼 stat EXP를 지급하고 `wins`를, 패배 시 `losses`를 증가시킨다.

## 컴포넌트 경계

- `gen2-data`: 2세대 종족값, 기본 경험치, 기술, 타입 상성의 읽기 전용 데이터.
- `gen2-stats`: DV·stat EXP에서 실능력치를 만드는 순수 함수.
- `gen2-battle`: 턴 순서, 명중, 데미지, 상태, 승패를 계산하는 순수 상태 머신.
- `encounter-scheduler`: 실행 시간 기반 다음 조우 예약, 등장 기한, 패배 쿨다운 관리.
- `wild-catalog`: PokéAPI 골드 조우·습득 기술·이름·스프라이트 캐시.
- `main`: BrowserWindow 수명, IPC, 저장, XP 엔진 연결.
- `battle renderer`: 입력과 표시만 담당하고 전투 결과를 자체 계산하지 않는다.

렌더러는 `selectMove(moveSlug)`만 메인에 전달한다. 메인은 현재 전투 ID와 턴을 검증한 뒤
순수 전투 엔진을 호출하고, 결정된 이벤트 목록과 새 스냅샷을 렌더러에 보낸다. 승패 보상은
메인 프로세스에서 한 번만 커밋한다.

## 오류·중복 방지

- 전투 ID와 턴 번호가 일치하지 않는 IPC는 무시한다.
- 한 턴 처리 중 추가 기술 입력은 무시한다.
- 보상 지급 완료 플래그로 같은 승리를 두 번 저장하지 않는다.
- 캐시는 임시 파일 작성 후 rename하는 원자적 교체를 사용한다.
- 손상된 신규 필드는 기본값으로 마이그레이션하되 기존 XP·종·진화 단계는 보존한다.
- 앱 종료 시 진행 중 전투는 무효 처리하며 XP나 패배를 기록하지 않는다.

## 검증

- 실능력치: DV 경계 0/15, HP DV 비트 조합, stat EXP 0/65,535, 레벨 1/100.
- 데미지: 물리·특수, STAB, 단일·이중 상성, 면역, 급소, 217/255 난수 경계, 화상.
- 명중·순서: 필중, 빗나감, 우선도, 마비 Speed, 동률 난수.
- 24개 기술: 각 기술의 위력 또는 상태 변화, 확률, 충전·회복·장막 동작.
- 상태: 독·화상·마비·얼음·혼란·풀죽음과 기절 순서.
- 보상: 원작 XP 식, stat EXP 누적·상한, 승리 중복 지급 방지.
- 스케줄: 최소·최대 대기, 15~45초 체류, 무시 무패널티, 패배 10분 쿨다운,
  재시작 시 놓친 조우 미재생.
- 저장: 기존 세이브 마이그레이션과 DV 영속성.
- 통합: 야생 클릭 → 기술 선택 → 턴 진행 → 승리/패배 → 창 정리와 상태 반영.
- 시각 확인: 데스크톱과 보조 모니터에서 투명 배경, HP 바 가독성, 중앙 이펙트,
  중복 창·겹침이 없는지 스크린샷으로 확인한다.
