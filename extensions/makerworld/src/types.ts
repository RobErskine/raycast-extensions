export interface DesignCreator {
  uid: number;
  name: string;
  avatar: string;
  handle: string;
}

export interface Design {
  id: number;
  title: string;
  slug: string;
  cover: string;
  coverPortrait: string;
  likeCount: number;
  collectionCount: number;
  printCount: number;
  downloadCount: number;
  commentCount: number;
  designCreator: DesignCreator;
  tags: string[];
  license: string;
  createTime: string;
  isStaffPicked: boolean;
  isExclusive: boolean;
  is_printable: boolean;
  nsfw: boolean;
}

export interface SearchResponse {
  total: number;
  hits: Design[];
}
