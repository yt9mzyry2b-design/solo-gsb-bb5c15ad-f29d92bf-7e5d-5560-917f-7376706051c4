// 无浏览器环境下的渲染冒烟：桩掉浏览器 API 后 renderToString
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k)
}
;(globalThis as any).performance = { now: () => 0 }
;(globalThis as any).window = { confirm: () => false }

import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App'
import { createSampleData } from '../src/sampleData'
import { StressTestPanel } from '../src/components/StressTestPanel'
import { runAbsenceStressTest } from '../src/engine/stressTest'

// 初始空数据渲染
const html1 = renderToString(React.createElement(App))
if (!html1.includes('盲审分配台')) throw new Error('未渲染标题')
if (!html1.includes('生成分派')) throw new Error('未渲染生成按钮')
if (!html1.includes('缺席压力测试')) throw new Error('未渲染压力测试标签')
if (!html1.includes('还没有稿件')) throw new Error('空态提示异常')
console.log('✓ 空数据渲染成功，长度', html1.length)

// 写入示例数据后渲染（localStorage 初始值，落在"稿件"标签页）
store.set('blind-review-desk:data:v1', JSON.stringify(createSampleData()))
const html2 = renderToString(React.createElement(App))
if (!html2.includes('添加稿件')) throw new Error('稿件面板异常')
if (!html2.includes('面向大语言模型的高效微调方法')) throw new Error('示例稿件未渲染')
if (!html2.includes('机器学习')) throw new Error('稿件标签未渲染')
if (!html2.includes('利益冲突')) throw new Error('冲突入口未渲染')
console.log('✓ 示例数据渲染成功，长度', html2.length)

// 压力测试面板：真实运行示例数据后渲染报告
const sample = createSampleData()
const outcome = runAbsenceStressTest(sample)
if (outcome.status !== 'ok') throw new Error('示例数据压力测试应可执行')
const html3 = renderToString(
  React.createElement(StressTestPanel, {
    data: sample,
    outcome,
    stale: false,
    running: false,
    runMillis: 3,
    onRun: () => {},
    onExport: () => {}
  })
)
if (!html3.includes('已测试评审人')) throw new Error('压力测试汇总未渲染')
if (!html3.includes('缺席者')) throw new Error('压力测试不可分配项未渲染')
if (!html3.includes('名额缺口')) throw new Error('名额缺口未渲染')
if (!html3.includes('受影响稿件')) throw new Error('受影响稿件未渲染')
if (!html3.includes('可选评审人瓶颈')) throw new Error('可选评审人瓶颈未渲染')
if (!html3.includes('导出报告 JSON')) throw new Error('导出入口未渲染')
console.log('✓ 压力测试报告渲染成功，长度', html3.length)

// 压力测试面板：数据变更后的过期标记
const html4 = renderToString(
  React.createElement(StressTestPanel, {
    data: sample,
    outcome,
    stale: true,
    running: false,
    runMillis: 3,
    onRun: () => {},
    onExport: () => {}
  })
)
if (!html4.includes('结果已过期')) throw new Error('过期标记未渲染')
console.log('✓ 压力测试过期标记渲染成功')

// 压力测试面板：基线不可行时拒绝执行并给出原因
const badOutcome = runAbsenceStressTest({ papers: [{ id: 'p1', title: 'X', reviewsRequired: 2, tags: [] }], reviewers: [] })
if (badOutcome.status !== 'base-infeasible') throw new Error('基线不可行应返回 base-infeasible')
const html5 = renderToString(
  React.createElement(StressTestPanel, {
    data: { papers: [], reviewers: [] },
    outcome: badOutcome,
    stale: false,
    running: false,
    runMillis: null,
    onRun: () => {},
    onExport: () => {}
  })
)
if (!html5.includes('压力测试未执行')) throw new Error('基线不可行提示未渲染')
console.log('✓ 压力测试基线不可行提示渲染成功')
