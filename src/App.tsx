import { useEffect, useMemo, useState } from 'react'
import type { AppData, AssignmentResult, Paper, Reviewer } from './types'
import { loadData, saveData } from './storage'
import { solveAssignment } from './engine/solver'
import { createSampleData } from './sampleData'
import { buildExportPayload, downloadJson } from './exporter'
import { PapersPanel } from './components/PapersPanel'
import { ReviewersPanel } from './components/ReviewersPanel'
import { ResultPanel } from './components/ResultPanel'
import './styles.css'

type Tab = 'papers' | 'reviewers' | 'result'

const EMPTY: AppData = { papers: [], reviewers: [] }

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData() ?? EMPTY)
  const [tab, setTab] = useState<Tab>('papers')
  const [result, setResult] = useState<AssignmentResult | null>(null)
  const [stale, setStale] = useState(false)
  const [solving, setSolving] = useState(false)
  const [solveMillis, setSolveMillis] = useState<number | null>(null)

  // 数据变化自动持久化到 localStorage；已有结果则标记为过期
  useEffect(() => {
    saveData(data)
    setStale((s) => (result ? true : s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const conflictCountOf = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of data.reviewers) for (const pid of r.conflictPaperIds) map.set(pid, (map.get(pid) ?? 0) + 1)
    return (paperId: string) => map.get(paperId) ?? 0
  }, [data.reviewers])

  const setPapers = (papers: Paper[]) => setData((d) => ({ ...d, papers }))
  const setReviewers = (reviewers: Reviewer[]) => setData((d) => ({ ...d, reviewers }))

  const generate = () => {
    // 让“求解中”状态先渲染，再执行同步求解（大规模 ILP 可能耗时数百毫秒至数秒）
    setSolving(true)
    setTimeout(() => {
      const t0 = performance.now()
      const r = solveAssignment(data)
      setSolveMillis(Math.round(performance.now() - t0))
      setResult(r)
      setStale(false)
      setSolving(false)
      setTab('result')
    }, 30)
  }

  const loadSample = () => {
    if (data.papers.length || data.reviewers.length) {
      if (!window.confirm('载入示例数据将覆盖当前录入内容，是否继续？')) return
    }
    setData(createSampleData())
    setResult(null)
    setStale(false)
  }

  const clearAll = () => {
    if (!window.confirm('确定清空全部稿件与评审人数据？该操作不可撤销。')) return
    setData(EMPTY)
    setResult(null)
    setStale(false)
  }

  const exportResult = () => {
    if (result?.feasible) downloadJson(buildExportPayload(data, result))
  }

  const totalRequired = data.papers.reduce((a, p) => a + Math.max(0, p.reviewsRequired || 0), 0)
  const totalCapacity = data.reviewers.reduce((a, r) => a + Math.max(0, r.capacity || 0), 0)

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">⚖</span>
          <div>
            <h1>盲审分配台</h1>
            <p>Blind Review Desk · 浏览器本地整数规划分配，数据不出本机</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="header-stat">
            稿件 {data.papers.length} · 名额 {totalRequired} · 评审人 {data.reviewers.length} · 容量 {totalCapacity}
          </span>
          <button className="btn btn-ghost" onClick={loadSample}>
            载入示例
          </button>
          <button className="btn btn-ghost danger" onClick={clearAll}>
            清空
          </button>
          <button className="btn btn-generate" onClick={generate} disabled={data.papers.length === 0 || solving}>
            {solving ? '⏳ 本地求解中…' : '▶ 生成分派'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'papers' ? 'tab active' : 'tab'} onClick={() => setTab('papers')}>
          稿件
        </button>
        <button className={tab === 'reviewers' ? 'tab active' : 'tab'} onClick={() => setTab('reviewers')}>
          评审人 / 利益冲突
        </button>
        <button className={tab === 'result' ? 'tab active' : 'tab'} onClick={() => setTab('result')}>
          分配结果
          {stale && <span className="stale-dot" title="数据已变更，结果可能过期">●</span>}
        </button>
        {solveMillis !== null && <span className="solve-time">本地求解耗时 {solveMillis} ms</span>}
      </nav>

      <main className="content">
        {tab === 'papers' && <PapersPanel papers={data.papers} onChange={setPapers} conflictCountOf={conflictCountOf} />}
        {tab === 'reviewers' && <ReviewersPanel papers={data.papers} reviewers={data.reviewers} onChange={setReviewers} />}
        {tab === 'result' &&
          (solving ? (
            <section className="result-empty">
              <p>⏳ 正在浏览器本地进行整数规划求解，请稍候…</p>
            </section>
          ) : (
            <ResultPanel data={data} result={result} onExport={exportResult} />
          ))}
      </main>

      <footer className="app-footer">
        所有计算均在浏览器内完成（javascript-lp-solver）；录入数据自动保存于 localStorage，可随时关闭页面。
      </footer>
    </div>
  )
}
