/**
 * Shared building blocks for the Generate labs (video, image, …).
 * Layout follows mockup 3 (docs/design/mockups/03-generate-lab.jpg).
 */

export { Field, FieldError, Meta, Segmented } from './Field'
export { ModelRadioList, type RadioModel } from './ModelRadioList'
export { FrameSlot, EmptyImageDrop, type SlotImage } from './FrameSlot'
export {
  LabShell,
  LabPanel,
  LabResults,
  GenerateButton,
  PromptBox,
} from './LabLayout'
export { ResultCard, PendingCard, type CardAction } from './ResultCard'
export { ImagePickerDialog } from './ImagePickerDialog'
export { AspectCards } from './AspectCards'
export { VideoPickerDialog, type PickedVideo } from './VideoPickerDialog'
