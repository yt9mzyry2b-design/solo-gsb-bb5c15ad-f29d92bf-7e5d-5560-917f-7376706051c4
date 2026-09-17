import { solveAssignment } from '../src/engine/solver'
import { runAbsenceStressTest } from '../src/engine/stressTest'
import type { AppData } from '../src/types'

let pass = 0
let fail = 0

function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✕ ${name} ${extra}`)
  }
}

const mk = (papers: AppData['papers'], reviewers: AppData['reviewers']): AppData => ({ papers, reviewers })
const P = (id: string, title: string, reviewsRequired: number, tags: string[] = []) => ({ id: id, title, reviewsRequired, tags })
const R = (id: string, name: string, capacity: number, tags: string[] = [], conflictPaperIds: string[] = []) => ({
  id, name, capacity, tags, conflictPaperIds
})

// 1. 示例数据：可行且匹配/均衡合理
{
  const d = mk(
    [P('p1', 'LLM微调', 2, ['机器学习', 'NLP']), P('p2', 'GNN推荐', 2, ['机器学习', '推荐系统']), P('p3', 'KV存储', 2, ['分布式系统', '数据库']), P('p4', '联邦隐私', 2, ['安全', '机器学习'])],
    [R('a', 'Alice', 2, ['机器学习', 'NLP'], ['p1']), R('b', 'Bob', 2, ['机器学习', '推荐系统']), R('c', 'Carol', 3, ['分布式系统', '数据库'], ['p3']), R('d', 'Dave', 2, ['安全', '机器学习'])]
  )
  const res = solveAssignment(d)
  console.log('用例1 示例数据')
  check('可行', res.feasible)
  if (res.feasible) {
    check('共分配 8 个名额', res.objective.totalAssigned === 8, JSON.stringify(res.objective))
    check('每篇恰好 2 人', d.papers.every((p) => res.assignments.filter((a) => a.paperId === p.id).length === 2))
    check('无人超容量', res.loads.every((l) => l.assigned <= l.capacity))
    check('冲突对从未出现', !res.assignments.some((a) => (a.paperId === 'p1' && a.reviewerId === 'a') || (a.paperId === 'p3' && a.reviewerId === 'c')))
    check('主题匹配数=4（p3 与 c 的非匹配不可避免）', res.objective.topicMatches === 4, `got ${res.objective.topicMatches}`)
    check('最大负载=2（均衡）', res.objective.maxLoad === 2, `got ${res.objective.maxLoad}`)
  } else {
    console.log('   原因:', res.reasons.map((r) => r.message).join(' | '))
  }
}

// 2. 单篇稿件可分配人数不足
{
  const d = mk(
    [P('p1', '稿件A', 3, ['X'])],
    [R('a', '甲', 2, ['X'], ['p1']), R('b', '乙', 1), R('c', '丙', 1)]
  )
  const res = solveAssignment(d)
  console.log('用例2 单篇可分配人数不足')
  check('不可行', !res.feasible)
  if (!res.feasible) check('给出 paper-eligible 原因', res.reasons.some((r) => r.kind === 'paper-eligible'), JSON.stringify(res.reasons))
}

// 3. 全局容量不足
{
  const d = mk(
    [P('p1', 'A', 2), P('p2', 'B', 2)],
    [R('a', '甲', 1), R('b', '乙', 1)]
  )
  const res = solveAssignment(d)
  console.log('用例3 全局容量不足')
  check('不可行', !res.feasible)
  if (!res.feasible) check('给出 global-capacity 原因', res.reasons.some((r) => r.kind === 'global-capacity'))
}

// 4. 组合性瓶颈：p1,p2 都只能给 a,b（容量各1，共2），但两篇各需2人
{
  const d = mk(
    [P('p1', 'A', 2), P('p2', 'B', 2)],
    [R('a', '甲', 1, [], []), R('b', '乙', 1, [], []), R('c', '丙', 5, [], ['p1', 'p2'])]
  )
  const res = solveAssignment(d)
  console.log('用例4 组合性瓶颈')
  check('不可行', !res.feasible)
  if (!res.feasible) {
    const sub = res.reasons.find((r) => r.kind === 'subset-bottleneck')
    check('给出 subset-bottleneck 原因', !!sub, JSON.stringify(res.reasons.map((r) => r.kind)))
    check('缺口=2（广义 Hall 紧见证）', sub?.deficit === 2, `got ${sub?.deficit}`)
    check('瓶颈稿件含 p1,p2', sub?.paperIds?.length === 2)
    check('可选评审人仅 a,b（不含冲突者 c）', sub?.reviewerIds?.length === 2 && !sub.reviewerIds.includes('c'))
  }
}

// 4b. 全冲突型组合瓶颈（每篇都无任何可分配评审人）
{
  const res = solveAssignment(mk(
    [P('p1', 'A', 1), P('p2', 'B', 1)],
    [R('a', '甲', 5, [], ['p1', 'p2']), R('b', '乙', 5, [], ['p1', 'p2'])]
  ))
  console.log('用例4b 全冲突')
  check('不可行', !res.feasible)
  if (!res.feasible) check('每篇均给出单篇不足原因', res.reasons.filter((r) => r.kind === 'paper-eligible').length === 2)
}

// 5. 目标优先级：匹配优先于均衡（必要时宁愿负载不均也要拿匹配）
{
  // p1 标 X：只有 a 擅长 X；p2 无标签。容量 a=2,b=2。
  const d = mk(
    [P('p1', 'A', 1, ['X']), P('p2', 'B', 1)],
    [R('a', '甲', 2, ['X']), R('b', '乙', 2, ['Y'])]
  )
  const res = solveAssignment(d)
  console.log('用例5 主题匹配优先')
  check('可行', res.feasible)
  if (res.feasible) {
    const p1a = res.assignments.find((a) => a.paperId === 'p1')
    check('p1 分给匹配者 a', p1a?.reviewerId === 'a' && p1a.topicMatched)
  }
}

// 6. 均衡第二优先：匹配数相同时摊平负载
{
  // 两篇都无标签，两位评审人容量各 2，各需 1 → 应一人一篇
  const d = mk(
    [P('p1', 'A', 1), P('p2', 'B', 1)],
    [R('a', '甲', 2), R('b', '乙', 2)]
  )
  const res = solveAssignment(d)
  console.log('用例6 负载均衡')
  if (res.feasible) check('最大负载=1', res.objective.maxLoad === 1, `got ${res.objective.maxLoad}`)
}

// 7. 无评审人
{
  const res = solveAssignment(mk([P('p1', 'A', 1)], []))
  console.log('用例7 无评审人')
  check('不可行且提示', !res.feasible && res.reasons.length > 0)
}

// 8. 较大规模性能（30 稿 ×3 + 12 评审人容量 8）
{
  const papers = Array.from({ length: 30 }, (_, i) => P(`p${i}`, `稿件${i}`, 3, ['T' + (i % 6)]))
  const reviewers = Array.from({ length: 12 }, (_, j) => R(`r${j}`, `评审${j}`, 8, j < 6 ? ['T' + (j % 6)] : []))
  const t0 = Date.now()
  const res = solveAssignment(mk(papers, reviewers))
  const ms = Date.now() - t0
  console.log(`用例8 规模 30x12（${ms} ms）`)
  check('可行且 90 个名额', res.feasible && res.objective.totalAssigned === 90, JSON.stringify(res.feasible ? res.objective : res.reasons))
}

// 9. 缺席压力测试：混合结果（仍可分配 / 不可分配），容量 0 者跳过，数据不被修改
{
  const d = mk(
    [P('p1', 'A', 2), P('p2', 'B', 2)],
    [R('a', '甲', 2), R('b', '乙', 2), R('c', '丙', 1), R('z', '闲', 0)]
  )
  const before = JSON.stringify(d)
  const out = runAbsenceStressTest(d)
  console.log('用例9 缺席压力测试·混合结果')
  check('基线可行，返回 ok', out.status === 'ok')
  if (out.status === 'ok') {
    check('测试 3 人（容量 0 的 z 被跳过）', out.report.testedCount === 3, `got ${out.report.testedCount}`)
    check('仍可分配 1 人（丙）', out.report.assignable.length === 1 && out.report.assignable[0].reviewerId === 'c')
    check('不可分配 2 人（甲、乙）', out.report.infeasible.length === 2)
    const a = out.report.infeasible.find((x) => x.reviewerId === 'a')
    check('甲缺席名额缺口=1', a?.deficit === 1, `got ${a?.deficit}`)
    check('甲缺席受影响稿件为 p1,p2', a?.affectedPaperIds.length === 2, JSON.stringify(a?.affectedPaperIds))
    check('瓶颈名单不含缺席者本人', !!a && !a.bottleneckReviewerIds.includes('a'))
    check('瓶颈名单含乙、丙', !!a && a.bottleneckReviewerIds.includes('b') && a.bottleneckReviewerIds.includes('c'))
    check('不可分配项附具体原因', !!a && a.reasons.length > 0)
  }
  check('录入数据未被修改', JSON.stringify(d) === before)
}

// 10. 缺席压力测试：基线不可行 → 不执行模拟
{
  const d = mk([P('p1', 'A', 2)], [R('a', '甲', 1)])
  const out = runAbsenceStressTest(d)
  console.log('用例10 缺席压力测试·基线不可行')
  check('返回 base-infeasible', out.status === 'base-infeasible')
  if (out.status === 'base-infeasible') check('附带既有可行性原因', out.reasons.length > 0)
}

// 11. 缺席压力测试：冲突型瓶颈诊断（缺席后瓶颈评审人定位精确）
{
  const d = mk(
    [P('p1', 'A', 2), P('p2', 'B', 2)],
    [R('a', '甲', 2), R('b', '乙', 2), R('c', '丙', 5, [], ['p1', 'p2'])]
  )
  const out = runAbsenceStressTest(d)
  console.log('用例11 缺席压力测试·冲突型瓶颈')
  check('基线可行，返回 ok', out.status === 'ok')
  if (out.status === 'ok') {
    const a = out.report.infeasible.find((x) => x.reviewerId === 'a')
    check('甲缺席缺口=2', a?.deficit === 2, `got ${a?.deficit}`)
    check('甲缺席受影响稿件为 p1,p2', a?.affectedPaperIds.length === 2)
    check('瓶颈仅乙（丙与全部稿件冲突）', a?.bottleneckReviewerIds.length === 1 && a.bottleneckReviewerIds[0] === 'b', JSON.stringify(a?.bottleneckReviewerIds))
    check('丙缺席仍可分配（丙本就无法承担任何稿件）', out.report.assignable.some((x) => x.reviewerId === 'c'))
  }
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
if (fail > 0) process.exit(1)
