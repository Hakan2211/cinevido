/** The Audio lab's tabs, passed through to each tab's <LabPanel>. */

export type AudioTab = 'music' | 'voice' | 'sfx'

export const AUDIO_TABS: ReadonlyArray<{ value: AudioTab; label: string }> = [
  { value: 'music', label: 'Music' },
  { value: 'voice', label: 'Voice' },
  { value: 'sfx', label: 'SFX' },
]

export interface AudioPanelTabs {
  tabs: typeof AUDIO_TABS
  tab: AudioTab
  onTabChange: (tab: AudioTab) => void
}
