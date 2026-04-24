# 실행 계획 — AI 일기장

## 일정 전략
- 당초 목표: 1주(7일) MVP.
- **현실화**: UX 3종(다크모드 / 검색 / 달력 뷰)을 MVP에 모두 포함하므로 **총 8~9일**로 확장.
- Day 7은 원래 버퍼였으나 달력 뷰 구현 난이도를 감안해 **작업에 흡수**. Day 9는 최종 폴리싱 버퍼.
- 각 Phase는 반나절~하루 단위, 모든 Phase 끝에 **DONE 조건** 명시.

---

## Phase 0 · Day 0.5 — 환경 셋업
**목표**: 코드 첫 줄 쓰기 전에 Supabase·Vercel·Gemini 키와 Next.js 뼈대를 모두 준비.

**작업**
- `npx create-next-app@latest` (TypeScript, App Router, Tailwind 활성화)
- `npx shadcn@latest init` + 다크모드용 `class` 전략 설정
- Supabase 프로젝트 생성
  - `diaries`, `diary_shares` 테이블 + 인덱스 + RLS SQL 실행 (`REQUIREMENTS.md` §9, §10 참조)
  - Storage 버킷 `diary-photos` (private) + policy 생성
- Google AI Studio에서 **Gemini API key** 발급
- Vercel 프로젝트 연결, 리포 연동
- 환경 변수 세팅: `.env.local` 및 Vercel Environment Variables
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `GEMINI_API_KEY` (server only)
- 라이브러리 설치: `@supabase/supabase-js`, `@supabase/ssr`, `@google/generative-ai`, `next-themes`, `react-day-picker`
- `lib/supabase/{client,server}.ts` 스캐폴딩

**주요 파일**
- `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`

**리스크**
- RLS 경험이 없으면 정책 디버깅에서 시간 소모 → 최소 예제(본인 row select)부터 검증.

**DONE 조건**
- `npm run dev`로 빈 홈페이지가 뜨고, Supabase Studio에서 두 테이블과 버킷이 확인되며, Gemini API key로 curl 테스트가 200을 반환.

---

## Phase 1 · Day 1 — 인증 + 보호 라우팅
**목표**: 매직링크 로그인 플로우 완성, 비로그인 사용자의 앱 접근 차단.

**작업**
- Supabase Auth 이메일 매직링크 설정(Redirect URL에 `http://localhost:3000/auth/callback` 등록)
- `/login` 페이지 (이메일 입력 → `signInWithOtp`)
- `/auth/callback` Route Handler (세션 교환)
- `middleware.ts`로 `/diaries/**` 등 보호 라우팅
- 상단 레이아웃에 사용자 이메일 + 로그아웃 버튼

**주요 파일**
- `middleware.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/(app)/layout.tsx`

**리스크**
- 매직링크 redirect URL 누락 시 콜백 실패 → 로컬/프로덕션 URL 모두 사전 등록.

**DONE 조건**
- 로그아웃 상태에서 `/diaries` 접근 시 `/login`으로 리다이렉트, 로그인 후 접근 가능, 새로고침해도 세션 유지.

---

## Phase 2 · Day 2 — 일기 CRUD
**목표**: 텍스트 기반 일기 작성/목록/상세/수정/삭제 완성 (사진/AI 제외).

**작업**
- 작성 폼: 날짜 picker, 카테고리 `select` (프리셋 6종), 본문 `textarea`
- 목록 페이지: 내 일기 역순, 카테고리 배지, 날짜 그룹핑(선택)
- 상세 페이지: 본문 렌더
- 수정/삭제: Server Actions, 삭제 시 `AlertDialog` 확인
- 빈 상태 UI ("아직 작성한 일기가 없어요")

**주요 파일**
- `app/(app)/diaries/page.tsx`
- `app/(app)/diaries/new/page.tsx`
- `app/(app)/diaries/[id]/page.tsx`
- `app/(app)/diaries/[id]/edit/page.tsx`
- `app/(app)/diaries/actions.ts`

**리스크**
- Server Actions 내 세션 획득 방식(`createServerClient`) 숙지 필요.

**DONE 조건**
- 일기 생성 → 목록 반영 → 상세 → 수정 → 삭제의 풀 사이클이 동작하며, 다른 계정의 일기는 보이지 않음(RLS 검증).

---

## Phase 3 · Day 3 오전 — 사진 업로드
**목표**: 일기당 1장의 사진 업로드·표시.

**작업**
- 업로드 컴포넌트: 확장자(`jpg/png/webp`) + 용량(5MB) 검증, 미리보기
- 업로드 경로: `{user_id}/{diary_id}.{ext}`
- 상세 페이지에서 signed URL 발급(서버) → `<Image>` 렌더
- 삭제 시 Storage 객체도 함께 삭제(실패해도 DB는 정상 삭제)

**주요 파일**
- `components/PhotoUploader.tsx`, `lib/storage.ts`

**리스크**
- RLS + Storage policy 동시 디버깅 → 콘솔에서 anon / authed 각각 테스트.

