export interface IQueryHandler<TRequest = unknown, TResponse = unknown> {
  handle(query: TRequest): Promise<TResponse>;
}
