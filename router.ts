import { httpRouter } from "convex/server";

const http = httpRouter();

// Add any custom HTTP endpoints here
// Example:
// http.route({
//   path: "/api/webhook",
//   method: "POST",
//   handler: httpAction(async (ctx, req) => {
//     // Handle webhook
//   }),
// });

export default http;
