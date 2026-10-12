import { test, assert } from 'vitest'
import { changes, integrityVerdict, judge } from './lockfile-check.mjs'

const REG = 'https://registry.npmjs.org/'
const lock = (integrity, version = '1.2.3') => ({
  packages: {
    '': { name: 'root' },
    'node_modules/left-pad': {
      version,
      resolved: `${REG}left-pad/-/left-pad-${version}.tgz`,
      ...(integrity === undefined ? {} : { integrity }),
    },
  },
})
const SHA512_A = 'sha512-' + 'A'.repeat(86) + '=='
const SHA512_B = 'sha512-' + 'B'.repeat(86) + '=='
const SHASUM_HEX = '0123456789abcdef0123456789abcdef01234567'
const SHA1_OF_SHASUM =
  'sha1-' + Buffer.from(SHASUM_HEX, 'hex').toString('base64')
const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
const meta = (dist, version = '1.2.3') => ({
  time: { [version]: thirtyDaysAgo },
  versions: { [version]: { dist } },
})
const only = (list, prefix) => list.filter((r) => r.startsWith(prefix))

test('an entry whose version, URL and integrity are unchanged is not a change', () => {
  assert.deepEqual(changes(lock(SHA512_A), lock(SHA512_A)), [])
})

test('the integrity changing under the same version and URL is a change and a refusal, whatever the registry says', () => {
  const list = changes(lock(SHA512_A), lock(SHA512_B))
  assert.equal(list.length, 1)
  assert.equal(list[0].integrityChanged, true)
  const { refusals } = judge(list[0], meta({ integrity: SHA512_B }))
  assert.deepEqual(only(refusals, 'integrity changed'), [
    `integrity changed under the same version and URL: ${SHA512_A} → ${SHA512_B}`,
  ])
})

test("a new version whose lockfile integrity is not the registry's is refused", () => {
  const list = changes(lock(SHA512_A, '1.2.2'), lock(SHA512_A))
  assert.equal(list[0].integrityChanged, false)
  const { refusals } = judge(list[0], meta({ integrity: SHA512_B }))
  assert.equal(only(refusals, 'integrity is not').length, 1)
  assert.deepEqual(only(refusals, 'integrity changed'), [])
})

test("a new version whose lockfile integrity is the registry's carries no integrity refusal", () => {
  const list = changes(lock(SHA512_A, '1.2.2'), lock(SHA512_B))
  const { refusals, warnings } = judge(
    list[0],
    meta({ integrity: SHA512_B, shasum: SHASUM_HEX }),
  )
  assert.deepEqual(only(refusals, 'integrity'), [])
  assert.deepEqual(only(warnings, 'the registry publishes no integrity'), [])
})

test('an entry with no integrity is refused', () => {
  const list = changes(lock(SHA512_A, '1.2.2'), lock(undefined))
  const { refusals } = judge(list[0], meta({ integrity: SHA512_B }))
  assert.deepEqual(only(refusals, 'no integrity'), [
    'no integrity in the lockfile entry',
  ])
})

test("a sha1 lockfile integrity is compared with the registry's shasum when that is all it publishes", () => {
  assert.deepEqual(integrityVerdict(SHA1_OF_SHASUM, { shasum: SHASUM_HEX }), {})
  assert.equal(
    integrityVerdict('sha1-' + 'x'.repeat(27) + '=', {
      shasum: SHASUM_HEX,
    }).refusal.startsWith('integrity is not'),
    true,
  )
  assert.equal(
    integrityVerdict(SHA512_A, { shasum: SHASUM_HEX }).refusal.startsWith(
      'integrity cannot be compared',
    ),
    true,
  )
  assert.deepEqual(integrityVerdict(SHA512_A, {}), {
    warning: 'the registry publishes no integrity for this version',
  })
})
