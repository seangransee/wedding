export { runtime, size, contentType } from "../opengraph-image";

import handler from "../opengraph-image";

export async function GET() {
  return handler();
}
