import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoFactorForm } from "@/components/two-factor-form";
import { safeAuthCallbackPath } from "@/lib/organization-invite-access";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Two-factor verification · PaperBoy",
};

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackURL?: string }>;
}) {
  const callbackURL = safeAuthCallbackPath((await searchParams)?.callbackURL);
  if (await getSession()) redirect(callbackURL);
  return <TwoFactorForm callbackURL={callbackURL} />;
}
