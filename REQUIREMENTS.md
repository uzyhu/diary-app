# 프로젝트 요구사항 — AI 일기장

## 1. 개요
AI가 감정 이모지와 해시태그를 자동으로 달아주는, 지정한 지인과 읽기 전용으로 공유 가능한 **웹 기반 일기장**입니다. 사용자는 매일의 일기를 날짜·카테고리·사진과 함께 기록하고, AI(Google Gemini 2.5 Flash)는 저장 시점에 감정 이모지 1개와 한국어 해시태그 최대 5개를 자동으로 부여합니다. 다크모드·검색·달력 뷰까지 MVP에 포함해 개인 사용자가 일상적으로 쓸 수 있는 수준으로 완성합니다.

## 2. 목표 및 성공 기준
- 본인과 지인 소수(5명 내외)가 매일 기록·열람할 수 있는 수준의 안정적인 웹앱 제공.
- 일기 1건 작성 → AI 태깅 완료까지 평균 5초 이내, 실패 시 재시도 가능.
- 모바일(320px~) 및 데스크톱에서 동일한 핵심 기능 사용 가능.
- 프로젝트 전체 운영 비용 **월 0원** 유지(모든 구성요소를 무료 티어 내에서 운영).

## 3. 사용자 / 이해관계자
- **주 사용자**: 프로젝트 오너 본인 및 초대받은 지인 소수.
- **이해관계자**: 오너 1인 (기획·개발·운영 겸임).
- **규모 가정**: 동시 사용자 수 한 자릿수, 월간 활성 사용자 10명 미만.

## 4. 제약 (Constraints)
- **무료 티어로만 운영**: 모든 외부 서비스는 free plan 한도 내에서 동작해야 함.
  - Supabase Free: DB 500MB, Storage 1GB, MAU 50,000, egress 5GB/월.
  - Vercel Hobby: 개인 프로젝트 무료 범위.
  - Google Gemini API 무료 한도: 약 분당 10req, 일 250req (Gemini 2.5 Flash 기준).
- 개발 기간: 당초 1주 목표였으나, UX 3종(다크모드·검색·달력 뷰)을 모두 MVP에 포함하기로 하여 **8~9일로 현실화**하거나 Day 7 버퍼를 해당 기능에 흡수한다. (자세한 일정은 `PLAN.md` 참조)
- 개발자 성향: 프론트엔드 경험 있음, 백엔드 부담 → **BaaS(Supabase) 중심**으로 설계.

## 5. 기능 요구사항 (Must-have, 이번 범위)

| ID | 기능 | 설명 |
|---|---|---|
| **FR-1** | 인증 | Supabase Auth **이메일 매직링크** 방식. 로그인 없이는 모든 앱 라우트 접근 불가. |
| **FR-2** | 일기 작성 | 필드: 날짜(date picker), 카테고리(프리셋 select), 본문(textarea), 사진 1장(선택). |
| **FR-3** | 일기 목록/상세/수정/삭제 | 본인 일기 역순 정렬 목록, 상세 페이지, 수정, 삭제(확인 다이얼로그). |
| **FR-4** | AI 자동 태깅 | 저장 시 **Gemini 2.5 Flash** 호출 → `{ emotion_emoji, hashtags[] }` JSON 응답 → 화이트리스트 검증 후 저장. 실패 시 null 저장 + "재분석" 버튼 제공. |
| **FR-5** | 카테고리 프리셋 | 6종 고정: **일상 / 운동 / 여행 / 업무 / 감정 / 기타**. 하루 단위로 1개 선택. 사용자 커스텀 불가(Out of Scope). |
| **FR-6** | 공유 | 일기 상세에서 **이메일 주소로 초대**하면 해당 이메일로 로그인한 사용자만 **읽기 전용**으로 열람 가능. 댓글/반응 없음. |
| **FR-7** | 사진 업로드 | 일기 1건당 **1장**, **최대 5MB**, 허용 확장자: `jpg`, `png`, `webp`. Supabase Storage `diary-photos` 버킷(private) + signed URL. |
| **FR-8** | 다크모드 | `next-themes` 기반 토글(시스템/라이트/다크), 전 페이지 `dark:` 클래스 대응. |
| **FR-9** | 검색 | **본문 `ilike`** 및 **해시태그 배열 매칭** 기준 검색. (제목 필드 없음.) 결과는 목록과 동일 카드 UI로 표시. |
| **FR-10** | 달력 뷰 | 월별 달력, 일기를 작성한 날짜에 점(또는 대표 이모지) 마킹. 날짜 클릭 시 해당 일자 일기로 이동(여러 건이면 해당 일자 목록). |

