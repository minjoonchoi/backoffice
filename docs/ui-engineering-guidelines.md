# UI 구현 가이드

## 목적과 우선순위

이 문서는 Backoffice UI를 추가하거나 수정할 때 적용할 공통 구현 기준이다. 특정 Codex 스킬이나 외부 UI 라이브러리가 없어도 같은 판단을 할 수 있도록 프로젝트 규칙만 정리한다.

기준이 충돌하면 다음 순서를 따른다.

1. [UI 기능 요구사항](ui-functional-requirements.md)과 사용자 요구사항
2. 기존 `src/components`, 동일 feature 구현과 Storybook story
3. 이 문서
4. 외부 라이브러리 예제와 도구의 일반 지침

외부 예제를 그대로 복사하지 않는다. 현재 프로젝트의 Base UI, Tailwind CSS 4, 토큰과 source-owned 컴포넌트 구조에 맞게 적용한다.

## 기술 기준

- 접근 가능한 동작이 필요한 primitive는 기존 `@base-ui/react` 기반 구현을 우선한다.
- `src/components/ui`에는 업무 도메인을 모르는 기본 컴포넌트를 둔다.
- `src/components/patterns`에는 `DataTable`, 검색 영역, 상세 그리드처럼 여러 feature에서 반복되는 조합을 둔다.
- 특정 업무 모델과 command를 아는 UI는 `src/features/<domain>`에 둔다.
- 기존 구성과 합의 없이 shadcn/Radix component를 새로 설치하거나 같은 컴포넌트를 중복 구현하지 않는다.
- TypeScript 타입을 유지하며 `any`나 강제 캐스팅으로 컴포넌트 계약을 우회하지 않는다.

## 컴포넌트 구성

- 새 컴포넌트를 만들기 전에 `src/components/ui`, `src/components/patterns`와 Storybook에서 유사 구현을 검색한다.
- 복합 UI는 작은 primitive를 조합하되 한 번만 쓰이는 단순 마크업을 성급하게 추상화하지 않는다.
- 공통 컴포넌트는 시각 표현과 상호작용을 담당하고 업무 검증, API 호출과 데이터 접근은 feature/application 경계에 둔다.
- 기존 public API를 변경해야 할 때는 실제 사용처를 먼저 확인하고 같은 변경에서 모두 수정한다. 추측한 호환 adapter나 fallback은 만들지 않는다.
- API와 연결되거나 권한 경계를 만드는 메뉴, view, component와 action은 [UI 리소스 레지스트리 관리](ui-resource-registry.md)를 함께 따른다. 표현 전용 primitive는 UI 리소스로 등록하지 않는다.

## 토큰과 스타일

- 토큰의 단일 원천은 `src/app/globals.css`의 primitive → semantic → component CSS 변수 계층이다.
- 화면과 컴포넌트에서는 가능한 한 `bg-surface`, `text-text-subtle`, `border-border-subtle`, `h-control` 같은 semantic/component utility를 사용한다.
- 기능 코드에 색상 hex나 임의의 상태색을 추가하지 않는다. 의미가 반복되면 기존 token을 사용하고 실제로 새로운 의미가 필요할 때만 token 계층을 확장한다.
- 기본 시각 언어는 Noto Sans KR, 14px body, 20~24px page title, 32px control, cool neutral과 blue point를 사용하는 light theme다. 브랜드 테마와 dark mode는 현재 범위가 아니다.
- 카드 기본 패딩은 12px, 테이블 헤더는 32px, layout gutter는 12~24px를 기준으로 한다. 간격, radius, shadow와 motion은 기존 scale을 사용하며 시선을 끄는 장식보다 정보 밀도와 상태 구분을 우선한다.
- motion은 짧고 기능적인 피드백에만 사용하며 `prefers-reduced-motion`에서도 정보나 동작이 사라지지 않게 한다.

## 레이아웃과 콘텐츠

- 데스크톱 백오피스를 중심으로 설계하되 320px viewport와 200% 확대에서도 콘텐츠 손실이나 겹침이 없어야 한다. 모바일 전용 navigation이나 별도 업무 패턴은 만들지 않는다.
- 입력 폼은 기본적으로 1열을 사용한다. 짧고 밀접한 값이 동시에 비교되어야 할 때만 다열을 사용한다.
- Dialog는 footer action이 화면 밖으로 밀리지 않게 하고, 긴 입력이나 목록은 전체 Dialog가 아니라 해당 세부 영역에 최대 높이와 scroll을 둔다.
- 목록은 공통 `DataTable`을 우선 사용한다. 컬럼 폭을 명시해 검색 결과가 바뀌어도 header가 흔들리지 않게 하고, 긴 값은 컬럼 목적에 따라 줄바꿈·말줄임·가로 scroll 중 하나를 명시적으로 선택한다.
- 목록에서 같은 도메인의 상세 이동은 행 클릭으로 제공한다. 다른 도메인의 상세로 이동하는 셀은 명시적인 text link를 사용한다.
- 상태는 의미에 맞는 `Badge`와 텍스트로 표현하며 색상만으로 구분하지 않는다.
- 한국어와 영어의 긴 문구를 확인하고, select의 option과 선택 결과는 같은 locale label을 사용한다.