**DONE 조건**
- 사진이 있는 일기 상세에서 이미지가 정상 렌더되고, 본인이 아닌 계정에서는 signed URL이 발급되지 않음.

---

## Phase 4 · Day 3 오후 ~ Day 4 오전 — AI 연동 (Gemini 2.5 Flash)
**목표**: 저장 시 자동으로 감정 이모지 + 해시태그 부여.

**작업**
- `app/api/analyze/route.ts` 작성 (세션 검증 → Gemini 호출 → JSON 파싱 → 화이트리스트 검증)
- 프롬프트는 `REQUIREMENTS.md` §11 참조, JSON 모드 사용
- 일기 **저장 직후 동기 호출** (MVP는 단순함 우선) → 결과를 `diaries` row `update`
- 실패 시 `emotion_emoji = null`, `hashtags = '{}'` → 상세 페이지에 "재분석" 버튼 노출
- UI: 상세 페이지 상단에 이모지 배지 + 해시태그 칩 리스트

**주요 파일**
- `app/api/analyze/route.ts`, `lib/ai/gemini.ts`, `lib/ai/validate.ts`

**리스크**
- Gemini JSON 이탈 → 스키마 강제 + 사후 검증 2중 처리.
- rate limit → 에러 토스트 + 재시도 UX.

**DONE 조건**
- 새 일기 저장 후 1~5초 내로 이모지와 해시태그 5개 이하가 표시됨. 실패해도 일기 자체는 저장되고, "재분석" 버튼이 노출됨.

---

## Phase 5 · Day 4 오후 — 다크모드
**목표**: 라이트/다크/시스템 전환.

**작업**
- `next-themes` 적용, `ThemeProvider`를 `app/layout.tsx`에 래핑
- 헤더에 토글 버튼(shadcn `DropdownMenu` 또는 단일 토글)
- 전체 페이지 `dark:` 변형 확인, 대비 점검
- `<html suppressHydrationWarning>` 세팅

**주요 파일**
- `components/ThemeToggle.tsx`, `components/ThemeProvider.tsx`, `app/layout.tsx`

**리스크**
- 하이드레이션 불일치 경고 → SSR 가드 필요.

**DONE 조건**
- 토글로 3가지 모드 즉시 반영, 새로고침해도 유지, 모든 페이지에서 대비 문제 없음.

---

## Phase 6 · Day 5 — 공유 (이메일 초대, 읽기 전용)
**목표**: 지정한 이메일에 일기를 읽기 전용으로 공유.

**작업**
- 일기 상세에 **공유 관리 섹션**: 이메일 추가 / 초대 목록 / 제거
- `diary_shares` CRUD (Server Actions) — insert는 소유자만, unique 충돌은 graceful
- 목록 페이지에 **"내 일기" / "공유받은 일기" 탭** (쿼리 파라미터 `?tab=mine|shared`)
- 읽기 전용 상세: 수정/삭제/재분석 버튼 숨김(기존). 비소유자에게는 소유자 전용 notice(사진 실패 / 분석 실패)도 숨긴다 — 재시도 버튼이 없어 안내가 모순되기 때문.

**주요 파일**
- `app/(app)/diaries/[id]/share-manager.tsx` (클라이언트, `useActionState`)
- `app/(app)/diaries/[id]/page.tsx` (소유자 섹션 렌더)
- `app/(app)/diaries/page.tsx` (탭 분리)
- `app/(app)/diaries/actions.ts` 확장 (`addShare` / `removeShare`)

**리스크**
- 공유받는 사용자도 **동일 앱에 로그인**해야 함을 UI에 명확히 안내.

**DONE 조건**
- 계정 A가 계정 B의 이메일로 공유 → B로 로그인 시 "공유받은 일기"에 표시 + 읽기만 가능. B가 수정/삭제 버튼을 볼 수 없고, 직접 호출해도 RLS가 차단.

---

## Phase 7 · Day 6 오전 — 검색
**목표**: 본문 + 해시태그 기반 검색.

**작업**
- 상단 검색창 → 쿼리 파라미터 `?q=...`
- 본문: `content ilike '%q%'`
- 해시태그: 입력이 `#`로 시작하면 `hashtags @> ARRAY[q]`, 아니면 본문과 OR
- 결과 목록은 기존 카드 UI 재사용, 빈 상태 처리

**주요 파일**
- `app/(app)/diaries/page.tsx` 쿼리 확장, `components/SearchBar.tsx`

**리스크**
- Postgres 정렬/성능은 데이터 소량이라 문제 없음. v2에서 pg_trgm / tsvector 업그레이드.

**DONE 조건**
- 본문 키워드와 `#해시태그` 둘 다 검색되며, 결과 개수 0일 때 안내 문구 표시.

---

## Phase 8 · Day 6 오후 ~ Day 7 — 달력 뷰
**목표**: 월별 달력으로 작성 현황 시각화 + 날짜 네비게이션.

