import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'housekeeping', description: 'Pending work in one place: map, check, init.' })
    return next(e)
  })
  on('command.run', { command: 'housekeeping' }, async () => ({
    text: 'housekeeping: map | check | init (more in later phases)',
  }))
}
