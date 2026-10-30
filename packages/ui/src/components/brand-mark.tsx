import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 64 40"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11 24a21 21 0 0 1 42 0"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6 28c10-2.6 17.5-2.6 26 0s16 2.6 26 0"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 33c7.6-1.8 13.6-1.8 20 0s12.4 1.8 20 0"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M32 5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
