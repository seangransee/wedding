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
    <div className="guest-panel-surface rounded-lg border border-[#b8860b]/45 p-5 text-center text-[#f1b3c6] sm:p-7">
      <div className="mx-auto grid size-11 place-items-center rounded-full border border-[#b8860b]/65 bg-[#fff6fa]/8 text-[#ffd86e]">
        <Lock size={19} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#ffd86e] sm:text-6xl">
        {title}
      </h2>
      <p className="mt-3 text-lg leading-[1.85] text-[#f1b3c6] sm:text-xl">
        {children}
      </p>
    </div>
  );
}
