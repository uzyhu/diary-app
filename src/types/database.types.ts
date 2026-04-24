// 수동으로 선언한 Supabase 스키마 타입.
// Phase 2에서는 Supabase CLI 로그인이 번거로워 수동 유지. 컬럼이 바뀌면 이 파일도 같이 업데이트.
// supabase/migrations/0001_init.sql이 진실 소스다.

import type { Category } from "@/lib/categories";

export type Database = {
  public: {
    Tables: {
      diaries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          category: Category;
          content: string;
          emotion_emoji: string | null;
          hashtags: string[];
          photo_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          category: Category;
          content: string;
          emotion_emoji?: string | null;
          hashtags?: string[];
          photo_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          category?: Category;
          content?: string;
          emotion_emoji?: string | null;
          hashtags?: string[];
          photo_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      diary_shares: {
        Row: {
          id: string;
          diary_id: string;
          shared_with_email: string;
          invited_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          diary_id: string;
          shared_with_email: string;
          invited_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          diary_id?: string;
          shared_with_email?: string;
          invited_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type DiaryRow = Database["public"]["Tables"]["diaries"]["Row"];
export type DiaryInsert = Database["public"]["Tables"]["diaries"]["Insert"];
export type DiaryUpdate = Database["public"]["Tables"]["diaries"]["Update"];
