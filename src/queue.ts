// One active render, one replaceable pending request. Invalidating immediately
// (before debounce) prevents a stale completion from reaching the preview.
export class LatestQueue<I, O> {
  private revision = 0
  private active = false
  private pending?: { input: I; revision: number }
  private render: (input: I) => Promise<O>
  private done: (input: I, result: O) => void
  private fail: (error: unknown) => void
  constructor(render: (input: I) => Promise<O>, done: (input: I, result: O) => void, fail: (error: unknown) => void) {
    this.render = render; this.done = done; this.fail = fail
  }
  invalidate() { this.pending = undefined; return ++this.revision }
  async submit(input: I, revision: number) {
    if (revision !== this.revision) return
    this.pending = {input, revision}
    if (this.active) return
    this.active = true
    try {
      while (this.pending) {
        const job = this.pending
        this.pending = undefined
        try {
          const result = await this.render(job.input)
          if (job.revision === this.revision) this.done(job.input, result)
        } catch (error) { if (job.revision === this.revision) this.fail(error) }
      }
    } finally { this.active = false }
  }
}
