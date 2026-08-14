/**
 * The follow-up email for one application.
 *
 * Returns the filled template immediately so the modal has something the moment
 * it opens, then replaces it with a version written against this application's
 * cover letter once that comes back. The template is the floor, never a
 * blocking state: a generic follow-up the candidate can send now beats a
 * spinner, and if the call fails they never find out it was attempted.
 *
 * The generated version exists because the template said nothing about the
 * candidate. Same role, same employer, same two sentences for every client, and
 * a follow-up that could have been sent by anyone is one the reader has no
 * reason to act on.
 */
import { useQuery } from '@tanstack/react-query';
import api from './api';
import {
    assembleFollowUp,
    renderTemplate,
    type JobContextLite,
    type RenderedEmail,
    type UserProfileLite,
} from './emailTemplates';

export interface FollowUpEmail extends RenderedEmail {
    /** True while the personalised version is still being written. */
    loading: boolean;
    /** True once the copy on screen is grounded on their own cover letter. */
    personalised: boolean;
}

export function useFollowUpEmail(
    job: JobContextLite & { id: string },
    profile: UserProfileLite | undefined,
): FollowUpEmail {
    const { data, isLoading } = useQuery({
        queryKey: ['follow-up-email', job.id],
        queryFn: async () =>
            (await api.post('/analyze/follow-up-email', { jobApplicationId: job.id })).data,
        // An application's cover letter does not change, so this is worth
        // holding for the session rather than rewriting on every reopen.
        staleTime: 60 * 60 * 1000,
        retry: false,
    });

    const generated = typeof data?.body === 'string' && data.body.trim().length > 0
        ? data.body
        : null;

    if (generated) {
        return { ...assembleFollowUp(job, profile, generated), loading: false, personalised: true };
    }

    return {
        ...renderTemplate('application-followup', job, profile),
        loading: isLoading,
        personalised: false,
    };
}
