// WorkVillage's $.state contract: the values its drawings read.

/** How the band was left this session. */
export type WorkvillageBand = 'shown' | 'hidden'

declare module 'claude-code' {
  interface PluginState {
    workvillage: {
      /** Whether the band above the prompt is hidden this session. */
      isHidden: boolean
      /** Bumped whenever the village changes, so text and vector views redraw. */
      revision: number
      /** The animation frame vector surfaces redraw on; only scene drawings read it. */
      frame: number
    }
  }
}
