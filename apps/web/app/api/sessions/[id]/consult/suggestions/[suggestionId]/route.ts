import { reviewConsultSuggestion } from '../../../../../../../lib/pipeline/consult';
import { PipelineError } from '../../../../../../../lib/pipeline/pipeline';
import { body, handle, keys } from '../../../../../_http';
export { OPTIONS } from '../../../../../_http';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string; suggestionId: string }> }) {
  return handle(async () => {
    const value = await body(request); keys(value, ['reviewerId', 'status']);
    if (typeof value.reviewerId !== 'string' || (value.status !== 'asked' && value.status !== 'dismissed')) throw new PipelineError('Invalid suggestion review', 'bad_request');
    const { id, suggestionId } = await context.params;
    return reviewConsultSuggestion(id, suggestionId, value.reviewerId, value.status);
  }, 200, request);
}