**작업**
- `react-day-picker` 도입 (또는 자체 구현)
- 해당 월의 `diaries` 쿼리 → 날짜별 존재 여부 + 대표 이모지 맵핑
- 작성한 날짜에 **점 또는 이모지 마킹**
- 날짜 클릭 → 그 일자 일기로 이동 (여러 건이면 그 날 필터된 목록)
- 모바일 레이아웃 별도 점검(셀 크기, 폰트)

**주요 파일**
- `app/(app)/calendar/page.tsx`, `components/DiaryCalendar.tsx`

**리스크**
- **손이 가장 많이 가는 Phase**. 여기서 밀리면 Day 7 버퍼 전부 소진.
- 일자 클릭 시 복수 일기 처리 UX를 초반에 확정할 것.

**DONE 조건**
- 월 이동 가능, 작성한 날짜가 시각적으로 구분됨, 날짜 클릭 시 정확한 일기(들)로 이동, 모바일에서도 조작 가능.

---

## Phase 9 · Day 8 — 반응형 / 접근성 / 배포
**목표**: 프로덕션 배포 및 스모크 테스트.

**작업**
- 320px / 375px / 768px / 1024px / 1440px 뷰포트 점검
- 키보드 네비게이션, 포커스 링, 폼 라벨 점검
- 빈 상태 / 에러 상태 / 로딩 상태 문구 통일
- Vercel **프로덕션 배포**
- Supabase Auth Redirect URL에 **프로덕션 도메인** 추가 (필수)
- 환경 변수 프로덕션용 세팅 확인
- 스모크 테스트 시나리오:
  1. 회원가입(매직링크) → 2. 일기 작성(사진 포함) → 3. AI 태깅 확인 → 4. 지인 이메일로 공유 → 5. 다른 계정으로 로그인해 공유받은 일기 열람 → 6. 검색 → 7. 달력 이동 → 8. 다크모드 토글.

**DONE 조건**
- 프로덕션 URL에서 위 8단계 시나리오 전부 성공.

---

## Phase 10 · Day 9 — 버퍼 / 폴리싱
**목표**: 남은 버그 수정 및 마감.

**작업**
- 발견된 버그 수정
- 로딩 스피너 / 스켈레톤 통일
- 오류 토스트 문구 다듬기
- (선택) README 간단 작성
- (선택) 이미지 클라이언트 압축 추가

**DONE 조건**
- 스모크 시나리오를 다시 돌려 크리티컬 이슈 0건.

---

## 마일스톤

| 마일스톤 | 완료 시점 | 상태 판별 기준 |
|---|---|---|
| M1 — 인증 가능 상태 | Day 1 종료 | 매직링크 로그인/로그아웃 동작 |
| M2 — 개인 일기장 동작 | Day 4 종료 | 텍스트+사진+AI 태깅까지 완성 |
| M3 — 공유 가능 상태 | Day 5 종료 | 이메일 초대 기반 읽기 전용 공유 완성 |
| M4 — UX 3종 완성 | Day 7 종료 | 다크모드 / 검색 / 달력 뷰 모두 동작 |
| M5 — 프로덕션 런칭 | Day 8 종료 | Vercel 배포 + 스모크 테스트 통과 |
| M6 — 폴리싱 완료 | Day 9 종료 | 크리티컬 이슈 0 |

---

## 검증 전략
- **수동 스모크 테스트**를 우선(개인 프로젝트 규모).
- 자동화 테스트는 Out of Scope. 다만 `analyze` 라우트의 화이트리스트 검증 유틸(`lib/ai/validate.ts`)은 간단한 unit 테스트를 추가하는 것을 권장(선택).
- 각 Phase DONE 조건을 그대로 체크리스트로 사용.

---

## 리스크 대응 계획

| # | 리스크 | 트리거 | 대응 |
|---|---|---|---|
| R1 | RLS / Storage policy 디버깅 지연 | Phase 0~3에서 권한 오류 반복 | Supabase 공식 예제 기반 최소 RLS → 점증 적용. anon/authed 각각 테스트. |
| R2 | Gemini JSON 스키마 이탈 | Phase 4에서 파싱 실패율 ↑ | JSON 모드 + 사후 화이트리스트 검증 2중. 실패 시 null 저장 + 재분석 버튼. |
| R3 | 일정 초과 | Phase 8(달력) 진입 시 Day 7 소진 | 달력 뷰에서 "이모지 마킹"을 "점 마킹"으로 단순화, 복수 일기 처리도 단순 목록으로 fallback. |
| R4 | 무료 티어 한도 초과 | Storage 사용량 급증 | 업로드 5MB 제한, 이미지 압축 옵션(Phase 10), Supabase 사용량 페이지 주기적 확인. |
| R5 | 매직링크 프로덕션 콜백 누락 | Phase 9 배포 후 로그인 실패 | 배포 체크리스트 필수 항목으로 포함, 프로덕션 URL 등록 확인. |

---

## 다음 작업
**senior-developer 에이전트에게 "Phase 0 환경 셋업부터 시작"이라고 지시하세요.**
Phase 0의 DONE 조건(빈 Next.js 홈 + Supabase 테이블/버킷 + Gemini key 검증)이 만족되면, Phase 1(인증 + 보호 라우팅)로 자연스럽게 이어집니다.
