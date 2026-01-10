"use client";

import { GmailConnectCard } from "@/components/mail/GmailConnectCard";
import { EmailAccountsCard } from "@/components/mail/EmailAccountsCard";
import { PushSubscribeCard } from "@/components/push/PushSubscribeCard";

export function MailAgentClient() {
  return (
    <div className="mx-auto max-w-screen-lg space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Mail Agent</p>
        <h1 className="text-2xl font-semibold">メールエージェント</h1>
        <p className="text-sm text-ink-soft">
          受信箱の接続・監視（タスク化）・通知（Push）をここで管理します。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <GmailConnectCard redirectPath="/mail-agent" />
        <EmailAccountsCard />
        <PushSubscribeCard />
      </div>
    </div>
  );
}


