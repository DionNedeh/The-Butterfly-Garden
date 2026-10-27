import { describe, expect, it } from 'vitest'
import {
  createLock,
  isAutoLockMinutes,
  LOCK_FORMAT,
  openLock,
  openLockWithPasskey,
  passcodeProblem,
  withAutoLock,
  withNewPasscode,
  withNewRecoveryCode,
  withoutPasskey,
  withPasskey,
  WrongSecretError,
  type LockRecord,
} from './gardenLock'
import { newRecoveryCode } from './recoveryCode'
import { open, PASSPHRASE_KDF, randomBytes, seal, toBase64 } from './sealing'

/** Quick derivations for tests; the app always uses PASSPHRASE_KDF's count. */
const FAST = 1_000
const PASSCODE = 'moss on the north wall'
const text = (value: string) => new TextEncoder().encode(value)
const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

async function newLock() {
  const words = newRecoveryCode()
  const { record, key } = await createLock(PASSCODE, words, FAST)
  // Something sealed under the garden's data key, to prove later keys are the same one.
  const sealed = await seal(key, text('a reflection'), text('reflections'))
  return { words, record, key, sealed }
}

async function opens(key: CryptoKey, sealed: { iv: Uint8Array; ciphertext: Uint8Array }) {
  return read(await open(key, sealed, text('reflections')))
}

describe('a new lock', () => {
  it('wraps one fresh data key by the passcode and by the recovery code, each with its own salt', async () => {
    const { record, key } = await newLock()
    expect(record).toMatchObject({ format: LOCK_FORMAT, version: 1 })
    expect(record.passcode).toMatchObject({ kdf: 'PBKDF2-SHA-256', iterations: FAST })
    expect(record.recovery).toMatchObject({ kdf: 'PBKDF2-SHA-256', iterations: FAST })
    expect(toBase64(record.passcode.salt)).not.toBe(toBase64(record.recovery.salt))
    expect(record.passcode.salt).toHaveLength(16)
    expect(record.passcode.iv).toHaveLength(12)
    // 32 bytes of key and AES-GCM's 16-byte tag.
    expect(record.passcode.wrapped).toHaveLength(48)
    expect(key.extractable).toBe(false)
    expect(key.usages.sort()).toEqual(['decrypt', 'encrypt'])
    expect(record.passkey).toBeUndefined()
    expect(record.autoLockMinutes).toBeUndefined()
  })

  it('records the app’s own iteration count when none is given', async () => {
    const { record } = await createLock(PASSCODE, newRecoveryCode())
    expect(record.passcode.iterations).toBe(PASSPHRASE_KDF.iterations)
    expect(record.recovery.iterations).toBe(PASSPHRASE_KDF.iterations)
  })

  it('names each lock differently, and makes a different data key each time', async () => {
    const a = await newLock()
    const b = await newLock()
    expect(a.record.id).not.toBe(b.record.id)
    await expect(open(b.key, a.sealed, text('reflections'))).rejects.toThrow()
  })
})

describe('opening the lock', () => {
  it('gives back the same data key with the passcode or with the recovery code', async () => {
    const { record, words, sealed } = await newLock()
    expect(await opens(await openLock(record, { slot: 'passcode', passcode: PASSCODE }), sealed)).toBe(
      'a reflection',
    )
    expect(await opens(await openLock(record, { slot: 'recovery', words }), sealed)).toBe(
      'a reflection',
    )
  })

  it('says only that a wrong passcode or code did not open it', async () => {
    const { record, words } = await newLock()
    const wrong = openLock(record, { slot: 'passcode', passcode: 'moss on the north wal' })
    await expect(wrong).rejects.toBeInstanceOf(WrongSecretError)
    await expect(wrong).rejects.toThrow('That did not open the garden.')
    const swapped = [words[1], words[0], ...words.slice(2)]
    await expect(openLock(record, { slot: 'recovery', words: swapped })).rejects.toBeInstanceOf(
      WrongSecretError,
    )
    // The passcode does not open the recovery code's wrap, nor the other way round.
    await expect(openLock(record, { slot: 'recovery', words: [PASSCODE] })).rejects.toBeInstanceOf(
      WrongSecretError,
    )
  })

  it('binds each wrapped key to its lock and its place in it', async () => {
    const { record, words } = await newLock()
    // The recovery code's wrap moved into the passcode's place does not open.
    const moved: LockRecord = { ...record, passcode: record.recovery }
    await expect(
      openLock(moved, { slot: 'passcode', passcode: words.join(' ') }),
    ).rejects.toBeInstanceOf(WrongSecretError)
    // Nor does a wrap under another lock's name.
    const renamed: LockRecord = { ...record, id: 'another-lock' }
    await expect(openLock(renamed, { slot: 'passcode', passcode: PASSCODE })).rejects.toBeInstanceOf(
      WrongSecretError,
    )
  })
})

