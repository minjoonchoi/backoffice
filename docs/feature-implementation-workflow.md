# 기능 구현·변경 작업 흐름

## 목적

신규 메뉴, 목록·상세 화면, 권한 제어 컴포넌트와 API command를 추가하거나 기존 기능을 확장·변경해 실제로 동작시키는 순서를 정의한다. 세부 규칙을 다시 정의하지 않고 다음 문서를 연결하는 실행 가이드로 사용한다.

- 코드 위치와 책임: [프로젝트 코드 구조](project-structure.md)
- UI 구성과 접근성: [UI 구현 가이드](ui-engineering-guidelines.md)
- 메뉴·화면·액션 권한: [UI 리소스 레지스트리 관리](ui-resource-registry.md)
- mock과 실제 API 교체 경계: [API client 경계](api-client-boundary.md)

## Quick Start: 작업 요청 작성법

신규 기능을 추가하거나 기존 기능을 확장·변경할 때 아래 양식만 채우면 된다. 기존 코드 확인, 파일 배치, API client 연결, UI 리소스 등록, 문서 갱신과 테스트 명령은 `AGENTS.md`와 이 문서가 지시하므로 요청마다 반복하지 않는다.

```md
# 작업

- 목표:
  - 사용자가 최종적으로 할 수 있어야 하는 일을 한 문장으로 작성
- 진입 위치:
  - 기존 메뉴·화면 또는 신규 메뉴 이름과 원하는 영역
- 현재 동작:
  - 기존 기능을 변경한다면 사용자가 현재 경험하는 동작
  - 신규 기능이라면 `해당 기능 없음`
- 변경 후 동작:
  - 현재 동작에서 달라져야 할 결과를 항목별로 작성
- 반드시 유지할 기존 동작:
  - 변경의 영향을 받지 않아야 할 화면, 권한, API와 사용자 흐름
- 사용자와 권한:
  - 조회·생성·수정·삭제할 수 있는 사용자·역할·조직·그룹
  - 사용할 수 없어야 하는 대상
- 데이터와 규칙:
  - 입력·표시 필드, 필수값, 관계, 중복·상태·삭제 제한
- 사용자 흐름:
  - 진입 → 입력·선택 → 저장·요청 → 성공 결과
- 실패와 경계:
  - 잘못된 입력, 빈 결과, 권한 없음, 충돌 시 기대 동작
- 완료 조건:
  - 화면에서 확인할 결과와 반드시 통과해야 할 핵심 시나리오

## 확정된 서버 API가 있는 경우에만

- API: method, path, request, response와 오류 code
```

### 최소 요구사항

다음 다섯 가지는 구현 방향을 바꿀 수 있으므로 명시한다.

1. 업무 목표와 사용 주체
2. 화면 진입 위치와 핵심 사용자 흐름
3. 저장하거나 조회할 데이터와 업무 제약
4. 조회·실행 권한과 권한이 없을 때의 기대 결과
5. 성공·실패 인수 조건

기존 기능을 확장·변경할 때는 `현재 동작`, `변경 후 동작`, `반드시 유지할 기존 동작`도 필수로 작성한다. 신규 기능은 현재 동작을 `해당 기능 없음`으로 적고, 인접 화면이나 공통 컴포넌트에서 유지해야 할 동작이 있다면 함께 명시한다. 작업자는 현재 동작을 요구사항만으로 단정하지 않고 코드, 테스트, Storybook과 실행 결과에서 확인하며 유지 조건은 회귀 테스트로 보호한다.

확정된 서버 API가 없다면 URL이나 response 형식을 억지로 작성할 필요가 없다. 이 경우 기존 패턴에 맞는 feature API 계약과 local mock 구현까지 구성하고, 존재하지 않는 외부 서버 endpoint를 임의로 만들었다고 가정하지 않는다.

### 작성하지 않아도 되는 내용

- 파일 경로, 컴포넌트 이름과 세부 TypeScript 구조
- 기존 컴포넌트 재사용, `any` 금지와 책임 분리 같은 공통 작업 원칙
- UI 리소스 registry, locale, Storybook과 테스트 갱신 지시
- format, lint, typecheck, test와 build 실행 지시

