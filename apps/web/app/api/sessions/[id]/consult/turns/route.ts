import { addConsultTurn, consultMode } from '../../../../../../lib/pipeline/consult';
import { PipelineError } from '../../../../../../lib/pipeline/pipeline';
import { body, handle, keys, type RouteContext } from '../../../../_http';
export { OPTIONS } from '../../../../_http';
export const runtime = 'nodejs';
export async function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    const value = await body(request); keys(value, ['speaker', 'text', 'mode', 'clientTurnId']);
    if (value.speaker !== 'patient' && value.speaker !== 'clinician') throw new PipelineError('Invalid speaker', 'bad_request');
    if (typeof value.text !== 'string' || (value.clientTurnId !== undefined && typeof value.clientTurnId !== 'string')) throw new PipelineError('Invalid consult utterance', 'bad_request');
    return addConsultTurn((await context.params).id, { speaker: value.speaker, text: value.text, mode: consultMode(value.mode), clientTurnId: value.clientTurnId as string | undefined });
  }, 200, request);
}
