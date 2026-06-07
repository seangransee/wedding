import { createReadStream } from "fs";
import { Readable } from "stream";
import { notFound } from "next/navigation";
import { getPhotoFile } from "@/lib/photos";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    filename: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { filename } = await params;
  const photo = await getPhotoFile(filename);

  if (!photo) {
    notFound();
  }

  const stream = createReadStream(photo.filePath);

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(photo.size),
      "Content-Type": photo.contentType,
    },
  });
}