작업자는 위 항목을 저장소와 가이드에서 확인해 스스로 결정한다. 누락된 세부사항이 기존 코드와 요구사항에서 유일하게 도출되면 질문하지 않고 진행하고, 선택에 따른 차이를 결과에 기록한다. 데이터 손실, 보안·권한 모델, 외부 API 계약처럼 서로 다른 선택이 결과를 크게 바꾸고 저장소에서도 답을 찾을 수 없을 때만 구현 전에 확인한다.

### 간단한 요청 예시

한 bullet에는 하나의 요구사항만 작성한다. 같은 주제의 세부 조건은 중첩 `-` 목록으로 분리한다.

```md
# 작업

- 목표: 서비스 상세에서 서비스별 운영 메모를 조회하고 수정한다.
- 진입 위치: 카탈로그 > 서비스 > 상세
- 현재 동작:
  - 서비스 상세에는 기본 정보와 엔드포인트 목록이 표시된다.
  - 운영 메모를 조회하거나 수정하는 기능은 없다.
- 변경 후 동작:
  - 서비스 상세에 운영 메모 카드를 표시한다.
  - 서비스 관리 권한 보유자는 Dialog에서 운영 메모를 수정할 수 있다.
- 반드시 유지할 기존 동작:
  - 서비스 기본 정보와 엔드포인트 목록의 표시 및 상세 이동은 그대로 동작한다.
  - 서비스 수정·삭제 권한 판정은 변경하지 않는다.
  - 존재하지 않는 서비스의 기존 not-found 처리를 유지한다.
- 사용자와 권한:
  - 서비스 상세 접근자는 메모를 조회할 수 있다.
  - 해당 서비스 관리 권한 보유자만 메모를 수정할 수 있다.
- 데이터와 규칙:
  - 메모는 최대 1,000자다.
  - 서비스당 메모는 1개다.
  - 공백만 있는 메모는 저장할 수 없다.
- 사용자 흐름:
  - 서비스 상세에서 수정 버튼을 누른다.
  - 1열 Dialog에서 메모를 입력한다.
  - 저장에 성공하면 최신 메모를 상세에 표시한다.
- 실패와 경계:
  - 서비스가 없으면 기존 not-found를 표시한다.
  - 수정 권한이 없으면 버튼을 숨기고 API 요청도 거부한다.
  - 잘못된 입력은 Dialog에서 오류로 표시한다.
- 완료 조건:
  - 권한별 조회·수정을 테스트한다.
  - invalid 입력을 테스트한다.
  - 저장 후 snapshot 갱신을 테스트한다.
  - 직접 URL 접근을 테스트한다.
```

## 전체 흐름

```text
현재 코드·사용처·테스트 확인
  → 현재 동작·변경 후 동작·유지 조건 확정
  → 요구사항과 소유 domain 확인
  → model·입력 schema 정의
  → feature API 계약 정의
  → mock 또는 HTTP client 구현
  → application command·client 조합
  → UI resource·권한 정책 구성
  → route gate·화면·component 연결
  → locale·상태·접근성 보완
  → 단위·Storybook·E2E·build 검증
```

앞 단계의 계약이 정해지기 전에 화면에서 fixture를 직접 읽거나 임시 상태 전이를 만들지 않는다. 화면부터 검증해야 한다면 먼저 최소 API 계약과 mock 구현을 만든 뒤 동일한 경계를 사용한다.

## 1. 변경 범위와 소유 책임 결정

