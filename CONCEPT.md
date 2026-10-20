# Site concept

**What it is.** A working engineer's lab notebook made public. Each project is a case study:
a question, a method, results you can see, a link to the code. The reader should leave
thinking: this person understands dynamics, estimation and learning deeply, and can explain them.

**What it is not.** Not a template portfolio (no skill bars, no stock art, no "welcome to my
webpage"). Not a blog that needs weekly posts. Not a demo of web tricks: every animation
carries meaning.

**Signature idea.** The site is itself a controlled system. The hero is a live pendulum running
the same equations as Pendulum Lab chapter 1. Drag it, flick it, watch the phase portrait draw
itself, then switch the controller on and watch it swing up and balance.

**Visitors.**
- Recruiter, 30 s: hero, one line, three featured projects, CV button always visible.
- Engineer, 10 min: opens a case study, reads, plays with figures, follows the code link.
- Collaborator: finds email, LinkedIn, GitHub in the footer of every page.

**Structure.** Home · Projects (filterable index) · Project pages (long form, side chapter nav)
· About (story, web CV, PDF download, publications) · Playground (later).

**Look.** Near-black background so Pendulum Lab's Manim-style figures blend in. Accent blue
`#58C4DD`, secondary yellow `#F7D96F`, teal `#5CD0B3`, red `#FC6255`. IBM Plex Sans for text,
IBM Plex Mono for numbers, labels and equations' surroundings. Light mode available.

**Stack.** Astro 5 + MDX, KaTeX (server-rendered), hand-written CSS with design tokens, vanilla
TypeScript canvas simulations, GitHub Actions → GitHub Pages.
