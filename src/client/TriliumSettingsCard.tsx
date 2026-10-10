/**
 * The dsh-trilium settings section: Settings sidebar page
 * (`settings.section`). Desktop 0.2 removed `settings.plugin.item`; this
 * surface matches dsh-search-mcp / netxops.
 *
 * Data path: reads/writes the host JSON store directly through the
 * /api/dsh-trilium/config routes — deliberately NOT the settings-namespace
 * document, which is allowlist-gated for third-party namespaces. The JSON
 * store (~/.dsh/dsh-trilium.json, 0600) is the single runtime source.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TriliumApi } from './api.ts'
import type { TriliumConfigView } from '../protocol.ts'

/** The registration-side face the slot entry injects. */
export interface TriliumSettingsFace {
  api: TriliumApi
}

/** Props the section renderer binds for the card. */
export type TriliumSettingsCardProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'dsh-trilium'>
  & InjectFace<TriliumSettingsFace>

interface Form {
  baseUrl: string
  token: string
  memoryNoteId: string
  timeoutMs: string
  autoInject: boolean
  deleteConfirm: boolean
  tokenSet: boolean
}

const EMPTY: Form = {
  baseUrl: '',
  token: '',
  memoryNoteId: '',
  timeoutMs: '15000',
  autoInject: true,
  deleteConfirm: true,
  tokenSet: false,
}

const sectionStyle: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minHeight: 0,
  padding: '4px 4px 24px',
  color: 'var(--dsw-alias-label-primary, #1f2329)',
}
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 600, lineHeight: '28px' }
const introStyle: CSSProperties = { margin: '4px 0 12px', fontSize: 13, color: 'var(--dsw-alias-label-secondary, #646a73)' }
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderTop: '1px solid var(--dsw-alias-border-l2)' }
const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' }
const inputStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  height: 34,
  borderRadius: 8,
  padding: '0 12px',
  fontSize: 13,
  color: 'var(--dsw-alias-label-primary)',
}
const hintStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary)', margin: 0, fontSize: 12, lineHeight: 1.5 }
const buttonStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 8,
  padding: '6px 16px',
  fontSize: 13,
  cursor: 'pointer',
}

function TextField(props: { id: string; label: string; hint: string; value: string; disabled: boolean; password?: boolean; placeholder?: string; onEdit: (v: string) => void }) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle} htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        style={inputStyle}
        type={props.password === true ? 'password' : 'text'}
        autoComplete="off"
        placeholder={props.placeholder}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p style={hintStyle}>{props.hint}</p>
    </div>
  )
}

function Toggle(props: { id: string; label: string; hint: string; checked: boolean; disabled: boolean; onEdit: (v: boolean) => void }) {
  return (
    <div style={fieldStyle}>
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} htmlFor={props.id}>
        <input
          id={props.id}
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={(event) => { props.onEdit(event.target.checked) }}
        />
        <span>{props.label}</span>
      </label>
      <p style={hintStyle}>{props.hint}</p>
    </div>
  )
}

/**
 * Render the Settings sidebar section for Trilium.
 * @param props - locale copy and the API client.
 * @returns the section.
 */
