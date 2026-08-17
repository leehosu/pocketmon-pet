# Pokemon Gold Move Animation Engine Design

작성일: 2026-08-17

## 목표

- 현재 24개 기술의 수작업 Canvas 연출을 제거한다.
- `pret/pokegold` 원본의 기술 스크립트, OAM, 프레임셋, 오브젝트 콜백을 재생한다.
- 원본 60fps 타이밍, 팔레트, 스프라이트 배치와 움직임을 유지한다.
- 기존 요구사항인 중앙 포켓몬과 완전 투명 배경을 유지한다.
- 모든 기술을 브라우저 갤러리와 자동 캡처로 검수할 수 있게 한다.

## 근거 데이터

### pret/pokegold

시각 연출의 기준은 `pret/pokegold`의 다음 파일이다.

- `data/moves/animations.asm`: 기술별 `anim_obj`, `anim_wait`, `anim_loop`, `anim_call`
- `data/battle_anims/objects.asm`: 프레임셋, 콜백, 팔레트, 그래픽 연결
- `data/battle_anims/framesets.asm`: OAM 프레임 순서와 유지 시간
- `data/battle_anims/oam.asm`: 8x8 타일 조합과 반전 정보
- `engine/battle_anims/functions.asm`: 오브젝트 이동 콜백
- `engine/battle_anims/bg_effects.asm`: 흔들림, 점멸, 포켓몬 변형
- `gfx/battle_anims/*.png`, `gfx/battle_anims/battle_anims.pal`: 원본 비트맵과 CGB 팔레트

생성 파일에는 사용한 `pret/pokegold` 커밋 SHA를 기록한다.

### PokeAPI

PokeAPI는 애니메이션 프레임을 제공하지 않으므로 다음 용도로만 사용한다.

- `generation-ii/gold` 포켓몬 스프라이트
- 기술 타입, 위력, 명중률, PP 등 메타데이터
- 포켓몬 도감 번호와 이름

## 아키텍처

### 데이터 생성기

`scripts/generate-pokegold-anim-data.mjs`가 Gold 원본 ASM을 파싱해 정적 ES 모듈을 만든다.

생성 데이터:

- 24개 기술의 명령 배열과 서브루틴
- 오브젝트 정의
- 프레임셋과 OAM 타일 데이터
- 오브젝트 그래픽 팔레트
- 지원해야 하는 콜백 및 배경 효과 목록

생성기는 알 수 없는 명령, 콜백, 프레임셋 또는 OAM 참조를 만나면 실패한다. 누락을 조용히
대체하지 않는다.

### 스크립트 VM

`pokegold-anim-vm.js`는 원본 명령을 프레임 단위로 실행한다.

- `anim_obj`: 원본 좌표와 파라미터로 오브젝트 생성
- `anim_wait`: 지정 프레임 동안 오브젝트와 배경 효과 갱신
- `anim_loop`, `anim_call`, `anim_ret`: 원본 제어 흐름 실행
- `anim_incobj`, `anim_setobj`, `anim_clearobjs`: 활성 오브젝트 상태 변경
- `anim_if_param_equal`: 솔라빔 등 분기 처리
- 사운드 명령은 시각 VM에서는 타이밍만 보존

한 프레임에 실행 가능한 명령 수와 활성 오브젝트 수에 상한을 두어 손상된 데이터가 무한
루프를 만들지 못하게 한다.

### 오브젝트 엔진

`pokegold-object-engine.js`는 원본 프레임셋과 콜백을 실행한다. 24개 기술이 실제로 사용하는
콜백만 이식하되, 구현은 `functions.asm`의 정수 연산과 상태 전이를 따른다.

최소 지원 범위:

- 정지, 흔들림, 원운동, 사용자에서 상대까지 이동
- Ember, Fire Blast, Razor Leaf, Water Gun, Powder
- Thunder Wave, Bite, Solar Beam
- Float Up, Shiny, Smoke/Flame Wheel, Smokescreen, Speed Line
- Swift의 사용자-상대 이동 및 회전