1. `rg`로 관련 route, 화면, 컴포넌트, command, API 구현, 호출부와 테스트를 찾고 기존 기능이면 현재 동작을 재현한다.
2. 확인한 결과를 `현재 동작`, `변경 후 동작`, `반드시 유지할 기존 동작`과 대조한다. 요구사항에 적힌 현재 동작과 실제 코드가 다르면 실제 동작을 기준으로 영향 범위를 판단하고 결과가 달라지는 경우에만 사용자에게 확인한다.
3. 유지 조건을 검증하는 테스트가 없으면 변경 전에 현재 동작을 재현하는 회귀 테스트를 추가한다.
4. [UI 기능 요구사항](ui-functional-requirements.md)에 화면, 사용자 흐름과 권한별 노출을 작성한다.
5. 데이터 규칙, 입력 검증, 권한 재검증과 상태 전이가 추가되면 [서버 기능 요구사항](server-functional-requirements.md)도 같은 작업에서 갱신한다.
6. 기존 domain에 속하면 해당 `src/features/<domain>`을 확장한다. 독립적인 업무 개념일 때만 새 feature를 만든다.
7. 둘 이상의 feature를 조합하는 로직은 `src/application`, 업무를 모르는 UI는 `src/components`에 둔다.
8. App Router route, layout 또는 Next.js API를 변경한다면 구현 전에 `node_modules/next/dist/docs/`의 현재 버전 가이드를 확인한다.

단순한 화면 섹션이나 표현 컴포넌트를 위해 새 feature, API client 또는 UI 리소스를 만들지 않는다.

## 2. 도메인 model과 상태 계약 정의

1. `src/features/<domain>/model.ts`에 엔티티, 입력 타입과 Zod schema를 정의한다.
2. 외부 입력은 UI 타입만 믿지 않고 API 구현 경계에서 schema로 다시 검증할 수 있게 한다.
3. 화면 snapshot에 새 데이터가 필요하면 `src/application/state/model.ts`의 `BackofficeState`에 domain 타입을 추가한다.
4. 시스템 기본 레코드 참조가 필요하면 FE 상수나 이름 검색을 추가하지 말고 API snapshot의 `systemReferences` 계약을 확장한다.
5. 로컬 검증 데이터가 필요할 때만 `src/mocks/fixture.yaml`과 loader schema를 갱신한다. fixture를 app, auth, feature 또는 UI에서 직접 import하지 않는다.

새 입력에는 정상값뿐 아니라 잘못된 형식, 중복, 존재하지 않는 참조와 변경 불가 관계 같은 경계 조건을 먼저 정한다.

## 3. feature API 계약 정의

`src/features/<domain>/api.ts`가 해당 기능의 request/response 원본이다.

- `<Domain>Api`: 화면이 사용하는 의미 중심 command 계약
- `<Domain>ApiClient`: 실제 전송 형태를 반영한 request DTO 계약
- response: 성공값과 명시적인 오류 code를 가진 `CommandResult`

```ts
export interface ExampleApi {
  createExample: (input: ExampleInput) => Promise<CommandResult<Example>>
}

export interface ExampleApiClient {
  createExample: (request: {
    body: ExampleInput
  }) => Promise<CommandResult<Example>>
}
```

기존 domain에 operation을 추가하면 해당 두 계약을 함께 확장한다. 새 domain이면 다음 조합 지점도 추가한다.

- `BackofficeCommands`: `<Domain>Api` 조합
- `BackofficeApiClient`: `<domain>: <Domain>ApiClient` 조합

화면에서 transport URL, HTTP method, fixture 구조나 client 구현체를 알게 만들지 않는다.

## 4. API 구현과 application 연결

### 로컬 mock 구현

1. `src/features/<domain>/local-api.ts`에서 입력 schema, 참조, 권한과 상태 전이를 검증한다.
2. 실패한 command는 상태를 변경하지 않고 구체적인 오류 code를 반환한다.
3. `src/application/api/mock-api-client.ts`에 request DTO와 local API를 연결한다.
4. 새 domain이면 local API factory를 `createMockBackofficeApiClient`에 조합한다.

mock도 실제 API와 동일한 `BackofficeApiClient` 계약을 구현한다. 화면 편의를 위한 별도 mock command를 추가하지 않는다.

### command facade 연결

`src/application/state/commands.ts`의 `createBackofficeCommands`에서 화면 input을 API request DTO로 변환한다.

