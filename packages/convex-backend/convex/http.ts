import { httpRouter, makeFunctionReference } from "convex/server";
import { httpAction } from "./server";

const http = httpRouter();
const processIncomingWebhookRef = makeFunctionReference<"mutation">("wabaWebhook:processIncomingWebhook");

http.route({
  path: "/webhooks/waba",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return Response.json({ ok: true }, { status: 200 });
  }),
});

http.route({
  path: "/webhooks/waba",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const receivedAt = Date.now();

    const result = await ctx.runMutation(processIncomingWebhookRef, {
      rawBody,
      receivedAt,
    });

    const shouldFailClosed = result.blocked > 0 && result.processed === 0 && result.duplicates === 0;
    return Response.json(result, {
      status: shouldFailClosed ? 404 : 200,
    });
  }),
});

export default http;
