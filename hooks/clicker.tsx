// A transparent region laid over the village: it draws nothing and tells
// the hooks module when the village is clicked.

import type { ClientModule } from 'claude-code'

const Clicker: ClientModule<null, true> = (_props, surface) => {
  if (surface.state === undefined) {
    surface.onPointer(event => {
      if (event.type === 'up' && event.button !== 'right') surface.post({ type: 'toggle' })
    })
    surface.setState(true)
  }
  const { Box } = surface.elements
  return <Box width="100%" height="100%" />
}

export default Clicker
