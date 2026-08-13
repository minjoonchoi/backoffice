# 프로젝트 코드 구조

## 원칙

업무 도메인과 애플리케이션 조합 책임을 분리한다. `features`에는 독립적인 업무 개념을 두고, 여러 feature를 하나의 Backoffice 애플리케이션으로 연결하는 코드는 `application`에 둔다.

## 디렉터리 책임

```text
src/
├── app/                    # Next.js route, layout, route handler
├── application/
│   ├── api/                # feature API 조합, mock/HTTP client 선택과 mock 저장소
│   ├── bootstrap/          # 초기 데이터 source 선택과 시스템 기본 데이터
│   ├── state/              # 전체 상태 모델과 React Provider
│   └── ui/                 # 여러 feature가 함께 사용하는 업무 UI
├── domain/                 # feature에 종속되지 않는 공통 도메인 계약
├── features/
│   └── <domain>/
│       ├── api.ts          # 해당 feature의 command와 client request/response 계약
│       ├── local-api.ts    # fixture 기반 mock 구현과 로컬 상태 전이
│       ├── model.ts        # schema와 도메인 모델
│       └── *.tsx           # 해당 feature 전용 화면과 dialog
├── auth/                   # 인증 port와 권한 계산
├── components/             # 업무 규칙에 의존하지 않는 UI와 조합 패턴
├── config/                 # 정적 registry와 애플리케이션 설정
├── lib/                    # 업무에 의존하지 않는 기술 유틸리티
└── mocks/                  # development fixture와 loader
```

## `application` 하위 책임

### `api`

- `api-client.ts`: 각 feature의 `api.ts`를 `BackofficeApiClient`와 `BackofficeCommands`로 조합한다.
- `mock-api-client.ts`: feature의 `local-api.ts` 구현을 조합한다.
- `mock-fixture-api-client.ts`: system/YAML fixture와 로컬 session seed를 감싸는 bootstrap client다.
- `client-factory.ts`: 현재 실행에서 사용할 mock 또는 HTTP 구현체를 선택하는 단일 지점이다.
- `local-state.ts`: mock 구현체만 사용하는 메모리 상태 갱신 도구다.

### `bootstrap`

- `initial-state.ts`: 실행 환경과 data source를 검증하고 초기 조회 client를 만든다.
- fixture 데이터 자체는 소유하지 않고 `mock-fixture-api-client.ts`를 동적으로 선택한다.

### `state`

- `model.ts`: 여러 feature 엔티티를 묶는 `BackofficeState`를 정의한다.
- `commands.ts`: 화면 command를 API request DTO로 변환한다.
- `provider.tsx`: client 수명주기와 응답 snapshot의 React 상태 반영만 담당한다.

### `domain`과 `ui`

- `domain/common.ts`: 여러 feature가 공유하는 식별자·상태·command 결과 계약이다.
- `domain/system-references.ts`: snapshot으로 받은 시스템 역할·그룹·네임스페이스 참조 계약이다.
- `ui`: 여러 feature가 함께 사용하는 할당, 관계 제거, 상태 표시 같은 업무 UI다. 범용 디자인 시스템 컴포넌트는 이곳이 아니라 `components`에 둔다.

## 배치 판단 기준

- 사용자, 조직, 정책, 자격증명처럼 독립된 업무 개념이면 `features/<domain>`에 둔다.
- 두 개 이상의 feature를 조합하거나 구현체를 선택하고 초기화하면 `application`에 둔다.
- Next.js URL과 요청 진입점만 담당하면 `app`에 둔다.
- 업무 모델을 몰라도 재사용할 수 있는 UI와 기술 코드는 각각 `components`, `lib`에 둔다.
- `backoffice`라는 포괄적인 feature를 다시 만들지 않는다. 새 파일의 책임이 불명확하면 관련 feature 또는 `application`의 구체적인 하위 책임부터 결정한다.

## API 파일 규칙

- 각 feature는 자기 `api.ts`에서 화면 command와 client request/response 계약을 관리한다.
- feature의 `model.ts`와 `api.ts`는 상위 `application` 상태나 bootstrap을 import하지 않는다.
- `application/api/api-client.ts`에는 feature별 세부 메서드를 다시 정의하지 않고 계약을 조합한다.
- mock 구현은 feature의 `local-api.ts`, 실제 구현은 규모에 따라 feature의 `http-api.ts`에 둔다.
- app·auth·feature·UI runtime 코드는 `mocks` 또는 system fixture를 직접 import하지 않는다. fixture 선택과 로딩은 bootstrap API client 경계 안에서만 수행한다.
- 전체 client 구현과 선택 흐름은 [Backoffice API client 경계](api-client-boundary.md)를 따른다.
