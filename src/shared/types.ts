export type UserReport = {
  app_channel: string;
  app_major_version: string;
  app_name: string;
  app_version: string;
  breakage_category?: string;
  comments: string;
  has_actions: boolean;
  labels: string[];
  os: string;
  prediction: string;
  prob: number;
  related_bugs: RelatedBug[];
  reported_at: Date;
  translated_comments?: string;
  translated_from?: string;
  ua_string: string;
  url: string;
  uuid: string;
};

export type RelatedBug = {
  number: number;
  title: string;
};

export type UrlPattern = {
  bug: number;
  title: string;
  url_pattern: string;
};
