import { logger } from "@/lib/logger";
import { listPushSubscriptionsByUser } from "@/lib/repos/pushSubscriptionRepo";
import type { Task } from "@shared/mail";

let configured = false;
let webpushMod: typeof import("web-push") | null = null;

async function configureWebPush(): Promise<boolean> {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    logger.warn("VAPID keys are missing");
    return false;
  }
  try {
    webpushMod = webpushMod ?? (await import("web-push"));
  } catch (error) {
    logger.warn("web-push module load failed", { error });
    return false;
  }
  webpushMod.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendTaskPush(params: {
  userId: string;
  task: Task;
}): Promise<void> {
  const ok = await configureWebPush();
  if (!ok) return;

  const subscriptions = await listPushSubscriptionsByUser({
    userId: params.userId,
  });
  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    title: "要対応タスク",
    body: params.task.title,
    url: "/tasks",
    taskId: params.task.id,
  });

  for (const sub of subscriptions) {
    try {
      await webpushMod!.sendNotification(
        {
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
    } catch (error) {
      logger.warn("push notification failed", { error, endpoint: sub.endpoint });
    }
  }
}

