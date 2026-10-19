import { useMemo, useState } from 'react'
import { Copy, History, RefreshCw, Save, Sparkles } from 'lucide-react'
import { formatServicePrice, services, storeInfo } from '../data/mockData'
import {
  generateMarketingContent,
  MARKETING_SCENES,
  validateMarketingInput,
} from '../lib/marketingService'
import { useAppData } from '../store/AppDataContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import type {
  MarketingGeneratedContent,
  MarketingPlan,
  MarketingSceneType,
  MarketingTone,
} from '../types'

const TONES: MarketingTone[] = ['专业可信', '亲切温和', '轻松活泼']

function displayContent(plan: {
  generatedContent: string
  editedContent?: string
}): string {
  return plan.editedContent?.trim() ? plan.editedContent : plan.generatedContent
}

export function MarketingPage() {
  const {
    customers,
    appointments,
    getCustomerAppointments,
    marketingPlans,
    saveMarketingPlan,
    updateMarketingPlan,
    deleteMarketingPlan,
  } = useAppData()

  const [scene, setScene] = useState<MarketingSceneType>('new_customer_campaign')
  const [prompt, setPrompt] = useState(MARKETING_SCENES[0].defaultPrompt)
  const [goal, setGoal] = useState(MARKETING_SCENES[0].defaultGoal)
  const [audience, setAudience] = useState(MARKETING_SCENES[0].defaultAudience)
  const [serviceId, setServiceId] = useState('svc-clean-hydrate')
  const [activityDate, setActivityDate] = useState('')
  const [promoRule, setPromoRule] = useState('')
  const [tone, setTone] = useState<MarketingTone>('专业可信')
  const [customerId, setCustomerId] = useState('')

  const [generating, setGenerating] = useState(false)
  const [variant, setVariant] = useState(0)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const [generated, setGenerated] = useState<MarketingGeneratedContent | null>(
    null,
  )
  const [editedText, setEditedText] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [activePlanId, setActivePlanId] = useState<string | null>(null)

  const needsCustomer =
    scene === 'old_customer_revisit' || scene === 'new_customer_invite'

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId],
  )

  const customerLatestApt = selectedCustomer
    ? getCustomerAppointments(selectedCustomer.id)[0]
    : undefined

  const selectableCustomers = useMemo(() => {
    if (scene === 'old_customer_revisit') {
      return customers.filter(
        (c) =>
          c.followUpStatus === '已预约' ||
          c.tags?.includes('老客复购') ||
          Boolean(c.lastAppointmentAt),
      )
    }
    if (scene === 'new_customer_invite') {
      return customers.filter(
        (c) =>
          c.followUpStatus === '待跟进' ||
          c.followUpStatus === '跟进中' ||
          c.intentLevel === '观望' ||
          c.intentLevel === '高意向',
      )
    }
    return customers
  }, [customers, scene])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }

  const applyScene = (next: MarketingSceneType) => {
    const meta = MARKETING_SCENES.find((s) => s.id === next)!
    setScene(next)
    setPrompt(meta.defaultPrompt)
    setGoal(meta.defaultGoal)
    setAudience(meta.defaultAudience)
    setError('')
    if (next === 'new_customer_campaign' || next === 'moments_copy') {
      setServiceId('svc-clean-hydrate')
    }
  }

  const runGenerate = (nextVariant: number) => {
    const check = validateMarketingInput({ prompt })
    if (!check.ok) {
      setError(check.error)
      return
    }
    setError('')
    setGenerating(true)

    window.setTimeout(() => {
      const result = generateMarketingContent(
        {
          scene,
          prompt,
          goal,
          audience,
          serviceId: serviceId || undefined,
          activityDate: activityDate || undefined,
          promoRule: promoRule || undefined,
          tone,
          customerId: customerId || undefined,
          variant: nextVariant,
        },
        {
          customer: selectedCustomer,
          appointments,
        },
      )
      setGenerated(result)
      setEditedText(result.fullText)
      setIsDirty(false)
      setActivePlanId(null)
      setVariant(nextVariant)
      setGenerating(false)
      showToast('已生成本地方案（规则模板，非大模型）')
    }, 280)
  }

  const handleGenerate = () => runGenerate(0)
  const handleRegenerate = () => runGenerate(variant + 1)

  const handleEdit = (value: string) => {
    setEditedText(value)
    setIsDirty(value !== (generated?.fullText ?? ''))
  }

  const handleCopy = async (text: string, label = '内容') => {
    const value = text.trim()
    if (!value) {
      setError('没有可复制的内容。')
      return
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        showToast(`已复制${label}`)
        return
      }
      throw new Error('clipboard unavailable')
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
        showToast(`已复制${label}（备用方式）`)
      } catch {
        setError('复制失败，请手动选中文本复制。')
      }
      document.body.removeChild(area)
    }
  }

  const handleSave = () => {
    if (!generated && !editedText.trim()) {
      setError('请先生成方案后再保存。')
      return
    }
    const content = editedText.trim() || generated?.fullText || ''
    const result = saveMarketingPlan({
      planId: activePlanId ?? undefined,
      scene,
      sceneLabel: generated?.sceneLabel ?? MARKETING_SCENES.find((s) => s.id === scene)!.title,
      serviceId: generated?.serviceId ?? serviceId,
      serviceName:
        generated?.serviceName ??
        services.find((s) => s.id === serviceId)?.name,
      originalPrompt: prompt,
      generatedContent: generated?.fullText ?? content,
      editedContent: isDirty || activePlanId ? content : undefined,
      sections: generated?.sections ?? [],
      warnings: generated?.warnings ?? [],
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      goal,
      audience,
      activityDate: activityDate || undefined,
      promoRule: promoRule || undefined,
      tone,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setActivePlanId(result.plan.planId)
    setIsDirty(false)
    showToast('方案已保存到本地历史')
  }

  const openHistoryPlan = (plan: MarketingPlan) => {
    setScene(plan.scene)
    setPrompt(plan.originalPrompt)
    setGoal(plan.goal ?? '')
    setAudience(plan.audience ?? '')
    setServiceId(plan.serviceId ?? '')
    setActivityDate(plan.activityDate ?? '')
    setPromoRule(plan.promoRule ?? '')
    setTone(plan.tone ?? '专业可信')
    setCustomerId(plan.customerId ?? '')
    setGenerated({
      scene: plan.scene,
      sceneLabel: plan.sceneLabel,
      serviceId: plan.serviceId,
      serviceName: plan.serviceName,
      sections: plan.sections,
      fullText: plan.generatedContent,
      warnings: plan.warnings,
      generatedAt: plan.updatedAt,
    })
    setEditedText(displayContent(plan))
    setIsDirty(Boolean(plan.editedContent))
    setActivePlanId(plan.planId)
    setShowHistory(false)
    showToast('已打开历史方案')
  }

  const handleDeletePlan = (planId: string) => {
    if (!window.confirm('确认删除该历史方案吗？删除后不可恢复。')) return
    const result = deleteMarketingPlan(planId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (activePlanId === planId) setActivePlanId(null)
    showToast('历史方案已删除')
  }

  const saveEditedToHistory = () => {
    if (!activePlanId) {
      handleSave()
      return
    }
    const result = updateMarketingPlan(activePlanId, {
      editedContent: editedText,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setIsDirty(false)
    showToast('已更新历史方案中的编辑内容')
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 pb-4">
      {(toast || error) && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || toast}
          {error ? (
            <button
              type="button"
              className="ml-3 text-xs underline"
              onClick={() => setError('')}
            >
              关闭
            </button>
          ) : null}
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface-card px-5 py-4 shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text">AI 营销助手</h2>
              <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-text-muted">
                本地 Demo 模式
              </span>
            </div>
            <p className="mt-1.5 text-sm text-text-secondary">
              根据门店项目与经营需求，快速生成活动方案和客户沟通内容。
            </p>
            <p className="mt-1 text-xs text-text-muted">
              使用本地模板规则生成，未接入大模型；门店：{storeInfo.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface"
          >
            <History size={16} />
            历史方案（{marketingPlans.length}）
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Left input */}
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface-card p-4 shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
            <h3 className="text-sm font-semibold text-text">快捷场景</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MARKETING_SCENES.map((item) => {
                const active = scene === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyScene(item.id)}
                    className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                      active
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-border bg-white hover:border-brand-200 hover:bg-surface'
                    }`}
                  >
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {item.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-card p-4 shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
            <h3 className="text-sm font-semibold text-text">营销需求输入</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="例如：帮我策划一个周末基础清洁补水拓客活动，面向附近的新客户，并生成朋友圈文案。"
              className="mt-3 w-full resize-y rounded-lg border border-border bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand-300"
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs text-text-muted">营销目标</span>
                <input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs text-text-muted">目标客群</span>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-text-muted">
                  主推项目（统一价目表）
                </span>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2"
                >
                  <option value="">不指定项目</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatServicePrice(s)} / {s.durationMinutes} 分钟
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-text-muted">活动日期</span>
                <input
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  placeholder="例如：本周六"
                  className="w-full rounded-lg border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs text-text-muted">
                  优惠规则（已确认才填写，勿留空却要求折扣）
                </span>
                <input
                  value={promoRule}
                  onChange={(e) => setPromoRule(e.target.value)}
                  placeholder="例如：首次到店咨询赠基础皮肤咨询（免费）"
                  className="w-full rounded-lg border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-text-muted">文案风格</span>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as MarketingTone)}
                  className="w-full rounded-lg border border-border px-3 py-2"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              {needsCustomer ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">
                    关联模拟客户（可选）
                  </span>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2"
                  >
                    <option value="">不选择客户</option>
                    {selectableCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.focusProject || '无关注项目'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {selectedCustomer && needsCustomer ? (
              <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-text-secondary">
                <p className="font-medium text-text">已选客户档案</p>
                <p className="mt-1">姓名：{selectedCustomer.name}</p>
                <p>关注项目：{selectedCustomer.focusProject || '—'}</p>
                <p>
                  意向：{selectedCustomer.intentLevel} · 跟进：
                  {selectedCustomer.followUpStatus}
                </p>
                <p>
                  最近预约：
                  {customerLatestApt
                    ? `${customerLatestApt.appointmentDate} ${customerLatestApt.startTime} ${customerLatestApt.serviceName}`
                    : selectedCustomer.lastAppointmentAt ?? '暂无'}
                </p>
                <p className="mt-1 text-text-muted">
                  生成话术仅引用已有信息，不会写入客户档案或发送消息。
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                <Sparkles size={16} />
                {generating ? '本地生成中…' : '生成方案'}
              </button>
              <button
                type="button"
                disabled={generating || !generated}
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface disabled:opacity-50"
              >
                <RefreshCw size={16} />
                重新生成
              </button>
            </div>
          </section>
        </div>

        {/* Right result */}
        <section className="rounded-xl border border-border bg-surface-card p-4 shadow-[0_1px_2px_rgba(44,41,38,0.04)] xl:min-h-[640px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-text">生成结果</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                {generated
                  ? `${generated.sceneLabel}${isDirty ? ' · 已编辑' : ' · 原始生成'}${activePlanId ? ' · 已关联历史' : ''}`
                  : '选择场景并填写需求后生成'}
              </p>
            </div>
            {generated ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(editedText, '完整方案')}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface"
                >
                  <Copy size={14} />
                  复制全文
                </button>
                <button
                  type="button"
                  onClick={activePlanId && isDirty ? saveEditedToHistory : handleSave}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs text-white hover:bg-brand-600"
                >
                  <Save size={14} />
                  {activePlanId ? '保存修改' : '保存方案'}
                </button>
              </div>
            ) : null}
          </div>

          {!generated && !generating ? (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-surface px-4 py-16 text-center text-sm text-text-muted">
              <p>还没有生成内容</p>
              <p className="mt-2 text-xs">
                可点击左侧「新客拓客活动」等场景，确认主推项目后点击「生成方案」
              </p>
            </div>
          ) : null}

          {generating ? (
            <div className="mt-6 rounded-lg border border-border bg-surface px-4 py-16 text-center text-sm text-text-secondary">
              正在按本地模板组合文案…
              <p className="mt-2 text-xs text-text-muted">
                非真实模型调用，仅 Demo 处理状态
              </p>
            </div>
          ) : null}

          {generated && !generating ? (
            <div className="mt-4 space-y-4">
              {generated.warnings.length > 0 ? (
                <div className="space-y-2">
                  {generated.warnings.map((w) => (
                    <div
                      key={w}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
                    >
                      {w}
                    </div>
                  ))}
                </div>
              ) : null}

              {generated.serviceName ? (
                <p className="text-xs text-text-muted">
                  引用项目：{generated.serviceName}
                  {(() => {
                    const svc = services.find((s) => s.id === generated.serviceId)
                    return svc ? `（${formatServicePrice(svc)}）` : ''
                  })()}
                </p>
              ) : null}

              <div className="space-y-3">
                {generated.sections.map((section) => (
                  <div
                    key={section.key}
                    className="rounded-lg border border-border bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-text">
                        {section.title}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(section.content, `「${section.title}」`)
                        }
                        className="text-[11px] text-brand-600 hover:text-brand-700"
                      >
                        复制本段
                      </button>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-secondary">
                      {section.content}
                    </pre>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-text">
                    可编辑全文（修改后不会被重新生成覆盖，除非再次点击生成）
                  </p>
                  {isDirty ? (
                    <StatusBadge type="tag" status="已修改未覆盖原文" />
                  ) : null}
                </div>
                <textarea
                  value={editedText}
                  onChange={(e) => handleEdit(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand-300"
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {showHistory ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl border border-border bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-text">历史方案</h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                关闭
              </button>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              保存在本地（botb-demo-data-v4），刷新后仍可访问
            </p>
            <ul className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
              {marketingPlans.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-text-muted">
                  暂无历史方案，生成后点击「保存方案」即可归档
                </li>
              ) : (
                marketingPlans.map((plan) => (
                  <li
                    key={plan.planId}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-text">
                          {plan.sceneLabel}
                          {plan.serviceName ? ` · ${plan.serviceName}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          创建 {new Date(plan.createdAt).toLocaleString('zh-CN')}
                          {plan.editedContent ? ' · 含编辑稿' : ''}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                          {plan.originalPrompt}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openHistoryPlan(plan)}
                          className="text-xs text-brand-600"
                        >
                          打开编辑
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(displayContent(plan), '历史方案')
                          }
                          className="text-xs text-text-secondary"
                        >
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan.planId)}
                          className="text-xs text-rose-600"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