```text
UI command(input)
  → createBackofficeCommands
  → apiClient.<domain>.<operation>({ body, id, ... })
  → CommandResult
```

업무 규칙은 이 매핑 함수에 넣지 않는다. `BackofficeProvider`는 성공한 command 뒤 `getSnapshot({})`을 다시 호출하므로 화면이 응답 엔티티를 추측해 state를 직접 보정하지 않는다.

### 실제 HTTP 구현

실제 서버를 연결할 때는 feature의 `http-api.ts` 또는 `src/application/api/http-api-client.ts`에서 같은 계약을 구현하고 `src/application/api/client-factory.ts`에서 구현체를 선택한다. 화면과 Provider에 mock/HTTP 분기나 실패 시 mock fallback을 추가하지 않는다. HTTP response는 `ApiTransport` 경계에서 schema 검증 후 상태에 반영한다.

## 5. 메뉴와 UI 리소스 등록

`src/config/menu-registry.ts`의 `uiResourceRegistry`를 같은 변경에서 갱신한다.

1. 신규 메뉴는 lowerCamelCase registry key, kebab-case `href`, 영역, 이름과 기본 view를 등록한다.
2. URL로 접근하는 목록·상세 화면은 `list` 또는 `detail` view를 등록한다.
3. API command와 연결되거나 독립적으로 숨겨야 하는 기능은 해당 view의 action으로 등록한다.
4. 권한 경계 전체가 테이블·카드·도구 모음이면 component 등록 필요성을 검토한다.
5. 구현에서는 raw string 대신 파생된 `uiResourceKeys`만 사용한다.
6. 기본 역할에 제공할 기능이면 `src/mocks/system-fixture.ts`의 역할별 mock 정책을 의도적으로 갱신한다. 실제 서버에서는 seed/migration으로 구성한다.

신규 메뉴에는 현재 구조상 다음 shell 연결도 필요하다.

- `ShellLabels`, `menuLabels`, `menuIcons`
- `src/app/(backoffice)/layout.tsx`의 번역 label 전달
- `messages/ko.json`, `messages/en.json`의 메뉴 문구

메뉴의 존재와 사용 권한은 별개다. 레지스트리에 추가했다는 이유만으로 모든 역할에 자동 부여하지 않는다.

## 6. route와 UI 연결

### route

- `src/app/(backoffice)/<kebab-case-path>/page.tsx`는 route 진입과 server gate만 담당하는 얇은 wrapper로 둔다.
- 목록과 상세 route는 각각 등록한 view key로 `UiResourceServerGate`를 적용한다.
- 상세 식별자는 route에서 읽어 feature page component에 전달한다.
- 권한 없는 직접 URL 접근은 `forbidden()`을 통해 403 UI로 종료하고 전체 허용 fallback을 두지 않는다.

```tsx
<UiResourceServerGate resourceKey={uiResourceKeys.examples.list.key}>
  <ExamplesPage />
</UiResourceServerGate>
```

### feature UI

1. 조회 데이터와 command는 `useBackoffice()`로만 사용한다.
2. action, component와 다른 view 링크는 `useSessionAccess().canAccessUiResource(uiResourceKeys...)` 결과로 노출한다.
3. UI 리소스 허용과 별개로 소유 조직, 상태 같은 업무 조건도 함께 만족해야 동작을 제공한다.
4. 같은 domain 상세 이동은 공통 `DataTable`의 행 이동을 사용하고 다른 domain 상세는 권한을 확인하는 text link를 사용한다.
5. command 실패는 오류 code를 locale 문구로 표시하고 성공했을 때만 Dialog 종료, snackbar 또는 route 이동을 수행한다.
6. snapshot 배열을 직접 변경하거나 화면 전용 임시 엔티티를 삽입하지 않는다.

서버는 인증 사용자, 최신 권한과 데이터 무결성을 command 처리 시 다시 검증해야 한다. UI 숨김은 보안 경계가 아니다.

## 7. 문구, 상태와 Storybook 완성

