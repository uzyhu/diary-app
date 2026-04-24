"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/lib/categories";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE,
  isAllowedPhotoMimeType,
} from "@/lib/storage";
import {
  INITIAL_FORM_STATE,
  type DiaryFormState,
} from "@/app/(app)/diaries/form-state";

type DiaryFormAction = (
  prevState: DiaryFormState,
  formData: FormData,
) => Promise<DiaryFormState>;

type InitialValues = {
  date: string;
  category: string;
  content: string;
};

type DiaryFormProps = {
  action: DiaryFormAction;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  initialValues?: InitialValues;
  initialPhotoUrl?: string;
};

function todayISO(): string {
  // 브라우저의 로컬 타임존 기준 오늘. 서버(Asia/Seoul) 기준과 최대 하루 편차가 있을 수 있으나
  // 서버측에서 한 번 더 검증하므로 클라는 UX용 상한선만 제공한다.
  // en-CA 로케일은 YYYY-MM-DD 형식을 반환한다.
  return new Date().toLocaleDateString("en-CA");
}

export function DiaryForm({
  action,
  submitLabel,
  pendingLabel,
  cancelHref,
  initialValues,
  initialPhotoUrl,
}: DiaryFormProps) {
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_FORM_STATE,
  );

  const defaults: InitialValues = {
    date: state.values?.date ?? initialValues?.date ?? todayISO(),
    category: state.values?.category ?? initialValues?.category ?? "",
    content: state.values?.content ?? initialValues?.content ?? "",
  };

  const fieldErrors = state.fieldErrors ?? {};
  const maxDate = todayISO();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const photoFieldError = fieldErrors.photo ?? null;
  const photoErrorMessage = localError ?? photoFieldError;

  // 컴포넌트 unmount / 새 파일 선택 시 blob URL 누수 방지.
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const photoAction = useMemo<"keep" | "replace" | "remove">(() => {
    if (localPreviewUrl) return "replace";
    if (removeExisting) return "remove";
    return "keep";
  }, [localPreviewUrl, removeExisting]);

  const previewUrl = localPreviewUrl ?? (removeExisting ? null : initialPhotoUrl);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    if (!file) {
      setLocalPreviewUrl(null);
      setLocalError(null);
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setLocalPreviewUrl(null);
      setLocalError("사진은 5MB 이하여야 합니다.");
      event.target.value = "";
      return;
    }
    if (!isAllowedPhotoMimeType(file.type)) {
      setLocalPreviewUrl(null);
      setLocalError("jpg / png / webp 형식만 업로드 가능합니다.");
      event.target.value = "";
      return;
    }
    setLocalError(null);
    setRemoveExisting(false);
    setLocalPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveToggle(event: React.ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    setRemoveExisting(checked);
    if (checked) {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      setLocalError(null);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="date">날짜</Label>
        <Input
          id="date"
          name="date"
          type="date"
          required
          max={maxDate}
          defaultValue={defaults.date}
          aria-invalid={fieldErrors.date ? true : undefined}
          aria-describedby={fieldErrors.date ? "date-error" : undefined}
          disabled={isPending}
        />
        {fieldErrors.date ? (
          <p id="date-error" className="text-xs text-destructive">
            {fieldErrors.date}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">카테고리</Label>
        <select
          id="category"
          name="category"
          required
          defaultValue={defaults.category}
          aria-invalid={fieldErrors.category ? true : undefined}
          aria-describedby={fieldErrors.category ? "category-error" : undefined}
          disabled={isPending}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-8 md:text-sm dark:bg-input/30"
        >
          <option value="" disabled hidden>
            선택하세요
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {fieldErrors.category ? (
          <p id="category-error" className="text-xs text-destructive">
            {fieldErrors.category}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">본문</Label>
        <Textarea
          id="content"
          name="content"
          required
          maxLength={10_000}
          defaultValue={defaults.content}
          placeholder="오늘은 어떤 일이 있었나요?"
          className="min-h-48"
          aria-invalid={fieldErrors.content ? true : undefined}
          aria-describedby={fieldErrors.content ? "content-error" : undefined}
          disabled={isPending}
        />
        {fieldErrors.content ? (
          <p id="content-error" className="text-xs text-destructive">
            {fieldErrors.content}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo">사진 (선택, 1장, 최대 5MB)</Label>
        {previewUrl ? (
          // 장식용 미리보기. 실제 alt는 상세 페이지에서 부여한다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="max-h-64 w-auto rounded-lg border border-border object-contain"
          />
        ) : null}
        <input
          ref={photoInputRef}
          id="photo"
          name="photo"
          type="file"
          accept={ALLOWED_PHOTO_MIME_TYPES.join(",")}
          onChange={handlePhotoChange}
          aria-invalid={photoErrorMessage ? true : undefined}
          aria-describedby={photoErrorMessage ? "photo-error" : undefined}
          disabled={isPending}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        {initialPhotoUrl && !localPreviewUrl ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={removeExisting}
              onChange={handleRemoveToggle}
              disabled={isPending}
            />
            기존 사진 제거
          </label>
        ) : null}
        <input type="hidden" name="photo_action" value={photoAction} />
        {photoErrorMessage ? (
          <p id="photo-error" className="text-xs text-destructive">
            {photoErrorMessage}
          </p>
        ) : null}
      </div>

      <div
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-destructive"
      >
        {state.status === "error" && state.message ? state.message : null}
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <Link
          href={cancelHref}
          className="text-center text-sm text-muted-foreground hover:underline sm:text-left"
        >
          취소
        </Link>
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isPending}
        >
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