### 감정 이모지 화이트리스트 (FR-4 상세)
AI 응답은 아래 7종 중 정확히 1개여야 하며, 벗어나면 null로 저장한다.

| 이모지 | 라벨 |
|---|---|
| 😊 | 기쁨 |
| 😢 | 슬픔 |
| 😡 | 분노 |
| 😌 | 평온 |
| 😰 | 불안 |
| 😴 | 피곤 |
| 🤔 | 복잡 |

### 해시태그 규칙 (FR-4 상세)
- 한국어 해시태그, `#` 접두사 포함.
- **최대 5개** (AI가 더 반환해도 상위 5개로 절단).
- 중복 제거, 공백 제거, 각 태그 길이 상한 20자.

## 6. 비기능 요구사항
- **반응형**: 320px ~ 1440px 지원. 모바일 우선 설계.
- **접근성**: 시맨틱 마크업, 폼 라벨, 포커스 링 유지, 본문 대비 WCAG AA 수준 지향.
- **성능**: 초기 로드 First Contentful Paint 2.5s 이하(Vercel Edge 기준 희망치).
- **가용성**: 무료 티어 의존도 높음 → 의존 서비스 다운 시 사용자에게 명확한 오류 메시지.
- **이미지 최적화**: 업로드 전 클라이언트에서 간단한 리사이즈/압축 **(선택 사항, Nice-to-have)**.
- **비용**: 월 0원 유지 (유료 전환 시 사전 합의 필요).

## 7. Out of Scope (이번 범위 제외)
아래 항목은 **MVP에 포함하지 않음** — 이후 Phase에서 별도 검토.
- 댓글 / 좋아요 / 이모지 반응
- 푸시 알림, 이메일 리마인더
- 모바일 네이티브 앱(iOS/Android)
- 사용자 커스텀 카테고리
- 통계 / 대시보드 / 감정 트렌드 그래프
- 백업 / Export(JSON·Markdown·PDF)
- 상업적 배포, 다국어(i18n)
- 유료 구독·결제
- 전체 텍스트 검색(pg_trgm, tsvector) — 우선 `ilike`로 시작

## 8. 기술 스택

| 레이어 | 선택 |
|---|---|
| 프레임워크 | **Next.js 14+ (App Router)** |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS + **shadcn/ui** |
| 다크모드 | `next-themes` |
| 인증 / DB / Storage | **Supabase** (Auth 매직링크, Postgres, Storage private 버킷) |
| Supabase 클라이언트 | `@supabase/supabase-js`, `@supabase/ssr` |
| AI | **Google Gemini 2.5 Flash** (`@google/generative-ai`) |
| 배포 | **Vercel Hobby** |
| 달력 | `react-day-picker` (또는 자체 구현) |

### 환경 변수
| 키 | 위치 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | 서버 액션/라우트에서 관리자 작업용 (선택) |
| `GEMINI_API_KEY` | **server only** | Gemini API 호출용 |

## 9. 데이터 모델 (Supabase / Postgres)

```sql
-- auth.users는 Supabase Auth가 내장으로 제공

create table diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  category text not null check (category in ('일상','운동','여행','업무','감정','기타')),
  content text not null,
  emotion_emoji text,          -- AI가 채움, 7종 이모지 중 1개 (없으면 null)
  hashtags text[] default '{}',-- 최대 5개, 각 '#...'
  photo_path text,             -- Storage path (없을 수 있음)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on diaries(user_id, date desc);

create table diary_shares (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references diaries(id) on delete cascade,
  shared_with_email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (diary_id, shared_with_email)
);
create index on diary_shares(shared_with_email);
```

### Storage
- 버킷: **`diary-photos`** (private)
- 업로드 경로 규칙: `{user_id}/{diary_id}.{ext}`
- 열람은 서버에서 **signed URL** 생성 후 클라이언트에 전달.

## 10. RLS 정책 (요지)

### `diaries`
- **SELECT**:
  `user_id = auth.uid()`
  **OR** `exists (select 1 from diary_shares ds where ds.diary_id = diaries.id and ds.shared_with_email = auth.email())`
- **INSERT / UPDATE / DELETE**: `user_id = auth.uid()`

