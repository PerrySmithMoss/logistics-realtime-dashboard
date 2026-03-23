export interface ICommandHandler<TRequest = unknown, TResponse = unknown> {
  handler(request: TRequest): Promise<TResponse>;
}
