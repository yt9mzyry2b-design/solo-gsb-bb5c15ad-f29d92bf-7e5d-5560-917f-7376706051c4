import type { AppData } from '../types'
import type { StressTestOutcome } from '../engine/stressTest'
import { kindLabel } from './ResultPanel'

interface StressTestPanelProps {
  data: AppData
  outcome: StressTestOutcome | null
  /** 数据已变更、结果已过期 */
  stale: boolean
  running: boolean
  runMillis: number | null
  onRun: () => void
  onExport: () => void
}

export function StressTestPanel({ data, outcome, stale, running, runMillis, onRun, onExport }: StressTestPanelProps) {
  const paperMap = new Map(data.papers.map((p) => [p.id, p]))
  const reviewerMap = new Map(data.reviewers.map((r) => [r.id, r]))
  const paperTitle = (id: string) => paperMap.get(id)?.title || id
  const reviewerName = (id: string) => reviewerMap.get(id)?.name || id
  const reviewerCapacity = (id: string) => reviewerMap.get(id)?.capacity ?? 0

  return (
    <section>
      <div className="panel-head">
        <h2>评审人缺席压力测试</h2>
        <div className="stress-actions">
          <button className="btn btn-primary" onClick={onRun} disabled={running}>
            {running ? '⏳ 模拟中…' : '▶ 运行压力测试'}
          </button>
          <button className="btn btn-ghost" onClick={onExport} disabled={!outcome || outcome.status !== 'ok'}>
            ⬇ 导出报告 JSON
          </button>
        </div>
      </div>

      <p className="stress-desc">
        在当前数据可生成方案的前提下，依次将每位容量大于 0 的评审人模拟为完全缺席（容量置 0），
        使用与「生成分派」相同的硬约束可行性逻辑重新判定。容量为 0 的评审人本就不参与分配，跳过模拟。
        整个过程不修改录入数据与当前分配结果。
      </p>

      {running && (
        <div className="result-empty">
          <p>⏳ 正在逐人模拟缺席并重新判定可行性…</p>
        </div>
      )}

      {!running && !outcome && (
        <div className="result-empty">
          <p>尚未运行压力测试。点击右上角「▶ 运行压力测试」开始逐人缺席模拟。</p>
          <ul>
            <li>
              <strong>仍可分配</strong>：该评审人缺席后，剩余阵容仍能满足全部硬约束；
            </li>
            <li>
              <strong>不可分配</strong>：该评审人是关键节点，报告会给出缺席者、受影响稿件、名额缺口与可选评审人瓶颈。
            </li>
          </ul>
        </div>
      )}

      {!running && outcome?.status === 'base-infeasible' && (
        <>
          <div className="result-banner result-banner--fail">
            <h2>✕ 当前数据无法生成可行分配</h2>
            <p>压力测试未执行：请先解决以下硬约束问题，使当前数据可以生成方案后再运行。</p>
          </div>
          <div className="reason-list">
            {outcome.reasons.map((r, i) => (
              <div className="reason-card" key={i}>
                <span className="reason-kind">{kindLabel[r.kind] ?? r.kind}</span>
                <p className="reason-message">{r.message}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {!running && outcome?.status === 'ok' && (
        <>
          {stale && (
            <div className="result-banner result-banner--warn">
              <h2>⚠ 结果已过期</h2>
              <p>录入数据已变更，以下压力测试结果对应旧数据，请重新运行以更新。</p>
            </div>
          )}

          <div className={`result-banner ${outcome.report.infeasible.length === 0 ? 'result-banner--ok' : 'result-banner--warn'}`}>
            <h2>
              {outcome.report.infeasible.length === 0
                ? '✓ 任一评审人缺席后仍可分配'
                : `⚠ ${outcome.report.infeasible.length} 位评审人缺席后将无法分配`}
            </h2>
            <div className="stat-row">
              <div className="stat">
                <strong>{outcome.report.testedCount}</strong>
                <span>已测试评审人</span>
              </div>
              <div className="stat">
                <strong>{outcome.report.assignable.length}</strong>
                <span>缺席后仍可分配</span>
              </div>
              <div className="stat">
                <strong>{outcome.report.infeasible.length}</strong>
                <span>缺席后不可分配</span>
              </div>
              {runMillis !== null && (
                <div className="stat">
                  <strong>{runMillis} ms</strong>
                  <span>本地模拟耗时</span>
                </div>
              )}
            </div>
            <p>
              总需求 {outcome.report.totalRequired} 个名额 · 总容量 {outcome.report.totalCapacity}（冗余{' '}
              {outcome.report.totalCapacity - outcome.report.totalRequired}）
            </p>
          </div>

          {outcome.report.infeasible.length > 0 && (
            <>
              <h3 className="subhead">不可分配（{outcome.report.infeasible.length}）</h3>
              <div className="reason-list">
                {outcome.report.infeasible.map((c) => (
                  <div className="reason-card" key={c.reviewerId}>
                    <span className="reason-kind">缺席者：{c.reviewerName}（容量 {c.capacity}）</span>
                    <div className="stress-facts">
                      <div className="stress-fact">
                        <span>名额缺口</span>
                        <strong>{c.deficit} 个</strong>
                      </div>
                      <div className="stress-fact">
                        <span>受影响稿件</span>
                        <strong>
                          {c.affectedPaperIds.length
                            ? c.affectedPaperIds.map((id) => `《${paperTitle(id)}》`).join('、')
                            : '—'}
                        </strong>
                      </div>
                      <div className="stress-fact">
                        <span>可选评审人瓶颈</span>
                        <strong>
                          {c.bottleneckReviewerIds.length
                            ? c.bottleneckReviewerIds
                                .map((id) => `${reviewerName(id)}（容量 ${reviewerCapacity(id)}）`)
                                .join('、')
                            : '（剩余阵容中无可用评审人）'}
                        </strong>
                      </div>
                    </div>
                    {c.reasons.map((r, i) => (
                      <p className="reason-message stress-reason" key={i}>
                        <em>{kindLabel[r.kind] ?? r.kind}</em>：{r.message}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {outcome.report.assignable.length > 0 && (
            <>
              <h3 className="subhead">仍可分配（{outcome.report.assignable.length}）</h3>
              <div className="stress-ok-list">
                {outcome.report.assignable.map((c) => (
                  <span className="stress-chip" key={c.reviewerId}>
                    ✓ {c.reviewerName}（容量 {c.capacity}）
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
