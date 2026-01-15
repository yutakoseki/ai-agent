import type { XPostBatch, XPostTopic } from "@shared/x-posts";

export type XPostPostedView = {
  rank: number;
  tweetId: string;
  postedAt: string;
};

export type XPostBatchView = {
  id: string;
  date: string;
  topics: XPostTopic[];
  posted?: XPostPostedView[];
  createdAt: string;
  updatedAt: string;
};

export function toViewBatch(batch: XPostBatch): XPostBatchView {
  return {
    id: batch.id,
    date: batch.date,
    topics: batch.payload.topics,
    posted: batch.posted?.map((entry) => ({
      rank: entry.rank,
      tweetId: entry.tweetId,
      postedAt: entry.postedAt.toISOString(),
    })),
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}
