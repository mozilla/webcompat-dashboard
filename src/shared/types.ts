export type UserReport = {
  uuid: string;
  reported_at: Date;
  url: string;
  breakage_category?: string;
  comments: string;
  ua_string: string;
  related_bugs: RelatedBug[];
  labels: string[];
  prediction: string;
  prob: number;
  has_actions: boolean;
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
