import type { AppData, InfeasibleReason } from '../types'
import { analyzeFeasibility, normalizeData } from './solver'

/** 单个评审人缺席模拟：仍可分配 */
export interface AbsenceCaseAssignable {
  reviewerId: string
  reviewerName: string
  /** 该评审人的原始容量（缺席模拟时被临时置 0） */
  capacity: number
  stillAssignable: true
}

/** 单个评审人缺席模拟：不可分配（含结构化诊断，绝不止“总容量不足”） */
export interface AbsenceCaseInfeasible {
  reviewerId: string
  reviewerName: string
  capacity: number
  stillAssignable: false
  /** 名额缺口：总需求 − 缺席后最多可分配数 */
  deficit: number
  /** 受影响稿件 id（最大流最小割源侧稿件集合） */
  affectedPaperIds: string[]
  /** 可选评审人瓶颈：缺席后剩余阵容中与受影响稿件无冲突的评审人 id（不含缺席者本人） */
  bottleneckReviewerIds: string[]
  /** 既有可行性逻辑给出的具体原因 */
  reasons: InfeasibleReason[]
}

export type AbsenceCase = AbsenceCaseAssignable | AbsenceCaseInfeasible

export interface StressTestReport {
  generatedAt: string
  totalRequired: number
  totalCapacity: number
  /** 参与模拟的评审人数（仅容量 > 0 者） */
  testedCount: number
  /** 缺席后仍可分配 */
  assignable: AbsenceCaseAssignable[]
  /** 缺席后不可分配 */
  infeasible: AbsenceCaseInfeasible[]
}

export type StressTestOutcome =
  | { status: 'ok'; report: StressTestReport }
  | { status: 'base-infeasible'; reasons: InfeasibleReason[] }

/**
 * 评审人缺席压力测试。
 *
 * 仅在当前数据可生成方案（硬约束可行）时执行：对每位容量 > 0 的评审人，
 * 在数据副本上将其容量置 0 模拟完全缺席，复用与「生成分派」完全相同的
 * 硬约束可行性逻辑（analyzeFeasibility）重新判定。
 * 全程不修改录入数据，也不触碰当前分配结果。
 */
export function runAbsenceStressTest(data: AppData): StressTestOutcome {
  // 门槛：当前数据本身必须可生成方案，否则压力测试无意义
  const base = analyzeFeasibility(data)
  if (!base.feasible) return { status: 'base-infeasible', reasons: base.reasons }

  // 以规范化后的评审人名单为准（与求解器口径一致：空姓名者本就不参与分配）
  const { reviewers } = normalizeData(data)
  const assignable: AbsenceCaseAssignable[] = []
  const infeasible: AbsenceCaseInfeasible[] = []

  for (const reviewer of reviewers) {
    if (reviewer.capacity <= 0) continue // 容量为 0 者本就形同缺席，无需模拟

    // 在副本上把该评审人容量置 0 —— 录入数据保持不变
    const simulated: AppData = {
      papers: data.papers,
      reviewers: data.reviewers.map((r) => (r.id === reviewer.id ? { ...r, capacity: 0 } : r))
    }
    const check = analyzeFeasibility(simulated)

    if (check.feasible) {
      assignable.push({
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        capacity: reviewer.capacity,
        stillAssignable: true
      })
    } else {
      infeasible.push({
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        capacity: reviewer.capacity,
        stillAssignable: false,
        deficit: check.deficit,
        affectedPaperIds: check.affectedPaperIds,
        // 瓶颈名单剔除缺席者本人：展示的是“剩余阵容”中的可选评审人瓶颈
        bottleneckReviewerIds: check.bottleneckReviewerIds.filter((id) => id !== reviewer.id),
        reasons: check.reasons
      })
    }
  }

  return {
    status: 'ok',
    report: {
      generatedAt: new Date().toISOString(),
      totalRequired: base.totalRequired,
      totalCapacity: base.totalCapacity,
      testedCount: assignable.length + infeasible.length,
      assignable,
      infeasible
    }
  }
}
