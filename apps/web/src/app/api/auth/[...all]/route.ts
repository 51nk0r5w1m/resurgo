import { auditAuthenticationResponse, getAuth } from "../../../../lib/auth";
import { blocksExternalDemoRegistration } from "../../../../lib/demo-mode";

export const runtime = "nodejs";

async function handler(request: Request) {
  if (blocksExternalDemoRegistration(new URL(request.url).pathname)) {
    return Response.json(
      {
        code: "REGISTRATION_DISABLED",
        message: "Registration is unavailable.",
      },
      { status: 403 },
    );
  }
  const response = await getAuth().handler(request);
  await auditAuthenticationResponse(request, response);
  return response;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
