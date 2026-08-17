<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 프로젝트 작업 원칙

## 1. 기존 코드 우선

- 파일을 추가하거나 이동하기 전에 [프로젝트 코드 구조](docs/project-structure.md)의 계층별 책임과 배치 규칙을 확인한다.
- 구현 전에 프로젝트 구조와 유사 코드를 확인한다.
- 기존 네이밍, 설계 패턴, 라이브러리를 따른다.
- 같은 기능을 중복 구현하지 않는다.
- 상태·유형·대상처럼 API 계약, 저장 값, 조건, discriminator와 `Set`·`Map` 조회에 쓰이는 문자열은 raw literal로 사용하지 않고 [프로젝트 코드 구조](docs/project-structure.md#도메인-식별값과-문자열)의 도메인 상수 규칙을 따른다.

## 2. 최소 범위 변경

- 요구사항에 필요한 부분만 수정한다.
- 관련 없는 리팩터링이나 구조 변경은 하지 않는다.
- 기존 API와 동작은 명시적인 호환성 요구가 있는 경우에만 유지한다.

## 3. 하위 호환성과 Fallback 제한

- 과거 구현과의 하위 호환성을 억지로 유지하기 위해 불필요한 분기나 어댑터를 추가하지 않는다.
- 실제 사용 여부가 확인되지 않은 레거시 동작을 추측해서 보존하지 않는다.
- 요구사항에 없는 fallback, 이중 처리, 자동 복구 로직을 만들지 않는다.
- 새 구현과 기존 구현을 동시에 유지하는 임시 호환 계층을 남기지 않는다.
- 하위 호환이나 fallback이 반드시 필요한 경우에는 대상, 종료 조건, 제거 시점을 명확히 한다.

## 4. 책임 분리

- UI, 비즈니스 로직, 데이터 접근을 분리한다.
- 함수와 클래스는 하나의 명확한 역할만 담당한다.
- 단순한 문제를 불필요하게 추상화하지 않는다.

## 5. 안전한 구현

- 외부 입력은 반드시 검증한다.
- 예외를 숨기거나 무시하지 않는다.
- 비밀번호, 토큰, 개인정보를 코드나 로그에 남기지 않는다.
- 타입 오류를 `any`, 강제 캐스팅 등으로 우회하지 않는다.

## 6. 테스트

- 정상 흐름뿐 아니라 오류와 경계 상황도 테스트한다.
- 버그 수정 시 재현 테스트를 추가한다.
- 기존 테스트를 삭제하거나 약화해서 통과시키지 않는다.

## 7. 완료 전 검증

다음 항목을 실행해 확인한다.

1. 포맷
2. lint
3. 타입 검사 또는 컴파일
4. 테스트
5. 빌드

오류가 발생하면 설정이나 우회 코드로 숨기지 말고 원인을 수정한다.

## 8. 완료 기준

다음 조건을 모두 만족한 경우에만 구현 완료로 판단한다.

- 요구사항이 정상 동작한다.
- 주요 예외와 경계 상황이 처리되어 있다.
- 테스트와 빌드가 통과한다.
- 불필요한 하위 호환 코드와 fallback 코드가 없다.
- TODO, 임시 코드, 하드코딩, placeholder, mock 응답이 남아 있지 않다.

## 9. UI 리소스 레지스트리 일관성

- 메뉴, view 또는 권한 제어 대상 UI를 추가·수정·삭제하기 전에 [UI 리소스 레지스트리 관리](docs/ui-resource-registry.md)를 확인한다.
- UI 구현과 registry를 같은 변경에서 일치시키고 권한 검사에는 registry에서 파생된 key를 사용한다.
- 표현 전용 컴포넌트를 불필요하게 등록하거나 삭제된 UI의 레거시 key와 임시 alias를 남기지 않는다.
- 변경 후 registry 일관성과 Manifest 생성을 검증한다.

## 10. API client 경계

- 데이터 조회·명령 또는 외부 API 연동을 변경하기 전에 [Backoffice API client 경계](docs/api-client-boundary.md)를 확인한다.
- feature가 request·response 계약을 소유하고 전체 client 조합과 구현체 선택은 application 계층에서 관리한다.
- UI가 mock fixture, local API, HTTP 구현이나 고정 시스템 ID를 직접 참조하지 않도록 한다.
- mock과 실제 API는 같은 계약을 구현하며 구현체별 분기, 이중 처리와 실패 시 fallback을 두지 않는다.
- 계약이나 구현을 변경하면 입력·응답 검증, 실패 시 상태 불변과 성공 후 조회 갱신을 테스트한다.

## 11. UI 구현 지침

- UI를 추가하거나 수정하기 전에 [UI 구현 가이드](docs/ui-engineering-guidelines.md)와 기존 Storybook foundation·component를 확인한다.
- 기존 token, 기본 컴포넌트와 반복 조합 pattern을 우선 사용하고 업무 UI는 관련 feature에 둔다.
- loading, empty, error, disabled와 invalid 상태를 구분하고 한·영 문구와 작은 viewport에서도 안정적으로 구성한다.
- 키보드 접근성과 권한별 노출을 확인하고 공통 컴포넌트 변경은 Storybook과 interaction test에 반영한다.

## 12. 기능 구현·변경 흐름

- 신규 기능을 추가하거나 기존 기능을 변경하기 전에 [기능 구현·변경 작업 흐름](docs/feature-implementation-workflow.md)을 확인한다.
- 관련 코드, 사용처와 테스트를 먼저 조사하고 현재 동작·변경 후 동작·반드시 유지할 기존 동작을 구분한다.
- 기존 domain과 구현 경계를 우선 확장하고 독립적인 업무 개념일 때만 새 구조를 추가한다.
- UI, API 계약, 권한 리소스와 관련 요구사항 문서를 같은 변경에서 일치시킨다.
- 유지할 동작과 변경할 동작을 테스트한 뒤 완료 체크리스트에 따라 전체 검증을 실행한다.

## 13. 메뉴별 PRD

- 메뉴 PRD를 생성·수정하거나 화면·route·권한·API 변경이 기존 PRD에 영향을 주면 [PRD 작성·갱신 가이드](docs/prd-authoring-guide.md)를 확인한다.
- 실제 `dev:mock` 화면을 정해진 사용자·locale·viewport로 캡처하고 시나리오마다 UI 요구사항 ID, 필요한 서버 query·command, 권한과 실패 조건을 연결한다.
- PRD를 요구사항 원본이나 운영 서버 구현 완료 증거로 사용하지 않으며 메뉴 PRD 인덱스, 영향 문서와 스크린샷을 같은 변경에서 일치시킨다.
