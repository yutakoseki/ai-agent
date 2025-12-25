// エラーハンドリングの単体テスト

import { describe, it, expect } from "vitest";
import { handleError } from "./error";
import { AppError } from "@types/error";

describe("error handling", () => {
  describe("handleError", () => {
    it("AppErrorを適切なレスポンスに変換", () => {
      const error = new AppError("UNAUTHORIZED", "認証が必要です");
      const traceId = "trace-123";

      const response = handleError(error, traceId);

      expect(response.status).toBe(401);
    });

    it("BAD_REQUESTは400を返す", () => {
      const error = new AppError("BAD_REQUEST", "不正なリクエスト");
      const response = handleError(error);

      expect(response.status).toBe(400);
    });

    it("FORBIDDENは403を返す", () => {
      const error = new AppError("FORBIDDEN", "権限がありません");
      const response = handleError(error);

      expect(response.status).toBe(403);
    });

    it("NOT_FOUNDは404を返す", () => {
      const error = new AppError("NOT_FOUND", "見つかりません");
      const response = handleError(error);

      expect(response.status).toBe(404);
    });

    it("QUOTA_EXCEEDEDは429を返す", () => {
      const error = new AppError("QUOTA_EXCEEDED", "クォータ超過");
      const response = handleError(error);

      expect(response.status).toBe(429);
    });

    it("予期しないエラーは500を返す", () => {
      const error = new Error("予期しないエラー");
      const response = handleError(error);

      expect(response.status).toBe(500);
    });

    it("トレースIDがレスポンスに含まれる", async () => {
      const error = new AppError("UNAUTHORIZED", "認証が必要です");
      const traceId = "trace-456";

      const response = handleError(error, traceId);
      const json = await response.json();

      expect(json.traceId).toBe(traceId);
    });

    it("エラー詳細が含まれる", async () => {
      const details = { field: "email", reason: "invalid format" };
      const error = new AppError("BAD_REQUEST", "不正なリクエスト", details);

      const response = handleError(error);
      const json = await response.json();

      expect(json.details).toEqual(details);
    });
  });
});
