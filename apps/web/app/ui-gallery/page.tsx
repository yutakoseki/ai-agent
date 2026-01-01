"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const actions = [
  { label: "Primary", variant: "primary" as const },
  { label: "Ghost", variant: "ghost" as const },
  { label: "Secondary", variant: "secondary" as const },
];

export default function UiGalleryPage() {
  return (
    <main className="min-h-screen bg-secondary text-ink">
      <section className="mx-auto flex max-w-screen-lg flex-col gap-8 px-4 py-10 md:px-6 lg:px-8">
        <header className="space-y-2">
          <p className="text-sm text-ink-muted">UI Component Gallery</p>
          <h1 className="text-2xl font-bold text-ink">共通UIサンプル</h1>
          <p className="text-sm text-ink-muted">
            カラートークン（primary/secondary/accent/surface/ink）と共通コンポーネントを再利用してください。
          </p>
        </header>

        <Card title="Buttons" className="bg-surface">
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button key={action.label} variant={action.variant} size="md">
                {action.label}
              </Button>
            ))}
          </div>
        </Card>

        <Card title="Inputs" className="bg-surface">
          <div className="grid gap-4 md:grid-cols-2">
            <Input name="email" label="メールアドレス" placeholder="you@example.com" />
            <Input
              name="password"
              label="パスワード"
              type="password"
              placeholder="••••••••"
              error="8文字以上で入力してください"
            />
          </div>
        </Card>

        <Card title="Content Card" className="bg-surface">
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              title="ダーク基調"
              actions={<Button size="sm">開く</Button>}
              className="bg-surface"
            >
              <p className="text-sm text-ink-muted">
                背景は secondary/surface、文字は ink 系を使います。アクセントは必要な箇所だけに。
              </p>
            </Card>
            <Card
              title="フラット + アクセント"
              actions={
                <Button size="sm" variant="ghost">
                  詳細
                </Button>
              }
              className="bg-surface"
            >
              <p className="text-sm text-ink-muted">
                フラットを基本とし、shadow-panel で最小限の階層表現を行います。
              </p>
            </Card>
          </div>
        </Card>
      </section>
    </main>
  );
}