## 상태와 피드백

- interactive component는 적용 가능한 `default`, `hover`, `active`, `focus-visible`, `disabled`, `read-only`, `invalid`, `selected/open`, `checked/indeterminate` 상태를 정의한다.
- 생성·수정 폼은 도메인 Zod 스키마를 입력 조건의 단일 원천으로 사용하고 `useDynamicFormValidation`으로 상호작용한 필드를 즉시 검증한다. 검토·저장 시도에는 `revealAll`로 전체 오류를 표시하며 같은 길이·형식 조건을 JSX와 별도 조건문에 중복 구현하지 않는다.
- 필드 오류는 해당 `Field`의 invalid 상태, 컨트롤의 `aria-invalid`·`aria-describedby`, `FieldValidationMessage`를 함께 사용한다. Select는 `FormSelect`의 `error`와 `onInteract` 계약을 사용한다.
- loading button은 별도 API를 중복 추가하지 않고 `disabled`, `aria-busy`와 spinner를 조합한다.
- 빈 결과, 검색 결과 없음, loading과 오류를 서로 다른 상태로 표현한다. 오류를 숨기거나 정상 결과로 대체하지 않는다.
- 파괴적이거나 관계를 제거하는 동작은 선택한 대상을 구체적으로 표시하고 필요한 경우 확인 Dialog를 사용한다.
- 작성 가능한 Dialog에서 입력·선택 내용이 변경된 뒤 X, Escape, 바깥 영역 또는 취소 버튼으로 닫으려 하면 내용이 사라진다는 확인을 제공한다. 계속 작성하면 상태를 유지하고 작성 취소를 확인하면 상태를 초기화한다. 조회 전용 Dialog와 저장 성공 후 닫기에는 이 경고를 표시하지 않는다.
- 버튼 문구는 `확인`보다 `사용자 추가`, `정책 삭제`처럼 결과가 드러나는 동사를 사용한다.

## 접근성

- 일반 텍스트는 WCAG AA 4.5:1, UI 경계와 focus indicator는 3:1 이상의 대비를 유지한다.
- semantic HTML을 우선하고 label, accessible name, description과 error message를 control에 연결한다.
- invalid 상태는 `aria-invalid`와 오류 문구를 함께 제공하며 색상만으로 전달하지 않는다.
- 모든 기능을 키보드로 실행할 수 있어야 한다. Dialog의 focus trap·Escape 종료·focus 복귀, Select와 RadioGroup의 방향키 탐색을 확인한다.
- 아이콘 전용 버튼에는 동작을 설명하는 accessible name을 제공한다.
- 권한이 없는 기능을 CSS로만 숨기지 않는다. SSR route gate와 UI 리소스 권한 판정 결과를 사용한다.

## Storybook과 검증

Storybook은 foundation과 공통 컴포넌트의 실행 가능한 사용 명세다.

- 공통 컴포넌트를 추가하거나 public 상태를 변경하면 해당 story도 같은 작업에서 갱신한다.
- variant, size, 상태, 한·영 긴 문구와 실제 조합 예시를 제공한다.
- Checkbox, Select, Dialog처럼 동작이 중요한 컴포넌트는 keyboard interaction과 focus 흐름을 검증한다.
- axe의 serious/critical 위반을 남기지 않고 320px과 desktop viewport를 확인한다.
- feature 전용 업무 규칙은 unit/E2E 테스트에 두고 Storybook을 mock 업무 화면 저장소로 사용하지 않는다.

완료 전에는 변경 범위에 맞는 테스트를 먼저 실행하고 최종적으로 다음 검증을 통과해야 한다.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm storybook:test
pnpm storybook:build
pnpm build
```

## 구현 체크리스트

- 기존 컴포넌트와 패턴을 재사용했는가?
- 업무 UI와 데이터/API 책임이 분리되어 있는가?
- hard-coded color 대신 프로젝트 token을 사용했는가?
- 긴 문구, 320px, 확대 환경에서 겹침과 콘텐츠 손실이 없는가?
- 키보드, focus, accessible name과 오류 연결을 확인했는가?
- loading, empty, error, disabled와 invalid 상태가 구분되는가?
- 필요한 Storybook story, 테스트와 UI 리소스 registry를 함께 갱신했는가?
