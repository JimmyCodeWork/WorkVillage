// Turns a finished tool call into progress signals for the village. Only
// the kind of work counts: no file names, commands or contents are kept.

import type { Signal } from './core/world'

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'NotebookEdit'])
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'LSP'])

const TEST_COMMAND =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|bun\s+test\b|npx\s+(jest|vitest|mocha|playwright\s+test)\b|(jest|vitest|mocha|pytest|tox|nox|rspec|phpunit|ctest)\b|python[0-9.]*\s+-m\s+(pytest|unittest)\b|go\s+test\b|cargo\s+(test|nextest)\b|dotnet\s+test\b|mvn\s+(\S+\s+)*test\b|(\.\/)?gradlew?\s+(\S+\s+)*test\b|make\s+(test|check)\b|deno\s+test\b|swift\s+test\b|mix\s+test\b|claude\s+plugin\s+test\b)/
const COMMIT_COMMAND = /(^|[\s;&|(])git\s+(-\S+\s+(\S+\s+)?)*commit\b/

export function isTestCommand(command: string): boolean {
  return TEST_COMMAND.test(command)
}

export function isCommitCommand(command: string): boolean {
  return COMMIT_COMMAND.test(command) && !/\bcommit\s+(-\S+\s+)*--dry-run\b/.test(command)
}

type Todo = { status?: unknown }

function completed(list: unknown): number {
  return Array.isArray(list) ? list.filter((t: Todo) => t?.status === 'completed').length : 0
}

/**
 * The signals one successful tool call gives. `input` is the call's input
 * and `result` the tool's own record, both as the engine hands them over.
 */
export function signalsFor(tool: string, input: unknown, result: unknown): Signal[] {
  const args = (input ?? {}) as Record<string, unknown>
  const record = (result ?? {}) as Record<string, unknown>

  if (EDIT_TOOLS.has(tool)) return ['edit']
  if (tool === 'Write') return [record.type === 'create' ? 'create' : 'edit']
  if (READ_TOOLS.has(tool)) return ['read']
  // Handing work to a subagent is planning, and counts as thinking.
  if (tool === 'Agent' || tool === 'Task') return ['think']

  if (tool === 'Bash') {
    if (record.interrupted === true || record.backgroundTaskId !== undefined) return []
    const command = typeof args.command === 'string' ? args.command : ''
    const signals: Signal[] = []
    if (isTestCommand(command)) signals.push('test')
    if (isCommitCommand(command)) signals.push('commit')
    return signals
  }

  if (tool === 'TodoWrite') {
    const delta = completed(record.newTodos ?? args.todos) - completed(record.oldTodos)
    return Array.from({ length: Math.max(0, Math.min(delta, 5)) }, () => 'task' as const)
  }

  if (tool === 'TaskUpdate') {
    const change = record.statusChange as { to?: unknown } | undefined
    const isDone = change ? change.to === 'completed' : args.status === 'completed' && record.success === true
    return isDone ? ['task'] : []
  }

  return []
}

/**
 * Whether a row the conversation keeps is a response in which the model
 * thought before answering: an assistant row holding a thinking block.
 */
export function hasThinking(door: string, content: unknown): boolean {
  if (door !== 'response' || !Array.isArray(content)) return false
  return content.some(
    (block: { type?: unknown }) => block?.type === 'thinking' || block?.type === 'redacted_thinking',
  )
}
