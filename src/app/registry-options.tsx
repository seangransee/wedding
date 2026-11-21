import Image from "next/image";
import type { ReactNode } from "react";
import { ExternalLink, Gift, Heart } from "lucide-react";
import { WEDDING_REGISTRY } from "@/lib/registry";

const actionClassName =
  "registry-action inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#ffd6e4] bg-[#ffd6e4] px-5 py-3 text-lg font-semibold leading-tight text-[#031b12] transition hover:bg-[#fff6fa] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd6e4]";

function GiftQrCode({ src, service }: { src: string; service: string }) {
  return (
    <div className="flex justify-center">
      <Image
        src={src}
        alt={`${service} QR code for gifts to Lexi and Sean`}
        width={200}
        height={200}
        unoptimized
        className="h-[200px] w-[200px] max-w-full rounded-md bg-white"
      />
    </div>
  );
}

export function RegistryOptions({ amazonCopy, fundCopy }: { amazonCopy: ReactNode; fundCopy: ReactNode }) {
  const { amazonUrl, venmo, zelle } = WEDDING_REGISTRY;

  return (
    <div className="grid gap-7 sm:gap-9">
      <div className="grid items-center gap-5 rounded-lg border border-[#ffd6e4]/45 bg-[#fff6fa]/5 p-5 sm:grid-cols-[1fr_auto] sm:gap-8 sm:p-6">
        <div className="grid gap-3">
          <h3 className="flex items-center gap-3 text-3xl font-semibold leading-tight sm:text-4xl">
            <Gift className="shrink-0" size={25} strokeWidth={1.5} aria-hidden />
            Amazon registry
          </h3>
          {amazonCopy}
        </div>
        <a href={amazonUrl} target="_blank" rel="noopener noreferrer" className={actionClassName}>
          View Amazon registry
          <ExternalLink size={18} aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      <div className="grid gap-6 rounded-lg border border-[#ffd6e4]/45 bg-[#fff6fa]/5 p-5 sm:p-6">
        <div className="grid gap-3">
          <h3 className="flex items-center gap-3 text-3xl font-semibold leading-tight sm:text-4xl">
            <Heart className="shrink-0" size={25} strokeWidth={1.5} aria-hidden />
            Contribute to our next chapter
          </h3>
          <div className="[&_p:first-child]:font-semibold">{fundCopy}</div>
        </div>

        <div className="grid gap-7 md:grid-cols-2 md:gap-8">
          <div className="grid content-start gap-4 border-t border-[#ffd6e4]/35 pt-5">
            <h4 className="text-3xl font-semibold">Venmo</h4>
            <p className="text-2xl font-semibold">@{venmo.username}</p>
            <a href={venmo.url} target="_blank" rel="noopener noreferrer" className={actionClassName}>
              Open Venmo
              <ExternalLink size={18} aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <GiftQrCode src={venmo.qrImage} service="Venmo" />
          </div>

          <div className="grid content-start gap-4 border-t border-[#ffd6e4]/35 pt-5">
            <h4 className="text-3xl font-semibold">Zelle</h4>
            <p className="text-2xl font-semibold">{zelle.formattedPhone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
