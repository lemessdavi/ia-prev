import { redirect } from "next/navigation";
import { LoginPage } from "@/components/LoginPage";
import { resolvePostLoginRedirect } from "@/server/auth-flow";
import { readValidatedSession } from "@/server/session-cookie";

export default async function HomePage() {
  const session = await readValidatedSession();

  if (session) {
    redirect(resolvePostLoginRedirect(session));
  }

  return <LoginPage />;
}