프레임셋 전환, `oamwait`, `oamend`, `oamdelete`, `oamrestart`도 원본 의미대로 처리한다.

### 렌더러

`pokegold-anim-renderer.js`는 VM 상태를 Canvas에 그리는 역할만 한다.

- 원본 Gold CGB 팔레트 사용
- 8x8 타일을 정수 배율로 그리며 보간 금지
- Canvas 도형, 그라디언트, 글로우, 수제 충돌 파편 금지
- 배경색과 전체 화면 불투명 레이어 금지
- 점멸과 흔들림은 포켓몬 및 원본 오브젝트에만 적용해 투명 배경 유지

## 중앙 배치 적응

원본 Gold 전투는 사용자와 상대가 떨어져 있지만 앱에서는 포켓몬 한 마리만 중앙에 있다.
원본 시뮬레이션 좌표와 움직임은 먼저 그대로 계산하고, 그 결과에만 좌표 변환을 적용한다.

- 공격 기술: 원본 상대 기준점 `(136, 56)`을 화면 중앙에 배치
- 자기 대상 기술: 원본 사용자 기준점을 화면 중앙에 배치
- 사용자-상대 거리만 25%로 압축해 타깃을 지정하는 인상을 줄임
- 오브젝트 내부 간격, 프레임 크기, 콜백 이동량은 변형하지 않음
- 포켓몬은 원본 56px 크기와 같은 정수 배율로 중앙에 그림

이 변환은 원본 오브젝트가 시뮬레이션된 뒤 적용하므로 기술별 수작업 좌표는 존재하지 않는다.

## 24개 기술 범위

- 풀: 잎날가르기, 누르기, 독가루, 광합성, 솔라빔, 빛의장막
- 불꽃: 불꽃세례, 연막, 화염바퀴, 스피드스타, 화염방사, 불대문자
- 물: 물대포, 물기, 냉동펀치, 겁나는얼굴, 하이드로펌프, 베어가르기
- 전기: 전기쇼크, 천사의키스, 전기자석파, 전광석화, 10만볼트, 번개

각 기술은 `animations.asm`의 실제 Gold 스크립트 라벨과 일대일로 연결한다.

## 검증

### 데이터 검증

- 24개 기술 모두 Gold 스크립트 라벨 존재
- 모든 오브젝트, 프레임셋, OAM, 그래픽, 팔레트 참조 해소
- 생성 파일의 소스 SHA가 현재 입력 저장소와 일치
- 수작업 기술별 렌더 분기 없음

### 동작 검증

- VM 명령 흐름과 활성 오브젝트 수를 고정 프레임 스냅샷으로 검사
- 대표 콜백의 좌표와 상태를 원본 정수 연산 결과와 비교
- 기술별 시작, 중간, 타격 프레임을 자동 캡처
- 24개 기술 접촉 시트에서 빈 화면, 잘린 타일, 비정수 확대, 겹침 확인
- 화면 모서리 alpha가 전체 프레임에서 0인지 검사
- 갤러리와 실제 Electron 오버레이가 동일 엔진을 사용하는지 검사

## 제거 대상

- `effect-overlay.js`의 `drawGscMove`, `drawOriginalGscMove`
- 기술별 `if (effect === 'gsc_*')` 수작업 배치
- `impactBurst`, `hydroGlyph`, `thunderBallGlyph` 등 합성 도우미
- `pokecrystal` 기반 생성 데이터와 커스텀 팔레트
- 모든 GSC 기술의 공통 동적 확대, 임의 흔들림, 임의 페이드

부화와 진화 같은 비기술 연출은 기존 경로를 유지한다.

## 완료 조건

1. 24개 기술이 모두 `pret/pokegold` 생성 데이터와 공통 VM으로만 재생된다.
2. 기술 전용 수작업 Canvas 도형과 기술별 좌표 분기가 없다.
3. 모든 기술의 자동 캡처가 비어 있지 않고 타일이 깨지지 않는다.
4. 투명 배경, 중앙 포켓몬, 실제 앱과 갤러리의 동일 렌더링이 확인된다.
5. 전체 테스트 통과 후 Electron 앱을 재시작한다.
