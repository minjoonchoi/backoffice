# Backoffice

리소스 카탈로그, 접근 정책, 자격증명, IAM을 한곳에서 운영하기 위한 Next.js 백오피스입니다. 현재 저장소는 업무 화면과 권한 기반 UI를 검증하는 foundation이며, 실제 인증·백엔드 연동은 포함하지 않습니다.

## 빠른 시작

Node.js `24.19.x`와 pnpm `11.20.x`가 필요합니다.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:mock
```

브라우저에서 <http://localhost:3000>을 엽니다. `dev:mock`은 사용자와 권한이 준비된 로컬 데이터를 사용하므로 기능을 확인할 때 가장 간단한 실행 방법입니다.

| 목적               | 명령어           | 주소                    |
| ------------------ | ---------------- | ----------------------- |
| 업무 화면 확인     | `pnpm dev:mock`  | <http://localhost:3000> |
| 기본 상태로 개발   | `pnpm dev`       | <http://localhost:3000> |
| 디자인 시스템 확인 | `pnpm storybook` | <http://localhost:6006> |
| 전체 품질 검사     | `pnpm verify`    | -                       |

## 제공 범위

| 영역     | 주요 기능                                         |
| -------- | ------------------------------------------------- |
| 업무 홈  | 내 보유 정책과 조회 가능한 자격증명               |
| IAM      | 사용자, 조직, 역할, 어플리케이션 조회와 관계 관리 |
| 요청     | 접근 정책 부여와 자격증명 발급·교체·폐기 요청     |
| 카탈로그 | 서비스, 엔드포인트, 네임스페이스, UI 리소스 관리  |
| 시스템   | 요청 템플릿 관리                                  |

목록은 한 페이지에 최대 20개를 표시하며, 컬럼 조건을 선택해 검색합니다. 모바일 전용 패턴, 브랜드 테마와 다크 모드는 현재 범위에 포함하지 않습니다.

요구사항은 [문서 안내](docs/README.md)를 기준으로 [UI 기능 요구사항](docs/ui-functional-requirements.md)과 [서버 기능 요구사항](docs/server-functional-requirements.md)을 분리해 관리합니다. 실제 화면과 사용자 시나리오의 연결은 [메뉴별 PRD](docs/menu-prd/README.md)에서 확인하고, 갱신 작업은 [PRD 작성·갱신 가이드](docs/prd-authoring-guide.md)를 따릅니다. MVP 화면에서 제외한 확정 범위는 [MVP 이후 UI 기능 요구사항](docs/post-mvp-ui-functional-requirements.md)과 [MVP 이후 서버 기능 요구사항](docs/post-mvp-server-functional-requirements.md)에서 별도로 추적합니다.

## 로컬 mock 데이터

로컬 데이터를 바꾸려면 [fixture.yaml](src/mocks/fixture.yaml)을 수정합니다. 앱 시작 시 loader가 YAML 스키마와 데이터 참조를 검증하고, 코드에서 관리하는 메뉴·시스템 UI 리소스와 결합합니다. 잘못된 데이터는 임의로 보정하지 않고 시작 단계에서 오류로 처리합니다.

- 헤더의 사용자 메뉴에서 서버가 로드한 YAML fixture 사용자를 로그인 사용자로 바꿀 수 있습니다. 화면에서 새로 등록한 사용자는 클라이언트 메모리에만 존재하므로 로그인 후보에는 추가되지 않습니다.
- `David`: Backoffice 시스템 관리자
- `Emma`: 개발 2팀 조직장(소유 조직의 서비스·엔드포인트 운영)
- `Owen`: Backoffice 정책 운영자·Backoffice UI 리소스 관리자, 개발 1팀 경유 IAM 운영자
- `개발 1팀`: Backoffice IAM 운영자
- `Daniel`: IAM 영역이 제외된 Backoffice 일반 사용자 권한 확인용
- 변경 사항은 브라우저 메모리에만 유지되며 새로고침하면 YAML 기준으로 초기화됩니다.
- `BACKOFFICE_DATA_SOURCE=local-mock`은 development 환경에서만 허용됩니다.

YAML 로딩과 검증은 [fixture-loader.ts](src/mocks/fixture-loader.ts)가 담당합니다. 메뉴와 시스템 UI 리소스의 원본은 [menu-registry.ts](src/config/menu-registry.ts)입니다.

fixture는 [mock fixture API client](src/application/api/mock-fixture-api-client.ts)가 감싸고, 내부에서 [mock API client](src/application/api/mock-api-client.ts)의 실제 API와 같은 request/response 계약으로 처리합니다. auth·feature·UI runtime 코드는 fixture를 직접 import하지 않습니다.

## API 연동 구조

각 feature는 자기 `api.ts`에서 request/response 계약을 소유하고, 화면은 이를 조합한 [API client 인터페이스](src/application/api/api-client.ts)를 통해서만 데이터를 조회하고 변경합니다. `createBackofficeCommands`가 UI 입력을 request DTO로 변환하고, `BackofficeProvider`는 성공 응답 뒤 client의 최신 snapshot으로 상태를 갱신합니다.

현재 [client 조합 지점](src/application/api/client-factory.ts)은 fixture 기반 mock 구현체만 반환합니다. `pnpm dev`와 `pnpm dev:mock` 모두 mock client를 사용하며, `dev:mock`만 테스트용 사용자·업무 fixture를 적재합니다. 실제 연동 시 `BackofficeApiClient`를 구현하는 `http-api-client.ts`를 추가하고 이 조합 지점만 교체합니다. 페이지와 UI에는 mock/HTTP 분기나 자동 fallback을 두지 않습니다.

시스템 기본 역할·네임스페이스 식별자는 API snapshot의 `systemReferences`로 전달됩니다. 화면과 권한 계산은 ID를 하드코딩하지 않으며, 로컬 고정 UUID는 mock 초기 데이터 안에만 존재합니다.

인터페이스·구현체 위치, 조회와 command 흐름, 실제 HTTP 구현 절차는 [API client 연동 가이드](docs/api-client-boundary.md)를 기준으로 관리합니다.

## 권한과 UI 렌더링

메뉴 경로, 영역과 UI 리소스 키는 `menu-registry.ts`의 단일 `uiResourceRegistry`에서 파생합니다. 서버 데이터에는 프런트엔드 경로 대신 사용자·조직·역할에 부여된 정책과 UI 리소스 식별자만 저장합니다. UI 추가·삭제 시 등록 범위와 검증 절차는 [UI 리소스 레지스트리 관리](docs/ui-resource-registry.md)를 따릅니다.

페이지 요청 시 서버가 세션 사용자의 정책을 계산하고, 허용된 UI 리소스를 기준으로 메뉴와 주요 기능을 SSR 렌더링합니다. 시스템 기본 권한은 메뉴나 개별 리소스마다 정책을 만들지 않고 `Backoffice 일반 사용자`, 전문 운영자, 네임스페이스 관리 역할처럼 역할별로 묶습니다. 하나의 기능에 UI 리소스와 엔드포인트 권한이 함께 필요하면 한 정책에 두 리소스 유형을 묶어 부여합니다. 네임스페이스는 UI 리소스의 동기화·조회 범위를 격리하는 관리 단위이며 정책 리소스나 권한 부여 대상이 아닙니다. 서비스 카탈로그의 엔드포인트와 정책도 네임스페이스에 종속되지 않습니다. 목록·상세뿐 아니라 생성·수정·요청·동기화처럼 고유 URL을 가진 업무 페이지도 각각 독립 view로 관리합니다. 권한 없는 view의 링크와 행 이동은 제공하지 않고 직접 URL에는 403 화면을 표시하며, 권한이나 세션을 확인할 수 없을 때 모든 기능을 허용하는 fallback은 사용하지 않습니다.

요청 UI는 현재 사용자의 직접·조직·역할 경유 정책과 조회 가능한 활성 자격증명을 함께 계산합니다. 정책 ID가 달라도 동일한 효과의 리소스를 모두 보유하면 요청 버튼을 숨기고, 일부만 보유하면 보유·누락 수를 구분합니다. 자격증명은 조직 소유 어플리케이션을 소유 주체로 선택하며 같은 어플리케이션·서비스에 활성 자격증명이 있으면 신규 발급 대상에서 제외합니다. 같은 조건은 요청 저장 시에도 다시 검증합니다.

상태·유형·효과·대상처럼 조건 분기에 쓰이는 도메인 문자열은 feature `model.ts`의 상수 객체에서 schema와 타입까지 함께 파생합니다. 배치와 예외 기준은 [프로젝트 코드 구조](docs/project-structure.md#도메인-식별값과-문자열)를 따릅니다.

UI 노출 제어는 사용자 경험을 위한 방어선입니다. 실제 API를 연결할 때는 같은 정책을 서버 엔드포인트에서도 반드시 검증해야 합니다.

## UI 리소스 동기화

코드에 등록된 UI 리소스 manifest를 YAML 또는 JSON으로 추출할 수 있습니다.

```bash
pnpm --silent ui-resources:export --format yaml
pnpm --silent ui-resources:export --format json
```

동기화 흐름은 다음과 같습니다.

1. UI 카탈로그의 `네임스페이스`에서 대상 시스템과 시스템 관리자 역할을 지정합니다.
2. 카탈로그의 `UI 리소스`에서 동기화를 시작합니다.
3. 네임스페이스를 선택하고 manifest를 붙여 넣습니다.
4. 추가·갱신·정상 복구·고아 예정 리소스와 시스템 관리자 전체 권한 부여 여부를 검토하고 제외할 항목을 선택합니다.
5. 동기화 후 남은 고아 리소스는 자동 삭제하지 않고 별도로 정리합니다.

UI 리소스 키는 lowerCamelCase depth를 콜론으로 연결합니다. 예: `services:list:createService`. 같은 키는 서로 다른 네임스페이스에서 독립적으로 관리됩니다.

코드 manifest는 `메뉴 → view → component/action` 계층을 사용합니다. 목록·상세·생성·수정·요청·동기화 같은 고유 URL 페이지가 `view`, 권한에 따라 통째로 제어하는 테이블·카드가 `component`, API 호출과 연결되는 등록·수정·삭제 기능이 `action`입니다.

UI 리소스는 개별 활성 상태를 가지며 상위 리소스가 비활성이면 활성 하위 리소스도 노출되지 않습니다. 수동으로 변경한 상태는 Manifest 재동기화 시 유지됩니다.

권한 제어 대상 메뉴·view·컴포넌트·액션을 추가하거나 삭제할 때는 같은 변경에서 `uiResourceRegistry`도 갱신해야 합니다. 표현 전용 디자인 시스템 컴포넌트는 등록 대상이 아닙니다.

## 디자인 시스템

Storybook이 foundation과 컴포넌트 사용법의 기준입니다. 컴포넌트 배치, Base UI 사용, 토큰, 접근성과 반응형 판단은 [UI 구현 가이드](docs/ui-engineering-guidelines.md)를 따릅니다.

```bash
pnpm storybook
```

- `Foundation`: 원칙, 색상·타이포·간격 토큰, 레이아웃, 접근성, 문구 규칙
- `Components`: 폼, 테이블, 오버레이와 조합 패턴의 상태·상호작용
- 테마: cool slate neutral과 blue point를 중심으로 한 light theme

컴포넌트를 추가하거나 변경할 때는 기본 상태뿐 아니라 disabled, invalid, loading, keyboard interaction과 320px viewport를 함께 확인합니다.

## 프로젝트 구조

```text
src/
├── app/                    # App Router 페이지와 레이아웃
├── application/            # API 조합, bootstrap, 전역 상태와 공통 업무 UI
├── auth/                   # 인증 port와 UI 리소스 권한 계산
├── components/
│   ├── ui/                 # source-owned 기본 컴포넌트
│   └── patterns/           # DataTable 등 공통 조합 패턴
├── config/menu-registry.ts # 메뉴와 UI 리소스 manifest 원본
├── domain/                 # feature 중립 공통 계약과 서버 시스템 참조
├── features/
│   ├── access-policies/    # 접근 정책과 정책 부여 요청
│   ├── credentials/        # 자격증명 발급·교체·폐기
│   ├── home/               # 사용자별 업무 홈
│   ├── iam/                # 사용자·조직·역할·어플리케이션
│   ├── request-templates/  # 요청 입력과 처리 순서 템플릿
│   ├── service-catalog/    # 서비스와 엔드포인트
│   └── ui-resources/       # 네임스페이스·UI 리소스 동기화
└── mocks/                  # development 전용 YAML fixture와 loader
```

새 업무 기능은 `src/features/<domain>`에 두고 해당 feature의 `api.ts`가 API 계약을 소유합니다. 여러 도메인을 조합하는 API client, 초기화, 전체 상태와 공통 업무 UI는 `src/application`에서 책임별로 분리합니다. 업무 규칙에 의존하지 않는 UI만 `src/components`로 이동합니다. 실제 인증은 `src/auth`의 `AuthPort`, 백엔드 통신은 `src/lib/api-transport.ts`의 `ApiTransport` 경계에서 연결합니다. 세부 배치 기준은 [프로젝트 코드 구조](docs/project-structure.md)를 따릅니다.

신규 메뉴·화면·API command를 추가하거나 기존 기능을 확장·변경할 때는 [기능 구현·변경 작업 흐름](docs/feature-implementation-workflow.md)의 Quick Start 요구사항 양식과 API 계약, UI 리소스, route gate, 검증 순서를 따릅니다.

## 검증

변경 범위에 맞는 개별 명령을 먼저 실행하고, 완료 전에는 전체 검증을 실행합니다.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm storybook:test
pnpm storybook:build
pnpm build
```

