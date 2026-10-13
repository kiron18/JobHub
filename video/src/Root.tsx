import React from 'react';
import { Composition } from 'remotion';
import { Walkthrough, chapterFrames, FPS, LANDSCAPE, PORTRAIT, type Chapter, type Layout } from './Walkthrough';
import { diagnosis } from './diagnosis';
import { application } from './application';
import { outreach } from './outreach';
import { diagnosis as diagnosisV } from './vertical/diagnosis';
import { application as applicationV } from './vertical/application';
import { outreach as outreachV } from './vertical/outreach';

// The vertical cuts are their own chapters, not the landscape ones reframed:
// they are filmed on the phone layout, where the page is a different shape.
const CHAPTERS: Record<string, [Chapter, Layout]> = {
  Diagnosis: [diagnosis, LANDSCAPE], Application: [application, LANDSCAPE], Outreach: [outreach, LANDSCAPE],
  DiagnosisVertical: [diagnosisV, PORTRAIT], ApplicationVertical: [applicationV, PORTRAIT], OutreachVertical: [outreachV, PORTRAIT],
};

// The chapter is bound into the component, not passed as defaultProps: Remotion
// serialises props to JSON, which silently drops the overlay functions a
// chapter can carry.
const bound = Object.fromEntries(
  Object.entries(CHAPTERS).map(([id, [chapter, layout]]) => [id, (() => <Walkthrough chapter={chapter} layout={layout} />) as React.FC]),
);

export const Root: React.FC = () => (
  <>
    {Object.entries(CHAPTERS).map(([id, [chapter, layout]]) => (
      <Composition
        key={id}
        id={id}
        component={bound[id]}
        durationInFrames={chapterFrames(chapter)}
        fps={FPS}
        width={layout.w}
        height={layout.h}
      />
    ))}
  </>
);
