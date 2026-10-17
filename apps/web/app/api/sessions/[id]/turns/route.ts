import { addTurn, PipelineError, TURN_TIMEOUT_MS } from '../../../../../lib/pipeline/pipeline';
import { body, handle, keys } from '../../../_http';
import type { RouteContext } from '../../../_http';
export { OPTIONS } from '../../../_http';
export const runtime = 'nodejs';
export async function POST(request: Request, context: RouteContext) {
  const response = await handle(async () => {
    const value = await body(request); keys(value, ['text', 'inputMode', 'clientTurnId']);
    if (typeof value.text !== 'string') throw new PipelineError('text must be a string', 'bad_request');
    if (value.inputMode !== undefined && !['text', 'voice'].includes(String(value.inputMode))) throw new PipelineError('Invalid inputMode', 'bad_request');
    if (value.clientTurnId !== undefined && (typeof value.clientTurnId !== 'string' || !value.clientTurnId.trim() || value.clientTurnId.length > 200)) throw new PipelineError('Invalid clientTurnId', 'bad_request');
    return addTurn((await context.params).id, value.text, value.inputMode as 'text' | 'voice' | undefined, value.clientTurnId as string | undefined);
  }, 200, request);
  response.headers.set('x-medx-timeout-ms', String(TURN_TIMEOUT_MS));
  response.headers.set('Access-Control-Expose-Headers', 'x-medx-timeout-ms');
  return response;
}
