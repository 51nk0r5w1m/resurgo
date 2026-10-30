import { auditAuthenticationResponse, getAuth } from "../../../../lib/auth";

export const runtime = "nodejs";

async function handler(request: Request) {
  const response = await getAuth().handler(request);
  await auditAuthenticationResponse(request, response);
  return response;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