한 번에 실행하려면 다음 명령을 사용합니다.

```bash
pnpm verify
pnpm e2e
```

`verify`는 포맷, lint, 타입, unit coverage, Storybook test/build와 Next build를 실행합니다. `e2e`는 production 및 Storybook build 후 Chromium, Firefox, WebKit에서 핵심 흐름을 검증합니다. serious/critical axe 위반은 테스트 실패로 처리합니다.

## Production과 Docker

실제 인증이 연결되지 않은 production 실행은 기본적으로 `503`으로 차단됩니다. 아래 환경 변수는 로컬 기술 검증에만 사용합니다.

```bash
pnpm build
pnpm prepare:standalone
ALLOW_UNAUTHENTICATED_BACKOFFICE=true pnpm start
```

Docker로 확인할 수 있습니다.

```bash
docker build -t backoffice-foundation .
docker run --rm -p 3000:3000 \
  -e ALLOW_UNAUTHENTICATED_BACKOFFICE=true \
  backoffice-foundation
```

상태 확인 경로는 <http://localhost:3000/api/healthz>입니다. `ALLOW_UNAUTHENTICATED_BACKOFFICE`는 Docker 이미지에 포함하지 않습니다.

## 기술 구성

- Next.js App Router, React, TypeScript
- Tailwind CSS, shadcn/ui, Base UI
- next-intl
- TanStack Query/Table, React Hook Form, Zod
- Vitest, Storybook, MSW, Playwright, axe
- Next.js standalone, Docker

정확한 버전은 [package.json](package.json)과 `pnpm-lock.yaml`에 고정되어 있습니다.
