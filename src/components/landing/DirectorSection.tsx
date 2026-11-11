import {
  CheckCircle2,
  Clapperboard,
  Film,
  ListChecks,
  MessageSquareText,
} from 'lucide-react'

/**
 * How the Director turns a brief into a film — the production loop from
 * src/lib/production.ts, in five steps.
 */
const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Brief',
    body: 'Describe the film in a sentence or two: "a 30-second ad for a coffee brand".',
  },
  {
    icon: ListChecks,
    title: 'Priced plan',
    body: 'The Director writes a shot list with a model and a cost per shot, inside the budget you set.',
  },
  {
    icon: Film,
    title: 'Drafts',
    body: 'Every shot renders as a cheap draft. An AI check flags drafts that miss the brief.',
  },
  {
    icon: CheckCircle2,
    title: 'Review',
    body: 'Keep, retry or promote each shot. Nothing expensive runs until you say so.',
  },
  {
    icon: Clapperboard,
    title: 'Finals & timeline',
    body: 'Kept shots re-render on a Hero model and land on the timeline in order, with voice and music.',
  },
]

export function DirectorSection() {
  return (
    <section id="director" className="border-t border-border py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
            The Director
          </p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight md:text-4xl">
            From one sentence to a cut, without losing control of the bill
          </h2>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <step.icon className="h-5 w-5 text-primary" />
                <span className="text-xs tabular-nums text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
