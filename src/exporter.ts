import type { AppData, AssignmentSuccess } from './types'

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

export function downloadJson(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `blind-review-assignment-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
