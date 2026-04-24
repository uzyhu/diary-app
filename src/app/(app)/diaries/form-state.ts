// Server Action과 클라이언트 폼이 공유하는 FormState 타입 + 초기값.
// "use server" 파일에서는 async 함수 외 export가 불가하므로 별도 파일로 분리.

export type DiaryFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<
    Record<"date" | "category" | "content" | "photo", string>
  >;
  values?: {
    date: string;
    category: string;
    content: string;
  };
};

export const INITIAL_FORM_STATE: DiaryFormState = { status: "idle" };

// 공유 추가 폼 상태. 성공 시에는 status: "success"로 토글해 입력을 비운다.
// error 시 message를 그대로 표시. fieldErrors는 email 단일 필드라 별도로 두지 않는다.
export type ShareFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const INITIAL_SHARE_STATE: ShareFormState = { status: "idle" };
