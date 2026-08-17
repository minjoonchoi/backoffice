# 어플리케이션 메뉴 PRD

## 개요

- 목표: 자격증명과 시스템 관리 정책을 보유하는 독립 권한 주체를 IAM 영역에서 관리한다.
- routes: `/applications`, `/applications/{applicationId}`
- 주 사용자: IAM 운영자, 시스템 관리자
- 원본: UI `APP-001~102`, 서버 `APP-S001~003`

## 대표 화면

![어플리케이션 목록](assets/applications-list.png)

| 등록                                                               | 상세                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| ![어플리케이션 등록 Dialog](assets/applications-create-dialog.png) | ![어플리케이션 상세](assets/applications-detail.png) |

## 사용자 시나리오

| ID         | 사용자·선행 조건            | 사용자 흐름·완료 결과                                                             | UI 요구사항                     | 필요한 서버 기능                                                                         | 화면                                           |
| ---------- | --------------------------- | --------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| APP-SCN-01 | 어플리케이션 목록 view 권한 | 이름·snake_case slug·소유 조직으로 검색하고 행으로 상세에 진입한다.               | `APP-001~002`                   | IAM 권한, 엔티티별 filter·pagination·total (`APP-S001`)                                  | ![목록](assets/applications-list.png)          |
| APP-SCN-02 | 등록 action 권한            | 이름·slug·설명·소유 조직을 입력해 등록한다.                                       | `APP-003`, `COM-005`, `COM-028` | 이름·slug 고유성, snake_case와 소유 조직 존재 검증 (`APP-S001~002`)                      | ![등록](assets/applications-create-dialog.png) |
| APP-SCN-03 | 상세 view 권한              | 기본 정보, 소유 자격증명과 자동 부여된 시스템 관리 정책을 독립 목록으로 조회한다. | `APP-101`, `COM-030`            | 자격증명·직접 시스템 관리 정책 query와 연결 상세 ID (`APP-S003`, `KEY-S001`, `POL-S018`) | ![상세](assets/applications-detail.png)        |
| APP-SCN-04 | 수정 action 권한            | 이름·설명·소유 조직을 수정하되 slug는 읽기 전용으로 유지한다.                     | `APP-003`, `APP-102`            | slug 불변, 소유 조직 존재와 권한 재검증 (`APP-S002`)                                     | ![상세](assets/applications-detail.png)        |
| APP-SCN-05 | 삭제 action 권한            | 삭제 영향과 보호 관계를 확인하고 자격증명·정책 부여가 없을 때만 삭제한다.         | `APP-102`                       | 자격증명·정책 관계가 있으면 거부하는 원자적 삭제 (`APP-S002`)                            | ![상세 action](assets/applications-detail.png) |