- 사용자에게 보이는 문구는 `messages/ko.json`, `messages/en.json`에 함께 추가한다.
- Select option과 선택 결과가 같은 locale label을 사용하도록 확인한다.
- loading, empty, no-results, error, disabled와 invalid 상태를 구분한다.
- 입력은 기본 1열로 구성하고 긴 Dialog는 세부 목록 영역만 scroll되도록 한다.
- 새 공통 컴포넌트나 pattern은 Storybook에 variant, 상태, keyboard interaction과 실제 조합 예시를 추가한다.
- feature 화면 story는 대표 권한과 데이터 조합을 검증하되 별도 mock 업무 규칙을 구현하지 않는다.

세부 UI 기준은 [UI 구현 가이드](ui-engineering-guidelines.md)를 따른다.

## 8. 테스트와 검증

변경 범위에 따라 다음 회귀 테스트를 추가한다.

| 변경 영역          | 최소 검증                                                         |
| ------------------ | ----------------------------------------------------------------- |
| 기존 기능 변경     | 현재 동작 재현, 유지 조건 회귀, 변경 후 동작                      |
| model·입력         | 정상, invalid, 중복과 참조 오류 schema/unit test                  |
| local API          | 정상 상태 전이, 실패 시 상태 불변, 경계 조건                      |
| API client·command | request DTO 전달, 성공 후 snapshot 갱신, 구현체 주입              |
| UI 리소스          | registry key/type/부모, 메뉴·view 파생, YAML·JSON Manifest export |
| 권한               | 허용·거부·상위 비활성, SSR route gate와 action 노출               |
| 공통 UI            | Storybook 상태, keyboard interaction, axe serious/critical        |
| 핵심 사용자 흐름   | Chromium·Firefox·WebKit E2E                                       |

UI 리소스를 변경했다면 다음을 별도로 확인한다.

```bash
pnpm vitest run --project unit \
  src/config/menu-registry.test.ts \
  src/features/ui-resources/ui-resource-manifest.test.ts
pnpm --silent ui-resources:export --format yaml
pnpm --silent ui-resources:export --format json
```

완료 전에는 전체 검증을 실행한다.

```bash
pnpm verify
pnpm e2e
```

## 변경 유형별 확인표

| 변경 대상               | 함께 확인할 주요 파일                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 기존 기능 확장·변경     | 현재 구현·호출부·테스트, 변경 대상 계층, 유지 조건 회귀 테스트                                                                                   |
| 표현 전용 공통 컴포넌트 | `src/components/ui`, Storybook, accessibility test                                                                                               |
| 공통 조합 pattern       | `src/components/patterns`, 사용하는 feature, Storybook·unit test                                                                                 |
| 기존 화면의 API action  | feature `model.ts`·`api.ts`·`local-api.ts`, application `commands.ts`·`mock-api-client.ts`, registry action, UI·권한·test                        |
| 신규 목록·상세 view     | registry view, App Router page와 server gate, feature UI, locale, 권한 policy·test                                                               |
| 신규 메뉴·domain        | UI·서버 요구사항, feature 전체 계약, `BackofficeState`, API client 조합, registry, shell label/icon, locale, route, 권한 seed/policy와 전체 test |

## 완료 체크리스트

- 기존 domain과 component를 중복 생성하지 않았는가?
- 현재 동작을 코드와 테스트에서 확인하고 변경 전후 차이를 명확히 했는가?
- 반드시 유지할 기존 동작을 회귀 테스트로 보호했는가?
- model, API 계약, 구현체, command와 UI가 단방향 경계를 따르는가?
- UI가 fixture, local API, HTTP transport 또는 고정 시스템 ID를 직접 참조하지 않는가?
- 메뉴·view·action이 registry와 실제 route/component에서 일치하는가?
- SSR route gate와 client action 노출이 동일한 UI 리소스 key를 사용하는가?
- 서버가 인증, 권한, 입력과 무결성을 다시 검증할 계약이 명확한가?
- 실패·빈 상태·긴 문구·키보드·320px 경계를 확인했는가?
- 테스트, Manifest export, format, lint, typecheck와 build가 통과하는가?
