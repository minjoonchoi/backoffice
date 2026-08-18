# UI 리소스 레지스트리 관리

## 목적과 원본

`src/config/menu-registry.ts`의 `uiResourceRegistry`는 Access Governance 코드 소유 UI 리소스의 단일 원본(SSOT)이다. 다음 결과는 별도로 관리하지 않고 레지스트리에서 파생한다.

- 권한 검사에 사용하는 `uiResourceKeys`
- LSB 구성을 위한 `menuDefinitions`
- 메뉴별 화면 목록인 `menuViewDefinitions`
- YAML·JSON 동기화에 사용하는 `uiResourceManifest`
- UI 리소스 key의 TypeScript 타입

Manifest나 mock 데이터에 코드 소유 UI 리소스를 직접 추가하여 레지스트리를 우회하지 않는다.

## 등록 대상

다음 변경은 UI 구현과 같은 작업에서 `uiResourceRegistry`에도 반영해야 한다.

- 메뉴 또는 라우팅 가능한 목록·상세 화면의 추가·삭제
- 권한에 따라 표시 여부가 달라지는 버튼, 폼 제출, 테이블, 카드 또는 도구 모음의 추가·삭제
- API command와 연결되는 생성·수정·삭제·승인 등의 액션 추가·삭제
- 기존 UI 리소스의 부모 계층이나 의미 변경

단순 레이아웃, 아이콘, `Button`·`Input` 같은 디자인 시스템 primitive와 권한 경계를 만들지 않는 표현 전용 컴포넌트는 개별 UI 리소스로 등록하지 않는다. 기존 권한 경계 안에서 재사용되는 컴포넌트도 새 key를 만들지 않는다.

리소스 유형은 다음 기준으로 선택한다.

| 유형        | 기준                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| `menu`      | LSB에서 접근하는 최상위 메뉴                                                 |
| `view`      | 직접 URL 접근을 제어하는 목록·상세·생성·수정·요청·동기화 페이지              |
| `action`    | API command와 연결되거나 독립적으로 숨겨야 하는 버튼·폼 액션                 |
| `component` | 테이블·카드·도구 모음 전체가 하나의 독립적인 조회 또는 표시 권한 경계인 경우 |

현재 코드 레지스트리에 독립적인 `component` leaf는 없다. 최초 `component` 리소스를 구현할 때는 Manifest만 수동 추가하지 말고 `uiResourceRegistry`의 view 구조와 `uiResourceKeys` 파생 로직이 `component`를 함께 생성하도록 확장해야 한다.

## key와 URL 규칙

- URL은 kebab-case를 유지한다. 예: `/service-endpoints`.
- UI 리소스의 각 depth는 lowerCamelCase를 사용하고 콜론으로 연결한다. 예: `serviceEndpoints:detail:updateEndpoint`.
- 권한 검사와 `data-ui-resource`에는 문자열을 직접 쓰지 않고 `uiResourceKeys`를 사용한다.
- URL은 권한 식별자가 아니다. URL 변경만으로 UI 리소스 key를 변경하지 않는다.

```tsx
localSession.canAccessUiResource(
  uiResourceKeys.services.detail.actions.updateService,
)
```

## 변경 절차

### 추가

1. 기존 메뉴와 view 중 어느 부모에 속하는지 확인한다.
2. `uiResourceRegistry`에 lowerCamelCase 프로퍼티와 사용자에게 표시할 이름을 추가한다.
3. 구현 코드에서는 파생된 `uiResourceKeys`만 참조한다.
4. 기본 역할에 즉시 제공해야 하는 기능이면 `src/mocks/system-fixture.ts`의 역할별 mock 정책 구성도 의도적으로 갱신한다. 실제 서버 초기 정책은 서버 seed/migration에서 별도로 관리하며, 새 리소스를 모든 기존 역할에 자동 부여하지 않는다.
5. 회귀 테스트와 YAML·JSON export를 확인한다.

### 삭제

1. 코드의 route gate, 링크, 권한 검사와 `data-ui-resource` 참조를 먼저 제거한다.
2. 같은 변경에서 `uiResourceRegistry` 항목을 제거한다.
3. 동기화 시 서버의 기존 항목은 자동 삭제하지 않고 고아 리소스로 표시되는지 확인한다.
4. 고아 리소스와 연결 정책은 운영자가 검토한 뒤 명시적으로 정리한다.

key 변경은 기존 리소스 삭제와 신규 리소스 추가로 취급한다. 임시 alias나 이중 key를 만들지 않으며, 이미 부여된 정책의 이관이 필요하면 별도 데이터 변경 절차를 함께 정의한다.

## 검증

레지스트리 변경 후 최소한 다음 검증을 실행한다.

```bash
pnpm vitest run --project unit \
  src/config/menu-registry.test.ts \
  src/features/ui-resources/ui-resource-manifest.test.ts
pnpm --silent ui-resources:export --format yaml
pnpm --silent ui-resources:export --format json
pnpm verify
```

`menu-registry.test.ts`는 레지스트리에서 메뉴·view, 키 트리와 Manifest가 빠짐없이 파생되는지, URL과 UI 리소스 key 규칙이 분리되는지를 검증한다.
