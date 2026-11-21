"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Sheet({
  children,
  description,
  onClose,
  onOpenAutoFocus,
  title,
}: {
  children: ReactNode;
  description: ReactNode;
  onClose: () => void;
  onOpenAutoFocus?: (event: Event) => void;
  title: ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="seating-dialog-overlay fixed inset-0 z-50 bg-[#4a1027]/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className="seating-dialog-content fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border border-[#df7fa3] bg-[#fff8fb] text-[#4a1027] shadow-[0_-24px_60px_-30px_rgba(74,16,39,0.8)] outline-none md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[88dvh] md:w-[min(94vw,36rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <div
            className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[#efb5c9] md:hidden"
            aria-hidden="true"
          />
          <div className="flex shrink-0 items-start gap-3 border-b border-[#f3cddb] px-5 pb-3 pt-3 md:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-2xl font-semibold leading-tight text-[#4a1027]">
                {title}
              </Dialog.Title>
              <Dialog.Description asChild>
                <div className="mt-1 text-sm text-[#8f5070]">{description}</div>
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-[#efb5c9] bg-white text-[#7a1239] transition hover:bg-[#ffe0ec]"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
