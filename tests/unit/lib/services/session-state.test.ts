import { describe, it, expect, beforeEach } from 'vitest'
import { SessionStateManager } from '@/lib/services/session-state'
import type { PendingCallAction, BargeInConfig, ScenarioSessionState } from '@/lib/services/session-state'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBargeInConfig(strategy: BargeInConfig['strategy'] = 'manual'): BargeInConfig {
  return { strategy, minimum_characters: 10, allow_after_ms: 500 }
}

function makeScenarioState(): ScenarioSessionState {
  return {
    scenarioId: 'scenario-1',
    activeNodeId: 'node-1',
    entryNodeId: 'node-1',
    entryVoiceConfig: { voice_provider: 'azure', voice_id: 'de-DE-KatjaNeural', voice_language: 'de-DE' },
    nodes: [],
    edges: [],
    dtmfVariables: {},
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SessionStateManager', () => {
  let mgr: SessionStateManager

  beforeEach(() => {
    mgr = new SessionStateManager()
  })

  // ── Locks ─────────────────────────────────────────────────────────────────

  describe('locks', () => {
    it('returns undefined for unknown session', () => {
      expect(mgr.getLock('unknown')).toBeUndefined()
    })

    it('stores and retrieves a lock', () => {
      const lock = Promise.resolve({} as never)
      mgr.setLock('s1', lock)
      expect(mgr.getLock('s1')).toBe(lock)
    })

    it('deletes a lock', () => {
      const lock = Promise.resolve({} as never)
      mgr.setLock('s1', lock)
      mgr.deleteLock('s1')
      expect(mgr.getLock('s1')).toBeUndefined()
    })

    it('lock is NOT removed by cleanup()', () => {
      const lock = Promise.resolve({} as never)
      mgr.setLock('s1', lock)
      mgr.cleanup('s1')
      // Locks self-manage — cleanup intentionally leaves them
      expect(mgr.getLock('s1')).toBe(lock)
    })
  })

  // ── Pending call actions ──────────────────────────────────────────────────

  describe('pendingActions', () => {
    it('returns undefined for unknown session', () => {
      expect(mgr.getPendingAction('unknown')).toBeUndefined()
    })

    it('stores a hangup action', () => {
      const action: PendingCallAction = { type: 'hangup' }
      mgr.setPendingAction('s1', action)
      expect(mgr.getPendingAction('s1')).toEqual(action)
    })

    it('stores a transfer action with metadata', () => {
      const action: PendingCallAction = {
        type: 'transfer',
        targetPhoneNumber: '+491234567890',
        callerIdName: 'Support',
        callerIdNumber: '+490000000',
        clickPlayed: false,
      }
      mgr.setPendingAction('s1', action)
      expect(mgr.getPendingAction('s1')).toEqual(action)
    })

    it('overwrites an existing action', () => {
      mgr.setPendingAction('s1', { type: 'hangup' })
      mgr.setPendingAction('s1', { type: 'transfer', targetPhoneNumber: '+49123' })
      expect(mgr.getPendingAction('s1')?.type).toBe('transfer')
    })

    it('deletes a pending action', () => {
      mgr.setPendingAction('s1', { type: 'hangup' })
      mgr.deletePendingAction('s1')
      expect(mgr.getPendingAction('s1')).toBeUndefined()
    })

    it('is removed by cleanup()', () => {
      mgr.setPendingAction('s1', { type: 'hangup' })
      mgr.cleanup('s1')
      expect(mgr.getPendingAction('s1')).toBeUndefined()
    })
  })

  // ── Barge-in config ────────────────────────────────────────────────────────

  describe('bargeInConfig', () => {
    it('returns undefined for unknown session', () => {
      expect(mgr.getBargeInConfig('unknown')).toBeUndefined()
    })

    it('stores and retrieves config', () => {
      const config = makeBargeInConfig('minimum_characters')
      mgr.setBargeInConfig('s1', config)
      expect(mgr.getBargeInConfig('s1')).toEqual(config)
    })

    it('is removed by cleanup()', () => {
      mgr.setBargeInConfig('s1', makeBargeInConfig())
      mgr.cleanup('s1')
      expect(mgr.getBargeInConfig('s1')).toBeUndefined()
    })
  })

  // ── Scenario state ──────────────────────────────────────────────────────────

  describe('scenarioState', () => {
    it('returns undefined for unknown session', () => {
      expect(mgr.getScenarioState('unknown')).toBeUndefined()
    })

    it('stores and retrieves state', () => {
      const state = makeScenarioState()
      mgr.setScenarioState('s1', state)
      expect(mgr.getScenarioState('s1')).toEqual(state)
    })

    it('deletes scenario state', () => {
      mgr.setScenarioState('s1', makeScenarioState())
      mgr.deleteScenarioState('s1')
      expect(mgr.getScenarioState('s1')).toBeUndefined()
    })

    it('is removed by cleanup()', () => {
      mgr.setScenarioState('s1', makeScenarioState())
      mgr.cleanup('s1')
      expect(mgr.getScenarioState('s1')).toBeUndefined()
    })
  })

  // ── Phoneme replacements ─────────────────────────────────────────────────

  describe('phonemeReplacements', () => {
    it('returns empty array for unknown session', () => {
      expect(mgr.getPhonemeReplacements('unknown')).toEqual([])
    })

    it('stores and retrieves replacements', () => {
      const replacements = [{ word: 'GmbH', phoneme: 'G-m-b-H', boost_recognition: true, replace_pronunciation: true }]
      mgr.setPhonemeReplacements('s1', replacements)
      expect(mgr.getPhonemeReplacements('s1')).toEqual(replacements)
    })

    it('is removed by cleanup()', () => {
      mgr.setPhonemeReplacements('s1', [{ word: 'test', phoneme: 't-e-s-t', boost_recognition: true, replace_pronunciation: true }])
      mgr.cleanup('s1')
      expect(mgr.getPhonemeReplacements('s1')).toEqual([])
    })
  })

  // ── Barge-in occurred flag ────────────────────────────────────────────────

  describe('bargeInOccurred', () => {
    it('returns false initially', () => {
      expect(mgr.wasBargeInOccurred('s1')).toBe(false)
    })

    it('returns true after setBargeInOccurred', () => {
      mgr.setBargeInOccurred('s1')
      expect(mgr.wasBargeInOccurred('s1')).toBe(true)
    })

    it('returns false after clearBargeInOccurred', () => {
      mgr.setBargeInOccurred('s1')
      mgr.clearBargeInOccurred('s1')
      expect(mgr.wasBargeInOccurred('s1')).toBe(false)
    })

    it('is cleared by cleanup()', () => {
      mgr.setBargeInOccurred('s1')
      mgr.cleanup('s1')
      expect(mgr.wasBargeInOccurred('s1')).toBe(false)
    })
  })

  // ── Lifecycle: cleanup() ──────────────────────────────────────────────────

  describe('cleanup()', () => {
    it('clears all state for the session but not other sessions', () => {
      // Session s1 — will be cleaned up
      mgr.setPendingAction('s1', { type: 'hangup' })
      mgr.setBargeInConfig('s1', makeBargeInConfig())
      mgr.setScenarioState('s1', makeScenarioState())
      mgr.setPhonemeReplacements('s1', [{ word: 'x', phoneme: 'y', boost_recognition: true, replace_pronunciation: true }])
      mgr.setBargeInOccurred('s1')

      // Session s2 — should be unaffected
      mgr.setPendingAction('s2', { type: 'hangup' })
      mgr.setBargeInConfig('s2', makeBargeInConfig())

      mgr.cleanup('s1')

      expect(mgr.getPendingAction('s1')).toBeUndefined()
      expect(mgr.getBargeInConfig('s1')).toBeUndefined()
      expect(mgr.getScenarioState('s1')).toBeUndefined()
      expect(mgr.getPhonemeReplacements('s1')).toEqual([])
      expect(mgr.wasBargeInOccurred('s1')).toBe(false)

      // s2 should still be intact
      expect(mgr.getPendingAction('s2')).toBeDefined()
      expect(mgr.getBargeInConfig('s2')).toBeDefined()
    })

    it('is safe to call for a session with no state', () => {
      expect(() => mgr.cleanup('never-existed')).not.toThrow()
    })

    it('is idempotent — calling twice does not throw', () => {
      mgr.setPendingAction('s1', { type: 'hangup' })
      mgr.cleanup('s1')
      expect(() => mgr.cleanup('s1')).not.toThrow()
    })
  })

  // ── Isolation between sessions ────────────────────────────────────────────

  describe('session isolation', () => {
    it('state for one session does not bleed into another', () => {
      mgr.setPendingAction('s1', { type: 'hangup' })
      mgr.setBargeInOccurred('s1')

      expect(mgr.getPendingAction('s2')).toBeUndefined()
      expect(mgr.wasBargeInOccurred('s2')).toBe(false)
    })
  })
})
