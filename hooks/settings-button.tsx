// The Settings button as a Client on the desktop: it tells the hooks module
// when the pointer rests on it, so the scene can hold still under it.

import type { ClientModule } from 'claude-code'

type Props = { label: string }

const SettingsButton: ClientModule<Props, true> = (props, surface) => {
  if (surface.state === undefined) {
    surface.onPointer(event => {
      if (event.type === 'enter') surface.post({ type: 'hover', on: true })
      else if (event.type === 'leave') surface.post({ type: 'hover', on: false })
      else if (event.type === 'up' && event.button !== 'right') surface.post({ type: 'open' })
    })
    surface.setState(true)
  }
  const { Button } = surface.elements
  return <Button key="open" label={props.label} onPress={() => surface.post({ type: 'open' })} />
}

export default SettingsButton
