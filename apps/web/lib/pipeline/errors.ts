/** Expected request failure with an HTTP status. Lives here (not in pipeline.ts) so order/role modules can use it without an import cycle. */
export class PipelineError extends Error {
  constructor(message: string, public code: 'bad_request' | 'not_found', public status?: number) { super(message); }
}
