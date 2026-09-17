/** 领域数据模型 */

export interface Paper {
  id: string
  title: string
  /** 该稿件需要的评审人数 */
  reviewsRequired: number
  /** 主题标签 */
  tags: string[]
}

export interface Reviewer {
  id: string
  name: string
  /** 擅长标签 */
  tags: string[]
  /** 最多承担的稿件数（容量） */
  capacity: number
  /** 声明利益冲突的稿件 id */
  conflictPaperIds: string[]
}

export interface AppData {
  papers: Paper[]
  reviewers: Reviewer[]
}

/** 单篇稿件的一条分配结果 */
export interface AssignmentItem {
  paperId: string
  reviewerId: string
  /** 是否命中至少一个共同主题标签 */
  topicMatched: boolean
  /** 命中的共同标签 */
  matchedTags: string[]
}

/** 评审人在结果中的负载信息 */
export interface ReviewerLoad {
  reviewerId: string
  assigned: number
  capacity: number
}

export type InfeasibleKind =
  | 'global-capacity'
  | 'paper-eligible'
  | 'subset-bottleneck'

export interface InfeasibleReason {
  kind: InfeasibleKind
  message: string
  /** paper-eligible: 对应稿件 id 列表 */
  paperIds?: string[]
  /** subset-bottleneck / global-capacity: 瓶颈涉及的评审人 id 列表 */
  reviewerIds?: string[]
  /** subset-bottleneck 时: 缺口数量 */
  deficit?: number
}

export interface AssignmentSuccess {
  feasible: true
  assignments: AssignmentItem[]
  loads: ReviewerLoad[]
  objective: {
    topicMatches: number
    maxLoad: number
    totalAssigned: number
    totalRequired: number
  }
}

export interface AssignmentFailure {
  feasible: false
  reasons: InfeasibleReason[]
}

export type AssignmentResult = AssignmentSuccess | AssignmentFailure
