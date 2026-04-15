import { IDL } from '@dfinity/candid';

export const idlFactory = ({ IDL }) => {
  const HttpRequest = IDL.Record({
    method: IDL.Text,
    url: IDL.Text,
    headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    body: IDL.Vec(IDL.Nat8),
  });

  const HttpResponse = IDL.Record({
    status_code: IDL.Nat16,
    headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    body: IDL.Vec(IDL.Nat8),
    streaming_strategy: IDL.Opt(IDL.Text),
    upgrade: IDL.Opt(IDL.Bool),
  });

  return IDL.Service({
    list_namespaces:      IDL.Func([], [IDL.Text], ['query']),
    list_files:           IDL.Func([IDL.Text], [IDL.Text], ['query']),
    get_file:             IDL.Func([IDL.Text], [IDL.Text], ['query']),
    get_stats:            IDL.Func([], [IDL.Text], ['query']),
    get_acl:              IDL.Func([], [IDL.Text], ['query']),
    store_file:           IDL.Func([IDL.Text], [IDL.Text], []),
    store_file_chunk:     IDL.Func([IDL.Text], [IDL.Text], []),
    finalize_chunked_file: IDL.Func([IDL.Text], [IDL.Text], []),
    delete_file:          IDL.Func([IDL.Text], [IDL.Text], []),
    update_namespace:     IDL.Func([IDL.Text], [IDL.Text], []),
    delete_namespace:     IDL.Func([IDL.Text], [IDL.Text], []),
    grant_publish:        IDL.Func([IDL.Text], [IDL.Text], []),
    revoke_publish:       IDL.Func([IDL.Text], [IDL.Text], []),
    http_request:         IDL.Func([HttpRequest], [HttpResponse], ['query']),
  });
};
