export type XPostTopicImportance = "High" | "Medium" | "Low";
export type XPostSourceType = "Official" | "Community" | "TechMedia" | "X";

export type XPostTopic = {
  rank: number;
  importance: XPostTopicImportance;
  title: string;
  summary: string;
  postTypeCode: string;
  postTypeName: string;
  publishedDate: string;
  urls: string[];
  tags: string[];
  image: string;
  sourceType: XPostSourceType;
};

export type XPostPayload = {
  date: string;
  topics: XPostTopic[];
};

export type XPostPosted = {
  rank: number;
  tweetId: string;
  postedAt: Date;
};

export type XPostBatch = {
  id: string;
  userId: string;
  date: string;
  payload: XPostPayload;
  posted?: XPostPosted[];
  createdAt: Date;
  updatedAt: Date;
};
