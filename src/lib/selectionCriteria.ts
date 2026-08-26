/**
 * Does this ad want a selection criteria response?
 *
 * Government, university and NFP ads say so in words, and they say it in a
 * small number of ways. Detection is the easy half and this is it. Getting the
 * criteria themselves is the hard half: they usually live in a separate
 * position description document, which is why the flow asks the candidate to
 * fetch them rather than trying to scrape them out of the ad.
 *
 * Lives here rather than in a page so the dashboard, the fit check and the
 * stepper all read the ad the same way.
 */
export const SELECTION_CRITERIA_PATTERN =
  /selection criteria|key selection criteria|statement of claims|address the following criteria|capability statement|response to the criteria/i;

export function jdMentionsSelectionCriteria(jd: string): boolean {
  return SELECTION_CRITERIA_PATTERN.test(jd || '');
}
