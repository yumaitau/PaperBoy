import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { previewTemplateAction } from "./actions";
import { TemplatePreviewForm } from "./preview-form";
import { AuthorizationError } from "@/lib/authorization";
import { requireOrganization } from "@/lib/session";
import {
  TemplateError,
  previewTemplate,
  templateSampleData,
} from "@/lib/template-core";
import { formatDateTime } from "@/lib/time";
import { getTemplate } from "@/lib/templates";

type TemplatePreviewPageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function TemplatePreviewPage({
  params,
}: TemplatePreviewPageProps) {
  const [{ organization, session }, { templateId }] = await Promise.all([
    requireOrganization(),
    params,
  ]);
  let template: Awaited<ReturnType<typeof getTemplate>>;
  try {
    template = await getTemplate({
      actorUserId: session.user.id,
      orgId: organization.id,
      templateId,
    });
  } catch (error) {
    if (error instanceof TemplateError && error.code === "TEMPLATE_NOT_FOUND") {
      notFound();
    }
    if (
      error instanceof AuthorizationError ||
      (error instanceof TemplateError && error.code === "MEMBERSHIP_REQUIRED")
    ) {
      redirect("/app/templates");
    }
    throw error;
  }
  const sampleData = templateSampleData(template);
  const initialPreview = previewTemplate(template, sampleData);
  const action = previewTemplateAction.bind(null, template.id);

  return (
    <section>
      <Link href="/app/templates">← Back to templates</Link>
      <h1 className="page-title template-preview-title">{template.name}</h1>
      <p className="page-sub">
        Safe preview only · updated{" "}
        {formatDateTime(template.updatedAt, session.user.timezone)} · times use{" "}
        <code>{session.user.timezone}</code>.
      </p>
      <TemplatePreviewForm
        action={action}
        initialData={JSON.stringify(sampleData, null, 2)}
        initialState={{ ...initialPreview, error: null }}
      />
    </section>
  );
}
