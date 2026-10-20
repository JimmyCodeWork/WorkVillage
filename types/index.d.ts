// WorkVillage's $.state contract: the values its drawings read.

/** How the band was left this session. */
export type WorkvillageBand = 'shown' | 'hidden'

/** What the settings pane's data section shows: export and import. */
export type WorkvillageTransfer = {
  /** A message key of the plugin's, said under the data buttons; empty for nothing. */
  notice: string
  /** The values that message fills in. */
  values: Record<string, string | number>
  /** An export code to copy by hand, when the clipboard did not take it. */
  shown: string
  /** A pasted import code, read and waiting to be confirmed. */
  pending: string
}

declare module 'claude-code' {
  interface PluginState {
    workvillage: {
      /** Whether the band above the prompt is hidden this session. */
      isHidden: boolean
      /** Bumped whenever the village changes, so text and vector views redraw. */
      revision: number
      /** The animation frame vector surfaces redraw on; only scene drawings read it. */
      frame: number
      /** Settings chosen in the settings pane this session, by field. */
      chosen: Record<string, string>
      /** The data section of the settings pane. */
      transfer: WorkvillageTransfer
    }
  }
}
