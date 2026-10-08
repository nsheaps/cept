// lint-as: packages/ui/src/components/App.tsx
// expect: cept/restricted-imports "isomorphic-git/http/web"
// App.tsx is baselined for four isomorphic-git/http/web imports; a fifth must still fail.
import http1 from 'isomorphic-git/http/web';
import http2 from 'isomorphic-git/http/web';
import http3 from 'isomorphic-git/http/web';
import http4 from 'isomorphic-git/http/web';
import http5 from 'isomorphic-git/http/web';

export const clients = [http1, http2, http3, http4, http5];
