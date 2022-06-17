import * as http from "http";

type SendParams = {
  statusCode: number;
  headers?: http.IncomingHttpHeaders;
  data?: Buffer | string;
  end?: Buffer | string;
};

type Send<Params = SendParams> = (
  response: http.ServerResponse
) => (params: Params) => void;

export const send: Send = (response) => (params) => {
  response.writeHead(params.statusCode, params.headers);
  if (params.data) response.write(params.data);
  response.end(params.end);
};

export type AttachedResponse = {
  empty: SendWithAttachedResponse;
  ok: SendWithAttachedResponse;
  badRequest: SendWithAttachedResponse;
  unauthorized: SendWithAttachedResponse;
  notFound: SendWithAttachedResponse;
  serviceUnavailable: SendWithAttachedResponse;
};

type SendWithAttachedResponse = (params?: Partial<SendParams>) => void;

export const attachResponse = (
  response: http.ServerResponse
): AttachedResponse => ({
  empty: (params) => send(response)({ statusCode: 400, ...params }),
  ok: sendOk(response),
  badRequest: sendBadRequest(response),
  unauthorized: sendUnauthorized(response),
  notFound: sendNotFound(response),
  serviceUnavailable: sendServiceUnavailable(response),
});

type SendWithCode = Send<Partial<SendParams> | void>;

export const sendOk: SendWithCode = (response) => (params) =>
  send(response)({ statusCode: 200, ...params });

export const sendBadRequest: SendWithCode = (response) => (params) =>
  send(response)({ statusCode: 400, end: "Bad request", ...params });

export const sendUnauthorized: SendWithCode = (response) => (params) =>
  send(response)({ statusCode: 401, end: "Unauthorized", ...params });

export const sendNotFound: SendWithCode = (response) => (params) =>
  send(response)({ statusCode: 404, end: "Not found", ...params });

export const sendServiceUnavailable: SendWithCode = (response) => (params) =>
  send(response)({ statusCode: 503, end: "Service unavailable", ...params });
