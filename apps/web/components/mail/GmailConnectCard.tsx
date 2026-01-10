"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function GmailConnectCard(props: { redirectPath?: string } = {}) {
  function startOAuth() {
    const redirect = encodeURIComponent(props.redirectPath ?? "/tasks");
    window.location.href = `/api/auth/google?redirect=${redirect}`;
  }

  return (
    <Card
      title="Gmail 連携"
      actions={
        <Button
          variant="secondary"
          className="h-9 rounded-xl"
          type="button"
          onClick={startOAuth}
        >
          Gmail を接続
        </Button>
      }
      className="border border-ink/10 bg-surface/90 shadow-panel"
    >
      <p className="text-sm text-ink-soft">
        Gmail の受信メールを取り込み、要対応タスクに変換します。
      </p>
    </Card>
  );
}