export function TriliumSettingsCard(props: TriliumSettingsCardProps) {
  const { t, api } = props
  const [form, setForm] = useState<Form>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState<string | undefined>()

  useEffect(() => {
    if (loaded) return
    setLoading(true)
    api.getConfig().then(config => {
      setForm({
        baseUrl: config.baseUrl,
        token: '',
        memoryNoteId: config.memoryNoteId,
        timeoutMs: String(config.timeoutMs),
        autoInject: config.autoInject,
        deleteConfirm: config.deleteConfirm,
        tokenSet: config.tokenSet,
      })
      setLoaded(true)
      setLoading(false)
    }).catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : String(error))
      setLoading(false)
    })
  }, [loaded, api])

  const save = async (): Promise<void> => {
    setSaving(true)
    setSaved(false)
    setSaveError(undefined)
    try {
      const config: TriliumConfigView = await api.putConfig({
        baseUrl: form.baseUrl,
        token: form.token,
        memoryNoteId: form.memoryNoteId,
        timeoutMs: Number.parseInt(form.timeoutMs, 10),
        autoInject: form.autoInject,
        deleteConfirm: form.deleteConfirm,
      })
      setForm(prev => ({ ...prev, token: '', tokenSet: config.tokenSet }))
      setSaved(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const runTest = async (): Promise<void> => {
    setBusy(true)
    setTestResult('idle')
    setTestMessage(undefined)
    try {
      const outcome = await api.test(form.baseUrl, form.token)
      if (outcome.ok) {
        setTestResult('ok')
        setTestMessage((outcome.appInfo?.appVersion ?? '') + ' · ' + (outcome.latencyMs ?? 0) + 'ms')
      } else {
        setTestResult('fail')
        setTestMessage(outcome.error ?? 'unknown')
      }
    } catch (error) {
      setTestResult('fail')
      setTestMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={sectionStyle} aria-label={t('settings.title')}>
      <header>
        <h2 style={titleStyle}>{t('settings.title')}</h2>
        <p style={introStyle}>{t('settings.description')}</p>
      </header>

      {loading ? <p style={hintStyle}>{t('panel.loading')}</p> : null}
      {loadError !== undefined ? <p style={{ color: 'var(--dsw-alias-label-error)', fontSize: 12 }}>{t('panel.error')}{loadError}</p> : null}

      {!loading && loadError === undefined
        ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <TextField id="tri-base-url" label={t('settings.baseUrl')} hint={t('settings.baseUrlHint')} value={form.baseUrl} disabled={saving} onEdit={(v) => { setForm(p => ({ ...p, baseUrl: v })); setSaved(false) }} />
            <TextField id="tri-token" label={t('settings.token')} hint={t('settings.tokenHint')} value={form.token} disabled={saving} password placeholder={form.tokenSet ? '已配置（留空保持不变）' : '粘贴 ETAPI token'} onEdit={(v) => { setForm(p => ({ ...p, token: v })); setSaved(false) }} />
            <TextField id="tri-memory" label={t('settings.memoryNoteId')} hint={t('settings.memoryNoteIdHint')} value={form.memoryNoteId} disabled={saving} onEdit={(v) => { setForm(p => ({ ...p, memoryNoteId: v })); setSaved(false) }} />
            <TextField id="tri-timeout" label={t('settings.timeoutMs')} hint={t('settings.timeoutMsHint')} value={form.timeoutMs} disabled={saving} onEdit={(v) => { setForm(p => ({ ...p, timeoutMs: v })); setSaved(false) }} />
            <Toggle id="tri-auto-inject" label={t('settings.autoInject')} hint={t('settings.autoInjectHint')} checked={form.autoInject} disabled={saving} onEdit={(v) => { setForm(p => ({ ...p, autoInject: v })); setSaved(false) }} />
            <Toggle id="tri-delete-confirm" label={t('settings.deleteConfirm')} hint={t('settings.deleteConfirmHint')} checked={form.deleteConfirm} disabled={saving} onEdit={(v) => { setForm(p => ({ ...p, deleteConfirm: v })); setSaved(false) }} />

            {saved ? <p style={{ color: 'var(--dsw-alias-state-success-primary, #3cb371)', fontSize: 12, margin: '8px 0 0' }}>{t('settings.saved')}</p> : null}
            {saveError !== undefined ? <p style={{ color: 'var(--dsw-alias-label-error)', fontSize: 12, margin: '8px 0 0' }}>{t('settings.saveFailed')}{saveError}</p> : null}
            {testResult === 'ok' ? <p style={{ color: 'var(--dsw-alias-state-success-primary, #3cb371)', fontSize: 12, margin: '8px 0 0' }}>{t('settings.testOk')} {testMessage}</p> : null}
            {testResult === 'fail' ? <p style={{ color: 'var(--dsw-alias-label-error)', fontSize: 12, margin: '8px 0 0' }}>{t('settings.testFail')}{testMessage}</p> : null}

            <div style={{ display: 'flex', gap: 10, padding: '14px 0 4px' }}>
              <button type="button" style={buttonStyle} disabled={busy || saving || form.baseUrl.trim() === ''} onClick={() => { void runTest() }}>
                {busy ? t('settings.testing') : t('settings.test')}
              </button>
              <button type="button" style={{ ...buttonStyle, borderColor: 'transparent' }} disabled={saving} onClick={() => { void save() }}>
                {saving ? t('settings.saving') : t('settings.save')}
              </button>
            </div>
          </div>
        )
        : null}
    </section>
  )
}
