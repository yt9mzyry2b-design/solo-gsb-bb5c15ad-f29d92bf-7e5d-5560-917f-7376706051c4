import type { AppData, AssignmentSuccess } from './types'
import type { StressTestReport } from './engine/stressTest'

export interface ExportPayload {
  exportedAt: string
  summary: AssignmentSuccess['objective']
  assignments: Array<{
    paperId: string
    paperTitle: string
    reviewerId: string
    reviewerName: string
    topicMatched: boolean
    matchedTags: string[]
  }>
  reviewerLoads: Array<{
    reviewerId: string
    reviewerName: string
    assigned: number
    capacity: number
    utilization: number
  }>
}

export function buildExportPayload(data: AppData, result: AssignmentSuccess): ExportPayload {
  const paperMap = new Map(data.papers.map((p) => [p.id, p]))
  const reviewerMap = new Map(data.reviewers.map((r) => [r.id, r]))
  return {
    exportedAt: new Date().toISOString(),
    summary: result.objective,
    assignments: result.assignments.map((a) => ({
      paperId: a.paperId,
      paperTitle: paperMap.get(a.paperId)?.title ?? a.paperId,
      reviewerId: a.reviewerId,
      reviewerName: reviewerMap.get(a.reviewerId)?.name ?? a.reviewerId,
      topicMatched: a.topicMatched,
      matchedTags: a.matchedTags
    })),
    reviewerLoads: result.loads.map((l) => ({
      reviewerId: l.reviewerId,
      reviewerName: reviewerMap.get(l.reviewerId)?.name ?? l.reviewerId,
      assigned: l.assigned,
      capacity: l.capacity,
      utilization: l.capacity > 0 ? Number((l.assigned / l.capacity).toFixed(3)) : 0
    }))
  }
}

export function downloadJson(payload: unknown, filePrefix = 'blind-review-assignment'): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `${filePrefix}-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ------------------------------ 缺席压力测试报告导出 ------------------------------ */

export interface StressExportPayload {
  exportedAt: string
  type: 'reviewer-absence-stress-test'
  summary: {
    totalRequired: number
    totalCapacity: number
    /** 总容量冗余 = 总容量 − 总需求 */
    capacitySlack: number
    testedReviewers: number
    stillAssignable: number
    notAssignable: number
  }
  cases: Array<{
    absentReviewerId: string
    absentReviewerName: string
    absentReviewerCapacity: number
    stillAssignable: boolean
    /** 仅不可分配时存在：名额缺口 */
    deficit?: number
    /** 仅不可分配时存在：受影响稿件 */
    affectedPapers?: Array<{ paperId: string; paperTitle: string }>
    /** 仅不可分配时存在：可选评审人瓶颈（不含缺席者本人） */
    bottleneckReviewers?: Array<{ reviewerId: string; reviewerName: string; capacity: number }>
    /** 仅不可分配时存在：既有可行性逻辑给出的具体原因 */
    reasons?: Array<{ kind: string; message: string }>
  }>
}

export function buildStressExportPayload(data: AppData, report: StressTestReport): StressExportPayload {
  const paperMap = new Map(data.papers.map((p) => [p.id, p]))
  const reviewerMap = new Map(data.reviewers.map((r) => [r.id, r]))
  return {
    exportedAt: new Date().toISOString(),
    type: 'reviewer-absence-stress-test',
    summary: {
      totalRequired: report.totalRequired,
      totalCapacity: report.totalCapacity,
      capacitySlack: report.totalCapacity - report.totalRequired,
      testedReviewers: report.testedCount,
      stillAssignable: report.assignable.length,
      notAssignable: report.infeasible.length
    },
    cases: [
      // 不可分配项在前（更关键），仍可分配项在后
      ...report.infeasible.map((c) => ({
        absentReviewerId: c.reviewerId,
        absentReviewerName: c.reviewerName,
        absentReviewerCapacity: c.capacity,
        stillAssignable: false as const,
        deficit: c.deficit,
        affectedPapers: c.affectedPaperIds.map((id) => ({
          paperId: id,
          paperTitle: paperMap.get(id)?.title ?? id
        })),
        bottleneckReviewers: c.bottleneckReviewerIds.map((id) => ({
          reviewerId: id,
          reviewerName: reviewerMap.get(id)?.name ?? id,
          capacity: reviewerMap.get(id)?.capacity ?? 0
        })),
        reasons: c.reasons.map((r) => ({ kind: r.kind as string, message: r.message }))
      })),
      ...report.assignable.map((c) => ({
        absentReviewerId: c.reviewerId,
        absentReviewerName: c.reviewerName,
        absentReviewerCapacity: c.capacity,
        stillAssignable: true as const
      }))
    ]
  }
}
