import { test, assert } from 'vitest'
import {
  changes,
  integrityVerdict,
  judge,
  packumentProblem,
  verdictFor,
} from './lockfile-check.mjs'

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
const meta = (dist, version = '1.2.3', extra = {}) => ({
  name: 'left-pad',
  time: { [version]: thirtyDaysAgo },
  versions: { [version]: { dist, ...extra } },
})
const texts = (list, prefix) =>
  list.filter((r) => r.text.startsWith(prefix)).map((r) => r.text)
const rules = (list) => list.map((r) => r.rule)

test('an entry whose version, URL and integrity are unchanged is not a change', () => {
  assert.deepEqual(changes(lock(SHA512_A), lock(SHA512_A)), [])
})

test('the integrity changing under the same version and URL is a change and a refusal, whatever the registry says', () => {
  const list = changes(lock(SHA512_A), lock(SHA512_B))
  assert.equal(list.length, 1)
  assert.equal(list[0].integrityChanged, true)
  const { refusals } = judge(list[0], meta({ integrity: SHA512_B }))
  assert.deepEqual(texts(refusals, 'integrity changed'), [
    `integrity changed under the same version and URL: ${SHA512_A} → ${SHA512_B}`,
  ])
})

test("a new version whose lockfile integrity is not the registry's is refused", () => {
  const list = changes(lock(SHA512_A, '1.2.2'), lock(SHA512_A))
  assert.equal(list[0].integrityChanged, false)
  const { refusals } = judge(list[0], meta({ integrity: SHA512_B }))
  assert.equal(texts(refusals, 'integrity is not').length, 1)
  assert.deepEqual(texts(refusals, 'integrity changed'), [])
})

test("a new version whose lockfile integrity is the registry's carries no refusal", () => {
  const list = changes(lock(SHA512_A, '1.2.2'), lock(SHA512_B))
  const { refusals } = judge(
    list[0],
    meta({ integrity: SHA512_B, shasum: SHASUM_HEX }),
  )
  assert.deepEqual(refusals, [])
})

test('an entry with no integrity is refused', () => {
  const list = changes(lock(SHA512_A, '1.2.2'), lock(undefined))
  const { refusals } = judge(list[0], meta({ integrity: SHA512_B }))
  assert.deepEqual(texts(refusals, 'no integrity'), [
    'no integrity in the lockfile entry',
  ])
})

test("a sha1 lockfile integrity is compared with the registry's shasum; no hash on the registry refuses", () => {
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
    refusal: 'the registry publishes no hash for this version',
  })
  assert.deepEqual(integrityVerdict(SHA512_A, undefined), {
    refusal: 'the registry publishes no hash for this version',
  })
})

test('the registry answer is validated as the packument asked for before anything is judged', () => {
  assert.equal(
    packumentProblem({ name: 'left-pad', versions: {} }, 'left-pad'),
    null,
  )
  assert.equal(
    packumentProblem({}, 'left-pad'),
    'registry payload is for undefined, not left-pad',
  )
  assert.equal(
    packumentProblem({ name: 'right-pad', versions: {} }, 'left-pad'),
    'registry payload is for "right-pad", not left-pad',
  )
  assert.equal(
    packumentProblem({ name: 'left-pad' }, 'left-pad'),
    'registry payload has no versions object',
  )
  assert.equal(
    packumentProblem([], 'left-pad'),
    'registry payload is not an object',
  )
  assert.equal(
    packumentProblem('{}', 'left-pad'),
    'registry payload is not an object',
  )
  const change = changes(lock(SHA512_A, '1.2.2'), lock(SHA512_B))[0]
  assert.deepEqual(
    rules(judge(change, { name: 'right-pad', versions: {} }).refusals),
    ['registry'],
  )
  assert.deepEqual(
    rules(
      judge(change, meta({ integrity: SHA512_B }, '1.2.3', { scripts: 'oops' }))
        .refusals,
    ),
    ['registry'],
  )
  assert.deepEqual(
    rules(judge(change, { name: 'left-pad', versions: {} }).refusals),
    ['missing'],
  )
})

test('an exception excuses only the one rule it names; integrity never; the old bare form nothing', () => {
  const scripts = { rule: 'scripts', text: 'install scripts: postinstall' }
  const integrity = {
    rule: 'integrity',
    text: "integrity is not the registry's",
  }
  assert.deepEqual(verdictFor([scripts], { scripts: 'node-gyp, macOS only' }), {
    verdict: 'exception: scripts: node-gyp, macOS only',
    refused: false,
    notes: [],
  })
  assert.equal(
    verdictFor([scripts, integrity], { scripts: 'why' }).verdict,
    'REFUSED',
  )
  assert.equal(verdictFor([integrity], { integrity: 'why' }).verdict, 'REFUSED')
  assert.equal(verdictFor([scripts], { age: 'why' }).verdict, 'REFUSED')
  assert.deepEqual(verdictFor([scripts], 'why'), {
    verdict: 'REFUSED',
    refused: true,
    notes: ['exception ignored: it names no rule'],
  })
  assert.deepEqual(verdictFor([], undefined), {
    verdict: 'ok',
    refused: false,
    notes: [],
  })
})

test('an aliased entry (npm:name@version) is read by the package name the lockfile records, not the alias path', () => {
  const head = {
    packages: {
      '': {},
      'node_modules/pad-alias': {
        name: 'left-pad',
        version: '1.2.3',
        resolved: `${REG}left-pad/-/left-pad-1.2.3.tgz`,
        integrity: SHA512_A,
      },
    },
  }
  const [change] = changes({ packages: {} }, head)
  assert.equal(change.name, 'left-pad')
  assert.equal(change.path, 'node_modules/pad-alias')
  assert.equal(changes({ packages: {} }, lock(SHA512_A))[0].name, 'left-pad')
})
