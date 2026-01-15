export type RssSourceStatus = "active" | "disabled" | "error";
export type RssGenerationTarget = "blog" | "x";

export interface RssSource {
  id: string;
  userId: string;
  url: string;
  status: RssSourceStatus;
  title?: string;
  lastFetchedAt?: Date;
  nextFetchAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RssDraft {
  id: string;
  userId: string;
  sourceId: string;
  sourceTitle?: string;
  itemId: string;
  itemTitle: string;
  itemUrl: string;
  target: RssGenerationTarget;
  title?: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRssSourceRequest {
  url: string;
}

export interface UpdateRssSourceRequest {
  status?: RssSourceStatus;
}

export interface RssSourceListResponse {
  sources: RssSource[];
  total: number;
}

export interface RssDraftListResponse {
  drafts: RssDraft[];
  total: number;
}

export interface RssPreferences {
  generationTargets: RssGenerationTarget[];
  writerRole?: string;
  targetPersona?: string;
  postTone?: string;
  postFormat?: string;
}
