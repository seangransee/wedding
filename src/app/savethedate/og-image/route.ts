export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

import handler from "../opengraph-image";

export async function GET() {
  return handler();
}
