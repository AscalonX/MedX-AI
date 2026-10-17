import type { RedFlagReviewAction, ReviewAction } from '@medx/shared';
import { PipelineError, review } from '../../../../../lib/pipeline/pipeline';
import { object } from '../../../../../lib/pipeline/schema';
import { body, handle, keys } from '../../../_http';
import type { RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    const value = await body(request); keys(value, ['reviewerId', 'actions', 'redFlagActions']);
    if (typeof value.reviewerId !== 'string' || !Array.isArray(value.actions) || value.actions.length > 24 || !value.actions.every(a => object(a) && typeof a.fieldKey === 'string' && typeof a.action === 'string' && (a.newValue === undefined || typeof a.newValue === 'string') && Object.keys(a).every(k => ['fieldKey', 'action', 'newValue'].includes(k))) || (value.redFlagActions !== undefined && (!Array.isArray(value.redFlagActions) || value.redFlagActions.length > 18 || !value.redFlagActions.every(a => object(a) && typeof a.ruleId === 'string' && typeof a.action === 'string' && (a.note === undefined || typeof a.note === 'string') && Object.keys(a).every(k => ['ruleId', 'action', 'note'].includes(k)))))) throw new PipelineError('Invalid review body', 'bad_request');
    return review((await context.params).id, value.reviewerId, value.actions as ReviewAction[], value.redFlagActions as RedFlagReviewAction[] | undefined);
  }, 200, request);
}
