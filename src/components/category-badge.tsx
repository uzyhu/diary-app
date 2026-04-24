import { cn } from "@/lib/utils";
import type { Category } from "@/lib/categories";

// 빈티지 earthy 팔레트. 누런 종이 배경과 조화되도록 채도를 통일(c≈0.04~0.08)하고
// 각 카테고리를 hue 하나로 구분. 색만으로 전달하지 않고 텍스트 라벨을 함께 둔다.
// - 라이트: 바랜 배경(l=0.88) + 진한 세피아 톤 글자(l=0.35), 같은 hue의 테두리.
// - 다크: 어두운 배경(l=0.3) + 크림 톤 글자(l=0.82), 중간 톤 테두리.
// Tailwind v4 arbitrary value는 공백을 `_`로 이스케이프.
const CATEGORY_STYLES: Record<Category, string> = {
  // 일상 — 세피아/갈색. 가장 기본, 눈에 안 띄게.
  일상:
    "bg-[oklch(0.88_0.04_70)] text-[oklch(0.35_0.08_70)] border-[oklch(0.6_0.08_70)] dark:bg-[oklch(0.3_0.04_70)] dark:text-[oklch(0.82_0.06_70)] dark:border-[oklch(0.5_0.08_70)]",
  // 운동 — 세이지/올리브. 채도 낮은 초록.
  운동:
    "bg-[oklch(0.88_0.04_135)] text-[oklch(0.35_0.08_135)] border-[oklch(0.6_0.08_135)] dark:bg-[oklch(0.3_0.04_135)] dark:text-[oklch(0.82_0.06_135)] dark:border-[oklch(0.5_0.08_135)]",
  // 여행 — 빈티지 바랜 블루. 회색빛 섞인 파랑.
  여행:
    "bg-[oklch(0.88_0.04_230)] text-[oklch(0.35_0.08_230)] border-[oklch(0.6_0.08_230)] dark:bg-[oklch(0.3_0.04_230)] dark:text-[oklch(0.82_0.06_230)] dark:border-[oklch(0.5_0.08_230)]",
  // 업무 — 머스타드/오커. 따뜻한 노랑.
  업무:
    "bg-[oklch(0.88_0.04_90)] text-[oklch(0.35_0.08_90)] border-[oklch(0.6_0.08_90)] dark:bg-[oklch(0.3_0.04_90)] dark:text-[oklch(0.82_0.06_90)] dark:border-[oklch(0.5_0.08_90)]",
  // 감정 — 빈티지 와인/테라코타. 바랜 레드.
  감정:
    "bg-[oklch(0.88_0.04_25)] text-[oklch(0.35_0.08_25)] border-[oklch(0.6_0.08_25)] dark:bg-[oklch(0.3_0.04_25)] dark:text-[oklch(0.82_0.06_25)] dark:border-[oklch(0.5_0.08_25)]",
  // 기타 — 먼지톤 그레이. 가장 무채색.
  기타:
    "bg-[oklch(0.88_0.02_65)] text-[oklch(0.35_0.03_65)] border-[oklch(0.6_0.03_65)] dark:bg-[oklch(0.3_0.02_65)] dark:text-[oklch(0.82_0.02_65)] dark:border-[oklch(0.5_0.03_65)]",
};

type CategoryBadgeProps = {
  category: Category;
  className?: string;
};

// 각진 도장 스타일: rounded-sm + 1px border + 손글씨 폰트.
// 그림자/ring 없이 "종이에 찍힌 도장" 느낌만.
export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center rounded-sm border px-2 py-0.5 text-xs leading-none",
        CATEGORY_STYLES[category],
        className,
      )}
    >
      {category}
    </span>
  );
}
