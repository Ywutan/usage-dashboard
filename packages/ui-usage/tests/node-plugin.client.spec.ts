/** ui-usage node half: mounting the Web feature adds no Host effect. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

describe('ui-usage node plugin', () => {
  it('mounts without adding services', async () => {
    const ctx = new Context()
    await ctx.plugin({ apply }).await()
    // The dashboard is browser-only presentation over the Host workspace
    // controller; the node half must not register anything model-visible.
    expect((ctx as unknown as Record<string, unknown>).workspaceController).toBeUndefined()
    await ctx.fiber.dispose()
  })
})
