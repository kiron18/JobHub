import { it } from 'vitest';
import * as fs from 'fs';
import { scoreThemes } from './src/services/answerBank/coverage';
const BAD_WEEK = `
It was the week before the end of financial year and two people were off sick.
I was meant to be doing reporting but the whole thing went wrong when the client
changed the brief on the Wednesday. I had to drop the reporting and tell my
manager it would be late. The problem was nobody had told the design team, so I
rang them myself and we rebuilt it over two days. In the end we got it out on
time but I learned to check the brief was locked before I started building.
`;
it('dump', () => {
  fs.writeFileSync('themes-out.txt', JSON.stringify(scoreThemes(BAD_WEEK), null, 1));
});
