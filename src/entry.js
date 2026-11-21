import { CASES } from './fixtures.js';
import { esc } from './ui.js';

export function entryHTML() {
  const labels = { cyber: 'Cybersecurity career', car: 'Gas for your commute', yen: 'Tuition in yen' };
  const choices = CASES.map(c =>
    `<li><button type="button" data-action="pick" data-case="${c.id}">
      <span class="sample-title">${labels[c.id]}</span>
      <span class="sample-prompt">${esc(c.samplePrompt)}</span>
      <span class="sample-next" aria-hidden="true">&#8599;</span>
    </button></li>`).join('');
  return `<section class="entry" aria-labelledby="entry-title">
    <div class="entry-hero">
      <div class="entry-copy">
        <h1 id="entry-title" data-step-heading tabindex="-1">How much could a money setback cost you?</h1>
        <p>Pick a real-life scenario, try your own numbers, and see whether a hedge could cover some of the loss. A hedge is a way to offset a loss if things go against you.</p>
      </div>
      <figure class="offset-example" aria-labelledby="example-title">
        <figcaption id="example-title">Example: Your tuition bill gets more expensive</figcaption>
        <dl>
          <div><dt>Extra cost without a hedge</dt><dd>$800</dd></div>
          <div class="example-offset"><dt>Extra cost after buying some yen early</dt><dd>$600</dd></div>
        </dl>
        <p><strong>$200</strong> of the extra cost covered</p>
      </figure>
    </div>
    <section class="scenario-picker" aria-labelledby="picker-title">
      <h2 id="picker-title">Choose a scenario</h2>
      <ul class="samples">${choices}</ul>
    </section>
    <p class="demo-note">This is a simulation. No account or real trades.</p>
  </section>`;
}
