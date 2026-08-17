# 메뉴별 PRD 작성·갱신 가이드

## 1. 목적과 원본

메뉴 PRD는 구현 화면을 사용자 시나리오 단위로 읽을 수 있게 정리하는 실행 문서다. 요구사항을 새로 정의하는 원본이 아니며 다음 자료를 연결한다.

- 메뉴·route·UI 리소스: `src/config/menu-registry.ts`
- UI 동작과 인수 조건: `docs/ui-functional-requirements.md`
- 데이터·권한·상태 전이와 외부 연동: `docs/server-functional-requirements.md`
- MVP 제외 범위: `docs/post-mvp-*-functional-requirements.md`
- 재현 데이터와 사용자 권한: `src/mocks/fixture.yaml`, `src/mocks/system-fixture.ts`

PRD와 원본이 다르면 원본 요구사항을 먼저 확정한 뒤 PRD를 갱신한다. `로컬 검증`은 mock API 계약과 동작을 확인했다는 뜻이며 운영 서버 구현 완료를 의미하지 않는다.

## 2. 준비 사항

1. 저장소 루트의 `AGENTS.md`와 이 문서를 읽는다.
2. Node.js `24.19.x`, pnpm `11.20.x`, `npx` 사용 가능 여부를 확인한다.
3. `pnpm dev:mock`으로 fixture 기반 앱을 실행하고 `curl -I http://localhost:3000`으로 응답을 확인한다.
4. 스크린샷은 한국어, 데스크톱 `1440×1000`, 기본 light theme를 기준으로 한다. 반응형 동작이 시나리오의 핵심이면 320px 화면을 추가한다.
5. 기본 운영자는 `David`, 일반 사용자·403 검증은 `Daniel`, 조직장 범위는 `Emma`, 정책/UI 리소스 운영 범위는 `Owen`을 사용한다.
6. 실제 비밀번호, API Key 원문, Secret value와 개인정보가 포함된 운영 데이터를 캡처하지 않는다.

Playwright CLI 준비:

```bash
command -v npx
export PWCLI=/Users/minjoon/.codex/skills/playwright/scripts/playwright_cli.sh
mkdir -p output/playwright/menu-prd
"$PWCLI" -s=menu-prd open http://localhost:3000 --headed
"$PWCLI" -s=menu-prd resize 1440 1000
```

개인 환경에서 스킬 경로가 다르면 설치된 Playwright 스킬의 `scripts/playwright_cli.sh`를 사용한다. 전역 CLI를 프로젝트 의존성으로 추가하지 않는다.

## 3. 시나리오 선정

각 메뉴에서 실제로 해당하는 항목을 빠짐없이 확인한다.

- 권한별 메뉴 노출과 직접 URL의 403
- 목록, 검색 조건, 페이지네이션, 빈 결과
- 상세 조회와 연결된 다른 메뉴 이동
- 생성·수정·삭제 및 실패·보호 조건
- 사용자·조직·역할·정책 같은 관계 추가·회수
- 입력→검토 workflow, 임시 저장, 제출과 완료 후 이동
- 승인·상태 전이·동기화·영향 검토처럼 서버 상태가 달라지는 흐름
- loading, empty, invalid, forbidden과 존재하지 않는 식별자

같은 화면에서 처리되는 시나리오는 하나의 스크린샷을 재사용할 수 있지만 시나리오 행은 합치지 않는다. 구현되지 않았거나 선행 데이터가 없어 재현할 수 없는 화면은 이미지를 꾸며내지 않고 `캡처 조건`과 준비할 fixture를 적는다.

## 4. 캡처 절차

요소를 조작하기 전에는 항상 snapshot을 새로 만든다.

```bash
"$PWCLI" -s=menu-prd goto http://localhost:3000/users
"$PWCLI" -s=menu-prd snapshot
"$PWCLI" -s=menu-prd screenshot \
  --filename output/playwright/menu-prd/users-list.png
```

Dialog·탭·검토 단계는 snapshot의 최신 ref로 조작한 뒤 다시 snapshot하고 캡처한다. 파일명은 `<menu>-<scenario>.png`의 kebab-case로 작성한다. 검토가 끝난 자산만 `docs/menu-prd/assets/`로 이동하고 PRD에서는 상대 경로 `assets/<file>.png`로 참조한다.

캡처 후에는 다음을 확인한다.

- URL, 로그인 사용자와 권한이 시나리오와 일치한다.
- Dialog, tooltip, 선택·검토 단계가 의도한 상태다.
- 개발 중 입력한 값이 다음 캡처에 남지 않았다. 필요하면 새로고침하거나 session data를 초기화한다.
- 1440×1000 이미지가 깨지지 않고 비밀 정보와 브라우저 외부 UI가 없다.
- 기존 이미지 교체 시 더 이상 참조되지 않는 자산을 남기지 않는다.

## 5. PRD 문서 형식

메뉴 문서는 `docs/menu-prd/<menu>.md`에 두고 다음 순서를 유지한다.

1. 목표, 주 사용자, route, 원본 요구사항 링크
2. 대표 화면 갤러리
3. 시나리오 매트릭스
4. 공통 권한·데이터·예외 규칙
5. MVP 제외 또는 미구현 항목

시나리오 매트릭스는 다음 열을 사용한다.

| 열                    | 작성 기준                                                                      |
| --------------------- | ------------------------------------------------------------------------------ |
| ID                    | `<MENU>-SCN-01` 형식의 문서 내부 안정 식별자                                   |
| 사용자·선행 조건      | 역할명 하드코딩이 아니라 필요한 UI 리소스·업무 관계를 함께 기재                |
| 사용자 흐름·완료 결과 | 시작점, 핵심 조작, 성공 후 이동 또는 상태                                      |
| UI 요구사항           | 원본 UI 요구사항 ID                                                            |
| 필요한 서버 기능      | query/command, 권한 재검증, validation, transaction, notification 등과 서버 ID |
| 화면                  | 실제 캡처 링크 또는 재현을 위한 캡처 조건                                      |

서버 기능에는 현재 mock 화면이 보여주는 결과만 쓰지 말고 클라이언트를 우회해도 지켜야 할 실패 조건을 포함한다. 외부 비밀 저장소, 예약 작업, 비동기 알림처럼 실제 운영 연동이 필요한 항목은 `외부 연동`으로 명시한다.

## 6. 갱신 순서와 완료 조건

1. 변경된 메뉴 registry, route, feature API 계약과 UI·서버 요구사항 diff를 확인한다.
2. 영향을 받는 시나리오를 추가·수정·삭제하고 요구사항 ID를 대조한다.
3. 실제 앱에서 해당 시나리오를 다시 수행해 영향 화면만 재캡처한다.
4. `docs/menu-prd/README.md`, 메뉴 PRD, 자산과 원본 문서 링크를 같은 변경에서 갱신한다.
5. Markdown 포맷, 상대 링크, 이미지 존재 여부와 중복·미참조 자산을 검사한다.
6. UI 또는 코드도 변경했다면 저장소의 전체 완료 전 검증을 수행한다.

PRD 갱신 완료는 모든 현재 route와 메뉴 시나리오가 인덱스에서 추적되고, 각 시나리오에 사용자·UI 요구사항·서버 책임·화면 또는 명시적 캡처 조건이 있을 때만 선언한다.
