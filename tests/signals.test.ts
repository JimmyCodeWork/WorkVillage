import { describe, expect, test } from 'claude-code/testing'

import { isCommitCommand, isTestCommand, signalsFor } from '../src/signals'

describe('signals', () => {
  test('edits, new files and reads', () => {
    expect(signalsFor('Edit', {}, {})).toEqual(['edit'])
    expect(signalsFor('Write', {}, { type: 'create' })).toEqual(['create'])
    expect(signalsFor('Write', {}, { type: 'update' })).toEqual(['edit'])
    expect(signalsFor('Grep', {}, {})).toEqual(['read'])
    expect(signalsFor('mcp__x__y', {}, {})).toEqual([])
  })

  test('test commands across ecosystems', () => {
    for (const command of [
      'npm test',
      'pnpm run test -- --watch=false',
      'bun test',
      'pytest -q tests/',
      'python3 -m pytest',
      'go test ./...',
      'cargo test',
      'dotnet test MySolution.sln',
      'cd api && ./gradlew clean test',
      'make check',
    ]) {
      expect(isTestCommand(command)).toBe(true)
    }
    for (const command of ['npm install', 'cat test.txt', 'ls tests', 'echo latest']) {
      expect(isTestCommand(command)).toBe(false)
    }
  })

  test('commits', () => {
    expect(isCommitCommand('git commit -m "Add parser"')).toBe(true)
    expect(isCommitCommand('git add . && git commit -am wip')).toBe(true)
    expect(isCommitCommand('git -C repo commit -m x')).toBe(true)
    expect(isCommitCommand('git commit --dry-run')).toBe(false)
    expect(isCommitCommand('git log --oneline')).toBe(false)
  })

  test('bash signals', () => {
    expect(signalsFor('Bash', { command: 'npm test && git commit -m x' }, { interrupted: false })).toEqual(['test', 'commit'])
    expect(signalsFor('Bash', { command: 'npm test' }, { interrupted: true })).toEqual([])
  })

  test('completed todos and tasks', () => {
    const oldTodos = [{ status: 'completed' }, { status: 'pending' }, { status: 'pending' }]
    const newTodos = [{ status: 'completed' }, { status: 'completed' }, { status: 'completed' }]
    expect(signalsFor('TodoWrite', { todos: newTodos }, { oldTodos, newTodos })).toEqual(['task', 'task'])
    expect(signalsFor('TaskUpdate', { status: 'completed' }, { success: true, statusChange: { from: 'in_progress', to: 'completed' } })).toEqual(['task'])
    expect(signalsFor('TaskUpdate', { status: 'pending' }, { success: true })).toEqual([])
  })
})
