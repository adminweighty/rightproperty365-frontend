import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

type Props = { title: string; description?: string; footer?: ReactNode; children: ReactNode };

/** Narrow, centred card used by every sign-in and account-recovery screen. */
export function AuthShell({ title, description, footer, children }: Props) {
  return (
    <Container className="flex justify-center py-12 md:py-20">
      <div className="w-full max-w-md">
        <Card className="p-6 sm:p-8">
          <h1 className="text-3xl">{title}</h1>
          {description && <p className="mt-2 leading-relaxed text-muted">{description}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
      </div>
    </Container>
  );
}

export const authLinkClass = "font-medium text-primary-ink underline-offset-2 hover:underline";
