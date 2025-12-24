# packages/config

環境変数と設定のスキーマ定義をまとめる場所。

## ポリシー
- `.env.example` にすべてのキーを列挙し、公開/非公開の境界を明確にする。
- 読み込み時にスキーマバリデーション（例: zod / pydantic）を必須化。
- ランタイムで不足・型不整合があれば起動時に fail-fast。

## 例（TypeScript, zod）
```ts
import { z } from "zod";

export const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  DATABASE_URL: z.string(),
  QUEUE_URL: z.string().url(),
  AGENTCORE_API_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;
```

