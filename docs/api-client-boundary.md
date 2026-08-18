# Access Governance API client 경계

## 목적

화면과 데이터 구현체를 분리해 현재 YAML/system fixture 기반 mock을 사용하면서도, 화면 코드를 바꾸지 않고 실제 HTTP API client로 교체할 수 있게 한다.

## 호출 흐름

```text
페이지·도메인 UI
  → useBackoffice command facade
  → createBackofficeCommands (request DTO 변환)
  → BackofficeApiClient
  → mock domain API 또는 실제 HTTP API
  → response
  → getSnapshot response로 화면 상태 갱신
```

- 화면은 기존의 의미 중심 command를 사용하고 transport 형식을 알지 않는다.
- `createBackofficeCommands`는 위치·본문·요청자 식별자를 명시한 request DTO로 변환하며 업무 규칙을 구현하지 않는다.
- 인증 주체가 필요한 command에서 화면이 요청자 식별자를 생략하면 facade가 현재 세션 사용자를 DTO에 채운다. 로컬 API는 식별자가 없거나 해당 UI 리소스 권한이 없으면 허용하지 않는다.
- `BackofficeProvider`는 client 수명주기, 성공 후 snapshot 재조회와 React 상태 반영만 담당한다.
- `BackofficeApiClient`는 조회와 IAM, 결재 템플릿, 정책, 요청 문서, 자격증명, 서비스 카탈로그, UI 리소스 API 계약을 묶는 교체 경계다.
- 성공한 command 뒤에는 client의 snapshot response를 다시 읽는다. 화면은 응답 엔티티를 추측해 별도로 보정하지 않는다.

### 조회

```text
Next.js server layout
  → createBackofficeQueryClient
  → BackofficeApiClient.getSnapshot(request)
  → GetBackofficeSnapshotResponse
  → BackofficeProvider initialState
  → 페이지 렌더링
```

초기 조회와 command 이후 재조회는 동일한 `getSnapshot` 계약을 사용한다. 현재는 화면에 필요한 조합 데이터를 한 번에 반환하며, client 밖에서 fixture나 저장소를 직접 읽지 않는다.

시스템 기본 역할·네임스페이스의 ID도 `systemReferences`로 snapshot에 포함한다. 화면과 권한 계산은 코드 상수나 이름 검색 대신 이 응답값을 사용한다. 실제 서버 연동 시 서버가 이 참조를 소유하며, 고정 UUID는 로컬 bootstrap 데이터 안에서만 사용한다.

### 생성·수정·삭제

```text
UI command(input)
  → createBackofficeCommands
  → 도메인 request DTO({ body, id, requesterId, ... })
  → BackofficeApiClient.<domain>.<operation>(request)
  → CommandResult response
  → 성공 시 getSnapshot({})
  → Provider 상태 갱신
```

실패 응답은 상태를 갱신하지 않고 그대로 UI에 전달한다. 통신 오류와 검증되지 않은 응답은 성공 결과로 변환하지 않는다.

## 파일별 책임

```text
src/application/
├── api/
│   ├── api-client.ts      # feature API 계약을 전체 client로 조합
│   ├── mock-api-client.ts # fixture 기반 BackofficeApiClient 구현
│   ├── mock-fixture-api-client.ts # fixture를 감싼 bootstrap client
│   ├── http-api-client.ts # 실제 API 연결 시 추가할 구현체
│   └── client-factory.ts  # 사용할 구현체를 선택하는 단일 조합 지점
├── bootstrap/
│   └── initial-state.ts   # 서버 초기 조회용 client 생성
└── state/
    ├── commands.ts        # UI command를 request DTO로 변환
    └── provider.tsx       # client 수명주기와 응답 snapshot 반영

src/features/<domain>/
├── api.ts                 # feature command와 request/response 계약
├── local-api.ts           # mock 업무 규칙과 상태 전이
└── http-api.ts            # 실제 도메인 HTTP 호출

src/lib/api-transport.ts   # 공통 HTTP 실행과 응답 schema 검증
```

인터페이스는 구현체를 import하지 않는다. `BackofficeProvider`와 페이지는 mock·HTTP 구현체를 직접 import하지 않고 `client-factory.ts`가 반환한 계약만 사용한다.

## 현재 mock 구현

