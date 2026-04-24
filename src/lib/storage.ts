// Storage 상수/헬퍼.
// diary-photos 버킷의 RLS 정책은 객체 경로의 첫 폴더가 auth.uid()와 일치할 때만
// INSERT/UPDATE/DELETE를 허용한다(SETUP.md §2). 경로 조립을 이 모듈에서 한 곳으로 모아
// 호출부에서 규칙을 잘못 적용하지 않도록 한다.

export const DIARY_PHOTOS_BUCKET = "diary-photos";
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoExtension = "jpg" | "png" | "webp";

export function extensionFromMimeType(mime: string): PhotoExtension | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export function buildPhotoPath(
  userId: string,
  diaryId: string,
  ext: PhotoExtension,
): string {
  return `${userId}/${diaryId}.${ext}`;
}

export function isAllowedPhotoMimeType(mime: string): boolean {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(mime);
}