describe('changing the passcode', () => {
  it('wraps the same data key again, so nothing stored is sealed again', async () => {
    const { record, words, sealed } = await newLock()
    const changed = await withNewPasscode(
      record,
      { slot: 'passcode', passcode: PASSCODE },
      'a new and longer passphrase',
      FAST,
    )
    expect(changed.id).toBe(record.id)
    expect(changed.stamp).not.toBe(record.stamp)
    expect(changed.recovery).toBe(record.recovery)
    await expect(openLock(changed, { slot: 'passcode', passcode: PASSCODE })).rejects.toBeInstanceOf(
      WrongSecretError,
    )
    const key = await openLock(changed, { slot: 'passcode', passcode: 'a new and longer passphrase' })
    expect(await opens(key, sealed)).toBe('a reflection')
    // The recovery code still opens it.
    expect(await opens(await openLock(changed, { slot: 'recovery', words }), sealed)).toBe(
      'a reflection',
    )
  })

  it('asks for the current passcode, or the recovery code when it is forgotten', async () => {
    const { record, words, sealed } = await newLock()
    await expect(
      withNewPasscode(record, { slot: 'passcode', passcode: 'not it' }, 'another one', FAST),
    ).rejects.toBeInstanceOf(WrongSecretError)
    const reset = await withNewPasscode(record, { slot: 'recovery', words }, 'remembered now', FAST)
    const key = await openLock(reset, { slot: 'passcode', passcode: 'remembered now' })
    expect(await opens(key, sealed)).toBe('a reflection')
  })
})

describe('a new recovery code', () => {
  it('stops the old code working and opens with the new one', async () => {
    const { record, words, sealed } = await newLock()
    const fresh = newRecoveryCode()
    const changed = await withNewRecoveryCode(record, PASSCODE, fresh, FAST)
    await expect(openLock(changed, { slot: 'recovery', words })).rejects.toBeInstanceOf(
      WrongSecretError,
    )
    expect(await opens(await openLock(changed, { slot: 'recovery', words: fresh }), sealed)).toBe(
      'a reflection',
    )
    expect(changed.passcode).toBe(record.passcode)
  })

  it('needs the passcode', async () => {
    const { record } = await newLock()
    await expect(
      withNewRecoveryCode(record, 'guess', newRecoveryCode(), FAST),
    ).rejects.toBeInstanceOf(WrongSecretError)
  })
})

describe('a passkey', () => {
  it('opens the lock with its PRF answer, and only that answer', async () => {
    const { record, sealed } = await newLock()
    const prfOutput = randomBytes(32)
    const passkey = { credentialId: randomBytes(16), prfSalt: randomBytes(32), prfOutput }
    const withKey = await withPasskey(record, PASSCODE, passkey)
    expect(withKey.passkey).toMatchObject({ credentialId: passkey.credentialId, prfSalt: passkey.prfSalt })
    // The answer itself is never stored.
    expect(JSON.stringify(Array.from(withKey.passkey!.wrapped))).not.toContain(
      JSON.stringify(Array.from(prfOutput)).slice(1, -1),
    )
    expect(await opens(await openLockWithPasskey(withKey, prfOutput), sealed)).toBe('a reflection')
    await expect(openLockWithPasskey(withKey, randomBytes(32))).rejects.toBeInstanceOf(
      WrongSecretError,
    )
    await expect(withPasskey(record, 'wrong', passkey)).rejects.toBeInstanceOf(WrongSecretError)
  })

  it('is removed, and then opens nothing', async () => {
    const { record } = await newLock()
    const prfOutput = randomBytes(32)
    const withKey = await withPasskey(record, PASSCODE, {
      credentialId: randomBytes(16),
      prfSalt: randomBytes(32),
      prfOutput,
    })
    const without = withoutPasskey(withKey)
    expect(without.passkey).toBeUndefined()
    await expect(openLockWithPasskey(without, prfOutput)).rejects.toBeInstanceOf(WrongSecretError)
  })
})

describe('the lock’s small settings', () => {
  it('keeps an auto-lock it offers, and none when it is off', async () => {
    const { record } = await newLock()
    const five = withAutoLock(record, 5)
    expect(five.autoLockMinutes).toBe(5)
    expect(five.stamp).not.toBe(record.stamp)
    expect(withAutoLock(five, undefined)).not.toHaveProperty('autoLockMinutes')
    expect([1, 5, 15, 60].every(isAutoLockMinutes)).toBe(true)
    expect([0, 2, 30, '5', undefined].some(isAutoLockMinutes)).toBe(false)
  })

  it('asks for six characters or more, typed the same twice', () => {
    expect(passcodeProblem('12345', '12345')).toBe('A passcode needs at least 6 characters.')
    expect(passcodeProblem('123456', '123457')).toBe('The two passcodes are not the same.')
    expect(passcodeProblem('123456', '123456')).toBeUndefined()
    // Counted as a person counts them: six letters, even where each takes two code units.
    expect(passcodeProblem('🦋🦋🦋🦋🦋', '🦋🦋🦋🦋🦋')).toBe('A passcode needs at least 6 characters.')
    expect(passcodeProblem('🦋🦋🦋🦋🦋🦋', '🦋🦋🦋🦋🦋🦋')).toBeUndefined()
  })
})