- [mock-api-client.ts](../src/application/api/mock-api-client.ts)는 검증된 system/YAML fixture를 내부 상태로 가진다.
- [mock-fixture-api-client.ts](../src/application/api/mock-fixture-api-client.ts)만 system/YAML fixture와 로컬 기본 사용자 seed를 import한다. 서버 bootstrap은 이 client를 동적으로 로드하고, auth·feature·UI는 fixture를 직접 import하지 않는다.
- 도메인별 `local-api.ts`가 입력 스키마, 참조와 상태 전이를 검증한다.
- mock client도 실제 API와 같은 request 객체와 response 계약을 사용한다.
- snapshot은 방어적 복사본이므로 UI가 client 내부 데이터를 직접 변경할 수 없다.
- 현재 `client-factory.ts`에는 mock 구현만 연결되어 있다. 따라서 `pnpm dev`와 `pnpm dev:mock`, 기술 검증용 production 실행 모두 같은 mock client를 사용하고, 둘의 차이는 사용자 fixture 적재 여부뿐이다.
- HTTP 구현체는 아직 존재하지 않는다. 실제 API가 준비되기 전까지 실행 모드만으로 HTTP client가 자동 선택되거나 mock으로 fallback되지 않는다.

## 실제 API 교체

1. 변경 대상 feature의 `api.ts`와 [api-client.ts](../src/application/api/api-client.ts)의 조합 계약이 서버 API와 일치하는지 확인한다.
2. `src/application/api/http-api-client.ts`에 `BackofficeApiClient` 구현체를 만든다.
3. 공통 요청은 [api-transport.ts](../src/lib/api-transport.ts)를 사용하고 각 response를 Zod schema로 검증한다.
4. 호출 수가 많아지면 도메인별 `src/features/<domain>/http-api.ts`로 나누고 `http-api-client.ts`에서 조합한다.
5. [client-factory.ts](../src/application/api/client-factory.ts)가 HTTP 구현체를 반환하도록 변경한다.
6. `BackofficeProvider`, 페이지와 도메인 UI에는 mock/HTTP 분기나 실패 시 mock fallback을 추가하지 않는다.

인증 사용자는 서버 세션에서 결정해야 한다. request DTO의 `requesterId` 같은 값은 UI 편의를 위한 현재 계약이며 실제 서버는 이를 신뢰하지 않고 인증 주체, 최신 권한과 최신 데이터로 다시 검증한다.

현재 snapshot 계약은 화면에 필요한 조합 상태를 한 번에 제공한다. 서버 검색·정렬·페이지네이션을 도입할 때는 같은 client 아래에 domain query 계약을 추가하고, mock과 HTTP 구현을 함께 바꾼다. mock과 HTTP를 동시에 호출하거나 실패 시 mock으로 자동 전환하는 fallback은 두지 않는다.

## 외부 inbound hook 경계

Groo 결재 완료 hook은 브라우저에서 호출하는 `BackofficeApiClient` 계약에 포함하지 않는다. 운영 서버의 별도 inbound endpoint가 서명·발신 시각·재전송 방지 값을 검증한 뒤, 저장된 Groo 요청 ID로 요청을 찾아 [groo-approval-hook.ts](../src/features/access-policies/groo-approval-hook.ts)의 상태 전이 규칙을 적용한다.

- 화면은 hook URL, 인증 정보나 완료 상태를 직접 조작하지 않는다.
- hook 처리기는 같은 결과의 재전송을 멱등 처리하고 상충 결과를 거부한다.
- 요청 상태 변경, 감사 이벤트, 알림 outbox는 서버의 한 트랜잭션으로 저장한다.
- 프런트 mock client에 운영 hook을 흉내 내는 fallback endpoint를 추가하지 않는다.

목록 query는 한 종류의 엔티티와 고정된 행 DTO만 반환한다. 한 화면에서 여러 엔티티 유형이 필요하면 `resourceType` union 응답 하나로 합치지 않고 feature client에 유형별 query를 정의하고 화면의 탭·섹션에서 각각 호출한다. 정책 상세의 엔드포인트·UI 리소스가 대표 사례다. 반면 감사 이벤트, 알림과 동기화 작업은 대상 유형을 속성으로 가진 독립 엔티티이므로 한 query의 유형 필터로 조회할 수 있다.

## 검증 기준

- client request body가 local 도메인 schema에서 검증되는가
- 실패한 command가 snapshot을 변경하지 않는가
- 성공한 command 뒤 Provider가 client의 최신 snapshot을 반영하는가
- snapshot 응답이 client 내부 상태와 참조를 공유하지 않는가
- 시스템 레코드 ID가 코드 상수가 아니라 snapshot의 `systemReferences`에서 전달되는가
- production runtime의 app·auth·feature·UI가 `src/mocks`나 system fixture를 직접 import하지 않는가
- 실제 구현체 주입 시 Provider와 화면을 수정하지 않아도 되는가
- HTTP response가 schema 검증을 통과해야만 UI 상태에 반영되는가
- 인증·권한·무결성 검증이 client가 아니라 서버에서도 수행되는가
