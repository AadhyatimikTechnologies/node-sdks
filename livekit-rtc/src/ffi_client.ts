import { FfiRequest, FfiResponse, FfiEvent } from './proto/ffi_pb';
import EventEmitter from 'events';
import TypedEmitter from 'typed-emitter';
import {
  FfiHandle,
  livekitFfiRequest,
  livekitInitialize,
  livekitCopyBuffer,
  livekitRetrievePtr,
} from './native';

export { FfiHandle, FfiEvent, FfiResponse, FfiRequest };

export type FfiClientCallbacks = {
  ffi_event: (event: FfiEvent) => void;
};

export enum FfiClientEvent {
  FfiEvent = 'ffi_event',
}

export class FfiClient extends (EventEmitter as new () => TypedEmitter<FfiClientCallbacks>) {
  static _client?: FfiClient;

  /** @internal */
  static get instance(): FfiClient {
    if (!FfiClient._client) FfiClient._client = new FfiClient();

    return FfiClient._client;
  }

  constructor() {
    super();

    livekitInitialize((event_data: Uint8Array) => {
      let event = FfiEvent.fromBinary(event_data);
      this.emit(FfiClientEvent.FfiEvent, event);
    }, true);
  }

  request<T>(req: FfiRequest): T {
    let req_data = req.toBinary();
    let res_data = livekitFfiRequest(req_data);
    return FfiResponse.fromBinary(res_data).message.value as T;
  }

  copyBuffer(ptr: bigint, len: number): Uint8Array {
    return livekitCopyBuffer(ptr, len);
  }

  retrievePtr(data: Uint8Array): bigint {
    return livekitRetrievePtr(data);
  }

  async waitFor<T>(predicate: (ev: FfiEvent) => boolean): Promise<T> {
    return new Promise<T>((resolve, _) => {
      let listener = (ev: FfiEvent) => {
        if (predicate(ev)) {
          this.off(FfiClientEvent.FfiEvent, listener);
          resolve(ev.message.value as T);
        }
      };
      this.on(FfiClientEvent.FfiEvent, listener);
    });
  }
}
