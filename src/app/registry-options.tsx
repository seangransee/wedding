"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Gift, Heart } from "lucide-react";
import { WEDDING_REGISTRY } from "@/lib/registry";

const actionClassName =
  "registry-action inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#ffd6e4] bg-[#ffd6e4] px-5 py-3 text-lg font-semibold leading-tight text-[#031b12] transition hover:bg-[#fff6fa] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd6e4]";

function CopyDetail({ value, copyValue = value, label }: { value: string; copyValue?: string; label: "venmo" | "zelle" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setStatus("copied");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setStatus("manual");
    }
  }

  return (
    <div className="grid gap-2">
      <label className="text-lg" htmlFor={`registry-${label}`}>
        {label === "zelle" ? "Zelle phone number" : "Venmo username"}
      </label>
      <input
        ref={inputRef}
        id={`registry-${label}`}
        value={value}
        readOnly
        spellCheck={false}
        autoCapitalize="none"
        aria-label={label === "zelle" ? "Zelle phone number" : "Venmo username"}
        onFocus={(event) => event.currentTarget.select()}
        className="min-h-12 w-full min-w-0 rounded-md border border-[#ffd6e4]/50 bg-[#031b12]/65 px-3 text-[1.1rem] font-semibold text-[#ffd6e4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd6e4]"
      />
      <button type="button" onClick={copy} className={actionClassName}>
        {status === "copied" ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
        {status === "copied" ? "Copied!" : label === "zelle" ? "Copy Zelle phone number" : "Copy Venmo username"}
      </button>
      <p role="status" className="min-h-6 text-base leading-snug">
        {status === "copied"
          ? label === "zelle" ? "Ready to paste in your bank's app." : "Ready to paste in Venmo."
          : status === "manual" ? "Copy the selected text above, then paste it in your app." : ""}
      </p>
    </div>
  );
}

function GiftQrCode({ src, service }: { src: string; service: string }) {
  if (!src) return null;

  const code = (
    <figure className="grid justify-items-center gap-3 text-center">
      <Image
        src={src}
        alt={`${service} QR code for Sean Gransee`}
        width={200}
        height={200}
        unoptimized
        className="h-[200px] w-[200px] max-w-full rounded-md bg-white"
      />
      <figcaption className="max-w-64 text-base leading-snug">
        {service === "Zelle" ? "Scan in your bank's Zelle screen." : "Scan with your phone's camera or Venmo."}
      </figcaption>
    </figure>
  );

  return (
    <>
      <div className="hidden sm:block">{code}</div>
      <details className="rounded-md border border-[#ffd6e4]/45 sm:hidden">
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd6e4]">
          Show {service} QR code
        </summary>
        <div className="p-4 pt-1">{code}</div>
      </details>
    </>
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
            <p className="text-lg leading-relaxed">Send your gift through Sean&apos;s Venmo account.</p>
            <a href={venmo.url} target="_blank" rel="noopener noreferrer" className={actionClassName}>
              Open Venmo
              <ExternalLink size={18} aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <CopyDetail value={`@${venmo.username}`} label="venmo" />
            <GiftQrCode src={venmo.qrImage} service="Venmo" />
          </div>

          <div className="grid content-start gap-4 border-t border-[#ffd6e4]/35 pt-5">
            <h4 className="text-3xl font-semibold">Zelle</h4>
            <p className="text-lg leading-relaxed">Choose your bank, or open Zelle in your bank&apos;s app and send to {zelle.name} using the phone number below.</p>
            <a href={zelle.url} target="_blank" rel="noopener noreferrer" className={actionClassName}>
              Open Zelle
              <ExternalLink size={18} aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <CopyDetail value={zelle.formattedPhone} copyValue={zelle.phone} label="zelle" />
            <p className="text-base leading-relaxed">Check that the recipient name is {zelle.name} before sending.</p>
            <GiftQrCode src={zelle.qrImage} service="Zelle" />
          </div>
        </div>
      </div>
    </div>
  );
}
