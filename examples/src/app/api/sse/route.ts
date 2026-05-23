import { createSSEResponse } from "@/dist";
import { watchStock } from "../../../lib/rpc/sse";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "AAPL";

  // Call the Actyx-RPC procedure to get the AsyncIterable stream
  const stream = watchStock({ symbol });

  // Convert it into a web-standard Server-Sent Events Response
  return createSSEResponse(stream);
}
