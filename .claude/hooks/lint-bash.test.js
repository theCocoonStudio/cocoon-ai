// The Bash lint hook, driven as Claude Code drives it: the hook's JSON on stdin, the verdict in
// its exit code (2 blocks, with the findings on stderr for the agent), 0 allows.
import { describe, expect, test } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const hook = fileURLToPath(new URL('./lint-bash.sh', import.meta.url))
const has = spawnSync('shellcheck', ['--version']).status === 0
const run = (command) =>
  spawnSync('bash', [hook], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  })

describe('lint-bash hook', () => {
  test.skipIf(!has)('a recursive delete on a variable path is refused with its code', () => {
    const r = run('T=$(mktemp -d)\nrm -rf "$T/bin"')
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('SC2115')
  })
  test.skipIf(!has)('a guarded one passes', () => {
    expect(run('T=$(mktemp -d)\nrm -rf "${T:?}/bin"').status).toBe(0)
  })
  test.skipIf(!has)('info-level findings do not block', () => {
    expect(run('echo $HOME').status).toBe(0)
  })
  test('an empty command passes', () => {
    expect(run('').status).toBe(0)
  })
})
