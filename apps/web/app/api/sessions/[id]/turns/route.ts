import { addTurn, PipelineError } from '../../../../../lib/pipeline/pipeline';
import { body, handle, keys } from '../../../_http';
import type { RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    const value = await body(request); keys(value, ['text', 'inputMode']);
    if (typeof value.text !== 'string') throw new PipelineError('text must be a string', 'bad_request');
    if (value.inputMode !== undefined && !['text', 'voice'].includes(String(value.inputMode))) throw new PipelineError('Invalid inputMode', 'bad_request');
    return addTurn((await context.params).id, value.text, value.inputMode as 'text' | 'voice' | undefined);
  }, 200, request);
}
