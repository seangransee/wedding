import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export function LockedNotice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#b8860b]/35 bg-white/75 p-5 text-center shadow-[inset_0_0_0_1px_rgba(255,246,250,0.35)] sm:p-7">
      <div className="mx-auto grid size-11 place-items-center rounded-full border border-[#b8860b]/45 bg-[#054f2d] text-[#fff6fa]">
        <Lock size={19} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#054f2d] sm:text-6xl">
        {title}
      </h2>
      <p className="mt-3 text-lg leading-[1.85] text-[#351421] sm:text-xl">
        {children}
      </p>
    </div>
  );
}
