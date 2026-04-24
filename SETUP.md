# 셋업 가이드 — AI 일기장

Phase 0 코드는 준비가 끝났습니다. 아래 항목은 **외부 서비스 계정 작업**이라 사용자가 직접 수행해야 합니다. 위에서 아래 순서로 진행하세요.

## 1. Supabase 프로젝트 생성 및 DB 스키마 적용

- [ ] [Supabase](https://supabase.com/dashboard) 계정 가입 후 새 프로젝트 생성
  - Region: `Northeast Asia (Seoul) / ap-northeast-2` 권장
  - Pricing Plan: **Free**
  - DB 비밀번호는 안전한 곳에 따로 보관
- [ ] 프로젝트 생성이 끝나면 좌측 메뉴 **SQL Editor** 열기
- [ ] `supabase/migrations/0001_init.sql` 파일 내용을 **전체 복사** 후 에디터에 붙여넣고 **Run**
  - 성공하면 테이블 `diaries`, `diary_shares`, 인덱스, 트리거, RLS 정책이 모두 생성됨
  - **Table Editor** 메뉴에서 두 테이블이 보이고 각 행의 방패 아이콘(RLS enabled)이 켜져 있으면 OK

## 2. Storage 버킷 생성 및 정책 설정

- [ ] 좌측 메뉴 **Storage** → **New bucket**
  - Name: `diary-photos`
  - Public bucket: **OFF** (private로 유지)
  - File size limit: `5 MB` 권장
  - Allowed MIME types: `image/jpeg, image/png, image/webp`
- [ ] 생성한 버킷 선택 → **Policies** 탭 → **New policy** → **For full customization**
  - 아래 SQL을 SQL Editor에서 실행하는 게 가장 간단합니다. 한 번만 실행하세요.

```sql
-- diary-photos 버킷 정책
-- 업로드·수정·삭제는 본인 user_id prefix 경로일 때만 허용

drop policy if exists "diary_photos_insert_own_prefix" on storage.objects;
create policy "diary_photos_insert_own_prefix"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'diary-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "diary_photos_update_own_prefix" on storage.objects;
create policy "diary_photos_update_own_prefix"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'diary-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "diary_photos_delete_own_prefix" on storage.objects;
create policy "diary_photos_delete_own_prefix"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'diary-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- SELECT는 anon/authenticated 모두에게 열어두지 않는다.
-- 앱은 서버에서 signed URL을 발급해 이미지를 보여주는 방식으로 동작한다.
```

> 메모: Phase 6(공유) 완성 뒤, 공유받은 사용자도 이미지를 볼 수 있도록 **서버에서 signed URL을 발급**한다. Storage SELECT 정책을 열지 말고, 서버 로직으로 접근을 제어할 것.

## 3. Auth(매직링크) 설정

- [ ] 좌측 메뉴 **Authentication** → **Providers** → **Email**
  - **Enable Email provider**: ON
  - **Confirm email**: ON (기본값 유지)
  - **Enable magic link**: ON
- [ ] **Authentication** → **URL Configuration**
  - **Site URL**: `http://localhost:3000`
  - **Redirect URLs**에 `http://localhost:3000/auth/callback` 추가
  - (배포 후) Vercel 프로덕션 URL과 `/auth/callback`도 함께 추가 — Phase 9에서 잊지 말 것

## 4. Supabase 키 복사

- [ ] 좌측 메뉴 **Project Settings** → **API**
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 공개 저장소에 올리지 말 것)

## 5. Google Gemini API 키 발급

- [ ] [Google AI Studio — API Keys](https://aistudio.google.com/apikey) 로그인
- [ ] **Create API key** → 키 복사 → `GEMINI_API_KEY`
- [ ] 무료 한도 확인: Gemini 2.5 Flash 기준 분당 10회 / 일 250회

## 6. 로컬 환경 변수 파일 생성

- [ ] 프로젝트 루트에 `.env.local` 파일 생성 (`.env.local.example`을 복사하면 편함)

```
cp .env.local.example .env.local
```

> ⚠️ 실제 키는 **반드시 `.env.local`에만** 적어야 합니다. `.env.local.example`은 저장소에 커밋되는 플레이스홀더 템플릿이므로 **여기에 실제 키를 넣지 마세요.** 실수로 넣었다면 즉시 키를 rotate하고 example 파일을 플레이스홀더로 되돌려야 합니다.

- [ ] 위 2·4·5 단계에서 복사한 값을 `.env.local`에 채워 넣기

## 7. 로컬 실행 확인

- [ ] `npm install` (스캐폴딩 시 이미 설치되어 있지만 혹시 누락됐다면)
- [ ] `npm run dev`
- [ ] 브라우저에서 `http://localhost:3000` 접속 → "AI 일기장" 제목이 보이면 성공
- [ ] OS 다크모드/라이트모드를 전환해 배경/글자색이 자동으로 바뀌는지 확인

## 8. (나중에, Phase 9에서) Vercel 배포

- [ ] [Vercel](https://vercel.com/) 계정 연결 후 리포지토리 import
- [ ] Project Settings → Environment Variables에 `.env.local`과 동일한 4개 키 등록
  - `NEXT_PUBLIC_*`만 Preview/Development에도 노출되도록 설정, 나머지는 Production만으로도 충분
- [ ] Supabase → Authentication → URL Configuration의 **Redirect URLs**에 Vercel 프로덕션 URL(`https://<프로젝트>.vercel.app/auth/callback`)을 반드시 추가

## 문제 해결 메모

- 매직링크 이메일을 눌러도 로그인이 안 되면 **Site URL**과 **Redirect URLs** 설정을 다시 확인.
- Supabase Free 한도: DB 500MB, Storage 1GB, MAU 50,000, Egress 5GB/월. 이미지 용량 관리에 주의.
- RLS 때문에 쿼리 결과가 비어 보일 수 있음. SQL Editor에서 임의로 row를 넣을 때는 `service_role` 키로 실행되므로 정책을 우회한다는 점을 기억.
- **Supabase 프로젝트 설정의 "Disable JWT-based API keys" / Publishable 키 전환 권장 배너를 누르지 말 것.** Legacy(anon + service_role) 체계를 유지해야 `@supabase/ssr` 조합이 지금까지 검증된 대로 동작한다. 전환을 권유하는 메시지가 떠도 무시하고 그대로 둔다.
- 이번 구현은 일기 사진 Storage 업로드·signed URL 발급을 **admin(service_role) 클라이언트로 처리**하므로(`src/lib/supabase/admin.ts`) anon/publishable 키 체계 변경과 무관하게 작동한다. 다만 업로드 경로는 항상 `auth.getUser()`로 확인한 user_id prefix로 강제해 사용자 간 격리를 유지한다.