### `diary_shares`
- **SELECT**: `invited_by = auth.uid()` **OR** `shared_with_email = auth.email()`
- **INSERT / DELETE**: 본인이 소유한 `diary`에 대해서만 허용
  (`exists (select 1 from diaries d where d.id = diary_id and d.user_id = auth.uid())`)

### Storage 버킷 정책 (`diary-photos`)
- **INSERT / UPDATE / DELETE**: 경로 prefix가 `auth.uid()`와 일치할 때만.
- **SELECT**: 본인 경로이거나, 해당 객체에 연결된 diary가 공유된 경우. (서버에서 signed URL을 발급하는 구조라면 anon 읽기는 막고 서버 발급만 허용.)

## 11. AI 프롬프트 전략

### 엔드포인트
- `POST /api/analyze` (Next.js Route Handler, 서버 전용)
- 인증된 사용자만 호출 가능하도록 세션 검증.

### 입출력 스펙
- **요청**: `{ content: string, category: string }`
- **응답**: `{ emotion_emoji: string | null, hashtags: string[] }`

### 호출 흐름
1. 클라이언트가 일기 저장 → 서버 액션이 `/api/analyze` 호출(또는 동일 프로세스 내 유틸 함수 호출).
2. Gemini 2.5 Flash에 **JSON 모드**로 요청 (`responseMimeType: "application/json"`, 스키마 지정).
3. 응답 파싱 후 **화이트리스트 검증**:
   - `emotion_emoji`가 7종 중 하나가 아니면 `null`.
   - `hashtags`는 `#`로 시작하는 한국어 문자열만, 상위 5개, 중복 제거.
4. 검증 결과를 `diaries` row에 `update`.
5. 실패(네트워크 / rate limit / JSON 파싱 실패)는 **null 저장** + UI에 "재분석" 버튼 노출.

### 프롬프트 스케치 (한국어)
```
당신은 한국어 일기 분석가입니다. 입력된 일기를 읽고 아래 JSON 형식으로만 답하세요.
- emotion_emoji: 다음 7개 중 하나만 선택하세요 → 😊 😢 😡 😌 😰 😴 🤔
- hashtags: 한국어 해시태그, '#' 포함, 최대 5개, 중복 금지, 각 20자 이내
응답은 반드시 순수 JSON 객체 하나. 설명·마크다운·코드블록 금지.

카테고리: {category}
일기 본문:
"""
{content}
"""
```

### 비용 0 유지 전략
- 저장 시 1회만 호출. 수정 시에는 기본적으로 재호출하지 않고, 사용자가 **"재분석" 버튼**을 눌렀을 때만 호출.
- 무료 한도(분당 10req / 일 250req)는 개인 사용 규모상 충분.

## 12. 가정 및 리스크

### 가정
- 사용자는 Google / 이메일 기반 로그인에 익숙하다.
- Gemini 2.5 Flash의 한국어 감정 분류 품질이 MVP 수준에 충분하다.
- Supabase RLS와 Storage policy로 앱단 권한 검사 없이도 데이터 격리가 가능하다.

### 리스크
| # | 리스크 | 대응 |
|---|---|---|
| R1 | Supabase RLS / Storage policy 디버깅에 시간 소모 | Phase 0에서 공식 예제 기반으로 먼저 미니멀하게 검증 |
| R2 | Gemini JSON 응답이 간헐적으로 스키마 이탈 | JSON 모드 + 스키마 + 사후 화이트리스트 검증 2중 |
| R3 | UX 3종 추가로 일정 초과 | Day 7 버퍼 + Phase 10(Day 9) 폴리싱으로 흡수, 초과 시 달력 뷰 기능부터 단순화 |
| R4 | 무료 티어 한도 초과(Storage 1GB 등) | 업로드 크기 5MB 제한, 이미지 압축 옵션, 사용량 모니터링 |
| R5 | 매직링크 콜백 URL을 프로덕션에 등록하지 않아 배포 후 로그인 실패 | Phase 9 배포 체크리스트에 필수 항목으로 포함 |

## 13. 열린 질문 (아직 미결 / 추후 결정)
- **이미지 클라이언트 압축 도입 여부**: Nice-to-have로 남김. 1차 배포 후 Storage 사용량 보고 결정.
- **검색 업그레이드(pg full-text)**: v2 이후 고려. 현재는 `ilike`로 출발.
- **공유 링크 방식 대안**: 현재는 "이메일 초대 + 로그인" 방식. 토큰 기반 공개 링크는 Out of Scope지만 추후 수요 있으면 도입 검토.
