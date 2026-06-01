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
    <div className="rounded-lg border border-[#b8860b]/35 bg-white/75 p-4 text-center shadow-[inset_0_0_0_1px_rgba(255,246,250,0.35)] sm:p-5">
      <div className="mx-auto grid size-11 place-items-center rounded-full border border-[#b8860b]/45 bg-[#054f2d] text-[#fff6fa]">
        <Lock size={19} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#054f2d]">
        {title}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-[#4a1f2e]/78">
        {children}
      </p>
    </div>
  );
}
