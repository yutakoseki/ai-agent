"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "idle" | "enabling" | "enabled" | "unsupported" | "error";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

type EnvProbe = {
  VAPID_PUBLIC_KEY?: { present: boolean; length: number };
  VAPID_PRIVATE_KEY?: { present: boolean; length: number };
  VAPID_SUBJECT?: { present: boolean; length: number };
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: { present: boolean; length: number };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function PushSubscribeCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [envProbe, setEnvProbe] = useState<EnvProbe | null>(null);

  const statusText = useMemo(() => {
    if (message) return message;
    if (status === "enabled") return "Push 通知が有効です。";
    if (status === "unsupported") return "このブラウザでは Push 通知に対応していません。";
    if (status === "error") return "Push 通知の有効化に失敗しました。";
    return "要対応タスクの Push 通知を有効化します。";
  }, [message, status]);

  async function refreshEnvProbe() {
    try {
      const res = await fetch("/api/debug/env", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setEnvProbe(data?.env ?? null);
    } catch {
      setEnvProbe(null);
    }
  }

  async function enablePush() {
    setStatus("enabling");
    setMessage(null);

    try {
      await refreshEnvProbe();
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        setStatus("error");
        setMessage("VAPID 公開キーが未設定です。");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("error");
        setMessage("通知の許可が必要です。");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(subscription),
      });

      if (!res.ok) {
        setStatus("error");
        const data = await res.json().catch(() => ({}));
        const traceId = res.headers.get("x-trace-id") || data?.traceId;
        const detail = data?.message ? String(data.message) : `HTTP ${res.status}`;
        const hint =
          res.status === 401
            ? "（未ログインの可能性があります。再ログインして試してください）"
            : res.status === 403
              ? "（CSRF/Originチェックで拒否された可能性があります。ページをリロードして再試行してください）"
              : "";
        setMessage(`購読の登録に失敗しました: ${detail}${hint}${traceId ? ` / traceId=${traceId}` : ""}`);
        return;
      }

      setStatus("enabled");
    } catch {
      setStatus("error");
      setMessage("Push 通知の設定でエラーが発生しました。");
    }
  }

  async function testPush() {
    setTesting(true);
    setMessage(null);
    try {
      await refreshEnvProbe();
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message || "テスト通知の送信に失敗しました。");
        return;
      }
      setMessage("テスト通知を送信しました（数秒待ってください）。");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card
      title="Push 通知"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="h-9 rounded-xl"
            type="button"
            onClick={enablePush}
            disabled={status === "enabling"}
          >
            {status === "enabling" ? "有効化中..." : "通知を有効化"}
          </Button>
          <Button
            variant="secondary"
            className="h-9 rounded-xl"
            type="button"
            onClick={testPush}
            disabled={testing}
          >
            {testing ? "送信中..." : "テスト通知"}
          </Button>
        </div>
      }
      className="border border-ink/10 bg-surface/90 shadow-panel"
    >
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">{statusText}</p>
        <p className="text-xs text-ink-soft">
          ※ PWAのインストールは必須ではありません。Push通知は「この端末で購読」＋「ブラウザの通知許可」が必要です。
          ローカルでも <span className="font-medium text-ink">http://localhost</span> は概ね動きます（別ホスト名/IPだと制限されることがあります）。
        </p>
        {!VAPID_PUBLIC_KEY ? (
          <p className="text-xs text-accent">
            ※ ブラウザ側の公開キーが未設定です:{" "}
            <span className="font-mono">NEXT_PUBLIC_VAPID_PUBLIC_KEY</span>
            （設定後に dev サーバーの再起動が必要）
          </p>
        ) : null}
        {envProbe ? (
          <details className="rounded-xl border border-ink/10 bg-surface-raised/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-ink">
              環境変数チェック（存在/長さ）
            </summary>
            <div className="mt-2 space-y-1 text-xs text-ink-soft">
              <div>
                サーバ: <span className="font-mono">VAPID_PUBLIC_KEY</span> ={" "}
                {String(envProbe.VAPID_PUBLIC_KEY?.present ?? false)} (len{" "}
                {envProbe.VAPID_PUBLIC_KEY?.length ?? 0})
              </div>
              <div>
                サーバ: <span className="font-mono">VAPID_PRIVATE_KEY</span> ={" "}
                {String(envProbe.VAPID_PRIVATE_KEY?.present ?? false)} (len{" "}
                {envProbe.VAPID_PRIVATE_KEY?.length ?? 0})
              </div>
              <div>
                サーバ: <span className="font-mono">VAPID_SUBJECT</span> ={" "}
                {String(envProbe.VAPID_SUBJECT?.present ?? false)} (len{" "}
                {envProbe.VAPID_SUBJECT?.length ?? 0})
              </div>
              <div>
                サーバ: <span className="font-mono">NEXT_PUBLIC_VAPID_PUBLIC_KEY</span> ={" "}
                {String(envProbe.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.present ?? false)} (len{" "}
                {envProbe.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length ?? 0})
              </div>
              <div>
                ブラウザ: <span className="font-mono">process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY</span>{" "}
                = {VAPID_PUBLIC_KEY ? `present (len ${VAPID_PUBLIC_KEY.length})` : "missing"}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
