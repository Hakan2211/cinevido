/**
 * How long a lab prompt may be. The prompt box and the server schemas share
 * these, so the box never lets through more than the server accepts.
 *
 * Image models take long prompts (GPT Image and Seedream read several
 * thousand words). Some video models cap lower; fal rejects an over-long
 * prompt before it runs, so nothing is billed.
 */
export const PROMPT_MAX = 20_000

/** Motion Control: the motion comes from the clip, the prompt only steers style */
export const MOTION_PROMPT_MAX = 2_500
